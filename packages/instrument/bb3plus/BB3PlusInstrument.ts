import net from "net";
// mobx only to follow the state of the Studio instrument (its connection)
import { autorun, IReactionDisposer } from "mobx";

import type { InstrumentObject } from "instrument/instrument-object";

import {
    PushFrameParser,
    FRAME_HEADER_SIZE,
    FRAME_SCPI_OUTPUT,
    FRAME_SCPI_DONE,
    FRAME_LOG,
    FRAME_DROPPED,
    FRAME_FIELD_CATALOG,
    FRAME_FIELD_VALUES,
    FRAME_SAMPLES,
    FRAME_SAMPLES_RANGE,
    parseScpiDone,
    parseDropped,
    parseSamples,
    parseSamplesRange,
    formatScpiErrors,
    MAX_SAMPLE_SUBSCRIPTIONS
} from "instrument/bb3plus/push-protocol";
import {
    ModuleFields,
    FieldInfo,
    isFieldFloat,
    isFieldSampled
} from "instrument/bb3plus/fields-model";
import {
    LogRecord,
    LogFilter,
    DEFAULT_LOG_FILTER,
    DEFAULT_LOG_LEVEL,
    MAX_LOG_RECORDS,
    parseLogRecord
} from "instrument/bb3plus/log-model";
import { SampleBuffer } from "instrument/bb3plus/sample-buffer";

// samples per second asked for: BB3+ samples at least this fast, up to the
// max sample rate of each field
export const SCOPE_RATES = [100, 1000, 10000, 16000, 32000, 64000, 128000];
export const SCOPE_SPANS = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60];
const DEFAULT_RATE = 10000;
const DEFAULT_SPAN = 1;

export const FIELDS_INTERVALS = [50, 100, 250, 1000];
const DEFAULT_FIELDS_INTERVAL = 250;

const TRACE_COLORS = [
    "#f5c211",
    "#2ec27e",
    "#3584e4",
    "#e66100",
    "#c061cb",
    "#33c7de",
    "#e01b24",
    "#98c379"
];

// a new connection to the push port after this long, if it failed or was
// closed while the instrument is connected
const RECONNECT_DELAY = 3000;

// the "fields" change is sent at most this often (ms); the "log" change is
// sent after each data received with log records, the view draws them in
// the next frame
const UPDATE_INTERVAL = 100;

// the settings are saved this long after the last change (ms)
const SAVE_SETTINGS_DELAY = 500;

// the oldest log records go in batches of this many, not one by one from
// the start of a long array
const LOG_TRIM_BATCH = 10000;

export type PushState = "idle" | "connecting" | "connected" | "error";

// what changed, the views listen for them:
//     status  the instrument and push port connection, the errors, the
//             dropped counts
//     fields  the catalogs, the values, the fields settings
//     log     the records, the log settings
//     scope   the traces, run/stop, the scope settings
export type BB3PlusChange = "status" | "fields" | "log" | "scope";

interface PendingCommand {
    command: string;
    output: string;
    resolve: (result: { output: string; errors: number[] }) => void;
}

interface TraceSettings {
    slot: number;
    fieldName: string;
}

// the scale of a Y axis of the scope:
//     full   the full range of the fields (ScopeTrace.fullRange), auto if
//            it isn't known
//     auto   fits the values shown
//     grow   fits the values shown since it was set (or restarted), it only
//            grows
//     fixed  from min to max
export type ScopeAxisMode = "full" | "auto" | "grow" | "fixed";

export interface ScopeAxisSettings {
    mode: ScopeAxisMode;
    // fixed: the range shown (set by the mouse zoom too)
    min: number;
    max: number;
    // the range typed in last, Fixed starts from it, undefined if none
    enteredMin?: number;
    enteredMax?: number;
    // auto and grow: 0 is always in the range
    includeZero: boolean;
}

export const DEFAULT_AXIS_SETTINGS: ScopeAxisSettings = {
    mode: "full",
    min: 0,
    max: 1,
    includeZero: false
};

// the font sizes of the values at the cursor (px)
export const READOUT_SIZES = [
    { value: 12, label: "Small" },
    { value: 15, label: "Medium" },
    { value: 19, label: "Large" },
    { value: 25, label: "Extra large" }
];
const DEFAULT_READOUT_SIZE = 15;

interface Settings {
    logLevel: number;
    logFilter: LogFilter;
    fieldsInterval: number;
    fieldsFilter: string;
    scopeRate: number;
    scopeSpan: number;
    scopeTraces: TraceSettings[];
    // the scales of the Y axes: "unit<unit>" of the float fields, "bits" of
    // the integer fields
    scopeAxes: { [key: string]: ScopeAxisSettings };
    scopeReadoutSize: number;
    scopeShowOptions: boolean;
}

export class ScopeTrace {
    // the field index in the catalog of the slot, -1 if the module in the
    // slot doesn't have the field (now)
    fieldIndex = -1;
    unit = 255;
    // an integer field, drawn as steps in the lower plot
    bits = false;
    // the full range of the values (FRAME_SAMPLES_RANGE, it comes with
    // the samples), undefined if not known
    fullRange: { min: number; max: number } | undefined;
    buffer = new SampleBuffer();
    // period of the subscription sent, 0 if not subscribed
    subscribedPeriod = 0;

    constructor(
        public slot: number,
        public fieldName: string,
        public color: string
    ) {}

    get label() {
        return `${this.slot}: ${this.fieldName}`;
    }

    get key() {
        return `${this.slot}:${this.fieldName}`;
    }
}

export class BB3PlusInstrument {
    pushState: PushState = "idle";
    pushError: string | undefined;

    fieldsError: string | undefined;
    logError: string | undefined;
    samplesError: string | undefined;
    setFieldError: string | undefined;

    // dropped by BB3+ since the subscriptions started
    droppedLogRecords = 0;
    droppedSamples = 0;

    settings: Settings;

    fields = new ModuleFields();

    logRecords: LogRecord[] = [];
    // the categories of the records received
    logCategories = new Set<string>();
    private nextLogRecordId = 1;
    // the log records and their frame bytes received, never reset
    // (the rates are the differences)
    logRecordsReceived = 0;
    logBytesReceived = 0;

    traces: ScopeTrace[] = [];
    scopeRunning = true;
    // the end of the time window shown while the scope is stopped
    scopeStopTime = 0;
    // the zoom of the time: the seconds shown, undefined for the whole span;
    // the end of the window while stopped, undefined for the stop time
    // (while running the window ends at the newest sample)
    scopeViewSpan: number | undefined;
    scopeViewEnd: number | undefined;

    // the state of the Studio instrument, set by the autorun
    instrumentConnected = false;
    // the push port while the instrument is connected over Ethernet
    pushAddress: { host: string; port: number } | undefined;

    private listeners = new Map<BB3PlusChange, Set<() => void>>();

    private socket: net.Socket | undefined;
    private parser = new PushFrameParser();
    private pending: PendingCommand[] = [];
    private reconnectTimer: any;
    private updateTimer: any;
    private saveTimer: any;
    private fieldsChanged = false;
    private logChanged = false;

    // the subscriptions sent on this connection
    private subscribedLogLevel = 0;
    private subscribedFieldsInterval = 0;

    private disposers: IReactionDisposer[] = [];
    private terminated = false;

    constructor(public instrument: InstrumentObject) {
        this.settings = this.loadSettings();

        for (const traceSettings of this.settings.scopeTraces) {
            this.createTrace(traceSettings.slot, traceSettings.fieldName);
        }

        // the push port connection while the instrument is connected over
        // Ethernet
        this.disposers.push(
            autorun(() => {
                this.instrumentConnected = this.instrument.isConnected;
                const address = getPushAddress(this.instrument);
                if (
                    address?.host != this.pushAddress?.host ||
                    address?.port != this.pushAddress?.port
                ) {
                    this.pushAddress = address;
                    if (address) {
                        this.connectPush(address.host, address.port);
                    } else {
                        this.disconnectPush();
                    }
                }
                this.emit("status");
            })
        );
    }

    terminate() {
        this.terminated = true;
        for (const disposer of this.disposers) {
            disposer();
        }
        this.disposers = [];
        this.disconnectPush();
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = undefined;
        }
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = undefined;
            this.saveSettings();
        }
        this.listeners.clear();
    }

    ////////////////////////////////////////////////////////////////////////////
    // changes

    // the listener is called after each change, the returned function
    // removes it
    on(change: BB3PlusChange, listener: () => void) {
        let listeners = this.listeners.get(change);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(change, listeners);
        }
        listeners.add(listener);
        return () => {
            listeners!.delete(listener);
        };
    }

    private emit(change: BB3PlusChange) {
        const listeners = this.listeners.get(change);
        if (listeners) {
            for (const listener of Array.from(listeners)) {
                try {
                    listener();
                } catch (err) {
                    console.error(err);
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////
    // settings

    private get settingsKey() {
        return `instrument/${this.instrument.id}/bb3plus`;
    }

    private loadSettings(): Settings {
        let saved: any = {};
        try {
            saved = JSON.parse(localStorage.getItem(this.settingsKey) || "{}");
        } catch (err) {}
        return {
            logLevel:
                typeof saved.logLevel == "number"
                    ? saved.logLevel
                    : DEFAULT_LOG_LEVEL,
            logFilter: Object.assign(
                {},
                DEFAULT_LOG_FILTER,
                saved.logFilter ?? {}
            ),
            fieldsInterval:
                FIELDS_INTERVALS.indexOf(saved.fieldsInterval) != -1
                    ? saved.fieldsInterval
                    : DEFAULT_FIELDS_INTERVAL,
            fieldsFilter:
                typeof saved.fieldsFilter == "string" ? saved.fieldsFilter : "",
            scopeRate:
                SCOPE_RATES.indexOf(saved.scopeRate) != -1
                    ? saved.scopeRate
                    : DEFAULT_RATE,
            scopeSpan:
                SCOPE_SPANS.indexOf(saved.scopeSpan) != -1
                    ? saved.scopeSpan
                    : DEFAULT_SPAN,
            scopeTraces: Array.isArray(saved.scopeTraces)
                ? saved.scopeTraces.filter(
                      (trace: any) =>
                          typeof trace?.slot == "number" &&
                          typeof trace?.fieldName == "string"
                  )
                : [],
            scopeAxes: loadAxes(saved.scopeAxes),
            scopeReadoutSize: READOUT_SIZES.find(
                size => size.value == saved.scopeReadoutSize
            )
                ? saved.scopeReadoutSize
                : DEFAULT_READOUT_SIZE,
            scopeShowOptions: saved.scopeShowOptions === true
        };
    }

    private saveSettings() {
        try {
            localStorage.setItem(
                this.settingsKey,
                JSON.stringify(this.settings)
            );
        } catch (err) {}
    }

    private settingsChanged() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            this.saveSettings();
        }, SAVE_SETTINGS_DELAY);
    }

    setLogLevel(level: number) {
        this.settings.logLevel = level;
        this.settingsChanged();
        this.syncSubscriptions();
        this.emit("log");
    }

    setLogFilter(filter: LogFilter) {
        this.settings.logFilter = filter;
        this.settingsChanged();
        this.emit("log");
    }

    setFieldsInterval(interval: number) {
        this.settings.fieldsInterval = interval;
        this.settingsChanged();
        this.syncSubscriptions();
        this.emit("fields");
    }

    setFieldsFilter(filter: string) {
        this.settings.fieldsFilter = filter;
        this.settingsChanged();
        this.emit("fields");
    }

    ////////////////////////////////////////////////////////////////////////////
    // push port connection

    get isPushConnected() {
        return this.pushState == "connected";
    }

    private setPushState(state: PushState, error: string | undefined) {
        this.pushState = state;
        this.pushError = error;
        this.emit("status");
    }

    private connectPush(host: string, port: number) {
        this.disconnectPush();

        const socket = new net.Socket();
        this.socket = socket;

        socket.on("data", (data: Buffer) => {
            if (socket == this.socket) {
                this.onData(data);
            }
        });

        socket.on("error", (err: any) => {
            if (socket == this.socket) {
                // shown when it closes, right after
                this.pushError =
                    err.code == "ECONNREFUSED"
                        ? `Push port ${port} refused the connection`
                        : err.toString();
            }
        });

        socket.on("close", () => {
            if (socket == this.socket) {
                this.onPushClosed();
            }
        });

        this.setPushState("connecting", undefined);

        socket.connect(port, host, () => {
            if (socket == this.socket) {
                socket.setNoDelay(true);
                this.setPushState("connected", undefined);
                this.syncSubscriptions();
            }
        });
    }

    private onPushClosed() {
        this.socket?.removeAllListeners();
        this.socket?.destroy();
        this.socket = undefined;
        this.resetConnectionState();

        // again while the instrument is connected
        if (!this.reconnectTimer && !this.terminated) {
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = undefined;
                const address = this.pushAddress;
                if (address && !this.socket && !this.terminated) {
                    this.connectPush(address.host, address.port);
                }
            }, RECONNECT_DELAY);
        }

        this.setPushState(
            "error",
            this.pushError || "Push port connection closed"
        );
    }

    private disconnectPush() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.destroy();
            this.socket = undefined;
        }
        this.resetConnectionState();
        if (this.pushState != "idle") {
            this.setPushState("idle", undefined);
        }
    }

    private resetConnectionState() {
        this.parser.clear();
        for (const command of this.pending) {
            command.resolve({ output: "", errors: [] });
        }
        this.pending = [];
        this.subscribedLogLevel = 0;
        this.subscribedFieldsInterval = 0;
        for (const trace of this.traces) {
            trace.subscribedPeriod = 0;
        }
    }

    // a SCPI command line over the push port, its output and errors
    sendCommand(command: string) {
        return new Promise<{ output: string; errors: number[] }>(resolve => {
            if (!this.socket || this.pushState != "connected") {
                resolve({ output: "", errors: [-1] });
                return;
            }
            this.pending.push({ command, output: "", resolve });
            this.socket.write(command + "\n");
        });
    }

    private onData(data: Buffer) {
        this.parser.append(data);
        for (;;) {
            const frame = this.parser.next();
            if (!frame) {
                break;
            }
            this.onFrame(frame.type, frame.payload);
        }
        if (this.logChanged) {
            this.logChanged = false;
            this.emit("log");
        }
    }

    private onFrame(type: number, payload: Buffer) {
        if (type == FRAME_SCPI_OUTPUT) {
            if (this.pending.length > 0) {
                this.pending[0].output += payload.toString("utf8");
            }
        } else if (type == FRAME_SCPI_DONE) {
            const done = parseScpiDone(payload);
            const command = this.pending.shift();
            if (command) {
                command.resolve({
                    output: command.output,
                    errors: done ? done.errors : []
                });
            }
        } else if (type == FRAME_LOG) {
            const record = parseLogRecord(
                this.nextLogRecordId++,
                payload.toString("utf8")
            );
            this.logRecords.push(record);
            this.logCategories.add(record.cat);
            this.logRecordsReceived++;
            this.logBytesReceived += FRAME_HEADER_SIZE + payload.length;
            if (this.logRecords.length > MAX_LOG_RECORDS + LOG_TRIM_BATCH) {
                this.logRecords.splice(
                    0,
                    this.logRecords.length - MAX_LOG_RECORDS
                );
            }
            this.logChanged = true;
        } else if (type == FRAME_DROPPED) {
            const dropped = parseDropped(payload);
            this.droppedLogRecords += dropped.logRecords;
            this.droppedSamples += dropped.samples;
            this.emit("status");
        } else if (type == FRAME_FIELD_CATALOG) {
            const slot = this.fields.applyCatalog(payload.toString("utf8"));
            if (slot) {
                this.onCatalog(slot);
            }
            this.fieldsChanged = true;
            this.scheduleUpdate();
        } else if (type == FRAME_FIELD_VALUES) {
            this.fields.applyValues(payload, performance.now());
            this.fieldsChanged = true;
            this.scheduleUpdate();
        } else if (type == FRAME_SAMPLES_RANGE) {
            this.onSamplesRange(payload);
        } else if (type == FRAME_SAMPLES) {
            this.onSamples(payload);
        }
    }

    private scheduleUpdate() {
        if (this.updateTimer) {
            return;
        }
        this.updateTimer = setTimeout(() => {
            this.updateTimer = undefined;
            if (this.fieldsChanged) {
                this.fieldsChanged = false;
                this.emit("fields");
            }
        }, UPDATE_INTERVAL);
    }

    // the subscriptions of the connection as the settings and the scope
    // want them
    private async syncSubscriptions() {
        if (!this.isPushConnected) {
            return;
        }

        const logLevel = this.settings.logLevel;
        if (this.subscribedLogLevel != logLevel) {
            this.subscribedLogLevel = logLevel;
            const result = await this.sendCommand(`SUBScribe:LOG ${logLevel}`);
            this.logError =
                result.errors.length > 0
                    ? `SUBScribe:LOG failed: ${formatScpiErrors(result.errors)}`
                    : undefined;
            this.emit("status");
        }

        const fieldsInterval = this.settings.fieldsInterval;
        if (this.subscribedFieldsInterval != fieldsInterval) {
            this.subscribedFieldsInterval = fieldsInterval;
            const result = await this.sendCommand(
                `SUBScribe:FIELds ${fieldsInterval}`
            );
            this.fieldsError =
                result.errors.length > 0
                    ? `SUBScribe:FIELds failed: ${formatScpiErrors(
                          result.errors
                      )}`
                    : undefined;
            this.emit("status");
        }

        this.syncSampleSubscriptions();
    }

    // DEBUg:MODule:FIELd, the value as SCPI parameter
    async setModuleField(slot: number, field: FieldInfo, value: string) {
        const result = await this.sendCommand(
            `DEBUg:MODule:FIELd ${slot},"${field.name}",${value}`
        );
        this.setFieldError =
            result.errors.length > 0
                ? `Setting ${field.name} failed: ${formatScpiErrors(
                      result.errors
                  )}`
                : undefined;
        this.emit("status");
    }

    ////////////////////////////////////////////////////////////////////////////
    // log

    clearLog() {
        this.logRecords = [];
        this.logCategories = new Set();
        this.droppedLogRecords = 0;
        this.emit("log");
        this.emit("status");
    }

    ////////////////////////////////////////////////////////////////////////////
    // scope

    setScopeRate(rate: number) {
        this.settings.scopeRate = rate;
        this.settingsChanged();
        this.syncSampleSubscriptions();
        this.emit("scope");
    }

    get scopeSpan() {
        return this.settings.scopeSpan;
    }

    setScopeSpan(span: number) {
        this.settings.scopeSpan = span;
        this.settingsChanged();
        this.scopeViewSpan = undefined;
        this.scopeViewEnd = undefined;
        // while stopped the samples stay, the buffers are made again by Run
        if (this.scopeRunning) {
            for (const trace of this.traces) {
                trace.buffer.setSpan(this.getBufferSpan());
            }
        }
        this.emit("scope");
    }

    setScopeRunning(running: boolean) {
        if (!running) {
            this.scopeStopTime = this.getNewestSampleTime();
        } else {
            for (const trace of this.traces) {
                trace.buffer.setSpan(this.getBufferSpan());
            }
        }
        // the time zoom stays, the window ends at the stop time or at the
        // newest sample
        this.scopeViewEnd = undefined;
        this.scopeRunning = running;
        this.syncSampleSubscriptions();
        this.emit("scope");
    }

    // the time window shown: undefined span for the whole span, end only
    // while stopped
    setScopeView(span: number | undefined, end: number | undefined) {
        this.scopeViewSpan = span;
        this.scopeViewEnd = this.scopeRunning ? undefined : end;
        this.emit("scope");
    }

    getScopeAxis(key: string): ScopeAxisSettings {
        return this.settings.scopeAxes[key] ?? DEFAULT_AXIS_SETTINGS;
    }

    setScopeAxis(key: string, changes: Partial<ScopeAxisSettings>) {
        this.settings.scopeAxes = {
            ...this.settings.scopeAxes,
            [key]: { ...this.getScopeAxis(key), ...changes }
        };
        this.settingsChanged();
        this.emit("scope");
    }

    // the axes back to the default scale (the values typed in stay), all of
    // them if keys is undefined
    resetScopeAxes(keys?: string[]) {
        const axes = { ...this.settings.scopeAxes };
        for (const key of keys ?? Object.keys(axes)) {
            if (axes[key]) {
                axes[key] = { ...axes[key], mode: DEFAULT_AXIS_SETTINGS.mode };
            }
        }
        this.setScopeAxes(axes);
    }

    // all the axis settings, e.g. as they were before a drag
    setScopeAxes(axes: { [key: string]: ScopeAxisSettings }) {
        this.settings.scopeAxes = axes;
        this.settingsChanged();
        this.emit("scope");
    }

    setScopeReadoutSize(size: number) {
        this.settings.scopeReadoutSize = size;
        this.settingsChanged();
        this.emit("scope");
    }

    setScopeShowOptions(show: boolean) {
        this.settings.scopeShowOptions = show;
        this.settingsChanged();
        this.emit("scope");
    }

    // the samples kept: a bit more than the span, they arrive late
    private getBufferSpan() {
        return this.settings.scopeSpan * 1.2 + 0.5;
    }

    // the time of the newest sample of all the traces, 0 if none
    getNewestSampleTime() {
        let newest = 0;
        for (const trace of this.traces) {
            newest = Math.max(newest, trace.buffer.getNewestTime());
        }
        return newest;
    }

    // the sampled fields that can be added to the scope
    get sampledFields() {
        const result: { slot: number; field: FieldInfo }[] = [];
        this.fields.slots.forEach((slotFields, i) => {
            if (slotFields && slotFields.state == "ok") {
                for (const field of slotFields.fields) {
                    if (isFieldSampled(field)) {
                        result.push({ slot: i + 1, field });
                    }
                }
            }
        });
        return result;
    }

    private createTrace(slot: number, fieldName: string) {
        const used = new Set(this.traces.map(trace => trace.color));
        const color =
            TRACE_COLORS.find(color => !used.has(color)) ??
            TRACE_COLORS[this.traces.length % TRACE_COLORS.length];
        const trace = new ScopeTrace(slot, fieldName, color);
        trace.buffer.setSpan(this.getBufferSpan());
        this.resolveTraceField(trace);
        this.traces.push(trace);
        return trace;
    }

    addTrace(slot: number, fieldName: string) {
        if (
            this.traces.find(
                trace => trace.slot == slot && trace.fieldName == fieldName
            ) ||
            this.traces.length >= MAX_SAMPLE_SUBSCRIPTIONS
        ) {
            return;
        }
        this.createTrace(slot, fieldName);
        this.saveTraces();
        this.syncSampleSubscriptions();
        this.emit("scope");
    }

    removeTrace(trace: ScopeTrace) {
        const index = this.traces.indexOf(trace);
        if (index == -1) {
            return;
        }
        this.traces.splice(index, 1);
        if (trace.subscribedPeriod > 0 && this.isPushConnected) {
            this.sendCommand(
                `SUBScribe:SAMPles ${trace.slot},"${trace.fieldName}",0`
            );
        }
        this.saveTraces();
        this.emit("scope");
    }

    private saveTraces() {
        this.settings.scopeTraces = this.traces.map(trace => ({
            slot: trace.slot,
            fieldName: trace.fieldName
        }));
        this.settingsChanged();
    }

    private resolveTraceField(trace: ScopeTrace) {
        const slotFields = this.fields.slots[trace.slot - 1];
        const field =
            slotFields && slotFields.state == "ok"
                ? slotFields.fields.find(field => field.name == trace.fieldName)
                : undefined;
        trace.fieldIndex = field ? field.index : -1;
        if (field) {
            trace.unit = field.unit;
            trace.bits = !isFieldFloat(field);
        }
    }

    // a new catalog of a slot: its sample subscriptions ended
    private onCatalog(slot: number) {
        let changed = false;
        for (const trace of this.traces) {
            if (trace.slot == slot) {
                trace.subscribedPeriod = 0;
                trace.buffer.clear();
                // it comes again with the samples
                trace.fullRange = undefined;
                this.resolveTraceField(trace);
                changed = true;
            }
        }
        this.syncSampleSubscriptions();
        if (changed) {
            this.emit("scope");
        }
    }

    private syncSampleSubscriptions() {
        if (!this.isPushConnected) {
            return;
        }
        const period = 1 / this.settings.scopeRate;
        for (const trace of this.traces) {
            const wanted =
                this.scopeRunning && trace.fieldIndex >= 0 ? period : 0;
            if (trace.subscribedPeriod != wanted) {
                trace.subscribedPeriod = wanted;
                this.sendCommand(
                    `SUBScribe:SAMPles ${trace.slot},"${trace.fieldName}",${wanted}`
                ).then(result => {
                    this.samplesError =
                        result.errors.length > 0
                            ? `SUBScribe:SAMPles ${
                                  trace.label
                              } failed: ${formatScpiErrors(result.errors)}`
                            : undefined;
                    this.emit("status");
                });
            }
        }
    }

    // the full range of a sampled field, before its samples
    private onSamplesRange(payload: Buffer) {
        const range = parseSamplesRange(payload);
        if (!range) {
            return;
        }
        let changed = false;
        for (const trace of this.traces) {
            if (
                trace.slot == range.slot &&
                trace.fieldIndex == range.fieldIndex &&
                (trace.fullRange?.min != range.min ||
                    trace.fullRange?.max != range.max)
            ) {
                trace.fullRange = { min: range.min, max: range.max };
                changed = true;
            }
        }
        if (changed) {
            this.emit("scope");
        }
    }

    private onSamples(payload: Buffer) {
        const frame = parseSamples(payload);
        if (!frame || !this.scopeRunning) {
            return;
        }
        const arrivalTime = performance.now() / 1000;
        for (const trace of this.traces) {
            if (
                trace.slot == frame.slot &&
                trace.fieldIndex == frame.fieldIndex
            ) {
                trace.buffer.add(
                    frame.generation,
                    frame.seq,
                    frame.period,
                    frame.values,
                    arrivalTime
                );
            }
        }
    }
}

function loadAxes(saved: any) {
    const axes: { [key: string]: ScopeAxisSettings } = {};
    if (saved && typeof saved == "object") {
        for (const key of Object.keys(saved)) {
            const axis = saved[key];
            if (
                (axis?.mode == "full" ||
                    axis?.mode == "auto" ||
                    axis?.mode == "grow" ||
                    axis?.mode == "fixed") &&
                isFinite(axis.min) &&
                isFinite(axis.max) &&
                axis.min < axis.max
            ) {
                const entered =
                    isFinite(axis.enteredMin) &&
                    isFinite(axis.enteredMax) &&
                    axis.enteredMin < axis.enteredMax;
                axes[key] = {
                    mode: axis.mode,
                    min: axis.min,
                    max: axis.max,
                    enteredMin: entered ? axis.enteredMin : undefined,
                    enteredMax: entered ? axis.enteredMax : undefined,
                    includeZero: axis.includeZero === true
                };
            }
        }
    }
    return axes;
}

// the push port of the instrument while it is connected over Ethernet: the
// port after its SCPI port (5025 -> 5026)
function getPushAddress(instrument: InstrumentObject) {
    if (!instrument.isConnected) {
        return undefined;
    }
    const connection = instrument.lastConnection;
    if (!connection || connection.type != "ethernet") {
        return undefined;
    }
    const { address, port } = connection.ethernetParameters;
    return { host: address, port: port + 1 };
}

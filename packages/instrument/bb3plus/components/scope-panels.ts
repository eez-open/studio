// The parts of the scope view around the plot: the toolbar (run, the
// acquisition, the trigger, the zoom), a card per trace, the scales panel
// next to the plot and the measure bar under it. Plain DOM, each part updates
// only the elements that changed.

import {
    BB3PlusInstrument,
    ScopeTrace,
    ScopeTriggerMode,
    ScopeAxisMode,
    SCOPE_RATES,
    SCOPE_SPANS,
    SCOPE_TRIGGER_MODES,
    READOUT_SIZES,
    DEFAULT_AXIS_SETTINGS,
    TRACE_CUSTOM_COLORS
} from "instrument/bb3plus/BB3PlusInstrument";
import type { SampleStats } from "instrument/bb3plus/sample-buffer";
import { MAX_SAMPLE_SUBSCRIPTIONS } from "instrument/bb3plus/push-protocol";
import {
    getUnitName,
    formatNumber,
    getFieldNameParts
} from "instrument/bb3plus/fields-model";
import { getListName } from "instrument/bb3plus/labels";
import {
    MeasurementKind,
    MEASUREMENTS,
    getMeasurementLabel,
    formatMeasurement
} from "instrument/bb3plus/scope-measurements";
import type { ScopeCanvas } from "instrument/bb3plus/components/ScopeView";
import { showTriggerHelp } from "instrument/bb3plus/components/trigger-help";
import { PopupMenu, MenuItem } from "instrument/bb3plus/components/popup-menu";
import {
    h,
    setText,
    setVisible,
    setClass,
    setSelectOptions,
    setSelectValue,
    showModal,
    PushStatus,
    ErrorText,
    ICONS,
    svgIcon
} from "instrument/bb3plus/components/dom";
import {
    Axis,
    AXIS_MODES,
    BUTTON_ZOOM,
    TRIGGER_COLOR_DARK,
    TRIGGER_COLOR_LIGHT,
    formatRate,
    formatTime,
    withSign,
    getAxes,
    getAxisKey,
    getAxisName,
    getFullRange
} from "instrument/bb3plus/components/scope-common";

// the short names of the cursor readout sizes (READOUT_SIZES)
const READOUT_SIZE_NAMES = ["S", "M", "L", "XL"];

// how long a section of the scales panel is highlighted when a channel
// menu opens it (ms)
const FLASH_TIME = 1200;

const SHORTCUTS: [string, string][] = [
    ["Mouse wheel", "Zoom the time"],
    ["Ctrl + wheel, or wheel over an axis", "Zoom the values"],
    ["Drag", "Zoom to the box"],
    ["Shift + drag, or right drag", "Move the time and the values"],
    ["Drag an axis", "Move its values"],
    ["Drag the line with the tag T", "The trigger level"],
    ["Drag the trigger point (the handle at the top)", "The pre-trigger"],
    ["Esc", "Cancel the drag"],
    ["Double click", "Reset the zoom: the whole span, the default scales"],
    ["Double click on an axis", "Its default scale"]
];

////////////////////////////////////////////////////////////////////////////////
// small parts

// an icon button without a border, a background on hover
function ghostButton(
    icon: string,
    title: string,
    onclick: (event: MouseEvent) => void
) {
    return h(
        "button",
        {
            type: "button",
            className: "EezStudio_BB3Plus_GhostButton",
            title,
            onclick
        },
        svgIcon(icon, 16)
    );
}

// The chip of a choice: a prefix, a color swatch, the label of the value; a
// <select> over it (invisible) opens the list of the choices on a click.
function createChipSelect<T extends string | number>(
    prefix: string,
    title: string,
    onChange: (value: T) => void,
    withSwatch: boolean = false
) {
    const swatch = h("span", { className: "swatch" });
    const valueText = h("span", { className: "value" });
    const select = h("select", { className: "overlay", title });
    const element = h(
        "span",
        { className: "EezStudio_BB3Plus_Chip" },
        prefix ? h("span", { className: "prefix" }, prefix) : null,
        withSwatch ? swatch : null,
        valueText,
        select
    );
    let options: { value: T; label: string }[] = [];
    select.addEventListener("change", () => {
        const option = options.find(
            option => String(option.value) == select.value
        );
        if (option) {
            onChange(option.value);
        }
    });
    return {
        element,
        swatch,
        select,
        setOptions(newOptions: { value: T; label: string }[]) {
            if (JSON.stringify(newOptions) != JSON.stringify(options)) {
                options = newOptions;
                setSelectOptions(select, options);
            }
        },
        setValue(value: T | undefined) {
            setSelectValue(select, value ?? "");
            const option = options.find(option => option.value === value);
            setText(valueText, option?.label ?? "—");
        }
    };
}

// a row of buttons, one of them active
function createSegmented<T extends string | number>(
    options: { value: T; label: string; title?: string }[],
    onChange: (value: T) => void,
    className: string = ""
) {
    const buttons = options.map(option =>
        h(
            "button",
            {
                type: "button",
                title: option.title,
                onclick: () => onChange(option.value)
            },
            option.label
        )
    );
    const element = h(
        "div",
        { className: "EezStudio_BB3Plus_Segmented " + className },
        ...buttons
    );
    return {
        element,
        setValue(value: T) {
            options.forEach((option, i) =>
                setClass(buttons[i], "active", option.value == value)
            );
        }
    };
}

function checkbox(label: string, title: string, onchange: () => void) {
    const input = h("input", {
        type: "checkbox",
        className: "form-check-input",
        onchange
    });
    const element = h(
        "label",
        { className: "EezStudio_BB3Plus_Check", title },
        input,
        h("span", null, label)
    );
    return { element, input };
}

function getTraceUnit(trace: ScopeTrace) {
    return trace.bits ? "" : getUnitName(trace.unit);
}

// "Slot 1 · DCP405+ · Ch1"
function getTraceSubtitle(
    bb3PlusInstrument: BB3PlusInstrument,
    trace: ScopeTrace
) {
    const catalog = bb3PlusInstrument.getTraceCatalog(trace);
    if (!catalog) {
        return `Slot ${trace.slot} · not available now`;
    }
    const { slotFields, field } = catalog;
    const parts = [`Slot ${trace.slot}`];
    if (slotFields.moduleName) {
        parts.push(slotFields.moduleName);
    }
    if (field.channelLabel && !trace.name.startsWith(field.channelLabel)) {
        parts.push(field.channelLabel);
    }
    return parts.join(" · ");
}

// the scale of the axis in a few words: "Fixed 0–40 V"
function getScaleSummary(
    bb3PlusInstrument: BB3PlusInstrument,
    axisKey: string,
    unit: string
) {
    const settings = bb3PlusInstrument.getScopeAxis(axisKey);
    switch (settings.mode) {
        case "fixed":
            return `Fixed ${formatNumber(settings.min, 4)}–${formatNumber(
                settings.max,
                4
            )}${unit ? " " + unit : ""}`;
        case "auto":
            return "Auto";
        case "grow":
            return "Grow";
        case "full":
            return "Full range";
    }
}

function showShortcuts() {
    showModal(
        "Mouse & keyboard shortcuts",
        h(
            "div",
            { className: "modal-body" },
            h(
                "table",
                { className: "table table-sm mb-0" },
                h(
                    "tbody",
                    null,
                    ...SHORTCUTS.map(([keys, action]) =>
                        h(
                            "tr",
                            null,
                            h(
                                "td",
                                { style: { width: "50%" } },
                                h("b", null, keys)
                            ),
                            h("td", null, action)
                        )
                    )
                )
            )
        ),
        "modal-dialog-centered"
    );
}

////////////////////////////////////////////////////////////////////////////////
// toolbar

// Run / Stop and the status of the trigger; the rate, the span and the time
// of a division; the trigger: its mode, then (not Off) the source trace, the
// edge, the level of an analog source or the pin of a bit field, the
// pre-trigger. Under them the zoom, Save to history and the scales panel.
export class ScopeToolbar {
    element: HTMLDivElement;
    private runButton: HTMLButtonElement;
    private runIcon = h("span", { className: "icon" });
    private runText = h("span");
    private runningShown: boolean | undefined;
    private statusPill = h("span", {
        className: "EezStudio_BB3Plus_StatusPill"
    });
    private rateChip;
    private spanChip;
    private divText = h("span", {
        className: "EezStudio_BB3Plus_Muted",
        title: "The time of a division of the grid"
    });
    private modeChip;
    private sourceChip;
    private edgeChip: HTMLButtonElement;
    private edgeIcon = h("span", { className: "icon" });
    private edgeText = h("span");
    private levelChip: HTMLSpanElement;
    private levelInput: HTMLInputElement;
    private levelUnit = h("span", { className: "prefix" });
    private bitChip;
    private preChip: HTMLSpanElement;
    private preInput: HTMLInputElement;
    private preTime = h("span", { className: "prefix" });
    // shown only with a trigger mode
    private triggerDetails: HTMLElement[];
    private droppedText = h("span", {
        className: "text-warning",
        title: "BB3+ dropped them because they were not read fast enough"
    });
    private pushStatus: PushStatus;
    private samplesError = new ErrorText();
    private resetZoomButton: HTMLButtonElement;
    private panelButton: HTMLButtonElement;

    constructor(
        private bb3PlusInstrument: BB3PlusInstrument,
        private scopeCanvas: ScopeCanvas,
        actions: { addToHistory: () => void }
    ) {
        this.runButton = h(
            "button",
            {
                type: "button",
                className: "btn btn-sm EezStudio_BB3Plus_RunButton",
                onclick: () =>
                    bb3PlusInstrument.setScopeRunning(
                        !bb3PlusInstrument.scopeRunning
                    )
            },
            this.runIcon,
            this.runText
        );

        this.rateChip = createChipSelect<number>(
            "Rate",
            "BB3+ sends the averages of the module readings at this rate, every reading if the module doesn't read faster",
            rate => bb3PlusInstrument.setScopeRate(rate)
        );
        this.rateChip.setOptions(
            SCOPE_RATES.map(rate => ({ value: rate, label: formatRate(rate) }))
        );

        this.spanChip = createChipSelect<number>(
            "Span",
            "The time shown",
            span => bb3PlusInstrument.setScopeSpan(span)
        );
        this.spanChip.setOptions(
            SCOPE_SPANS.map(span => ({ value: span, label: formatTime(span) }))
        );

        // trigger

        this.modeChip = createChipSelect<ScopeTriggerMode>(
            "",
            "Off: the samples scroll as they come. Auto: as Normal, but without a trigger for a while they scroll again. Normal: each trigger shows its window until the next one. Single: the first trigger shows its window and stops the scope (Run arms it again).",
            mode => bb3PlusInstrument.setScopeTriggerMode(mode)
        );
        this.modeChip.setOptions(SCOPE_TRIGGER_MODES);

        this.sourceChip = createChipSelect<string>(
            "",
            "The trace of the trigger",
            key => bb3PlusInstrument.setScopeTriggerSource(key),
            true
        );

        this.edgeChip = h(
            "button",
            {
                type: "button",
                className: "EezStudio_BB3Plus_Chip",
                title: "The edge of the trigger (click: the other one)",
                onclick: () =>
                    bb3PlusInstrument.setScopeTriggerEdge(
                        bb3PlusInstrument.settings.scopeTriggerEdge == "rising"
                            ? "falling"
                            : "rising"
                    )
            },
            this.edgeIcon,
            this.edgeText
        );

        this.levelInput = h("input", {
            title: "The level of the edge, also dragged in the plot (the line with the tag T)",
            spellcheck: false
        });
        this.levelInput.addEventListener("change", () => {
            const level = parseFloat(this.levelInput.value);
            if (isFinite(level)) {
                bb3PlusInstrument.setScopeTriggerLevel(level);
            } else {
                this.updateLevel(true);
            }
        });
        this.levelInput.addEventListener("keydown", event => {
            if (event.key == "Enter") {
                this.levelInput.blur();
            }
        });
        this.levelChip = h(
            "span",
            {
                className: "EezStudio_BB3Plus_Chip EezStudio_BB3Plus_InputChip",
                onclick: () => this.levelInput.focus()
            },
            this.levelInput,
            this.levelUnit
        );

        this.bitChip = createChipSelect<number>(
            "Pin",
            "The pin of the edge",
            bit => bb3PlusInstrument.setScopeTriggerBit(bit)
        );

        this.preInput = h("input", {
            type: "number",
            min: "0",
            max: "100",
            step: "5",
            className: "percent",
            title: "The part of the window before the trigger, also dragged in the plot (the trigger point, its handle at the top)"
        });
        this.preInput.addEventListener("change", () => {
            const percent = parseFloat(this.preInput.value);
            if (isFinite(percent)) {
                bb3PlusInstrument.setScopeTriggerPosition(percent / 100);
            }
            this.update();
        });
        this.preInput.addEventListener("keydown", event => {
            if (event.key == "Enter") {
                this.preInput.blur();
            }
        });
        this.preChip = h(
            "span",
            {
                className: "EezStudio_BB3Plus_Chip EezStudio_BB3Plus_InputChip",
                onclick: () => this.preInput.focus()
            },
            h("span", { className: "prefix" }, "Pre"),
            this.preInput,
            h("span", null, "%"),
            this.preTime
        );

        this.triggerDetails = [
            this.sourceChip.element,
            this.edgeChip,
            this.levelChip,
            this.bitChip.element,
            this.preChip
        ];

        this.pushStatus = new PushStatus(bb3PlusInstrument);

        this.resetZoomButton = ghostButton(
            ICONS.zoomReset,
            "Reset the zoom: the whole span, the default scales (double click on the plot)",
            () => scopeCanvas.resetZoom()
        );

        this.panelButton = ghostButton(
            ICONS.sidePanel,
            "Scales & display",
            () =>
                bb3PlusInstrument.setScopeShowOptions(
                    !bb3PlusInstrument.settings.scopeShowOptions
                )
        );

        const separator = () =>
            h("span", { className: "EezStudio_BB3Plus_Separator" });
        const groupLabel = (label: string) =>
            h("span", { className: "EezStudio_BB3Plus_GroupLabel" }, label);

        this.element = h(
            "div",
            {
                className:
                    "EezStudio_BB3Plus_Card EezStudio_BB3Plus_ScopeToolbar"
            },
            h(
                "div",
                { className: "EezStudio_BB3Plus_ToolbarRow" },
                this.runButton,
                this.statusPill,
                separator(),
                groupLabel("Acquire"),
                this.rateChip.element,
                this.spanChip.element,
                this.divText,
                separator(),
                groupLabel("Trigger"),
                h(
                    "button",
                    {
                        type: "button",
                        className:
                            "EezStudio_BB3Plus_GhostButton EezStudio_BB3Plus_HelpButton",
                        title: "How the trigger works",
                        onclick: () =>
                            showTriggerHelp(
                                bb3PlusInstrument.darkTheme
                                    ? TRIGGER_COLOR_DARK
                                    : TRIGGER_COLOR_LIGHT
                            )
                    },
                    svgIcon(ICONS.help, 16)
                ),
                this.modeChip.element,
                ...this.triggerDetails,
                h(
                    "span",
                    { className: "EezStudio_BB3Plus_ToolbarStatus" },
                    this.droppedText,
                    this.pushStatus.element,
                    this.samplesError.element
                )
            ),
            h(
                "div",
                { className: "EezStudio_BB3Plus_ToolbarRow" },
                ghostButton(
                    ICONS.zoomIn,
                    "Zoom in the time (mouse wheel)",
                    () => scopeCanvas.zoomTime(1 / BUTTON_ZOOM)
                ),
                ghostButton(
                    ICONS.zoomOut,
                    "Zoom out the time (mouse wheel)",
                    () => scopeCanvas.zoomTime(BUTTON_ZOOM)
                ),
                this.resetZoomButton,
                h(
                    "button",
                    {
                        type: "button",
                        className: "EezStudio_BB3Plus_Chip",
                        title: "Add the samples of the time shown to the history of the instrument as a DLOG chart",
                        onclick: () => actions.addToHistory()
                    },
                    svgIcon(ICONS.history, 15),
                    "Save to history"
                ),
                this.panelButton
            )
        );
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const settings = bb3PlusInstrument.settings;

        const running = bb3PlusInstrument.scopeRunning;
        if (running != this.runningShown) {
            this.runningShown = running;
            this.runIcon.replaceChildren(
                svgIcon(running ? ICONS.stop : ICONS.play, 14, 2.4)
            );
            setText(this.runText, running ? "Stop" : "Run");
            setClass(this.runButton, "btn-danger", running);
            setClass(this.runButton, "btn-success", !running);
        }

        this.rateChip.setValue(settings.scopeRate);
        this.spanChip.setValue(settings.scopeSpan);

        // zoomed: the time or a scale not the default one
        const zoomed =
            bb3PlusInstrument.scopeViewSpan != undefined ||
            Object.values(settings.scopeAxes).some(
                axis => axis.mode != DEFAULT_AXIS_SETTINGS.mode
            );
        this.resetZoomButton.disabled = !zoomed;
        setClass(this.panelButton, "active", settings.scopeShowOptions);

        this.updateTrigger();
        this.updateTriggerStatus();
        this.updateScale();
    }

    private updateTrigger() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const settings = bb3PlusInstrument.settings;
        this.modeChip.setValue(settings.scopeTriggerMode);
        const on = settings.scopeTriggerMode != "off";
        for (const element of this.triggerDetails) {
            setVisible(element, on);
        }
        if (!on) {
            return;
        }

        const traces = bb3PlusInstrument.traces;
        this.sourceChip.setOptions(
            traces.map(trace => ({ value: trace.key, label: trace.name }))
        );
        const source = bb3PlusInstrument.scopeTriggerSource;
        this.sourceChip.setValue(source?.key);
        this.sourceChip.swatch.style.backgroundColor = source?.color ?? "";
        this.sourceChip.select.disabled = traces.length == 0;

        const rising = settings.scopeTriggerEdge == "rising";
        if (this.edgeText.textContent != (rising ? "Rising" : "Falling")) {
            setText(this.edgeText, rising ? "Rising" : "Falling");
            this.edgeIcon.replaceChildren(
                svgIcon(rising ? ICONS.risingEdge : ICONS.fallingEdge, 15)
            );
        }

        // a bit field: its pins, else the level
        const bits = source?.bits ?? false;
        setVisible(this.levelChip, !bits);
        setVisible(this.bitChip.element, bits);
        if (bits && source) {
            const field = bb3PlusInstrument.getTraceCatalog(source)?.field;
            const numBits = field?.bits || 8;
            const pins = Array.from(
                { length: numBits },
                (_, bit) => field?.pinLabels[bit] || `Bit ${bit + 1}`
            );
            this.bitChip.setOptions(
                pins.map((label, bit) => ({ value: bit, label }))
            );
            this.bitChip.setValue(settings.scopeTriggerBit);
        } else {
            this.updateLevel(false);
            setText(this.levelUnit, source ? getTraceUnit(source) : "");
        }

        // the pre-trigger and the time from the start of the window to the
        // trigger
        const capture = bb3PlusInstrument.scopeShownCapture;
        const full = capture
            ? capture.pre + capture.post
            : bb3PlusInstrument.scopeSpan;
        const position = settings.scopeTriggerPosition;
        const percent = Math.round(position * 100);
        if (
            document.activeElement != this.preInput &&
            this.preInput.value != String(percent)
        ) {
            this.preInput.value = String(percent);
        }
        const pre = -position * full;
        setText(this.preTime, "· " + withSign(formatTime(pre), pre, false));
    }

    // the level of the settings, not while it is typed in (unless force)
    private updateLevel(force: boolean) {
        if (force || document.activeElement != this.levelInput) {
            const text = formatNumber(
                this.bb3PlusInstrument.settings.scopeTriggerLevel,
                5
            );
            if (this.levelInput.value != text) {
                this.levelInput.value = text;
            }
            this.levelInput.style.width = `${Math.max(3, text.length) + 0.5}ch`;
        }
    }

    // also by a timer: "triggered" and "auto" go by the time
    updateTriggerStatus() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const mode = bb3PlusInstrument.settings.scopeTriggerMode;
        const status = bb3PlusInstrument.scopeTriggerStatus;
        let text: string;
        let color: string;
        let title: string;
        if (!bb3PlusInstrument.scopeRunning) {
            text = "Stopped";
            color = "gray";
            title =
                status == "stopped, not triggered"
                    ? "Stopped before a trigger (Run starts it)"
                    : "The scope is stopped (Run starts it)";
        } else if (mode == "off") {
            text = "Running";
            color = "green";
            title = "The samples scroll as they come, the trigger is off";
        } else if (status == "triggered") {
            text = "Triggered";
            color = "green";
            title = "A trigger was found, its window is shown";
        } else if (status == "auto") {
            text = "Auto";
            color = "amber";
            title = "No trigger for a while, the samples scroll";
        } else if (status == "no source") {
            text = "No source";
            color = "gray";
            title = "Add a trace for the trigger";
        } else {
            text = "Armed";
            color = "blue";
            title = "Waiting for a trigger, the window of the last one stays";
        }
        setText(this.statusPill, text);
        if (this.statusPill.title != title) {
            this.statusPill.title = title;
        }
        for (const name of ["green", "amber", "gray", "blue"]) {
            setClass(this.statusPill, name, name == color);
        }
    }

    updateScale() {
        const time = this.scopeCanvas.scale.time;
        setText(this.divText, time > 0 ? `${formatTime(time)}/div` : "");
    }

    updateStatus() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        this.pushStatus.update();
        this.samplesError.update(bb3PlusInstrument.samplesError);
        setText(
            this.droppedText,
            `${bb3PlusInstrument.droppedSamples} samples dropped`
        );
        setVisible(this.droppedText, bb3PlusInstrument.droppedSamples > 0);
    }
}

////////////////////////////////////////////////////////////////////////////////
// channel cards

interface ChannelCard {
    element: HTMLElement;
    trace: ScopeTrace;
    unit: string;
    mean: HTMLElement | undefined;
    pkpk: HTMLElement | undefined;
    scale: HTMLElement | undefined;
}

// A card per trace: its color, name, unit and where it comes from, the mean,
// the peak to peak and the scale of the window shown, show/hide and a menu
// (trigger source, scale, measurements, color, axis side, remove); then Add
// channel.
export class ScopeChannels {
    element = h("div", { className: "EezStudio_BB3Plus_Channels" });
    private cards: ChannelCard[] = [];
    private key = "";
    private addButton: HTMLButtonElement;

    constructor(
        private bb3PlusInstrument: BB3PlusInstrument,
        private scopeCanvas: ScopeCanvas,
        private sidePanel: ScopeSidePanel
    ) {
        this.addButton = h(
            "button",
            {
                type: "button",
                className: "EezStudio_BB3Plus_AddChannel",
                title: "Add a sampled field of a module",
                onclick: () =>
                    PopupMenu.show(this.addButton, () => this.getAddItems())
            },
            svgIcon(ICONS.plus, 16),
            "Add channel"
        );
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const traces = bb3PlusInstrument.traces;
        const key = JSON.stringify(
            traces.map(trace => [
                trace.key,
                trace.name,
                trace.details,
                trace.color,
                trace.hidden,
                trace.fieldIndex,
                trace.unit,
                trace.bits,
                getTraceSubtitle(bb3PlusInstrument, trace)
            ])
        );
        if (key == this.key) {
            return;
        }
        this.key = key;
        this.cards = traces.map(trace => this.createCard(trace));
        this.element.replaceChildren(
            ...this.cards.map(card => card.element),
            this.addButton
        );
        this.updateScale();
    }

    updateStats(stats: Map<ScopeTrace, SampleStats | undefined>) {
        for (const card of this.cards) {
            if (card.mean && card.pkpk) {
                const traceStats = stats.get(card.trace);
                setText(
                    card.mean,
                    formatMeasurement(traceStats, "mean", card.unit)
                );
                setText(
                    card.pkpk,
                    formatMeasurement(traceStats, "pkpk", card.unit)
                );
            }
        }
    }

    // the values of a division of the axes drawn
    updateScale() {
        for (const card of this.cards) {
            if (card.scale) {
                const step = this.scopeCanvas.scale.axes.get(
                    getAxisKey(card.trace)
                );
                setText(
                    card.scale,
                    step != undefined && !card.trace.hidden
                        ? `${formatNumber(step, 3)}${
                              card.unit ? " " + card.unit : ""
                          }/div`
                        : "—"
                );
            }
        }
    }

    private createCard(trace: ScopeTrace): ChannelCard {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const unit = getTraceUnit(trace);
        const missing = trace.fieldIndex < 0;
        const analog = !trace.bits && !missing;

        const stat = (label: string, title: string, colored: boolean) => {
            const value = h("span", {
                className: "value",
                style: { color: colored ? trace.color : "" }
            });
            return {
                value,
                element: h(
                    "div",
                    { className: "stat", title },
                    h("span", { className: "label" }, label),
                    value
                )
            };
        };
        const mean = analog
            ? stat("Mean", "The average of the samples shown", true)
            : undefined;
        const pkpk = analog
            ? stat("Pk-Pk", "The highest minus the lowest sample shown", true)
            : undefined;
        const scale = analog
            ? stat("Scale", "The values of a division of the grid", false)
            : undefined;

        const moreButton: HTMLButtonElement = ghostButton(
            ICONS.more,
            "Trigger source, scale, measurements, color, axis side, remove",
            () =>
                PopupMenu.show(
                    moreButton,
                    menu => this.getCardMenuItems(trace, menu),
                    "left"
                )
        );

        const element = h(
            "div",
            {
                className:
                    "EezStudio_BB3Plus_Card EezStudio_BB3Plus_ChannelCard" +
                    (trace.hidden ? " hidden-trace" : "") +
                    (missing ? " missing" : ""),
                title: missing
                    ? "The module in the slot doesn't have this sampled field"
                    : trace.details
            },
            h("span", {
                className: "bar",
                style: { backgroundColor: trace.color }
            }),
            h(
                "div",
                { className: "title" },
                h(
                    "div",
                    { className: "name" },
                    trace.name,
                    unit ? h("span", { className: "unit" }, `[${unit}]`) : null
                ),
                h(
                    "div",
                    { className: "sub" },
                    getTraceSubtitle(bb3PlusInstrument, trace)
                )
            ),
            mean?.element,
            pkpk?.element,
            scale?.element,
            h(
                "div",
                { className: "buttons" },
                ghostButton(
                    trace.hidden ? ICONS.eyeOff : ICONS.eye,
                    trace.hidden ? "Show the trace" : "Hide the trace",
                    () => bb3PlusInstrument.setTraceHidden(trace, !trace.hidden)
                ),
                moreButton
            )
        );

        return {
            element,
            trace,
            unit,
            mean: mean?.value,
            pkpk: pkpk?.value,
            scale: scale?.value
        };
    }

    private getCardMenuItems(trace: ScopeTrace, menu: PopupMenu): MenuItem[] {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const unit = getTraceUnit(trace);
        const missing = trace.fieldIndex < 0;
        const analog = !trace.bits && !missing;
        const axisKey = getAxisKey(trace);
        const triggerOn = bb3PlusInstrument.settings.scopeTriggerMode != "off";
        const items: MenuItem[] = [];

        if (!missing) {
            items.push({
                label: "Trigger source",
                icon: ICONS.target,
                checked:
                    triggerOn && bb3PlusInstrument.scopeTriggerSource == trace,
                title: "The trigger on the edges of this trace (Auto if the trigger is off)",
                onClick: () => {
                    bb3PlusInstrument.setScopeTriggerSource(trace.key);
                    if (!triggerOn) {
                        bb3PlusInstrument.setScopeTriggerMode("auto");
                    }
                }
            });
        }
        if (analog) {
            items.push(
                {
                    label: "Scale…",
                    icon: ICONS.scales,
                    detail: getScaleSummary(bb3PlusInstrument, axisKey, unit),
                    title: "The scale of the axis of this trace in the scales panel",
                    onClick: () => this.sidePanel.focusAxis(axisKey)
                },
                {
                    label: "Measurements",
                    icon: ICONS.list,
                    title: "The measurements of this trace in the measure bar",
                    submenu: () => getMeasurementItems(bb3PlusInstrument, trace)
                }
            );
        }

        // the color of the field, then the colors to choose from
        const colors = [undefined, ...TRACE_CUSTOM_COLORS];
        const swatches = h(
            "div",
            { className: "EezStudio_BB3Plus_Swatches" },
            ...colors.map(color => {
                const shown = color ?? trace.fieldColor;
                const button = h("button", {
                    type: "button",
                    className:
                        (trace.customColor == color ? "selected" : "") +
                        (color == undefined ? " field-color" : ""),
                    title:
                        color == undefined
                            ? "The color of the field"
                            : "This color, instead of the color of the field",
                    style: { backgroundColor: shown },
                    onclick: () => {
                        bb3PlusInstrument.setTraceColor(trace, color);
                        menu.refresh();
                    }
                });
                // the ring of the selected one
                button.style.setProperty("--swatch-color", shown);
                return button;
            })
        );
        items.push(
            { type: "separator" },
            { type: "header", label: "Color" },
            { type: "custom", element: swatches }
        );

        if (analog) {
            const axes = getAxes(bb3PlusInstrument.traces).filter(
                axis => axis.key != "bits"
            );
            const index = axes.findIndex(axis => axis.key == axisKey);
            const side = createSegmented(
                [
                    { value: "left" as const, label: "Left" },
                    { value: "right" as const, label: "Right" }
                ],
                value => {
                    bb3PlusInstrument.setScopeAxisSide(axisKey, value);
                    menu.refresh();
                },
                "compact"
            );
            side.setValue(
                bb3PlusInstrument.getScopeAxisSide(
                    axisKey,
                    index != -1 ? index : 0
                )
            );
            items.push({
                type: "custom",
                element: h(
                    "div",
                    {
                        className: "EezStudio_BB3Plus_MenuRow",
                        title: "The side of the axis of this trace (the traces with the same unit share it)"
                    },
                    h("span", null, "Axis side"),
                    side.element
                )
            });
        }

        items.push(
            { type: "separator" },
            {
                label: "Remove channel",
                icon: ICONS.trash,
                danger: true,
                onClick: () => bb3PlusInstrument.removeTrace(trace)
            }
        );
        return items;
    }

    // the sampled fields not shown yet, by slot
    private getAddItems(): MenuItem[] {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const traces = bb3PlusInstrument.traces;
        if (traces.length >= MAX_SAMPLE_SUBSCRIPTIONS) {
            return [
                {
                    label: `At most ${MAX_SAMPLE_SUBSCRIPTIONS} channels`,
                    disabled: true
                }
            ];
        }
        const available = bb3PlusInstrument.sampledFields.filter(
            ({ slot, field }) =>
                !traces.find(
                    trace => trace.slot == slot && trace.fieldName == field.name
                )
        );
        if (available.length == 0) {
            return [
                {
                    label: bb3PlusInstrument.instrumentConnected
                        ? "No more sampled fields"
                        : "Not connected",
                    disabled: true
                }
            ];
        }
        const items: MenuItem[] = [];
        let lastSlot = 0;
        for (const { slot, slotFields, field } of available) {
            if (slot != lastSlot) {
                lastSlot = slot;
                if (items.length > 0) {
                    items.push({ type: "separator" });
                }
                items.push({
                    type: "header",
                    label: `Slot ${slot} · ${
                        slotFields.slotLabel || slotFields.moduleName
                    }`
                });
            }
            items.push({
                label: getListName(getFieldNameParts(slotFields, field)),
                title: field.name,
                onClick: () => bb3PlusInstrument.addTrace(slot, field.name)
            });
        }
        return items;
    }
}

// the measurements of the trace, checked if in the measure bar
function getMeasurementItems(
    bb3PlusInstrument: BB3PlusInstrument,
    trace: ScopeTrace
): MenuItem[] {
    return MEASUREMENTS.map(measurement => ({
        label: measurement.label,
        title: measurement.title,
        checked: trace.measurements.includes(measurement.kind),
        keepOpen: true,
        onClick: () =>
            toggleMeasurement(bb3PlusInstrument, trace, measurement.kind)
    }));
}

function toggleMeasurement(
    bb3PlusInstrument: BB3PlusInstrument,
    trace: ScopeTrace,
    kind: MeasurementKind
) {
    const measurements = trace.measurements.includes(kind)
        ? trace.measurements.filter(other => other != kind)
        : // in the order of MEASUREMENTS
          MEASUREMENTS.map(measurement => measurement.kind).filter(
              other => other == kind || trace.measurements.includes(other)
          );
    bb3PlusInstrument.setTraceMeasurements(trace, measurements);
}

////////////////////////////////////////////////////////////////////////////////
// scales panel

interface AxisRow {
    axis: Axis;
    section: HTMLElement;
    mode: ReturnType<typeof createSegmented<ScopeAxisMode>>;
    min: HTMLInputElement;
    max: HTMLInputElement;
    includeZero: HTMLInputElement;
    restart: HTMLButtonElement;
    note: HTMLElement;
}

// The scales of the Y axes (the mode, the range, 0 always in it), the axes
// on one grid, the time zoom, the size of the cursor values, the colors.
export class ScopeSidePanel {
    element: HTMLDivElement;
    private axesElement = h("div");
    private axesKey = "";
    private axisRows = new Map<string, AxisRow>();
    private align;
    private timeText = h("span", { className: "EezStudio_BB3Plus_Muted" });
    private showAllButton: HTMLButtonElement;
    private readoutSize;
    private channelColors;
    private flashTimer: any;

    constructor(
        private bb3PlusInstrument: BB3PlusInstrument,
        private scopeCanvas: ScopeCanvas
    ) {
        this.align = checkbox(
            "Align secondary axis to grid",
            "The ticks of the other axes on the grid of the first axis (their scale fits it), not a fixed scale",
            () => bb3PlusInstrument.setScopeAlignAxes(this.align.input.checked)
        );

        this.showAllButton = h(
            "button",
            {
                type: "button",
                className: "EezStudio_BB3Plus_Chip small",
                onclick: () =>
                    bb3PlusInstrument.setScopeView(undefined, undefined)
            },
            "Show all"
        );

        this.readoutSize = createSegmented(
            READOUT_SIZES.map((size, i) => ({
                value: size.value,
                label: READOUT_SIZE_NAMES[i] ?? size.label,
                title: size.label
            })),
            size => bb3PlusInstrument.setScopeReadoutSize(size)
        );

        this.channelColors = checkbox(
            "Channel colors",
            "The colors BB3+ draws the channels with (the channel or the slot color), not the colors of the fields",
            () =>
                bb3PlusInstrument.setScopeChannelColors(
                    this.channelColors.input.checked
                )
        );

        this.element = h(
            "div",
            { className: "EezStudio_BB3Plus_Card EezStudio_BB3Plus_ScopeSide" },
            h(
                "div",
                { className: "header" },
                h("span", null, "Scales & display"),
                ghostButton(ICONS.close, "Close", () =>
                    bb3PlusInstrument.setScopeShowOptions(false)
                )
            ),
            this.axesElement,
            h("div", { className: "divider" }),
            h("div", { className: "sectionTitle" }, "Time"),
            h(
                "div",
                { className: "EezStudio_BB3Plus_SideRow" },
                this.timeText,
                this.showAllButton
            ),
            h("div", { className: "sectionTitle" }, "Cursor readout size"),
            this.readoutSize.element,
            h("div", { className: "sectionTitle" }, "Colors"),
            this.channelColors.element,
            h(
                "button",
                {
                    type: "button",
                    className: "EezStudio_BB3Plus_LinkButton",
                    onclick: () => showShortcuts()
                },
                svgIcon(ICONS.help, 14),
                "Mouse & keyboard shortcuts"
            )
        );
    }

    update() {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const settings = bb3PlusInstrument.settings;
        setVisible(this.element, settings.scopeShowOptions);
        if (!settings.scopeShowOptions) {
            return;
        }

        // a section per axis, also of the hidden traces
        const axes = getAxes(bb3PlusInstrument.traces, true);
        const axesKey = JSON.stringify(
            axes.map(axis => [
                axis.key,
                axis.traces.map(trace => [trace.key, trace.name, trace.color])
            ])
        );
        if (axesKey != this.axesKey) {
            this.axesKey = axesKey;
            this.axisRows.clear();
            // the option of the analog axes after them
            const sections = axes.map(axis => this.createAxisSection(axis));
            const analogCount = axes.filter(axis => axis.key != "bits").length;
            this.axesElement.replaceChildren(
                ...sections.slice(0, analogCount),
                this.align.element,
                ...sections.slice(analogCount)
            );
            if (axes.length == 0) {
                this.axesElement.append(
                    h(
                        "div",
                        { className: "EezStudio_BB3Plus_Muted mb-2" },
                        "The scales of the values are here when there are channels."
                    )
                );
            }
        }
        this.updateAxisRows();

        this.align.input.checked = settings.scopeAlignAxes;
        setVisible(
            this.align.element,
            axes.filter(axis => axis.key != "bits").length > 1
        );

        // time
        const full = bb3PlusInstrument.scopeSpan;
        const viewSpan = bb3PlusInstrument.scopeViewSpan;
        setText(
            this.timeText,
            viewSpan != undefined
                ? `Zoomed · ${formatTime(viewSpan)} of ${formatTime(full)}`
                : `Showing whole span · ${formatTime(full)}`
        );
        this.showAllButton.disabled = viewSpan == undefined;

        this.readoutSize.setValue(settings.scopeReadoutSize);
        this.channelColors.input.checked = settings.scopeChannelColors;
    }

    // the values of the sections, the ranges of the auto axes as drawn
    updateAxisRows() {
        for (const [key, row] of this.axisRows) {
            const settings = this.bb3PlusInstrument.getScopeAxis(key);
            row.mode.setValue(settings.mode);
            const range =
                settings.mode == "fixed"
                    ? settings
                    : this.scopeCanvas.getAxisRange(key);
            for (const [input, value] of [
                [row.min, range?.min],
                [row.max, range?.max]
            ] as [HTMLInputElement, number | undefined][]) {
                if (document.activeElement != input) {
                    input.value =
                        value != undefined ? formatNumber(value, 6) : "";
                    setClass(input, "is-invalid", false);
                }
            }
            // full range: auto if it isn't known
            const fullKnown = getFullRange(row.axis) != undefined;
            const auto =
                settings.mode == "auto" ||
                settings.mode == "grow" ||
                (settings.mode == "full" && !fullKnown);
            row.includeZero.checked = settings.includeZero;
            row.includeZero.disabled = !auto;
            setVisible(row.restart, settings.mode == "grow");
            setVisible(row.note, settings.mode == "full" && !fullKnown);
        }
    }

    // the panel open, the section of the axis in view and highlighted
    focusAxis(key: string) {
        this.bb3PlusInstrument.setScopeShowOptions(true);
        this.update();
        const row = this.axisRows.get(key);
        if (!row) {
            return;
        }
        row.section.scrollIntoView({ block: "nearest" });
        for (const other of this.axisRows.values()) {
            setClass(other.section, "flash", other == row);
        }
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(
            () => setClass(row.section, "flash", false),
            FLASH_TIME
        );
    }

    private createAxisSection(axis: Axis) {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const key = axis.key;

        const mode = createSegmented<ScopeAxisMode>(AXIS_MODES, mode => {
            if (mode == "fixed") {
                // the range typed in last, or the range shown now
                const settings = bb3PlusInstrument.getScopeAxis(key);
                const range =
                    settings.enteredMin != undefined &&
                    settings.enteredMax != undefined
                        ? {
                              min: settings.enteredMin,
                              max: settings.enteredMax
                          }
                        : this.scopeCanvas.getAxisRange(key);
                bb3PlusInstrument.setScopeAxis(key, {
                    mode,
                    ...(range ?? {})
                });
            } else {
                if (mode == "grow") {
                    this.scopeCanvas.restartGrow(key);
                }
                bb3PlusInstrument.setScopeAxis(key, { mode });
            }
        });

        // a value typed in fixes the scale
        const onRangeChange = () => {
            const min = parseFloat(minInput.value);
            const max = parseFloat(maxInput.value);
            const valid = isFinite(min) && isFinite(max) && min < max;
            setClass(minInput, "is-invalid", !valid);
            setClass(maxInput, "is-invalid", !valid);
            if (valid) {
                // remembered for Fixed
                bb3PlusInstrument.setScopeAxis(key, {
                    mode: "fixed",
                    min,
                    max,
                    enteredMin: min,
                    enteredMax: max
                });
            }
        };
        const createRangeInput = (title: string) =>
            h("input", {
                className: "form-control form-control-sm",
                title,
                spellcheck: false,
                onchange: onRangeChange,
                onkeydown: (event: KeyboardEvent) => {
                    if (event.key == "Enter") {
                        onRangeChange();
                    }
                }
            });
        const minInput = createRangeInput(
            "The lowest value shown, typing a value fixes the scale"
        );
        const maxInput = createRangeInput(
            "The highest value shown, typing a value fixes the scale"
        );

        const includeZero = checkbox(
            "Always include 0",
            "The auto scales always show the value 0",
            () =>
                bb3PlusInstrument.setScopeAxis(key, {
                    includeZero: includeZero.input.checked
                })
        );

        const restart = h(
            "button",
            {
                type: "button",
                className: "EezStudio_BB3Plus_LinkButton",
                title: "Fit the values shown now and grow from there",
                onclick: () => this.scopeCanvas.restartGrow(key)
            },
            "Restart"
        );

        const note = h(
            "div",
            { className: "EezStudio_BB3Plus_Muted small" },
            "No full range received yet, shown as Auto"
        );

        const section = h(
            "div",
            { className: "EezStudio_BB3Plus_AxisSection" },
            h(
                "div",
                {
                    className: "sectionTitle",
                    title: axis.traces.map(trace => trace.name).join(", ")
                },
                ...axis.traces.map(trace =>
                    h("span", {
                        className: "swatch",
                        style: { backgroundColor: trace.color }
                    })
                ),
                h("span", null, getAxisName(axis)),
                restart
            ),
            mode.element,
            h(
                "div",
                { className: "EezStudio_BB3Plus_RangeInputs" },
                h("label", null, h("span", null, "Min"), minInput),
                h("label", null, h("span", null, "Max"), maxInput)
            ),
            note,
            includeZero.element
        );

        this.axisRows.set(key, {
            axis,
            section,
            mode,
            min: minInput,
            max: maxInput,
            includeZero: includeZero.input,
            restart,
            note
        });
        return section;
    }
}

////////////////////////////////////////////////////////////////////////////////
// measure bar

interface MeasureItem {
    trace: ScopeTrace;
    kind: MeasurementKind;
    unit: string;
    value: HTMLElement;
}

// The measurements chosen for the traces (in the channel menu or here), of
// the window shown.
export class ScopeMeasureBar {
    element: HTMLDivElement;
    private itemsElement = h("div", { className: "items" });
    private items: MeasureItem[] = [];
    private key = "";
    private addButton: HTMLButtonElement;

    constructor(private bb3PlusInstrument: BB3PlusInstrument) {
        this.addButton = h(
            "button",
            {
                type: "button",
                className: "EezStudio_BB3Plus_Chip",
                title: "Add a measurement of a channel",
                onclick: () =>
                    PopupMenu.show(
                        this.addButton,
                        () => this.getAddItems(),
                        "right"
                    )
            },
            svgIcon(ICONS.plus, 15),
            "Measurement"
        );
        this.element = h(
            "div",
            {
                className: "EezStudio_BB3Plus_Card EezStudio_BB3Plus_MeasureBar"
            },
            h(
                "span",
                {
                    className: "EezStudio_BB3Plus_GroupLabel",
                    title: "The measurements of the samples shown"
                },
                "Measure"
            ),
            this.itemsElement,
            this.addButton
        );
    }

    private get analogTraces() {
        return this.bb3PlusInstrument.traces.filter(
            trace => !trace.bits && trace.fieldIndex >= 0
        );
    }

    update() {
        const traces = this.analogTraces;
        const key = JSON.stringify(
            traces.map(trace => [
                trace.key,
                trace.name,
                trace.color,
                trace.unit,
                trace.measurements
            ])
        );
        if (key == this.key) {
            return;
        }
        this.key = key;

        this.items = [];
        for (const trace of traces) {
            for (const kind of trace.measurements) {
                this.items.push({
                    trace,
                    kind,
                    unit: getTraceUnit(trace),
                    value: h("span", {
                        className: "value",
                        style: { color: trace.color }
                    })
                });
            }
        }

        if (this.items.length == 0) {
            this.itemsElement.replaceChildren(
                h(
                    "span",
                    { className: "EezStudio_BB3Plus_Muted" },
                    traces.length > 0
                        ? "Add the measurements of the channels: RMS, max, min, frequency…"
                        : "The measurements of the channels are here."
                )
            );
            return;
        }
        this.itemsElement.replaceChildren(
            ...this.items.map(item =>
                h(
                    "div",
                    {
                        className: "item",
                        title: MEASUREMENTS.find(
                            measurement => measurement.kind == item.kind
                        )!.title
                    },
                    h(
                        "span",
                        { className: "label" },
                        `${item.trace.name} ${getMeasurementLabel(item.kind)}`
                    ),
                    item.value,
                    h(
                        "button",
                        {
                            type: "button",
                            className: "remove",
                            title: "Remove the measurement",
                            onclick: () =>
                                toggleMeasurement(
                                    this.bb3PlusInstrument,
                                    item.trace,
                                    item.kind
                                )
                        },
                        svgIcon(ICONS.close, 10, 2.5)
                    )
                )
            )
        );
    }

    updateStats(stats: Map<ScopeTrace, SampleStats | undefined>) {
        for (const item of this.items) {
            setText(
                item.value,
                formatMeasurement(stats.get(item.trace), item.kind, item.unit)
            );
        }
    }

    // a trace: its measurements; more: a submenu per trace
    private getAddItems(): MenuItem[] {
        const bb3PlusInstrument = this.bb3PlusInstrument;
        const traces = this.analogTraces;
        if (traces.length == 0) {
            return [{ label: "No channels with values", disabled: true }];
        }
        if (traces.length == 1) {
            return [
                { type: "header", label: traces[0].name },
                ...getMeasurementItems(bb3PlusInstrument, traces[0])
            ];
        }
        return traces.map(trace => ({
            label: trace.name,
            color: trace.color,
            detail:
                trace.measurements.length > 0
                    ? String(trace.measurements.length)
                    : undefined,
            submenu: () => getMeasurementItems(bb3PlusInstrument, trace)
        }));
    }
}

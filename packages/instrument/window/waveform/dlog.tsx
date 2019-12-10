import React from "react";
import { observable, computed, reaction, toJS } from "mobx";

import { objectEqual, formatDateTimeLong } from "eez-studio-shared/util";
import { capitalize } from "eez-studio-shared/string";
import { logUpdate, IActivityLogEntry } from "eez-studio-shared/activity-log";
import {
    IUnit,
    TIME_UNIT,
    VOLTAGE_UNIT,
    CURRENT_UNIT,
    POWER_UNIT,
    UNITS
} from "eez-studio-shared/units";
import { Point } from "eez-studio-shared/geometry";

import {
    AxisController,
    ChartController,
    ChartMode,
    ChartsController,
    IAxisModel,
    ZoomMode,
    LineController
} from "eez-studio-ui/chart/chart";
import { RulersModel } from "eez-studio-ui/chart/rulers";
import { MeasurementsModel } from "eez-studio-ui/chart/measurements";
import { IWaveform } from "eez-studio-ui/chart/render";
import { WaveformFormat, initValuesAccesor } from "eez-studio-ui/chart/buffer";
import { getNearestValuePoint } from "eez-studio-ui/chart/generic-chart";
import { WaveformModel } from "eez-studio-ui/chart/waveform";

import { InstrumentAppStore } from "instrument/window/app-store";
import { ChartPreview } from "instrument/window/chart-preview";

import { FileHistoryItem } from "instrument/window/history/items/file";

import { MIME_EEZ_DLOG, checkMime } from "instrument/connection/file-type";

import { ViewOptions } from "instrument/window/waveform/generic";
import { WaveformTimeAxisModel } from "instrument/window/waveform/time-axis";
import { WaveformLineView } from "instrument/window/waveform/line-view";
import { WaveformToolbar } from "instrument/window/waveform/toolbar";

////////////////////////////////////////////////////////////////////////////////

enum Fields {
    FIELD_ID_X_UNIT = 10,
    FIELD_ID_X_STEP = 11,
    FIELD_ID_X_RANGE_MIN = 12,
    FIELD_ID_X_RANGE_MAX = 13,
    FIELD_ID_X_LABEL = 14,

    FIELD_ID_Y_UNIT = 30,
    FIELD_ID_Y_RANGE_MIN = 32,
    FIELD_ID_Y_RANGE_MAX = 33,
    FIELD_ID_Y_LABEL = 34,
    FIELD_ID_Y_CHANNEL_INDEX = 35,

    FIELD_ID_CHANNEL_MODULE_TYPE = 50,
    FIELD_ID_CHANNEL_MODULE_REVISION = 51
}

interface IDlogXAxis {
    unit: IUnit;
    step: number;
    range: {
        min: number;
        max: number;
    };
    label: string;
}

interface IDlogYAxis {
    unit: IUnit;
    range?: {
        min: number;
        max: number;
    };
    label?: string;
    channelIndex: number;
}

interface IDlog {
    version: number;
    xAxis: IDlogXAxis;
    yAxes: IDlogYAxis[];
    dataOffset: number;
    length: number;

    // legacy, version 1
    startTime?: Date;
    hasJitterColumn: boolean;
}

const DLOG_MAGIC1 = 0x2d5a4545;
const DLOG_MAGIC2 = 0x474f4c44;
const DLOG_VERSION1 = 0x0001;
const DLOG_VERSION2 = 0x0002;

function decodeDlog(data: Uint8Array): IDlog | undefined {
    const buffer = Buffer.allocUnsafe(4);

    function readFloat(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readFloatLE(0);
    }

    function readUInt8(i: number) {
        buffer[0] = data[i];
        return buffer.readUInt8(0);
    }

    function readUInt16(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        return buffer.readUInt16LE(0);
    }

    function readUInt32(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readUInt32LE(0);
    }

    function getUnit(unit: number) {
        enum FirmwareUnit {
            UNIT_UNKNOWN,
            UNIT_VOLT,
            UNIT_MILLI_VOLT,
            UNIT_AMPER,
            UNIT_MILLI_AMPER,
            UNIT_MICRO_AMPER,
            UNIT_WATT,
            UNIT_MILLI_WATT,
            UNIT_SECOND,
            UNIT_MILLI_SECOND,
            UNIT_CELSIUS,
            UNIT_RPM,
            UNIT_OHM,
            UNIT_KOHM,
            UNIT_MOHM,
            UNIT_PERCENT,
            UNIT_FREQUENCY,
            UNIT_JOULE
        }

        if (unit === FirmwareUnit.UNIT_VOLT) {
            return UNITS.volt;
        } else if (unit === FirmwareUnit.UNIT_AMPER) {
            return UNITS.ampere;
        } else if (unit === FirmwareUnit.UNIT_WATT) {
            return UNITS.watt;
        } else if (unit === FirmwareUnit.UNIT_SECOND) {
            return UNITS.time;
        } else if (unit === FirmwareUnit.UNIT_JOULE) {
            return UNITS.joule;
        } else {
            return UNITS.unknown;
        }
    }

    function readColumns() {
        const columns = readUInt32(12);
        for (let iChannel = 0; iChannel < 8; iChannel++) {
            if (columns & (1 << (4 * iChannel))) {
                yAxes.push({
                    unit: VOLTAGE_UNIT,
                    channelIndex: iChannel
                });
            }

            if (columns & (2 << (4 * iChannel))) {
                yAxes.push({
                    unit: CURRENT_UNIT,
                    channelIndex: iChannel
                });
            }

            if (columns & (4 << (4 * iChannel))) {
                yAxes.push({
                    unit: POWER_UNIT,
                    channelIndex: iChannel
                });
            }
        }
    }

    function readFields() {
        let offset = 16;
        while (offset < dataOffset) {
            const fieldLength = readUInt16(offset);
            if (fieldLength == 0) {
                break;
            }

            offset += 2;

            const fieldId = readUInt8(offset);
            offset++;

            let fieldDataLength = fieldLength - 2 - 1;

            if (fieldId === Fields.FIELD_ID_X_UNIT) {
                xAxis.unit = getUnit(readUInt8(offset));
                offset++;
            } else if (fieldId === Fields.FIELD_ID_X_STEP) {
                xAxis.step = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_RANGE_MIN) {
                xAxis.range.min = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_RANGE_MAX) {
                xAxis.range.max = readFloat(offset);
                offset += 4;
            } else if (fieldId === Fields.FIELD_ID_X_LABEL) {
                xAxis.label = "";
                for (let i = 0; i < fieldDataLength; i++) {
                    xAxis.label += readUInt8(offset);
                    offset++;
                }
            } else if (
                fieldId >= Fields.FIELD_ID_Y_UNIT &&
                fieldId <= Fields.FIELD_ID_Y_CHANNEL_INDEX
            ) {
                let yAxisIndex = readUInt8(offset);
                offset++;

                yAxisIndex--;
                while (yAxisIndex >= yAxes.length) {
                    yAxes.push({
                        unit: VOLTAGE_UNIT,
                        range: {
                            min: 0,
                            max: 1
                        },
                        label: "",
                        channelIndex: 0
                    });
                }

                fieldDataLength -= 1;

                if (fieldId === Fields.FIELD_ID_Y_UNIT) {
                    yAxes[yAxisIndex].unit = getUnit(readUInt8(offset));
                    offset++;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MIN) {
                    yAxes[yAxisIndex].range!.min = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_RANGE_MAX) {
                    yAxes[yAxisIndex].range!.max = readFloat(offset);
                    offset += 4;
                } else if (fieldId === Fields.FIELD_ID_Y_LABEL) {
                    let label = "";
                    for (let i = 0; i < fieldDataLength; i++) {
                        label += readUInt8(offset);
                        offset++;
                    }
                    yAxes[yAxisIndex].label = label;
                } else if (fieldId === Fields.FIELD_ID_Y_CHANNEL_INDEX) {
                    yAxes[yAxisIndex].channelIndex = readUInt8(offset) - 1;
                    offset++;
                } else {
                    // unknown field, skip
                    offset += fieldDataLength;
                }
            } else if (fieldId === Fields.FIELD_ID_CHANNEL_MODULE_TYPE) {
                readUInt8(offset); // channel index
                offset++;
                readUInt16(offset); // module type
                offset += 2;
            } else if (fieldId == Fields.FIELD_ID_CHANNEL_MODULE_REVISION) {
                readUInt8(offset); // channel index
                offset++;
                readUInt16(offset); // module revision
                offset += 2;
            } else {
                // unknown field, skip
                offset += fieldDataLength;
            }
        }
    }

    if (readUInt32(0) !== DLOG_MAGIC1) {
        return undefined;
    }

    if (readUInt32(4) !== DLOG_MAGIC2) {
        return undefined;
    }

    const version = readUInt16(8);
    if (version !== DLOG_VERSION1 && version !== DLOG_VERSION2) {
        return undefined;
    }

    let dataOffset = version == 1 ? 28 : readUInt32(12);

    let xAxis: IDlogXAxis = {
        unit: TIME_UNIT,
        step: 1,
        range: {
            min: 0,
            max: 1
        },
        label: ""
    };

    let yAxes: IDlogYAxis[] = [];

    let startTime = undefined;
    let hasJitterColumn = false;

    if (version == 1) {
        xAxis.step = readFloat(16);

        readColumns();

        startTime = new Date(readUInt32(24) * 1000);
        hasJitterColumn = version === 1 ? !!(readUInt16(10) & 0x0001) : false;
    } else {
        readFields();
        startTime = undefined;
        hasJitterColumn = false;
    }

    let length = (data.length - dataOffset) / (((hasJitterColumn ? 1 : 0) + yAxes.length) * 4);

    return {
        version,
        xAxis,
        yAxes,
        dataOffset,
        length,
        startTime,
        hasJitterColumn
    };
}

export function isDlog(dataSample: Uint8Array) {
    return !!decodeDlog(dataSample);
}

export function convertDlogToCsv(data: Uint8Array) {
    const dlog = decodeDlog(data);
    if (!dlog) {
        return undefined;
    }

    const buffer = Buffer.allocUnsafe(4);

    function readFloat(i: number) {
        buffer[0] = data[i];
        buffer[1] = data[i + 1];
        buffer[2] = data[i + 2];
        buffer[3] = data[i + 3];
        return buffer.readFloatLE(0);
    }

    const numColumns = (dlog.hasJitterColumn ? 1 : 0) + dlog.yAxes.length;

    let csv = "";
    for (let rowIndex = 0; rowIndex < dlog.length; rowIndex++) {
        for (let columnIndex = 0; columnIndex < dlog.yAxes.length; columnIndex++) {
            if (columnIndex > 0) {
                csv += ",";
            }
            csv += readFloat(
                dlog.dataOffset +
                    4 * (rowIndex * numColumns + (dlog.hasJitterColumn ? 1 : 0) + columnIndex)
            ).toString();
        }
        csv += "\n";
    }

    return Buffer.from(csv, "utf8");
}

export function isDlogWaveform(activityLogEntry: IActivityLogEntry) {
    return checkMime(activityLogEntry.message, [MIME_EEZ_DLOG]);
}

////////////////////////////////////////////////////////////////////////////////

export class DlogWaveformAxisModel implements IAxisModel {
    unit: IUnit;

    constructor(public yAxis: IDlogYAxis) {
        this.unit = yAxis.unit;
    }

    get minValue() {
        if (this.yAxis.range) {
            return this.yAxis.range.min;
        }

        return 0;
    }

    get maxValue() {
        if (this.yAxis.range) {
            return this.yAxis.range.max;
        }

        if (this.yAxis.unit.name === "voltage") {
            return 40;
        }

        if (this.yAxis.unit.name === "current") {
            return 5;
        }

        return 200;
    }

    get defaultFrom() {
        return this.minValue;
    }

    get defaultTo() {
        return this.maxValue;
    }

    @observable
    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "default",
        from: 0,
        to: 0
    };

    @observable
    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "default",
        subdivisionOffset: 0,
        subdivisonScale: 0
    };
    defaultSubdivisionOffset: number | undefined = undefined;
    defaultSubdivisionScale: number | undefined = undefined;

    @computed
    get label() {
        return `Channel ${this.yAxis.channelIndex + 1} ${this.yAxis.label ||
            capitalize(this.yAxis.unit.name)}`;
    }

    @computed
    get color() {
        return this.yAxis.unit.color;
    }

    @computed
    get colorInverse() {
        return this.yAxis.unit.colorInverse;
    }
}

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformLineController extends LineController {
    constructor(
        public id: string,
        public dlogWaveform: DlogWaveform,
        public yAxisController: AxisController,
        channel: IChannel,
        values: any,
        dataOffset: number
    ) {
        super(id, yAxisController);

        let rowOffset = dataOffset;
        const rowBytes =
            4 * ((this.dlogWaveform.hasJitterColumn ? 1 : 0) + this.dlogWaveform.channels.length);
        const length = (values.length - rowOffset) / rowBytes;

        if (this.dlogWaveform.hasJitterColumn) {
            rowOffset += 4; // skip jitter column
        }

        for (let i = 0; i < this.dlogWaveform.channels.length; i++) {
            if (
                this.dlogWaveform.channels[i].iChannel === channel.iChannel &&
                this.dlogWaveform.channels[i].unit === channel.unit
            ) {
                break;
            }
            rowOffset += 4;
        }

        this.waveform = {
            format: WaveformFormat.EEZ_DLOG,
            values,
            length,
            value: undefined as any,
            offset: rowOffset,
            scale: rowBytes,
            samplingRate: this.dlogWaveform.samplingRate,
            waveformData: undefined as any,
            valueUnit: yAxisController.unit.name as keyof typeof UNITS
        };

        initValuesAccesor(this.waveform);
    }

    waveform: IWaveform & {
        valueUnit: keyof typeof UNITS;
    };

    @computed
    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        return this.yAxisController.axisModel.maxValue;
    }

    getNearestValuePoint(point: Point): Point {
        return getNearestValuePoint(
            point,
            this.xAxisController,
            this.yAxisController,
            this.waveform
        );
    }

    render(): JSX.Element {
        return <WaveformLineView key={this.id} waveformLineController={this} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformChartsController extends ChartsController {
    constructor(public dlogWaveform: DlogWaveform, mode: ChartMode, xAxisModel: IAxisModel) {
        super(mode, xAxisModel, dlogWaveform.viewOptions);
    }

    get chartViewOptionsProps() {
        return {
            showRenderAlgorithm: true,
            showShowSampledDataOption: false
        };
    }

    get supportRulers() {
        return true;
    }

    getWaveformModel(chartIndex: number): WaveformModel {
        // TODO remove "as any"
        return (this.chartControllers[chartIndex].lineControllers[0] as DlogWaveformLineController)
            .waveform as any;
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IDlogChart {}

interface IChannel {
    iChannel: number;
    unit: IUnit;
    axisModel: IAxisModel;
}

export class DlogWaveform extends FileHistoryItem {
    constructor(
        activityLogEntry: IActivityLogEntry | FileHistoryItem,
        appStore: InstrumentAppStore
    ) {
        super(activityLogEntry, appStore);

        const message = JSON.parse(this.message);

        this.viewOptions = new ViewOptions(message.viewOptions);
        this.rulers = new RulersModel(message.rulers);
        this.measurements = new MeasurementsModel(message.measurements);

        // save viewOptions when changed
        reaction(
            () => toJS(this.viewOptions),
            viewOptions => {
                const message = JSON.parse(this.message);
                if (!objectEqual(message.viewOptions, viewOptions)) {
                    logUpdate(
                        this.appStore.history.options.store,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: JSON.stringify(
                                Object.assign(message, {
                                    viewOptions
                                })
                            )
                        },
                        {
                            undoable: false
                        }
                    );
                }
            }
        );

        // save rulers when changed
        reaction(
            () => toJS(this.rulers),
            rulers => {
                if (rulers.pauseDbUpdate) {
                    return;
                }
                delete rulers.pauseDbUpdate;

                const message = JSON.parse(this.message);
                if (!objectEqual(message.rulers, rulers)) {
                    logUpdate(
                        this.appStore.history.options.store,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: JSON.stringify(
                                Object.assign(message, {
                                    rulers
                                })
                            )
                        },
                        {
                            undoable: false
                        }
                    );
                }
            }
        );

        // save measurements when changed
        reaction(
            () => toJS(this.measurements),
            measurements => {
                const message = JSON.parse(this.message);
                if (!objectEqual(message.measurements, measurements)) {
                    logUpdate(
                        this.appStore.history.options.store,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: JSON.stringify(
                                Object.assign(message, {
                                    measurements
                                })
                            )
                        },
                        {
                            undoable: false
                        }
                    );
                }
            }
        );

        // make sure there is one Y ruler for each chart
        reaction(
            () => this.channels.length,
            numCharts => this.rulers.initYRulers(this.channels.length)
        );
    }

    @computed
    get values() {
        if (!this.transferSucceeded) {
            return undefined;
        }

        if (typeof this.data === "string") {
            return new Uint8Array(new Buffer(this.data, "binary").buffer);
        }

        return this.data;
    }

    @computed
    get dlog() {
        return (
            (this.values && decodeDlog(this.values)) || {
                version: 1,
                xAxis: {
                    unit: TIME_UNIT,
                    step: 1,
                    range: {
                        min: 0,
                        max: 1
                    },
                    label: ""
                },
                yAxes: [],
                dataOffset: 0,
                length: 0,
                startTime: undefined,
                hasJitterColumn: false
            }
        );
    }

    @computed
    get version() {
        return this.dlog.version;
    }

    @computed
    get xAxisUnit() {
        return this.dlog.xAxis.unit;
    }

    @computed
    get samplingRate() {
        return 1 / this.dlog.xAxis.step;
    }

    @computed
    get startTime() {
        return this.dlog.startTime;
    }

    @computed
    get channels() {
        return this.dlog.yAxes.map(yAxis => ({
            iChannel: yAxis.channelIndex,
            unit: yAxis.unit,
            axisModel: new DlogWaveformAxisModel(yAxis)
        })) as IChannel[];
    }

    @computed
    get hasJitterColumn() {
        return this.dlog.hasJitterColumn;
    }

    @computed
    get length() {
        return this.dlog.length;
    }

    @computed
    get dataOffset() {
        return this.dlog.dataOffset;
    }

    @observable
    charts: IDlogChart = [];

    @computed
    get description() {
        if (!this.values) {
            return null;
        }

        const step = this.dlog.xAxis.step;
        const stepStr = this.dlog.xAxis.unit.formatValue(step, 4);

        const max = (this.length - 1) * this.dlog.xAxis.step;
        const maxStr = this.dlog.xAxis.unit.formatValue(max, 4);

        let info;
        if (this.dlog.xAxis.unit === TIME_UNIT) {
            info = `Period: ${stepStr}, Duration: ${maxStr}`;
        } else {
            info = `Step: ${stepStr}, Max: ${maxStr}`;
        }

        if (this.startTime) {
            info = `Start time: ${formatDateTimeLong(this.startTime)}, ${info}`;
        }

        return <div>{info}</div>;
    }

    createChartController(chartsController: ChartsController, channel: IChannel) {
        const id = `ch${channel.iChannel + 1}_${channel.unit.name}`;

        const chartController = new ChartController(chartsController, id);

        chartController.createYAxisController(channel.axisModel);

        const lineController = new DlogWaveformLineController(
            "waveform-" + chartController.yAxisController.position,
            this,
            chartController.yAxisController,
            channel,
            this.values || "",
            this.dataOffset
        );

        chartController.lineControllers.push(lineController);

        return chartController;
    }

    viewOptions: ViewOptions;
    rulers: RulersModel;
    measurements: MeasurementsModel;

    xAxisModel = new WaveformTimeAxisModel(this);

    chartsController: ChartsController;

    createChartsController(mode: ChartMode): ChartsController {
        if (
            this.chartsController &&
            this.chartsController.mode === mode &&
            this.chartsController.chartControllers.length === this.channels.length
        ) {
            return this.chartsController;
        }

        const chartsController = new DlogWaveformChartsController(this, mode, this.xAxisModel);
        this.chartsController = chartsController;

        this.xAxisModel.chartsController = chartsController;

        chartsController.chartControllers = this.channels.map(channel =>
            this.createChartController(chartsController, channel)
        );

        chartsController.createRulersController(this.rulers);
        chartsController.createMeasurementsController(this.measurements);

        return chartsController;
    }

    renderToolbar(chartsController: ChartsController): JSX.Element {
        return <WaveformToolbar chartsController={chartsController} waveform={this} />;
    }

    get xAxisDefaultSubdivisionOffset(): number | undefined {
        return undefined;
    }

    get xAxisDefaultSubdivisionScale(): number | undefined {
        return undefined;
    }

    get yAxisDefaultSubdivisionOffset(): number | undefined {
        return undefined;
    }

    get yAxisDefaultSubdivisionScale(): number | undefined {
        return undefined;
    }

    @computed
    get previewElement() {
        return <ChartPreview data={this} />;
    }
}

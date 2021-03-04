import React from "react";
import { observable, computed, reaction, toJS, runInAction } from "mobx";

import { objectEqual, formatDateTimeLong } from "eez-studio-shared/util";
import { capitalize } from "eez-studio-shared/string";
import { logUpdate, IActivityLogEntry } from "eez-studio-shared/activity-log";
import { TIME_UNIT, UNKNOWN_UNIT, UNITS, IUnit } from "eez-studio-shared/units";
import { Point } from "eez-studio-shared/geometry";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { log } from "eez-studio-shared/activity-log";
import { readBinaryFile } from "eez-studio-shared/util-electron";

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

import { MIME_EEZ_DLOG } from "instrument/connection/file-type";

import { FileHistoryItem } from "instrument/window/history/items/file";

import { ViewOptions } from "instrument/window/waveform/generic";
import { WaveformTimeAxisModel } from "instrument/window/waveform/time-axis";
import { WaveformLineView } from "instrument/window/waveform/line-view";
import { WaveformToolbar } from "instrument/window/waveform/toolbar";

import {
    DataType,
    Unit,
    IDlog,
    IDlogYAxis,
    decodeDlog,
    ScaleType
} from "instrument/window/waveform/dlog-file";
import { dlogUnitToStudioUnit } from "instrument/connection/file-type-utils";

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformAxisModel implements IAxisModel {
    constructor(
        public yAxis: IDlogYAxis<IUnit>,
        public semiLogarithmic?: { a: number; b: number },
        private yAxes?: IDlogYAxis<IUnit>[]
    ) {}

    get unit() {
        return this.yAxis.unit;
    }

    get minValue() {
        if (this.semiLogarithmic) {
            return 0;
        }

        if (this.yAxis.range) {
            return this.yAxis.range.min;
        }

        return 0;
    }

    get maxValue() {
        if (this.semiLogarithmic) {
            const logOffset = 1 - this.yAxis.range!.min;
            return Math.log10(logOffset + this.yAxis.range!.max);
        }

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

    @observable dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "default",
        from: 0,
        to: 0
    };

    @observable fixed: {
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
        function getLabel(yAxis: IDlogYAxis<IUnit>) {
            return yAxis.label
                ? yAxis.label
                : `Channel ${yAxis.channelIndex + 1} ${capitalize(
                      yAxis.unit.name
                  )}`;
        }

        if (this.yAxes) {
            return this.yAxes.map(getLabel).join(", ");
        }

        return getLabel(this.yAxis);
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

class TransformedAxisController extends AxisController {
    constructor(axisController: AxisController, from: number, to: number) {
        super(
            axisController.position,
            axisController.chartsController,
            axisController.chartController,
            axisController.axisModel
        );
        this._from = from;
        this._to = to;
    }

    _from: number;
    _to: number;

    get from() {
        return this._from;
    }

    get to() {
        return this._to;
    }

    get ticks() {
        return [];
    }

    panByDirection(direction: number): void {}
    panTo(to: number): void {}
    zoomAll(): void {}
    zoomDefault(): void {}
    zoomIn(): void {}
    zoomOut(): void {}
    zoom(from: number, to: number): void {}
    zoomAroundPivotPoint(pivotPx: number, zoomIn: boolean): void {}
}

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformLineController extends LineController {
    constructor(
        public id: string,
        public dlogWaveform: DlogWaveform,
        yAxisController: AxisController,
        private channel: IChannel,
        values: any,
        dataOffset: number,
        private channelsGroup: IChannelsGroup
    ) {
        super(id, yAxisController);

        const yAxisIndex = this.dlogWaveform.channels.indexOf(channel);

        const columnDataIndex = dlogWaveform.dlog.columnDataIndexes[yAxisIndex];
        const numBytesPerRow = dlogWaveform.dlog.numBytesPerRow;

        const length = dlogWaveform.dlog.length;

        this.waveform = {
            format:
                dlogWaveform.dlog.yAxisScaleType === ScaleType.LINEAR
                    ? WaveformFormat.EEZ_DLOG
                    : WaveformFormat.EEZ_DLOG_LOGARITHMIC,
            values,
            offset: 0,
            scale: 1,

            dlog: {
                dataType: dlogWaveform.dlog.yAxes[yAxisIndex].dataType,
                dataOffset,
                dataContainsSampleValidityBit:
                    dlogWaveform.dlog.dataContainsSampleValidityBit,
                columnDataIndex,
                numBytesPerRow,
                bitMask: dlogWaveform.dlog.columnBitMask[yAxisIndex],
                logOffset: channel.yAxis.range
                    ? 1 - channel.yAxis.range.min
                    : 0,
                transformOffset:
                    dlogWaveform.dlog.yAxes[yAxisIndex].transformOffset,
                transformScale:
                    dlogWaveform.dlog.yAxes[yAxisIndex].transformScale
            },

            length,
            value: undefined as any,
            waveformData: undefined as any,

            samplingRate: this.dlogWaveform.samplingRate,
            valueUnit: yAxisController.unit.name as keyof typeof UNITS
        };

        initValuesAccesor(this.waveform);
    }

    waveform: IWaveform & {
        valueUnit: keyof typeof UNITS;
    };

    @computed get yAxisController() {
        const yAxisController = super.yAxisController;

        if (this.channel.yAxis.dataType === DataType.DATA_TYPE_BIT) {
            const offset =
                1.0 -
                (this.channelsGroup.channels.indexOf(this.channel) + 1) /
                    this.channelsGroup.channels.length +
                1 / 20;

            const scale = 1.0 / this.channelsGroup.channels.length - 2 / 20;

            const from = (yAxisController.from - offset) / scale;
            const to = (yAxisController.to - offset) / scale;

            return new TransformedAxisController(yAxisController, from, to);
        }

        return yAxisController;
    }

    @computed
    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        return this.yAxisController.axisModel.maxValue;
    }

    get label() {
        return this.channel.axisModel.label;
    }

    getWaveformModel(): WaveformModel {
        return this.waveform;
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
        return (
            <WaveformLineView
                key={this.id}
                waveformLineController={this}
                label={this.channel.axisModel.label}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformChartsController extends ChartsController {
    constructor(
        public dlogWaveform: DlogWaveform,
        mode: ChartMode,
        xAxisModel: IAxisModel
    ) {
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

    get bookmarks() {
        return this.dlogWaveform.dlog.bookmarks.length > 0
            ? this.dlogWaveform.dlog.bookmarks
            : undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IDlogChart {}

interface IChannel {
    yAxis: IDlogYAxis<IUnit>;
    axisModel: IAxisModel;
}

interface IChannelsGroup {
    id: string;
    channels: IChannel[];
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
                    const messageStr = JSON.stringify(
                        Object.assign(message, {
                            measurements
                        })
                    );
                    runInAction(() => (this.message = messageStr));
                    logUpdate(
                        this.appStore.history.options.store,
                        {
                            id: this.id,
                            oid: this.oid,
                            message: messageStr
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
    get dlog(): IDlog<IUnit> {
        return (
            (this.values && decodeDlog(this.values, dlogUnitToStudioUnit)) || {
                version: 1,
                xAxis: {
                    unit: TIME_UNIT,
                    step: 1,
                    scaleType: ScaleType.LINEAR,
                    range: {
                        min: 0,
                        max: 1
                    },
                    label: ""
                },
                yAxis: {
                    dataType: DataType.DATA_TYPE_FLOAT,
                    dlogUnit: Unit.UNIT_UNKNOWN,
                    unit: UNKNOWN_UNIT,
                    range: {
                        min: 0,
                        max: 1
                    },
                    label: "",
                    channelIndex: -1,
                    transformOffset: 0,
                    transformScale: 1.0
                },
                yAxisScaleType: ScaleType.LINEAR,
                yAxes: [],
                dataOffset: 0,
                textIndexFileOffset: 0,
                textFileOffset: 0,
                bookmarks: [],
                dataContainsSampleValidityBit: false,
                columnDataIndexes: [0],
                columnBitMask: [0],
                numBytesPerRow: 1,
                length: 0,
                startTime: undefined,
                duration: 0,
                hasJitterColumn: false,
                getValue: (rowIndex: number, columnIndex: number) => 0
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
    get xAxisLabel() {
        return this.dlog.xAxis.label;
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
            yAxis,
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

    @observable charts: IDlogChart = [];

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

    createLineController(
        chartController: ChartController,

        channel: IChannel,

        channelsGroup: IChannelsGroup
    ) {
        return new DlogWaveformLineController(
            "waveform-" +
                chartController.yAxisController.position +
                "-" +
                this.channels.indexOf(channel),
            this,
            chartController.yAxisController,
            channel,
            this.values || "",
            this.dataOffset,
            channelsGroup
        );
    }

    @computed get channelsGroups(): IChannelsGroup[] {
        const channelsGroups: IChannelsGroup[] = [];

        function compareYAxis(
            yAxis1: IDlogYAxis<IUnit>,
            yAxis2: IDlogYAxis<IUnit>
        ) {
            if (yAxis1.unit != yAxis2.unit) {
                return false;
            }

            if (yAxis1.range && yAxis2.range) {
                if (
                    yAxis1.range.min != yAxis2.range.min ||
                    yAxis1.range.max != yAxis2.range.max
                ) {
                    return false;
                }
            } else if (yAxis1.range || yAxis2.range) {
                return false;
            }

            return true;
        }

        function findChannelsGroup(yAxis: IDlogYAxis<IUnit>) {
            for (
                let channelsGroupIndex = 0;
                channelsGroupIndex < channelsGroups.length;
                channelsGroupIndex++
            ) {
                const channelsGroup = channelsGroups[channelsGroupIndex];
                if (compareYAxis(yAxis, channelsGroup.channels[0].yAxis)) {
                    return channelsGroup;
                }
            }
            return undefined;
        }

        for (
            let yAxisIndex = 0;
            yAxisIndex < this.dlog.yAxes.length;
            yAxisIndex++
        ) {
            const yAxis = this.dlog.yAxes[yAxisIndex];
            const channelsGroup = findChannelsGroup(yAxis);
            const channel = this.channels[yAxisIndex];
            if (channelsGroup) {
                channelsGroup.channels.push(channel);
            } else {
                channelsGroups.push({
                    id: `dlog_chart_controller_${yAxisIndex}`,
                    channels: [channel]
                });
            }
        }

        return channelsGroups;
    }

    createChartControllerForChannelsGroup(
        chartsController: ChartsController,

        channelsGroup: IChannelsGroup
    ) {
        const chartController = new ChartController(
            chartsController,

            channelsGroup.id
        );

        const yAxis = channelsGroup.channels[0].yAxis;

        chartController.createYAxisController(
            new DlogWaveformAxisModel(
                yAxis,
                this.dlog.yAxisScaleType == ScaleType.LOGARITHMIC
                    ? {
                          a: 0,
                          b: -(1 - yAxis.range!.min)
                      }
                    : undefined,
                channelsGroup.channels.map(channel => channel.yAxis)
            )
        );

        if (yAxis.dataType === DataType.DATA_TYPE_BIT) {
            chartController.yAxisController.isDigital = true;
        }

        channelsGroup.channels.forEach(channel => {
            chartController.lineControllers.push(
                this.createLineController(
                    chartController,

                    channel,

                    channelsGroup
                )
            );
        });

        return chartController;
    }

    viewOptions: ViewOptions;
    rulers: RulersModel;
    measurements: MeasurementsModel;

    @computed get xAxisModel() {
        return new WaveformTimeAxisModel(
            this,
            this.dlog.xAxis.scaleType === ScaleType.LOGARITHMIC
                ? {
                      a: this.dlog.xAxis.range.min,
                      b: 0
                  }
                : undefined
        );
    }

    chartsController: ChartsController;

    createChartsController(mode: ChartMode): ChartsController {
        if (
            this.chartsController &&
            this.chartsController.mode === mode &&
            this.chartsController.chartControllers &&
            this.chartsController.chartControllers.length ===
                this.channels.length
        ) {
            return this.chartsController;
        }

        if (this.chartsController) {
            this.chartsController.destroy();
        }

        const chartsController = new DlogWaveformChartsController(
            this,
            mode,
            this.xAxisModel
        );
        this.chartsController = chartsController;

        this.xAxisModel.chartsController = chartsController;

        chartsController.chartControllers = this.channelsGroups.map(
            channelsGroup =>
                this.createChartControllerForChannelsGroup(
                    chartsController,
                    channelsGroup
                )
        );

        chartsController.createRulersController(this.rulers);
        chartsController.createMeasurementsController(this.measurements);

        return chartsController;
    }

    renderToolbar(chartsController: ChartsController): JSX.Element {
        return (
            <WaveformToolbar
                chartsController={chartsController}
                waveform={this}
            />
        );
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

////////////////////////////////////////////////////////////////////////////////

export async function importDlog(
    appStore: InstrumentAppStore,
    filePath: string
) {
    if (!filePath.toLowerCase().endsWith(".dlog")) {
        return false;
    }

    const data = await readBinaryFile(filePath);

    const dlog = decodeDlog(data, unit => unit);
    if (!dlog) {
        return false;
    }

    beginTransaction("Add DLOG chart");

    log(
        appStore.history.options.store,
        {
            oid: appStore.history.oid,
            type: "instrument/file-attachment",
            message: JSON.stringify({
                sourceFilePath: filePath,
                state: "success",
                fileType: {
                    ext: "dlog",
                    mime: MIME_EEZ_DLOG
                },
                dataLength: data.length,
                note: dlog.comment
                    ? JSON.stringify([{ insert: dlog.comment }])
                    : undefined
            }),
            data
        },
        {
            undoable: true
        }
    );

    commitTransaction();

    appStore.navigationStore.navigateToHistory();

    return false;
}

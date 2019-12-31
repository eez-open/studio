import React from "react";
import { observable, computed, reaction, toJS } from "mobx";

import { objectEqual, formatDateTimeLong } from "eez-studio-shared/util";
import { capitalize } from "eez-studio-shared/string";
import { logUpdate, IActivityLogEntry } from "eez-studio-shared/activity-log";
import { IUnit, TIME_UNIT, UNKNOWN_UNIT, UNITS } from "eez-studio-shared/units";
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

import { IDlog, IDlogYAxis, decodeDlog, Scale } from "instrument/window/waveform/dlog-file";

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformAxisModel implements IAxisModel {
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
        return this.yAxis.label
            ? this.yAxis.label
            : `Channel ${this.yAxis.channelIndex + 1} ${capitalize(this.yAxis.unit.name)}`;
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
        private channel: IChannel,
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

        rowOffset += 4 * this.dlogWaveform.channels.indexOf(channel);

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
    yAxis: IDlogYAxis;
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
    get dlog(): IDlog {
        return (
            (this.values && decodeDlog(this.values)) || {
                version: 1,
                xAxis: {
                    unit: TIME_UNIT,
                    step: 1,
                    scale: Scale.LINEAR,
                    range: {
                        min: 0,
                        max: 1
                    },
                    label: ""
                },
                yAxis: {
                    unit: UNKNOWN_UNIT,
                    range: {
                        min: 0,
                        max: 1
                    },
                    label: "",
                    channelIndex: -1
                },
                yAxisScale: Scale.LINEAR,
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

    createLineController(chartController: ChartController, channel: IChannel) {
        return new DlogWaveformLineController(
            "waveform-" +
                chartController.yAxisController.position +
                "-" +
                this.channels.indexOf(channel),
            this,
            chartController.yAxisController,
            channel,
            this.values || "",
            this.dataOffset
        );
    }

    createChartControllerForSingleChannel(chartsController: ChartsController, channel: IChannel) {
        const id = `ch${this.channels.indexOf(channel) + 1}`;
        const chartController = new ChartController(chartsController, id);
        chartController.createYAxisController(channel.axisModel);
        chartController.lineControllers.push(this.createLineController(chartController, channel));
        return chartController;
    }

    createChartControllerForAllChannels(chartsController: ChartsController) {
        const id = "dlog_chart_controller";
        const chartController = new ChartController(chartsController, id);
        chartController.createYAxisController(new DlogWaveformAxisModel(this.dlog.yAxis));
        this.channels.forEach(channel => {
            chartController.lineControllers.push(
                this.createLineController(chartController, channel)
            );
        });
        return chartController;
    }

    @computed
    get singleChart() {
        const firstYAxis = this.dlog.yAxes[0];
        for (let i = 1; i < this.dlog.yAxes.length; i++) {
            const otherYAxis = this.dlog.yAxes[i];
            if (firstYAxis.unit != otherYAxis.unit) {
                return false;
            }

            if (firstYAxis.range && otherYAxis.range) {
                if (
                    firstYAxis.range.min != otherYAxis.range.min ||
                    firstYAxis.range.max != otherYAxis.range.max
                ) {
                    return false;
                }
            } else if (firstYAxis.range || otherYAxis.range) {
                return false;
            }
        }
        return true;
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

        if (this.singleChart) {
            chartsController.chartControllers = [
                this.createChartControllerForAllChannels(chartsController)
            ];
        } else {
            chartsController.chartControllers = this.channels.map(channel =>
                this.createChartControllerForSingleChannel(chartsController, channel)
            );
        }

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

////////////////////////////////////////////////////////////////////////////////

export async function importDlog(appStore: InstrumentAppStore, filePath: string) {
    if (!filePath.toLowerCase().endsWith(".dlog")) {
        return false;
    }

    const data = await readBinaryFile(filePath);

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
                dataLength: data.length
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

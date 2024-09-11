import React from "react";
import {
    observable,
    computed,
    reaction,
    toJS,
    runInAction,
    makeObservable,
    IReactionDisposer
} from "mobx";
import classNames from "classnames";

import { objectEqual, formatDateTimeLong } from "eez-studio-shared/util";
import { capitalize } from "eez-studio-shared/string";
import {
    TIME_UNIT,
    FREQUENCY_UNIT,
    UNITS,
    IUnit
} from "eez-studio-shared/units";
import { Point } from "eez-studio-shared/geometry";
import { IStore } from "eez-studio-shared/store";
import { readBinaryFile } from "eez-studio-shared/util-electron";

import {
    ChartController,
    IChartController,
    ChartMode,
    IAxisModel,
    ZoomMode,
    LineController,
    IAxisController,
    IMeasurementsModel
} from "eez-studio-ui/chart/chart";
import {
    AxisController,
    ChartsController,
    MeasurementsModel,
    IWaveform,
    getNearestValuePoint,
    WaveformModel
} from "eez-studio-ui/chart/chart";
import { RulersModel, IRulersModel } from "eez-studio-ui/chart/rulers";
import { WaveformLineView } from "eez-studio-ui/chart/WaveformLineView";
import { DataType } from "eez-studio-ui/chart/DataType";
import { WaveformFormat } from "eez-studio-ui/chart/WaveformFormat";
import { initValuesAccesor } from "eez-studio-ui/chart/value-accesor";

import {
    logUpdate,
    IActivityLogEntry,
    log
} from "instrument/window/history/activity-log";

import type { InstrumentAppStore } from "instrument/window/app-store";
import { ChartPreview } from "instrument/window/chart-preview";

import { MIME_EEZ_DLOG } from "instrument/connection/file-type";

import { FileHistoryItem } from "instrument/window/history/items/file";

import { ViewOptions } from "instrument/window/waveform/ViewOptions";
import { WaveformTimeAxisModel } from "instrument/window/waveform/time-axis";
import {
    IToolbarOptions,
    WaveformToolbar
} from "instrument/window/waveform/toolbar";

import {
    IDlog,
    IDlogYAxis,
    decodeDlog,
    ScaleType,
    EMPTY_DLOG
} from "instrument/window/waveform/dlog-file";
import {
    convertDlogToCsv,
    dlogUnitToStudioUnit
} from "instrument/connection/file-type-utils";
import type { ChartsDisplayOption } from "instrument/window/lists/common-tools";
import type { IAppStore } from "instrument/window/history/history";
import { globalViewOptions } from "eez-studio-ui/chart/GlobalViewOptions";

////////////////////////////////////////////////////////////////////////////////

class DlogWaveformAxisModel implements IAxisModel {
    constructor(
        public yAxis: IDlogYAxis<IUnit>,
        public semiLogarithmic?: { a: number; b: number },
        private yAxes?: IDlogYAxis<IUnit>[],
        private chartsController?: ChartsController
    ) {
        makeObservable(this, {
            dynamic: observable,
            fixed: observable,
            label: computed,
            color: computed,
            colorInverse: computed
        });
    }

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

    dynamic: {
        zoomMode: ZoomMode;
        from: number;
        to: number;
    } = {
        zoomMode: "all",
        from: 0,
        to: 0
    };

    fixed: {
        zoomMode: ZoomMode;
        subdivisionOffset: number;
        subdivisonScale: number;
    } = {
        zoomMode: "all",
        subdivisionOffset: 0,
        subdivisonScale: 0
    };
    defaultSubdivisionOffset: number | undefined = undefined;
    defaultSubdivisionScale: number | undefined = undefined;

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

    get labelReactNode(): React.ReactNode | undefined {
        if (!this.yAxes || !this.chartsController) {
            return undefined;
        }

        return (
            <div
                className="EezStudio_Chart_Title"
                style={{
                    left: this.chartsController.chartLeft,
                    top: this.chartsController.chartTop,
                    backgroundColor: globalViewOptions.blackBackground
                        ? "rgba(64, 64, 64, 0.8)"
                        : "rgba(255, 255, 255, 0.8)",
                    borderColor: globalViewOptions.blackBackground
                        ? "#999"
                        : "#ccc",
                    fontWeight: "bold"
                }}
            >
                {this.yAxes.map((yAxis, i) => (
                    <div
                        key={i}
                        style={{
                            color: globalViewOptions.blackBackground
                                ? yAxis.color
                                : yAxis.colorInverse
                        }}
                    >
                        {yAxis.label}
                    </div>
                ))}
            </div>
        );
    }

    get color() {
        return this.yAxes && this.yAxes.length > 1
            ? "#fff"
            : this.yAxis.color ?? this.yAxis.unit.color;
    }

    get colorInverse() {
        return this.yAxes && this.yAxes.length > 1
            ? "#333"
            : this.yAxis.colorInverse ?? this.yAxis.unit.colorInverse;
    }
}

////////////////////////////////////////////////////////////////////////////////

class TransformedAxisController extends AxisController {
    constructor(axisController: IAxisController, from: number, to: number) {
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
        yAxisController: IAxisController,
        private channel: IChannel,
        values: any,
        dataOffset: number,
        private channelsGroup: IChannelsGroup
    ) {
        super(id, yAxisController);

        makeObservable(this, {
            yAxisController: computed,
            yMin: computed,
            yMax: computed
        });

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

    get yAxisController() {
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

    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

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
                color={this.channel.yAxis.color}
                colorInverse={this.channel.yAxis.colorInverse}
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
    dispose1: IReactionDisposer | undefined;
    dispose2: IReactionDisposer | undefined;
    dispose3: IReactionDisposer | undefined;
    dispose4: IReactionDisposer | undefined;

    constructor(
        store: IStore,
        activityLogEntry: IActivityLogEntry | FileHistoryItem,
        private options?: { toolbar?: IToolbarOptions }
    ) {
        super(store, activityLogEntry);

        makeObservable(this, {
            values: computed,
            dlog: computed,
            version: computed,
            xAxisUnit: computed,
            xAxisLabel: computed,
            samplingRate: computed,
            startTime: computed,
            channels: computed,
            hasJitterColumn: computed,
            length: computed,
            dataOffset: computed,
            charts: observable,
            channelsGroups: computed,
            xAxisModel: computed
        });

        const message = JSON.parse(this.message);

        this.viewOptions = new ViewOptions(message.viewOptions);
        this.rulers = new RulersModel(message.rulers);
        this.measurements = new MeasurementsModel(message.measurements);

        // save viewOptions when changed
        this.dispose1 = reaction(
            () => toJS(this.viewOptions),
            viewOptions => {
                const message = JSON.parse(this.message);
                if (!objectEqual(message.viewOptions, viewOptions)) {
                    logUpdate(
                        this.store,
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
        this.dispose2 = reaction(
            () => toJS(this.rulers),
            rulers => {
                if (rulers.pauseDbUpdate) {
                    return;
                }
                delete rulers.pauseDbUpdate;

                const message = JSON.parse(this.message);
                if (!objectEqual(message.rulers, rulers)) {
                    const messageStr = JSON.stringify(
                        Object.assign(message, {
                            rulers
                        })
                    );

                    runInAction(() => (this.message = messageStr));

                    logUpdate(
                        this.store,
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

        // save measurements when changed
        this.dispose3 = reaction(
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
                        this.store,
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
        this.dispose4 = reaction(
            () => this.channels.length,
            numCharts => this.rulers.initYRulers(this.channels.length)
        );
    }

    get values() {
        if (!this.transferSucceeded) {
            return undefined;
        }

        if (typeof this.data === "string") {
            return new Uint8Array(Buffer.from(this.data, "binary").buffer);
        }

        return this.data;
    }

    get dlog(): IDlog<IUnit> {
        return (
            (this.values && decodeDlog(this.values, dlogUnitToStudioUnit)) ||
            EMPTY_DLOG
        );
    }

    get version() {
        return this.dlog.version;
    }

    get xAxisUnit() {
        return this.dlog.xAxis.unit;
    }

    get xAxisLabel() {
        return this.dlog.xAxis.label;
    }

    get samplingRate() {
        return 1 / this.dlog.xAxis.step;
    }

    get startTime() {
        return this.dlog.startTime;
    }

    get channels() {
        return this.dlog.yAxes.map(yAxis => ({
            yAxis,
            axisModel: new DlogWaveformAxisModel(yAxis)
        })) as IChannel[];
    }

    get hasJitterColumn() {
        return this.dlog.hasJitterColumn;
    }

    get length() {
        return this.dlog.length;
    }

    get dataOffset() {
        return this.dlog.dataOffset;
    }

    charts: IDlogChart = [];

    get description() {
        if (!this.values) {
            return null;
        }

        const step = this.dlog.xAxis.step;
        const stepStr = this.dlog.xAxis.unit.formatValue(step, 4);

        const sampleRate = 1 / this.dlog.xAxis.step;
        const sampleRateStr = FREQUENCY_UNIT.formatValue(sampleRate, 1);

        const max = (this.length - 1) * step;
        const maxStr = this.dlog.xAxis.unit.formatValue(max, 4);

        let info;
        if (this.dlog.xAxis.unit.name === TIME_UNIT.name) {
            info = `Period: ${stepStr}, Sample rate: ${sampleRateStr}, Duration: ${maxStr}`;
        } else {
            info = `Step: ${stepStr}, Max: ${maxStr}`;
        }

        if (this.startTime) {
            info = `Start time: ${formatDateTimeLong(this.startTime)}, ${info}`;
        }

        return <div>{info}</div>;
    }

    createLineController(
        chartController: IChartController,

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

    get channelsGroups(): IChannelsGroup[] {
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
                channelsGroup.channels.map(channel => channel.yAxis),
                chartsController
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
    rulers: IRulersModel;
    measurements: IMeasurementsModel;

    get xAxisModel() {
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

    createChartsController(
        appStore: IAppStore,
        displayOption: ChartsDisplayOption,
        mode: ChartMode
    ): ChartsController {
        if (
            this.direction != "plotter" &&
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
        chartsController.chartViewWidth = this.chartsController?.chartViewWidth;
        chartsController.chartViewHeight =
            this.chartsController?.chartViewHeight;

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
                options={this.options?.toolbar}
            />
        );
    }

    openConfigurationDialog = undefined;

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

    getPreviewElement(appStore: IAppStore) {
        return (
            <ChartPreview
                appStore={appStore}
                data={this}
                className={classNames({
                    EezStudio_ChartView_Plotter: this.direction === "plotter"
                })}
            />
        );
    }

    get isZoomable() {
        return this.state != "live";
    }

    convertToCsv = async () => {
        return convertDlogToCsv(this.dlog);
    };

    override dispose() {
        super.dispose();

        if (this.dispose1) {
            this.dispose1();
        }

        if (this.dispose2) {
            this.dispose2();
        }

        if (this.dispose3) {
            this.dispose3();
        }

        if (this.dispose4) {
            this.dispose4();
        }
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
            undoable: true,
            transaction: "Add DLOG chart"
        }
    );

    appStore.navigationStore.navigateToHistory();

    return false;
}

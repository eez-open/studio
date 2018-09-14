import * as React from "react";
import { observable, computed } from "mobx";

import { _map, _difference } from "shared/algorithm";
import { UNITS, IUnit } from "shared/units";

import { IChart } from "shared/extensions/extension";

import {
    ChartsView,
    ChartsController,
    IAxisModel,
    IViewOptions,
    IViewOptionsAxesLines,
    IViewOptionsAxesLinesType,
    ChartMode,
    ZoomMode,
    ChartController,
    LineController,
    AxisController
} from "shared/ui/chart/chart";
import { IWaveform } from "shared/ui/chart/render";
import { WaveformFormat } from "shared/ui/chart/buffer";

import { WaveformLineView } from "instrument/window/waveform/line-view";

////////////////////////////////////////////////////////////////////////////////

class GenericChartWaveform implements IWaveform {
    constructor(private chartData: IChart) {
        this.xAxes = {
            unit: UNITS[this.chartData.xAxes.unit]
        };

        let min = chartData.yAxes.minValue;
        let max = chartData.yAxes.maxValue;

        if (min === undefined && max === undefined) {
            min = this.chartData.data[0];
            max = this.chartData.data[0];
            for (let i = 1; i < this.chartData.data.length; ++i) {
                min = Math.min(min, this.chartData.data[i]);
                max = Math.max(max, this.chartData.data[i]);
            }
            const d = (max - min) * 0.1;
            min -= d;
            max += d;
        } else if (min === undefined) {
            min = this.chartData.data[0];
            for (let i = 1; i < this.chartData.data.length; ++i) {
                min = Math.min(min, this.chartData.data[i]);
            }
            const d = (max! - min) * 0.1;
            min -= d;
        } else if (max === undefined) {
            max = this.chartData.data[0];
            for (let i = 1; i < this.chartData.data.length; ++i) {
                max = Math.max(max, this.chartData.data[i]);
            }
            const d = (max - min) * 0.1;
            max += d;
        }

        this.yAxes = {
            minValue: min!,
            maxValue: max!,
            unit: UNITS[this.chartData.yAxes.unit]
        };
    }

    isVisible = true;

    format = WaveformFormat.FLOATS;

    get values() {
        return this.chartData.data;
    }

    get length() {
        return this.chartData.data.length;
    }

    value(i: number) {
        return this.chartData.data[i];
    }

    waveformData(i: number) {
        return this.chartData.data[i];
    }

    offset = 0;
    scale = 1;

    get samplingRate() {
        return this.chartData.samplingRate;
    }

    xAxes: {
        unit: IUnit;
    };

    yAxes: {
        minValue: number;
        maxValue: number;
        unit: IUnit;
    };
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartXAxisModel implements IAxisModel {
    constructor(private data: GenericChartWaveform) {}

    @computed
    get unit() {
        return this.data.xAxes.unit;
    }

    chartsController: ChartsController;

    get minValue() {
        return 0;
    }

    get maxValue() {
        return (this.data.length - 1) / this.data.samplingRate;
    }

    get defaultFrom() {
        return 0;
    }

    get defaultTo() {
        return this.maxValue;
    }

    get minScale() {
        return (
            Math.min(
                this.data.samplingRate,
                this.chartsController.chartWidth / ((this.data.length - 1) / this.data.samplingRate)
            ) / 2
        );
    }

    get maxScale() {
        return 10 * this.data.samplingRate;
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

    get defaultSubdivisionOffset() {
        return 0;
    }

    get defaultSubdivisionScale() {
        return 1;
    }

    label: "";
    color: "";
    colorInverse: "";
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartYAxisModel implements IAxisModel {
    constructor(private data: GenericChartWaveform) {}

    @computed
    get minValue() {
        return this.data.yAxes.minValue;
    }

    @computed
    get maxValue() {
        return this.data.yAxes.maxValue;
    }

    @computed
    get defaultFrom() {
        return this.data.yAxes.minValue;
    }

    @computed
    get defaultTo() {
        return this.data.yAxes.maxValue;
    }

    @computed
    get unit() {
        return this.data.yAxes.unit;
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

    get defaultSubdivisionOffset(): number | undefined {
        return 0;
    }

    get defaultSubdivisionScale() {
        return 1;
    }

    get label() {
        return "";
    }

    get color() {
        return "red";
    }

    get colorInverse() {
        return "green";
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartViewOptions implements IViewOptions {
    constructor(props?: any) {
        if (props) {
            Object.assign(this, props);
        }
    }

    @observable
    axesLines: IViewOptionsAxesLines = {
        type: "dynamic",
        steps: {
            x: [],
            y: []
        },
        majorSubdivision: {
            horizontal: 24,
            vertical: 8
        },
        minorSubdivision: {
            horizontal: 5,
            vertical: 5
        },
        snapToGrid: true
    };

    @observable
    showAxisLabels: boolean = true;
    @observable
    showZoomButtons: boolean = true;

    setAxesLinesType(type: IViewOptionsAxesLinesType) {
        this.axesLines.type = type;
    }

    setAxesLinesMajorSubdivisionHorizontal(value: number) {
        this.axesLines.majorSubdivision.horizontal = value;
    }

    setAxesLinesMajorSubdivisionVertical(value: number) {
        this.axesLines.majorSubdivision.vertical = value;
    }

    setAxesLinesMinorSubdivisionHorizontal(value: number) {
        this.axesLines.minorSubdivision.horizontal = value;
    }

    setAxesLinesMinorSubdivisionVertical(value: number) {
        this.axesLines.minorSubdivision.vertical = value;
    }

    setAxesLinesStepsX(steps: number[]) {
        this.axesLines.steps.x = steps;
    }

    setAxesLinesStepsY(index: number, steps: number[]): void {
        this.axesLines.steps.y[index] = steps;
    }

    setAxesLinesSnapToGrid(value: boolean): void {
        this.axesLines.snapToGrid = value;
    }

    setShowAxisLabels(value: boolean) {
        this.showAxisLabels = value;
    }

    setShowZoomButtons(value: boolean) {
        this.showZoomButtons = value;
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartLineController extends LineController {
    constructor(
        public id: string,
        public waveform: GenericChartWaveform,
        public yAxisController: AxisController
    ) {
        super(id, yAxisController);
    }

    @computed
    get yMin(): number {
        return this.yAxisController.axisModel.minValue;
    }

    @computed
    get yMax(): number {
        return this.yAxisController.axisModel.maxValue;
    }

    render(): JSX.Element {
        return <WaveformLineView key={this.id} waveformLineController={this} useWorker={false} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

class GenericChartChartsController extends ChartsController {
    constructor(
        public data: GenericChartWaveform,
        mode: ChartMode,
        xAxisModel: IAxisModel,
        viewOptions: IViewOptions
    ) {
        super(mode, xAxisModel, viewOptions);
    }

    get chartViewOptionsProps() {
        return {
            showRenderAlgorithm: true,
            showShowSampledDataOption: false
        };
    }

    get supportRulers() {
        return false;
    }

    getWaveformModel(chartIndex: number) {
        return null;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class GenericChart extends React.Component<{
    chart: IChart;
    className?: string;
}> {
    render() {
        const waveform = new GenericChartWaveform(this.props.chart);
        const xAxisModel = new GenericChartXAxisModel(waveform);
        const yAxisModel = new GenericChartYAxisModel(waveform);
        const viewOptions = new GenericChartViewOptions();

        const chartsController = new GenericChartChartsController(
            waveform,
            "interactive",
            xAxisModel,
            viewOptions
        );

        xAxisModel.chartsController = chartsController;

        const chartController = new ChartController(chartsController, "TODO");

        chartsController.chartControllers = [chartController];

        chartController.createYAxisController(yAxisModel);

        chartController.lineControllers.push(
            new GenericChartLineController("TODO", waveform, chartController.yAxisController)
        );

        return (
            <ChartsView
                chartsController={chartsController}
                className={this.props.className}
                sideDockAvailable={false}
            />
        );
    }
}

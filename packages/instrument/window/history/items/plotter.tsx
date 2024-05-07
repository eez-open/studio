import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IStore } from "eez-studio-shared/store";

import { Icon } from "eez-studio-ui/icon";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { IActivityLogEntry } from "instrument/window/history/activity-log";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { PLOTTER_ICON } from "project-editor/ui-components/icons";
import { DlogWaveform } from "instrument/window/waveform/dlog";
import {
    EMPTY_DLOG,
    IDlog,
    ScaleType,
    Unit
} from "instrument/window/waveform/dlog-file";
import { IUnit, TIME_UNIT, UNKNOWN_UNIT } from "eez-studio-shared/units";
import { DataType } from "eez-studio-ui/chart/DataType";
import { lighten } from "eez-studio-shared/color";

////////////////////////////////////////////////////////////////////////////////

interface IPlotterHistoryItemMessage {
    variableNames: string[];
    numPoints: number;
    rate: number;
}

////////////////////////////////////////////////////////////////////////////////
// Plotly based plotter

export const PlotterHistoryItemComponent = observer(
    class PlotterHistoryItemComponent extends React.Component<{
        appStore: IAppStore;
        historyItem: PlotterHistoryItemWithPlotly;
    }> {
        chartDivRef = React.createRef<HTMLDivElement>();
        plotlyInitialized = false;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                variableNames: computed,
                isVariableNamesReady: computed,
                chartData: computed,
                chartLayout: computed,
                chartConfig: computed
            });
        }

        get startTime() {
            const data: Buffer = this.props.historyItem.data;
            return data.readDoubleLE(0);
        }

        get endTime() {
            const data: Buffer = this.props.historyItem.data;
            return data.readDoubleLE(
                data.length - (1 + this.variableNames.length) * 8
            );
        }

        get variableNames() {
            return this.props.historyItem.plotterMessage.variableNames;
        }

        get isVariableNamesReady() {
            return (
                this.variableNames &&
                Array.isArray(this.variableNames) &&
                this.variableNames.length > 0
            );
        }

        get numPoints() {
            return this.props.historyItem.plotterMessage.numPoints;
        }

        get rate() {
            return this.props.historyItem.plotterMessage.rate;
        }

        get chartData(): Plotly.Data[] {
            this.props.historyItem.loadData();

            if (
                !this.isVariableNamesReady ||
                !this.props.historyItem.data ||
                this.props.historyItem.data.length == 0
            ) {
                return [
                    {
                        type: "scatter",
                        x: [],
                        y: []
                    }
                ];
            }

            let x: Date[] = [];
            let y: number[][] = this.variableNames.map(() => []);

            const data: Buffer = this.props.historyItem.data;

            let duration = this.endTime - this.startTime;
            if (duration == 0) {
                duration = 1;
            }

            let offset = 0;
            for (let i = 0; offset + 8 <= data.length; i++) {
                x[i] = new Date(
                    this.startTime + (i / this.numPoints) * duration
                );
                offset += 8;

                for (
                    let j = 0;
                    j < this.variableNames.length && offset + 8 <= data.length;
                    j++
                ) {
                    y[j][i] = data.readDoubleLE(offset);
                    offset += 8;
                }
            }

            return this.variableNames.map((variableName, i) => ({
                type: "scatter",
                name: variableName,
                x,
                y: y[i]
            }));
        }

        get chartLayout() {
            return {
                width: 900,
                height: 540
            };
        }

        get chartConfig() {
            return {};
        }

        updateChart() {
            if (this.chartDivRef.current) {
                if (!this.plotlyInitialized) {
                    const Plotly =
                        require("plotly.js-dist-min") as typeof import("plotly.js-dist-min");

                    this.plotlyInitialized = true;

                    Plotly.newPlot(
                        this.chartDivRef.current!,
                        this.chartData,
                        this.chartLayout,
                        this.chartConfig
                    );
                } else {
                    const Plotly =
                        require("plotly.js-dist-min") as typeof import("plotly.js-dist-min");

                    Plotly.react(
                        this.chartDivRef.current!,
                        this.chartData,
                        this.chartLayout,
                        this.chartConfig
                    );
                }
            } else {
                this.plotlyInitialized = false;
            }
        }

        componentDidMount() {
            this.updateChart();
        }

        componentDidUpdate() {
            this.updateChart();
        }

        componentWillUnmount() {}

        render() {
            this.chartData;
            this.chartLayout;
            this.chartConfig;

            let body;
            if (!this.variableNames) {
                body = <p>Waiting for data ...</p>;
            } else {
                const numPoints = (
                    <p>
                        <span>Num points: </span>
                        {this.numPoints}
                    </p>
                );

                const rate = (
                    <p>
                        <span>Rate: </span>
                        {Math.round(this.rate)} points/sec
                    </p>
                );

                body = (
                    <>
                        {numPoints}
                        {rate}
                        <div ref={this.chartDivRef}></div>
                    </>
                );
            }

            return (
                <div className="EezStudio_PlotterHistoryItem">
                    <Icon className="me-3" icon={PLOTTER_ICON} size={48} />
                    <div>
                        <p>
                            <HistoryItemInstrumentInfo
                                appStore={this.props.appStore}
                                historyItem={this.props.historyItem}
                            />
                            <small className="EezStudio_HistoryItemDate">
                                {formatDateTimeLong(
                                    this.props.historyItem.date
                                )}
                            </small>
                        </p>
                        {this.props.historyItem.getSourceDescriptionElement(
                            this.props.appStore
                        )}
                        {body}
                    </div>
                </div>
            );
        }
    }
);

class PlotterHistoryItemWithPlotly extends HistoryItem {
    constructor(public store: IStore, activityLogEntry: IActivityLogEntry) {
        super(store, activityLogEntry);

        makeObservable(this, {
            plotterMessage: computed
        });
    }

    get plotterMessage() {
        return JSON.parse(this.message) as IPlotterHistoryItemMessage;
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <PlotterHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////
// EEZ-Chart based plotter.
// Based on DLOG.

const COLORS = [
    "#004CA3",
    "#FF5200",
    "#007D00",
    "#D40000",
    "#7E3DB1",
    "#782700",
    "#DD4CB4",
    "#525252",
    "#AFB000",
    "#00B2C6",
    "#004CA2",
    "#FF5200",
    "#007D00"
];

class PlotterHistoryItemWithEezChart extends DlogWaveform {
    constructor(public store: IStore, activityLogEntry: IActivityLogEntry) {
        super(store, activityLogEntry);
    }

    get plotterMessage() {
        return JSON.parse(this.message) as IPlotterHistoryItemMessage;
    }

    get dlog(): IDlog<IUnit> {
        const variableNames = this.plotterMessage.variableNames;
        if (!variableNames || variableNames.length == 0) {
            return EMPTY_DLOG;
        }

        const dataOffset = 0;
        const numBytesPerRow = 8 * (1 + variableNames.length);

        const columnDataIndexes = variableNames.map(
            (variable, i) => (1 + i) * 8
        );

        const data = this.data;
        const buffer = Buffer.allocUnsafe(8);

        function readDouble(i: number) {
            buffer[0] = data[i];
            buffer[1] = data[i + 1];
            buffer[2] = data[i + 2];
            buffer[3] = data[i + 3];
            buffer[4] = data[i + 4];
            buffer[5] = data[i + 5];
            buffer[6] = data[i + 6];
            buffer[7] = data[i + 7];
            return buffer.readDoubleLE(0);
        }

        function getValue(rowIndex: number, columnIndex: number) {
            return readDouble(
                dataOffset +
                    rowIndex * numBytesPerRow +
                    columnDataIndexes[columnIndex]
            );
        }

        let minTotal: number | undefined;
        let maxTotal: number | undefined;

        const yAxes = variableNames.map((variable, yIndex) => {
            let min: number | undefined;
            let max: number | undefined;

            for (let i = 0; i < this.plotterMessage.numPoints; i++) {
                const y = getValue(i, yIndex);
                if (min == undefined || y < min) min = y;
                if (max == undefined || y > max) max = y;
            }

            if (minTotal == undefined || (min != undefined && min < minTotal)) {
                minTotal = min;
            }

            if (maxTotal == undefined || (max != undefined && max > maxTotal)) {
                maxTotal = max;
            }

            return {
                dataType: DataType.DATA_TYPE_DOUBLE,
                dlogUnit: Unit.UNIT_UNKNOWN,
                unit: UNKNOWN_UNIT,
                range: {
                    min: min ?? 0,
                    max: max ?? 0
                },
                label: variable,
                channelIndex: yIndex,
                transformOffset: 0,
                transformScale: 1.0,
                color: lighten(COLORS[yIndex % COLORS.length]),
                colorInverse: COLORS[yIndex % COLORS.length]
            };
        });

        // set the same range for all y axis
        minTotal = minTotal ?? 0;
        maxTotal = maxTotal ?? 0;
        const d = maxTotal - minTotal;
        const overhead = 0 / 100; // no overhead
        const range = {
            min: minTotal - overhead * d,
            max: maxTotal + overhead * d
        };
        yAxes.forEach(yAxis => {
            yAxis.range = range;
        });

        let startTime = readDouble(0);
        let endTime = readDouble(data.length - (1 + variableNames.length) * 8);

        let duration = endTime - startTime;
        if (duration == 0) {
            duration = 1;
        }

        return {
            version: 1,
            xAxis: {
                unit: TIME_UNIT,
                step: duration / 1000 / this.plotterMessage.numPoints,
                scaleType: ScaleType.LINEAR,
                range: {
                    min: 0,
                    max: this.plotterMessage.numPoints
                },
                label: ""
            },
            yAxis: yAxes[0],
            yAxisScaleType: ScaleType.LINEAR,
            yAxes,
            dataOffset,
            bookmarks: [],
            dataContainsSampleValidityBit: false,
            columnDataIndexes,
            columnBitMask: [0],
            numBytesPerRow,
            length: this.plotterMessage.numPoints,
            startTime: new Date(startTime),
            duration: this.plotterMessage.numPoints,
            hasJitterColumn: false,
            getValue
        };
    }
}

////////////////////////////////////////////////////////////////////////////////
// EEZ-Chart plotter is used.

export const PlotterHistoryItem = true
    ? PlotterHistoryItemWithEezChart
    : PlotterHistoryItemWithPlotly;

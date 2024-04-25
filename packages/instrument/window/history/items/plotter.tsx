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

////////////////////////////////////////////////////////////////////////////////

export const PlotterHistoryItemComponent = observer(
    class PlotterHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: PlotterHistoryItem;
        },
        {}
    > {
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

            if (!this.isVariableNamesReady || !this.props.historyItem.data) {
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

            let offset = 0;
            for (let i = 0; offset + 8 <= data.length; i++) {
                x[i] = new Date(data.readDoubleBE(offset));
                offset += 8;

                for (
                    let j = 0;
                    j < this.variableNames.length && offset + 8 <= data.length;
                    j++
                ) {
                    y[j][i] = data.readDoubleBE(offset);
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
                width: 1200,
                height: 800
            };
        }

        get chartConfig() {
            return {};
        }

        updateChart() {
            if (this.chartDivRef.current) {
                if (this.plotlyInitialized) {
                    const Plotly =
                        require("plotly.js-dist-min") as typeof import("plotly.js-dist-min");

                    Plotly.newPlot(
                        this.chartDivRef.current!,
                        this.chartData,
                        this.chartLayout,
                        this.chartConfig
                    );
                    this.plotlyInitialized = true;
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

export interface IPlotterHistoryItemMessage {
    variableNames: string[];
    numPoints: number;
    rate: number;
}

export class PlotterHistoryItem extends HistoryItem {
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

import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import { computed, makeObservable, observable, runInAction } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";
import * as notification from "eez-studio-ui/notification";

import { logUpdate } from "instrument/window/history/activity-log";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { PLOTTER_ICON } from "project-editor/ui-components/icons";

import { HistoryItemPreview } from "instrument/window/history/item-preview";
import { getScrapbookStore } from "../scrapbook";
import { readTextFile, writeTextFile } from "eez-studio-shared/util-electron";

////////////////////////////////////////////////////////////////////////////////

interface IPlotlyHistoryItemMessage {
    data: any;
    layout: any;
    config: any;
}

////////////////////////////////////////////////////////////////////////////////
// Plotly based plotter

export const PlotterHistoryItemComponent = observer(
    class PlotterHistoryItemComponent extends React.Component<{
        appStore: IAppStore;
        historyItem: PlotlyHistoryItem;
        viewType: "chat" | "thumbs";
    }> {
        chartDivRef = React.createRef<HTMLDivElement>();
        plotlyInitialized = false;

        zoom: boolean = false;

        actionInProgress: boolean = false;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                zoom: observable,
                actionInProgress: observable,
                data: computed,
                layout: computed
            });
        }

        toggleZoom = () => {
            runInAction(() => (this.zoom = !this.zoom));
        };

        get data() {
            if (this.props.viewType != "thumbs" || this.zoom) {
                return this.props.historyItem.plotlyMessage.data;
            }

            const data = this.props.historyItem.plotlyMessage.data.slice();

            for (let i = 0; i < data.length; i++) {
                if (data[i].showlegend == true) {
                    data[i] = Object.assign({}, data[i], { showlegend: false });
                }
            }

            return data;
        }

        get layout() {
            const layout = Object.assign(
                {},
                this.props.historyItem.plotlyMessage.layout
            );
            if (this.zoom) {
                layout.width = undefined;
                layout.height = undefined;
            } else {
                if (this.props.viewType == "thumbs") {
                    const theScrapbook = getScrapbookStore();
                    layout.width = theScrapbook.thumbnailSize;
                    layout.height = theScrapbook.thumbnailSize;
                } else {
                    layout.width = 900;
                    layout.height = 540;
                }
            }
            return layout;
        }

        updateChart() {
            if (this.chartDivRef.current) {
                if (!this.plotlyInitialized) {
                    const Plotly =
                        require("plotly.js-dist-min") as typeof import("plotly.js-dist-min");

                    this.plotlyInitialized = true;

                    Plotly.newPlot(
                        this.chartDivRef.current!,
                        this.data,
                        this.layout,
                        this.props.historyItem.plotlyMessage.config
                    );
                } else {
                    const Plotly =
                        require("plotly.js-dist-min") as typeof import("plotly.js-dist-min");

                    Plotly.react(
                        this.chartDivRef.current!,
                        this.data,
                        this.layout,
                        this.props.historyItem.plotlyMessage.config
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

        async convertToCsv() {
            let csv =
                `${
                    this.layout?.xaxis?.ticksuffix
                        ? this.layout.xaxis.ticksuffix
                        : "x"
                };` +
                this.data
                    .map(
                        (trace: any) =>
                            trace.name +
                            (this.layout?.yaxis?.ticksuffix
                                ? "[" + this.layout.yaxis.ticksuffix + "]"
                                : "")
                    )
                    .join(";") +
                "\n";

            csv += this.data[0].x
                .map(
                    (value: number, i: number) =>
                        value +
                        ";" +
                        this.data.map((trace: any) => trace.y[i]).join(";")
                )
                .join("\n");

            return csv;
        }

        onExportCSV = async () => {
            if (this.actionInProgress) {
                return;
            }
            runInAction(() => (this.actionInProgress = true));

            let data;

            try {
                data = await this.convertToCsv();
            } catch (err) {
                console.error(err);
                notification.error(err.toString());
                runInAction(() => (this.actionInProgress = false));
                return;
            }

            const result = await dialog.showSaveDialog(getCurrentWindow(), {
                filters: [
                    {
                        name: "CSV Files",
                        extensions: ["csv"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ],
                defaultPath: "plotly.csv"
            });

            let filePath = result.filePath;
            if (filePath) {
                if (!filePath.toLowerCase().endsWith("csv")) {
                    filePath += ".csv";
                }

                try {
                    await writeTextFile(filePath, data);
                    notification.success(`Saved as "${filePath}"`);
                } catch (err) {
                    console.error(err);
                    notification.error(err.toString());
                }
            }

            runInAction(() => (this.actionInProgress = false));
        };

        onExportJSON = async () => {
            if (this.actionInProgress) {
                return;
            }
            runInAction(() => (this.actionInProgress = true));

            const json = {
                data: this.props.historyItem.plotlyMessage.data,
                layout: this.props.historyItem.plotlyMessage.layout,
                config: this.props.historyItem.plotlyMessage.config
            };

            const jsonStr = JSON.stringify(json, undefined, 2);

            const result = await dialog.showSaveDialog(getCurrentWindow(), {
                filters: [
                    {
                        name: "JSON Files",
                        extensions: ["json"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ],
                defaultPath: "plotly.json"
            });

            let filePath = result.filePath;
            if (filePath) {
                if (!filePath.toLowerCase().endsWith("json")) {
                    filePath += ".json";
                }

                try {
                    await writeTextFile(filePath, jsonStr);
                    notification.success(`Exported to "${filePath}"`);
                } catch (err) {
                    console.error(err);
                    notification.error(err.toString());
                }
            }

            runInAction(() => (this.actionInProgress = false));
        };

        onImportJSON = async () => {
            if (this.actionInProgress) {
                return;
            }
            runInAction(() => (this.actionInProgress = true));

            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                filters: [
                    {
                        name: "JSON Files",
                        extensions: ["json"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ]
            });

            const filePaths = result.filePaths;
            if (filePaths && filePaths.length > 0) {
                const filePath = filePaths[0];
                try {
                    const jsonStr = await readTextFile(filePath);

                    const json = JSON.parse(jsonStr);

                    this.props.historyItem.updatePlotly(
                        this.props.appStore,
                        json.data,
                        json.layout,
                        json.config
                    );

                    notification.success(`Imported from "${filePath}"`);
                } catch (err) {
                    console.error(err);
                    notification.error(err.toString());
                }
            }

            runInAction(() => (this.actionInProgress = false));
        };

        render() {
            this.layout;
            this.data;

            const actions = (
                <Toolbar>
                    <IconAction
                        icon="material:save"
                        title="Save as CSV file"
                        onClick={this.onExportCSV}
                        overlayText={"CSV"}
                        enabled={!this.actionInProgress}
                    />

                    <IconAction
                        icon="material:file_download"
                        title="Export to JSON file"
                        onClick={this.onExportJSON}
                        overlayText={"JSON"}
                        style={{ marginLeft: 10 }}
                        enabled={!this.actionInProgress}
                    />

                    <IconAction
                        icon="material:file_upload"
                        title="Import from JSON file"
                        onClick={this.onImportJSON}
                        overlayText={"JSON"}
                        style={{ marginLeft: 5 }}
                        enabled={!this.actionInProgress}
                    />
                    {this.props.historyItem.renderAddNoteAction(
                        this.props.appStore
                    )}
                    {this.props.historyItem.renderAddMediaNoteAction(
                        this.props.appStore
                    )}
                </Toolbar>
            );

            return (
                <div className="EezStudio_PlotlyHistoryItem">
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

                        <HistoryItemPreview
                            className="EezStudio_PlotlyPreview"
                            zoom={this.zoom}
                            toggleZoom={this.toggleZoom}
                            enableUnzoomWithEsc={true}
                        >
                            <div ref={this.chartDivRef}></div>
                        </HistoryItemPreview>

                        {actions}
                        {this.props.historyItem.renderNote(this.props.appStore)}
                        {this.props.historyItem.renderMediaNote(
                            this.props.appStore
                        )}
                    </div>
                </div>
            );
        }
    }
);

export class PlotlyHistoryItem extends HistoryItem {
    get plotlyMessage() {
        return this.messageObject as IPlotlyHistoryItemMessage;
    }

    updatePlotly(appStore: IAppStore, data: any, layout: any, config: any) {
        let plotlyMessage = JSON.parse(this.message);

        plotlyMessage.data = data;
        plotlyMessage.layout = layout;
        plotlyMessage.config = config;

        logUpdate(
            this.store,
            {
                id: this.id,
                oid: appStore.history.oid,
                message: JSON.stringify(plotlyMessage)
            },
            {
                undoable: true
            }
        );
    }

    getListItemElement(
        appStore: IAppStore,
        viewType: "chat" | "thumbs"
    ): React.ReactNode {
        return (
            <PlotterHistoryItemComponent
                appStore={appStore}
                historyItem={this}
                viewType={viewType}
            />
        );
    }
}

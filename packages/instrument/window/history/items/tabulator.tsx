import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import { makeObservable, observable, runInAction } from "mobx";
import { observer } from "mobx-react";

import type * as TabulatorModule from "tabulator-tables";
import type * as LuxonModule from "luxon";

import { formatDateTimeLong } from "eez-studio-shared/util";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";
import * as notification from "eez-studio-ui/notification";

import { logUpdate } from "instrument/window/history/activity-log";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { TABULATOR_ICON } from "project-editor/ui-components/icons";

import { HistoryItemPreview } from "instrument/window/history/item-preview";
import { readTextFile, writeTextFile } from "eez-studio-shared/util-electron";

////////////////////////////////////////////////////////////////////////////////

interface ITabulatorHistoryItemMessage {
    options: any;
    persistance: any;
}

////////////////////////////////////////////////////////////////////////////////

let _Tabulator: typeof TabulatorModule.TabulatorFull | undefined;

function getTabulator() {
    if (!_Tabulator) {
        const luxon = require("luxon") as typeof LuxonModule;
        (window as any).luxon = luxon;

        _Tabulator =
            require("tabulator-tables") as typeof TabulatorModule.TabulatorFull;
    }
    return _Tabulator;
}

////////////////////////////////////////////////////////////////////////////////

export const TabulatorHistoryItemComponent = observer(
    class TabulatorHistoryItemComponent extends React.Component<{
        appStore: IAppStore;
        historyItem: TabulatorHistoryItem;
        viewType: "chat" | "thumbs";
    }> {
        tabulatorDivRef = React.createRef<HTMLDivElement>();

        tabulator: TabulatorModule.Tabulator;

        zoom: boolean = false;

        actionInProgress: boolean = false;

        persistance: any;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                zoom: observable,
                actionInProgress: observable
            });
        }

        toggleZoom = () => {
            runInAction(() => (this.zoom = !this.zoom));
        };

        get options() {
            return this.props.historyItem.tabulatorMessage.options;
        }

        updatePersistance() {
            try {
                const jsonNew = JSON.stringify(this.persistance || {});
                const jsonOld = JSON.stringify(
                    this.props.historyItem.tabulatorMessage.persistance || {}
                );

                if (jsonNew != jsonOld) {
                    this.props.historyItem.updateTabulator(
                        this.props.appStore,
                        this.options,
                        this.persistance
                    );
                }
            } catch (err) {
                console.error(err);
            }
        }

        updateTabulator() {
            if (this.tabulatorDivRef.current) {
                const Tabulator = getTabulator();

                const options = JSON.parse(JSON.stringify(this.options || {}));

                //
                options.persistence = true;

                options.persistenceWriterFunc = (
                    id: any,
                    type: any,
                    data: any
                ) => {
                    this.persistance[type] = data;
                };

                options.persistenceReaderFunc = (id: any, type: any) => {
                    return this.persistance[type];
                };
                //

                if (this.tabulator) {
                    this.updatePersistance();
                } else {
                    this.persistance = JSON.parse(
                        JSON.stringify(
                            this.props.historyItem.tabulatorMessage
                                .persistance || {}
                        )
                    );
                }

                this.tabulator = new Tabulator(
                    this.tabulatorDivRef.current,
                    options
                );
            }
        }

        componentDidMount() {
            this.updateTabulator();
        }

        componentDidUpdate() {
            this.updateTabulator();
        }

        componentWillUnmount() {
            this.updatePersistance();
        }

        onExportCSV = async () => {
            this.tabulator.download("csv", "table.csv");
        };

        onExportJSON = async () => {
            if (this.actionInProgress) {
                return;
            }
            runInAction(() => (this.actionInProgress = true));

            const json = {
                options: this.props.historyItem.tabulatorMessage.options,
                persistance: this.persistance
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
                defaultPath: "table.json"
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

                    this.props.historyItem.updateTabulator(
                        this.props.appStore,
                        json.options,
                        json.persistance
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
            this.options;

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
                <div className="EezStudio_TabulatorHistoryItem">
                    <Icon className="me-3" icon={TABULATOR_ICON} size={48} />
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
                            className="EezStudio_TabulatorPreview"
                            zoom={this.zoom}
                            toggleZoom={this.toggleZoom}
                            enableUnzoomWithEsc={true}
                        >
                            <div ref={this.tabulatorDivRef}></div>
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

export class TabulatorHistoryItem extends HistoryItem {
    get tabulatorMessage() {
        return this.messageObject as ITabulatorHistoryItemMessage;
    }

    updateTabulator(appStore: IAppStore, options: any, persistance: any) {
        let tabulatorMessage = JSON.parse(this.message);

        tabulatorMessage.options = options;
        tabulatorMessage.persistance = persistance;

        logUpdate(
            this.store,
            {
                id: this.id,
                oid: appStore.history.oid,
                message: JSON.stringify(tabulatorMessage)
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
            <TabulatorHistoryItemComponent
                appStore={appStore}
                historyItem={this}
                viewType={viewType}
            />
        );
    }
}

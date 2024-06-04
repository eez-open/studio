import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import { computed, makeObservable, observable, runInAction } from "mobx";
import { observer } from "mobx-react";

import type * as TabulatorModule from "tabulator-tables";
import type * as LuxonModule from "luxon";

import { formatDateTimeLong } from "eez-studio-shared/util";

import {
    beginTransaction,
    commitTransaction,
    IStore
} from "eez-studio-shared/store";

import { Balloon } from "eez-studio-ui/balloon";
import { PropertyList, StaticRichTextProperty } from "eez-studio-ui/properties";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";
import * as notification from "eez-studio-ui/notification";

import {
    IActivityLogEntry,
    logUpdate
} from "instrument/window/history/activity-log";

import {
    showAddNoteDialog,
    showEditNoteDialog
} from "instrument/window/note-dialog";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

import { PreventDraggable } from "instrument/window/history/helper";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { TABULATOR_ICON } from "project-editor/ui-components/icons";

import { HistoryItemPreview } from "instrument/window/history/item-preview";
import { readTextFile, writeTextFile } from "eez-studio-shared/util-electron";

////////////////////////////////////////////////////////////////////////////////

interface ITabulatorHistoryItemMessage {
    options: any;
    persistance: any;
    note: string;
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

        defaultPersistance: any = {};

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

        onAddNote = () => {
            showAddNoteDialog(note => {
                beginTransaction("Add file note");
                this.props.historyItem.setNote(this.props.appStore, note);
                commitTransaction();
            });
        };

        onEditNote = () => {
            showEditNoteDialog(this.props.historyItem.note!, note => {
                if (this.props.historyItem.note !== note) {
                    beginTransaction("Edit file note");
                    this.props.historyItem.setNote(this.props.appStore, note);
                    commitTransaction();
                }
            });
        };

        onDeleteNote = () => {
            beginTransaction("Delete file note");
            this.props.historyItem.setNote(this.props.appStore, undefined);
            commitTransaction();
        };

        get options() {
            return this.props.historyItem.tabulatorMessage.options;
        }

        get persistance() {
            return (
                this.props.historyItem.tabulatorMessage.persistance ||
                this.defaultPersistance
            );
        }

        updateTabulator() {
            if (this.tabulatorDivRef.current) {
                const Tabulator = getTabulator();

                const options = JSON.parse(JSON.stringify(this.options || {}));

                options.persistence = true;

                options.persistenceWriterFunc = (
                    id: any,
                    type: any,
                    data: any
                ) => {
                    runInAction(() => {
                        this.persistance[type] = data;
                        // if (this.options) {
                        //     this.props.historyItem.updateTabulator(
                        //         this.props.appStore,
                        //         this.options,
                        //         this.persistance
                        //     );
                        // }
                    });
                };

                options.persistenceReaderFunc = (id: any, type: any) => {
                    return this.persistance[type];
                };

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

        componentWillUnmount() {}

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
                persistance: this.props.historyItem.tabulatorMessage.persistance
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
                    {!this.props.historyItem.tabulatorMessage.note && (
                        <IconAction
                            icon="material:comment"
                            title="Add note"
                            onClick={this.onAddNote}
                        />
                    )}
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
                </Toolbar>
            );

            let note;
            if (this.props.historyItem.note) {
                note = (
                    <div
                        className="EezStudio_HistoryItem_Note"
                        onDoubleClick={this.onEditNote}
                    >
                        <Balloon>
                            <PreventDraggable tag="div">
                                <PropertyList>
                                    <StaticRichTextProperty
                                        value={this.props.historyItem.note}
                                    />
                                </PropertyList>
                            </PreventDraggable>
                        </Balloon>
                        <Toolbar>
                            <IconAction
                                icon="material:edit"
                                title="Edit note"
                                onClick={this.onEditNote}
                            />
                            <IconAction
                                icon="material:delete"
                                title="Delete note"
                                onClick={this.onDeleteNote}
                            />
                        </Toolbar>
                    </div>
                );
            }

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
                        {note}
                    </div>
                </div>
            );
        }
    }
);

export class TabulatorHistoryItem extends HistoryItem {
    constructor(public store: IStore, activityLogEntry: IActivityLogEntry) {
        super(store, activityLogEntry);

        makeObservable(this, {
            tabulatorMessage: computed
        });
    }

    get tabulatorMessage() {
        return JSON.parse(this.message) as ITabulatorHistoryItemMessage;
    }

    get note() {
        return this.tabulatorMessage.note;
    }

    setNote(appStore: IAppStore, value: string | undefined) {
        let tabulatorMessage = JSON.parse(this.message);

        tabulatorMessage.note = value;

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

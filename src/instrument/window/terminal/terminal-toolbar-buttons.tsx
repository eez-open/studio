import * as React from "react";
import { keys } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { readBinaryFile } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { log, logDelete, logUndelete } from "shared/activity-log";

import { confirm } from "shared/ui/dialog";
import { IconAction } from "shared/ui/action";

import { InstrumentObject } from "instrument/instrument-object";

import { appStore, toggleSearchVisible, selectHistoryItems } from "instrument/window/app-store";

import { showAddNoteDialog } from "instrument/window/terminal/note-dialog";
import { detectFileType } from "instrument/connection/file-type";

@observer
export class TerminalToolbarButtons extends React.Component<{ instrument: InstrumentObject }, {}> {
    @bind
    deleteHistoryItems() {
        selectHistoryItems({
            historyItemType: "all",
            message: "Select one or more history items",
            alertDanger: true,
            okButtonText: "Delete",
            okButtonTitle: "Delete",
            onOk: () => {
                beginTransaction("Delete history items");

                keys(appStore.selectedHistoryItems).forEach(id => {
                    logDelete(
                        {
                            oid: this.props.instrument.id,
                            id
                        },
                        {
                            undoable: true
                        }
                    );
                });

                commitTransaction();

                selectHistoryItems(undefined);
            }
        });
    }

    @bind
    restoreHistoryItems() {
        selectHistoryItems({
            historyItemType: "all",
            message: "Select one or more history items",
            okButtonText: "Restore",
            okButtonTitle: "Restore",
            onOk: () => {
                beginTransaction("Restore history items");

                keys(appStore.selectedHistoryItems).forEach(id => {
                    logUndelete(
                        {
                            oid: this.props.instrument.id,
                            id
                        },
                        {
                            undoable: true
                        }
                    );
                });

                commitTransaction();

                selectHistoryItems(undefined);
            }
        });
    }

    @bind
    purgeHistoryItems() {
        selectHistoryItems({
            historyItemType: "all",
            message: "Select one or more history items",
            alertDanger: true,
            okButtonText: "Purge",
            okButtonTitle: "Purge",
            onOk: () => {
                confirm(
                    "Are you sure?",
                    "This will permanently delete selected history items.",
                    () => {
                        beginTransaction("Purge history items");

                        keys(appStore.selectedHistoryItems).forEach(id => {
                            logDelete(
                                {
                                    oid: this.props.instrument.id,
                                    id
                                },
                                {
                                    undoable: false
                                }
                            );
                        });

                        commitTransaction();

                        selectHistoryItems(undefined);
                    },
                    () => {
                        selectHistoryItems(undefined);
                    }
                );
            }
        });
    }

    @bind
    addNote() {
        showAddNoteDialog(note => {
            beginTransaction("Add note");
            log(
                {
                    oid: this.props.instrument.id,
                    type: "activity-log/note",
                    message: note
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    @bind
    attachFile() {
        EEZStudio.electron.remote.dialog.showOpenDialog(
            {
                properties: ["openFile", "multiSelections"],
                filters: [{ name: "All Files", extensions: ["*"] }]
            },
            filePaths => {
                if (filePaths) {
                    filePaths.forEach(async filePath => {
                        const data = await readBinaryFile(filePath);

                        beginTransaction("Attach file");
                        log(
                            {
                                oid: this.props.instrument.id,
                                type: "instrument/file",
                                message: JSON.stringify({
                                    direction: "upload",
                                    sourceFilePath: filePath,
                                    state: "success",
                                    fileType: detectFileType(data, filePath),
                                    dataLength: data.length
                                }),
                                data: data as any
                            },
                            {
                                undoable: true
                            }
                        );
                        commitTransaction();
                    });
                }
            }
        );
    }

    @bind
    addChart() {
        selectHistoryItems({
            historyItemType: "chart",
            message: "Select one or more waveform data items",
            okButtonText: "Add Chart",
            okButtonTitle: "Add chart",
            onOk: () => {
                const multiWaveformDefinition = {
                    waveformLinks: keys(appStore.selectedHistoryItems).map(id => ({
                        id
                    }))
                };

                selectHistoryItems(undefined);

                beginTransaction("Add chart");
                log(
                    {
                        oid: this.props.instrument.id,
                        type: "instrument/chart",
                        message: JSON.stringify(multiWaveformDefinition)
                    },
                    {
                        undoable: true
                    }
                );
                commitTransaction();
            }
        });
    }

    render() {
        let actions = [];

        if (appStore.selectHistoryItemsSpecification === undefined) {
            actions.push(
                <IconAction
                    key="addNote"
                    icon="material:comment"
                    title="Add note"
                    onClick={this.addNote}
                />,
                <IconAction
                    key="addFile"
                    icon="material:attach_file"
                    title="Attach file"
                    onClick={this.attachFile}
                />,
                <IconAction
                    key="addChart"
                    icon="material:insert_chart"
                    title="Add chart"
                    onClick={this.addChart}
                />
            );

            if (appStore.filters.deleted) {
                actions.push(
                    <IconAction
                        key="restore"
                        icon="material:restore"
                        title="Restore one or more deleted history items"
                        style={{ marginLeft: 20 }}
                        onClick={this.restoreHistoryItems}
                    />,
                    <IconAction
                        key="purge"
                        icon="material:delete_forever"
                        title="Purge one or more deleted history items"
                        onClick={this.purgeHistoryItems}
                    />
                );
            } else {
                actions.push(
                    <IconAction
                        key="delete"
                        icon="material:delete"
                        title="Delete one or more history items"
                        style={{ marginLeft: 20 }}
                        onClick={this.deleteHistoryItems}
                    />
                );
            }
        }

        actions.push(
            <IconAction
                style={{ marginLeft: 20 }}
                key="search"
                icon="material:search"
                title="Search, Calendar, Sessions, Filter"
                onClick={toggleSearchVisible}
                selected={appStore.searchVisible}
            />
        );

        return actions;
    }
}

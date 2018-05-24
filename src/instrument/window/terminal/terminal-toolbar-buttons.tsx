import * as React from "react";
import { keys, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { readBinaryFile } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { log } from "shared/activity-log";

import { IconAction, ButtonAction } from "shared/ui/action";

import { InstrumentObject } from "instrument/instrument-object";

import { appStore } from "instrument/window/app-store";
import { historyNavigator } from "instrument/window/history";

import { showAddNoteDialog } from "instrument/window/terminal/note-dialog";
import { detectFileType } from "instrument/connection/file-type";

@observer
export class TerminalToolbarButtons extends React.Component<{ instrument: InstrumentObject }, {}> {
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
                                type: "instrument/file-attachment",
                                message: JSON.stringify({
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
        appStore.selectHistoryItems({
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

                appStore.selectHistoryItems(undefined);

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
            if (!appStore.filters.deleted) {
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
            }

            if (historyNavigator.selectedHistoryItems.length > 0) {
                if (appStore.filters.deleted) {
                    actions.push(
                        <IconAction
                            key="restore"
                            icon="material:restore"
                            title="Restore selected history items"
                            style={{ marginLeft: 20 }}
                            onClick={historyNavigator.restoreHistoryItems}
                        />,
                        <IconAction
                            key="purge"
                            icon="material:delete_forever"
                            title="Purge selected history items"
                            onClick={historyNavigator.purgeHistoryItems}
                        />
                    );
                } else {
                    actions.push(
                        <IconAction
                            key="delete"
                            icon="material:delete"
                            title="Delete selected history items"
                            style={{ marginLeft: 20 }}
                            onClick={historyNavigator.deleteHistoryItems}
                        />
                    );
                }
            }

            if (historyNavigator.deletedCount > 0) {
                const style =
                    historyNavigator.selectedHistoryItems.length === 0
                        ? { marginLeft: 20 }
                        : undefined;

                if (appStore.filters.deleted) {
                    actions.push(
                        <ButtonAction
                            key="deletedItems"
                            icon="material:arrow_back"
                            text="Back"
                            title={"Go back to the terminal"}
                            onClick={action(
                                () => (appStore.filters.deleted = !appStore.filters.deleted)
                            )}
                            style={style}
                        />
                    );
                } else {
                    actions.push(
                        <ButtonAction
                            key="deletedItems"
                            text={`Deleted Items (${historyNavigator.deletedCount})`}
                            title="Show deleted items"
                            onClick={action(
                                () => (appStore.filters.deleted = !appStore.filters.deleted)
                            )}
                            style={style}
                        />
                    );
                }
            }
        }

        if (!appStore.filters.deleted) {
            actions.push(
                <IconAction
                    style={{ marginLeft: 20 }}
                    key="search"
                    icon="material:search"
                    title="Search, Calendar, Sessions, Filter"
                    onClick={appStore.toggleSearchVisible}
                    selected={appStore.searchVisible}
                />
            );
        }

        return actions;
    }
}

import * as React from "react";
import { keys, action } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { readBinaryFile } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { log } from "shared/activity-log";

import { IconAction, ButtonAction } from "shared/ui/action";

import { InstrumentObject } from "instrument/instrument-object";

import { navigationStore, deletedHistoryItemsNavigationItem } from "instrument/window/app";
import { appStore } from "instrument/window/app-store";
import { history, deletedItemsHistory } from "instrument/window/history";

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

            if (history.selection.items.length > 0) {
                actions.push(
                    <IconAction
                        key="delete"
                        icon="material:delete"
                        title="Delete selected history items"
                        style={{ marginLeft: 20 }}
                        onClick={history.deleteSelectedHistoryItems}
                    />
                );
            }

            if (deletedItemsHistory.deletedCount > 0) {
                const style = history.selection.items.length === 0 ? { marginLeft: 20 } : undefined;

                actions.push(
                    <ButtonAction
                        key="deletedItems"
                        text={`Deleted Items (${deletedItemsHistory.deletedCount})`}
                        title="Show deleted items"
                        onClick={action(
                            () =>
                                (navigationStore.mainNavigationSelectedItem = deletedHistoryItemsNavigationItem)
                        )}
                        style={style}
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
                onClick={() => appStore.toggleSearchVisible()}
                selected={appStore.searchVisible}
            />
        );

        return actions;
    }
}

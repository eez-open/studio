import * as React from "react";
import { keys } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { readBinaryFile } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { log } from "shared/activity-log";
import { IconAction } from "shared/ui/action";

import { InstrumentObject } from "instrument/instrument-object";

import { appStore, toggleSearchVisible, selectHistoryItems } from "instrument/window/app-store";

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

    // @bind
    // addBigList() {
    //     const N = 1200000;
    //     const data = Buffer.allocUnsafe(N * 4);
    //     let u = 20;
    //     for (let i = 0; i < N; ++i) {
    //         u += (Math.random() - 0.5) * 2;
    //         if (u < 0) {
    //             u = 0;
    //         }
    //         if (u > 40) {
    //             u = 40;
    //         }
    //         data.writeFloatLE(u, i * 4);
    //     }

    //     beginTransaction("Add big list");
    //     log(
    //         {
    //             oid: appStore.instrument.id,
    //             type: "instrument/file",
    //             message: JSON.stringify({
    //                 direction: "upload",
    //                 state: "success",
    //                 fileType: {
    //                     ext: "raw",
    //                     mime: "application/eez-binary-list"
    //                 },
    //                 dataLength: data.length
    //             }),
    //             data: data as any
    //         },
    //         {
    //             undoable: true
    //         }
    //     );
    //     commitTransaction();

    // }

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

            // actions.push(
            //     <IconAction
            //         key="addBigList"
            //         icon="material:timeline"
            //         title="Add big list"
            //         onClick={this.addBigList}
            //     />
            // );
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

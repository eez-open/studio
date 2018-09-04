import * as fsModule from "fs";
import * as pathModule from "path";
import * as archiverModule from "archiver";
import * as React from "react";
import { values } from "mobx";

import { db } from "shared/db";
import { IActivityLogEntry, loadData } from "shared/activity-log";
import { stringCompare } from "shared/string";

import { DropdownIconAction, DropdownItem } from "shared/ui/action";
import * as notification from "shared/ui/notification";
import { showGenericDialog } from "shared/ui/generic-dialog";

import { validators } from "shared/model/validation";

import { IActivityLogController } from "shared/extensions/extension";

import { notebooks, addNotebook } from "notebook/store";
import { showNotebook } from "notebook/section";

////////////////////////////////////////////////////////////////////////////////

function doExport(items: IActivityLogEntry[], filePath: string, progressToastId: number) {
    return new Promise((resolve, reject) => {
        const ids = items.map(item => item.id).join(",");

        const rows = db
            .prepare(
                `SELECT id, date, type, message, length(data) as dataLength FROM activityLog WHERE id IN (${ids})`
            )
            .all();

        const fs = EEZStudio.electron.remote.require("fs") as typeof fsModule;
        const path = EEZStudio.electron.remote.require("path") as typeof pathModule;
        const archiver = EEZStudio.electron.remote.require("archiver") as typeof archiverModule;

        var output = fs.createWriteStream(filePath);
        var archive = archiver("zip", {
            zlib: {
                level: 9
            }
        });

        let failed = false;

        archive.pipe(output);

        output.on("close", function() {
            if (failed) {
                reject();
            } else {
                resolve();
            }
        });

        archive.on("warning", function(warning: any) {
            notification.update(progressToastId, {
                render: warning,
                type: "warning"
            });
        });

        archive.on("error", function(error: any) {
            failed = true;
            notification.update(progressToastId, {
                render: error,
                type: "error",
                autoClose: 5000
            });
        });

        const notebook = {
            name: path.basename(filePath, ".eez-notebook"),
            items: rows.map(row => ({
                id: row.id.toString(),
                date: new Date(row.date),
                type: row.type,
                message: row.message
            }))
        };

        archive.append(JSON.stringify(notebook, undefined, 2), { name: "notebook.json" });

        const rowsWithData = rows.filter(row => row.dataLength > 0);

        let index = 0;

        function appendData() {
            if (index === rowsWithData.length) {
                archive.finalize();
                return;
            }

            notification.update(progressToastId, {
                render: `Exporting item ${index + 1} of ${rowsWithData.length} ...`,
                type: "info"
            });

            const row = rowsWithData[index];

            const data = loadData(row.id);

            if (data) {
                archive.append(data, { name: `${row.id}.data` });
                ++index;
                setTimeout(appendData, 10);
            } else {
                const error = `Failed to load data for item ${row.id}`;
                console.error(error);
                failed = true;
                archive.abort();
                notification.update(progressToastId, {
                    render: error,
                    type: "error",
                    autoClose: 5000
                });
            }
        }

        setTimeout(appendData, 500);
    });
}

export function exportActivityLogItems(items: IActivityLogEntry[]) {
    EEZStudio.electron.remote.dialog.showSaveDialog(
        EEZStudio.electron.remote.getCurrentWindow(),
        {
            filters: [
                { name: "EEZ Notebook files", extensions: ["eez-notebook"] },
                { name: "All Files", extensions: ["*"] }
            ]
        },
        (filePath: any) => {
            if (filePath) {
                const progressToastId = notification.info("Exporting...", {
                    autoClose: false
                });

                doExport(items, filePath, progressToastId)
                    .then(() => {
                        notification.update(progressToastId, {
                            render: (
                                <div>
                                    <p>Export succeeded!</p>
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => {
                                            EEZStudio.electron.shell.showItemInFolder(filePath);
                                        }}
                                    >
                                        Show in Folder
                                    </button>
                                </div>
                            ),
                            type: "success",
                            autoClose: 8000
                        });
                    })
                    .catch(() => {});
            }
        }
    );
}

////////////////////////////////////////////////////////////////////////////////

async function addItemsToNotebook(items: IActivityLogEntry[], notebookId: string) {
    const progressToastId = notification.info("Exporting items to notebook...", {
        autoClose: false
    });

    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    try {
        for (let item of items) {
            let data: any = null;

            data = await new Promise(resolve => {
                setTimeout(() => resolve(loadData(item.id)), 10);
            });

            db.prepare(
                `INSERT INTO "notebook/items" (date, oid, sid, type, message, data, deleted) VALUES(?, ?, ?, ?, ?, ?, ?)`
            ).run([
                new Date(item.date).getTime(),
                notebookId,
                null,
                item.type,
                item.message,
                data,
                0
            ]);
        }

        db.exec(`COMMIT TRANSACTION`);

        notification.update(progressToastId, {
            render: (
                <div>
                    <p>Items added to notebook!</p>
                    <button className="btn btn-sm" onClick={() => showNotebook(notebookId)}>
                        Show Notebook
                    </button>
                </div>
            ),
            type: "success",
            autoClose: 8000
        });

        // TODO navigate to notebook
    } catch (err) {
        console.error(err);
        db.exec(`ROLLBACK TRANSACTION`);

        notification.update(progressToastId, {
            render: `Failed to add items to notebook (${err})`,
            type: "error",
            autoClose: 5000
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function addToNewNotebook(items: IActivityLogEntry[]) {
    showGenericDialog({
        dialogDefinition: {
            fields: [
                {
                    name: "name",
                    displayName: "Notebook name",
                    type: "string",
                    validators: [
                        validators.required,
                        validators.unique(
                            {},
                            values(notebooks),
                            "Notebook with the same name already exists"
                        )
                    ]
                }
            ]
        },
        values: {
            name: ""
        }
    })
        .then(result => {
            const notebookId = addNotebook(result.values);
            addItemsToNotebook(items, notebookId);
        })
        .catch(() => {});
}

////////////////////////////////////////////////////////////////////////////////

function addToExistingNotebook(items: IActivityLogEntry[]) {
    showGenericDialog({
        dialogDefinition: {
            fields: [
                {
                    name: "id",
                    displayName: "Notebook",
                    type: "enum",
                    enumItems: Array.from(notebooks.values())
                        .sort((a, b) => stringCompare(a.name, b.name))
                        .map(notebook => ({
                            id: notebook.id,
                            label: notebook.name
                        }))
                }
            ]
        },
        values: {
            id: ""
        }
    })
        .then(result => {
            addItemsToNotebook(items, result.values.id);
        })
        .catch(() => {});
}

////////////////////////////////////////////////////////////////////////////////

export function exportTool(controller: IActivityLogController) {
    // check if there is at least 1 item that is not "activity-log/session" item ...
    let i;
    for (i = 0; i < controller.selection.length; ++i) {
        if (!controller.selection[i].type.startsWith("activity-log/session")) {
            break;
        }
    }
    if (i === controller.selection.length) {
        // ... if not then there is nothing to export
        return null;
    }

    return (
        <DropdownIconAction
            key="notebook/export"
            icon="material:library_add"
            title="Export selected history items to notebook"
        >
            <DropdownItem
                text="Export as notebook file"
                onClick={() => exportActivityLogItems(controller.selection)}
            />
            <DropdownItem
                text="Export to a new notebook"
                onClick={() => addToNewNotebook(controller.selection)}
            />
            {notebooks.size > 0 && (
                <DropdownItem
                    text="Export to an existing notebook"
                    onClick={() => addToExistingNotebook(controller.selection)}
                />
            )}
        </DropdownIconAction>
    );
}

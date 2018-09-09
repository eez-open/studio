import * as fsModule from "fs";
import * as pathModule from "path";
import * as archiverModule from "archiver";
import * as React from "react";
import { values } from "mobx";

import { stringCompare } from "shared/string";
import { _flatten } from "shared/algorithm";
import { db } from "shared/db";
import { IStore } from "shared/store";
import { IActivityLogEntry, activityLogStore, logGet, loadData } from "shared/activity-log";

import { DropdownIconAction, DropdownItem } from "shared/ui/action";
import * as notification from "shared/ui/notification";
import { showGenericDialog } from "shared/ui/generic-dialog";

import { validators } from "shared/model/validation";

import { IActivityLogController } from "shared/extensions/extension";

import { store as instrumentsStore } from "instrument/instrument-object";
import {
    getReferencedItemIds,
    remapReferencedItemIds
} from "instrument/window/history/item-factory";

import {
    notebooks,
    addNotebook,
    getInstrumentDescription,
    getSource,
    insertSource
} from "notebook/store";
import { showNotebook } from "notebook/section";

////////////////////////////////////////////////////////////////////////////////

function getExternalSourceDescription(store: IStore, item: IActivityLogEntry) {
    let oid;

    if (store === activityLogStore) {
        oid = item.oid;
    } else {
        if (!item.sid) {
            return "";
        }

        const source = getSource(item.sid);

        if (!source) {
            return "";
        }

        if (source.type === "external") {
            return source.description;
        }

        oid = source.oid;
    }

    try {
        let result = db
            .prepare(`SELECT * FROM "${instrumentsStore.storeName}" WHERE id = ?`)
            .get([oid]);

        if (result) {
            return getInstrumentDescription(result.instrumentExtensionId, result.label, result.idn);
        }

        return "";
    } catch (err) {
        console.error(err);
        return "";
    }
}

function doExport(
    store: IStore,
    items: IActivityLogEntry[],
    filePath: string,
    progressToastId: number
) {
    return new Promise((resolve, reject) => {
        const rows = items;

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
                message: row.message,
                source: getExternalSourceDescription(store, row)
            }))
        };

        archive.append(JSON.stringify(notebook, undefined, 2), { name: "notebook.json" });

        let index = 0;

        function appendData() {
            if (index === rows.length) {
                archive.finalize();
                return;
            }

            notification.update(progressToastId, {
                render: `Exporting item ${index + 1} of ${rows.length} ...`,
                type: "info"
            });

            const row = rows[index];

            let data = loadData(store, row.id);

            if (data) {
                archive.append(data, { name: `${row.id}.data` });
            }

            ++index;
            setTimeout(appendData, 10);
        }

        setTimeout(appendData, 500);
    });
}

export function exportActivityLogItems(store: IStore, items: IActivityLogEntry[]) {
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

                doExport(store, items, filePath, progressToastId)
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

async function addItemsToNotebook(store: IStore, items: IActivityLogEntry[], notebookId: string) {
    const progressToastId = notification.info("Exporting items to notebook...", {
        autoClose: false
    });

    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    try {
        const oldToNewId = new Map<string, string>();

        for (let item of items) {
            let sourceId;
            if (store === activityLogStore) {
                sourceId = insertSource("internal", item.oid);
            } else {
                sourceId = item.sid;
            }

            const message = remapReferencedItemIds(item, oldToNewId);

            const data = await new Promise(resolve => {
                setTimeout(() => resolve(loadData(store, item.id)), 10);
            });

            let info = db
                .prepare(
                    `INSERT INTO "notebook/items" (date, oid, sid, type, message, data, deleted) VALUES(?, ?, ?, ?, ?, ?, ?)`
                )
                .run([
                    new Date(item.date).getTime(),
                    notebookId,
                    sourceId,
                    item.type,
                    message,
                    data,
                    0
                ]);

            oldToNewId.set(item.id, info.lastInsertROWID.toString());
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

function addToNewNotebook(store: IStore, items: IActivityLogEntry[]) {
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
            addItemsToNotebook(store, items, notebookId);
        })
        .catch(() => {});
}

////////////////////////////////////////////////////////////////////////////////

function addToExistingNotebook(store: IStore, items: IActivityLogEntry[]) {
    const sortedNotebooks = Array.from(notebooks.values())
        .sort((a, b) => stringCompare(a.name, b.name))
        .map(notebook => ({
            id: notebook.id,
            label: notebook.name
        }));

    showGenericDialog({
        dialogDefinition: {
            fields: [
                {
                    name: "id",
                    displayName: "Notebook",
                    type: "enum",
                    enumItems: sortedNotebooks
                }
            ]
        },
        values: {
            id: sortedNotebooks[0].id
        }
    })
        .then(result => {
            addItemsToNotebook(store, items, result.values.id);
        })
        .catch(() => {});
}

////////////////////////////////////////////////////////////////////////////////

export function exportTool(controller: IActivityLogController) {
    let items: IActivityLogEntry[] = [];

    // check if there is at least 1 item that is not "activity-log/session" item ...
    let i;
    for (i = 0; i < controller.selection.length; ++i) {
        if (!controller.selection[i].type.startsWith("activity-log/session")) {
            items.push(controller.selection[i]);
        }
    }

    if (items.length === 0) {
        // ... if not then there is nothing to export
        return null;
    }

    const referencedItemIds = _flatten(
        controller.selection.map(item => getReferencedItemIds(item))
    );

    const referencedItems = referencedItemIds
        .map(id => logGet(activityLogStore, id))
        .filter(item => !!item);

    items = referencedItems.concat(items);

    return (
        <DropdownIconAction
            key="notebook/export"
            icon="material:library_add"
            title="Export selected history items to notebook"
        >
            <DropdownItem
                text="Export as notebook file"
                onClick={() => exportActivityLogItems(controller.store, items)}
            />
            <DropdownItem
                text="Export to a new notebook"
                onClick={() => addToNewNotebook(controller.store, items)}
            />
            {notebooks.size > 0 && (
                <DropdownItem
                    text="Export to an existing notebook"
                    onClick={() => addToExistingNotebook(controller.store, items)}
                />
            )}
        </DropdownIconAction>
    );
}

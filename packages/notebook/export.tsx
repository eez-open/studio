import { shell } from "electron";
import { dialog, getCurrentWindow } from "@electron/remote";
import fs from "fs";
import path from "path";
import { flatten } from "lodash";

import React from "react";
import { values } from "mobx";

import { stringCompare } from "eez-studio-shared/string";
import { db } from "eez-studio-shared/db";
import { IStore } from "eez-studio-shared/store";

import { DropdownIconAction, DropdownItem } from "eez-studio-ui/action";
import * as notification from "eez-studio-ui/notification";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import { validators } from "eez-studio-shared/validation";

import type { IActivityLogController } from "eez-studio-shared/extensions/extension";

import {
    IActivityLogEntry,
    activityLogStore,
    logGet,
    loadData
} from "instrument/window/history/activity-log";

import {
    getReferencedItemIds,
    remapReferencedItemIds
} from "instrument/window/history/item-factory";

import {
    notebooks,
    addNotebook,
    getInstrumentDescription,
    getSource,
    insertSourceFromInstrumentId
} from "notebook/store";
import { showNotebook } from "notebook/section";

////////////////////////////////////////////////////////////////////////////////

export interface IExportedNotebook {
    name: string;
    sources: IExportedNotebookSources;
    items: IExportedNotebookItem[];
}

interface IExportedNotebookSources {
    [id: string]: IExportedNotebookSource;
}

interface IExportedNotebookSource {
    instrumentName: string;
    instrumentExtensionId: string;
}

interface IExportedNotebookItem {
    id: string;
    date: Date;
    type: string;
    message: string;
    source?: string;
}

function getExternalSourceDescription(
    store: IStore,
    item: IActivityLogEntry,
    sources: IExportedNotebookSources
): string | undefined {
    if (store === activityLogStore) {
        try {
            let result = db
                .prepare(`SELECT * FROM "instrument" WHERE id = ?`)
                .get([item.oid]) as any;

            if (result && result.id) {
                const id = item.oid.toString();
                if (!(id in sources)) {
                    sources[id] = {
                        instrumentName: getInstrumentDescription(
                            result.instrumentExtensionId,
                            result.label,
                            result.idn
                        ),
                        instrumentExtensionId: result.instrumentExtensionId
                    };
                }

                return id;
            }
        } catch (err) {
            console.error(err);
        }
    } else {
        if (item.sid) {
            const source = getSource(item.sid);

            if (source && source.id) {
                const id = source.id.toString();

                if (!(id in sources)) {
                    sources[id] = {
                        instrumentName: source.instrumentName,
                        instrumentExtensionId: source.instrumentExtensionId
                    };
                }

                return id;
            }
        }
    }

    return undefined;
}

async function doExport(
    store: IStore,
    itemsToExport: IActivityLogEntry[],
    filePath: string,
    progressToastId: notification.ToastId
) {
    const archiver = await import("archiver");

    return new Promise<void>((resolve, reject) => {
        var output = fs.createWriteStream(filePath);
        var archive = archiver.default("zip", {
            zlib: {
                level: 9
            }
        });

        let failed = false;

        archive.pipe(output);

        output.on("close", function () {
            if (failed) {
                reject();
            } else {
                resolve();
            }
        });

        archive.on("warning", function (warning: any) {
            notification.update(progressToastId, {
                render: warning,
                type: notification.WARNING
            });
        });

        archive.on("error", function (error: any) {
            failed = true;
            notification.update(progressToastId, {
                render: error,
                type: notification.ERROR,
                autoClose: 5000
            });
        });

        const sources: IExportedNotebookSources = {};

        const items: IExportedNotebookItem[] = itemsToExport.map(row => ({
            id: row.id.toString(),
            date: new Date(row.date),
            type: row.type,
            message: row.message,
            source: getExternalSourceDescription(store, row, sources)
        }));

        const notebook: IExportedNotebook = {
            name: path.basename(filePath, ".eez-notebook"),
            sources,
            items
        };

        archive.append(JSON.stringify(notebook, undefined, 2), {
            name: "notebook.json"
        });

        let index = 0;

        function appendData() {
            if (index === itemsToExport.length) {
                archive.finalize();
                return;
            }

            notification.update(progressToastId, {
                render: `Exporting item ${index + 1} of ${
                    itemsToExport.length
                } ...`,
                type: notification.INFO
            });

            const row = itemsToExport[index];

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

export async function exportActivityLogItems(
    store: IStore,
    items: IActivityLogEntry[]
) {
    const result = await dialog.showSaveDialog(getCurrentWindow(), {
        filters: [
            { name: "EEZ Notebook files", extensions: ["eez-notebook"] },
            { name: "All Files", extensions: ["*"] }
        ]
    });

    if (result.filePath) {
        let filePath = result.filePath;
        if (!filePath.toLowerCase().endsWith(".eez-notebook")) {
            filePath += ".eez-notebook";
        }

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
                                    shell.showItemInFolder(filePath);
                                }}
                            >
                                Show in Folder
                            </button>
                        </div>
                    ),
                    type: notification.SUCCESS,
                    autoClose: 8000
                });
            })
            .catch(() => {});
    }
}

////////////////////////////////////////////////////////////////////////////////

async function addItemsToNotebook(
    store: IStore,
    items: IActivityLogEntry[],
    notebookId: string
) {
    const progressToastId = notification.info(
        "Exporting items to notebook...",
        {
            autoClose: false
        }
    );

    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    try {
        const oldToNewId = new Map<string, string>();

        for (let item of items) {
            let sourceId;
            if (store === activityLogStore) {
                sourceId = insertSourceFromInstrumentId(item.oid);
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

            oldToNewId.set(item.id, info.lastInsertRowid.toString());
        }

        db.exec(`COMMIT TRANSACTION`);

        notification.update(progressToastId, {
            render: (
                <div>
                    <p>Items added to notebook!</p>
                    <button
                        className="btn btn-sm"
                        onClick={() => showNotebook(notebookId)}
                    >
                        Show Notebook
                    </button>
                </div>
            ),
            type: notification.SUCCESS,
            autoClose: 8000
        });

        // TODO navigate to notebook
    } catch (err) {
        console.error(err);
        db.exec(`ROLLBACK TRANSACTION`);

        notification.update(progressToastId, {
            render: `Failed to add items to notebook (${err})`,
            type: notification.ERROR,
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
    if (controller.selection.length === 0) {
        // ... if not then there is nothing to export
        return null;
    }

    let items: IActivityLogEntry[] = [];

    for (let i = 0; i < controller.selection.length; ++i) {
        items.push(controller.selection[i]);
    }

    const referencedItemIds = flatten(
        controller.selection.map(item => getReferencedItemIds(item))
    );

    const referencedItems = referencedItemIds
        .map(id => logGet(controller.store, id))
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
                    onClick={() =>
                        addToExistingNotebook(controller.store, items)
                    }
                />
            )}
        </DropdownIconAction>
    );
}

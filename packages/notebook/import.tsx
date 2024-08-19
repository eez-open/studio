import React from "react";
import { values } from "mobx";

import {
    getTempDirPath,
    zipExtract,
    readJsObjectFromFile,
    readBinaryFile,
    fileExists
} from "eez-studio-shared/util-electron";
import { db } from "eez-studio-shared/db";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { confirm } from "eez-studio-ui/dialog-electron";
import * as notification from "eez-studio-ui/notification";

import { validators } from "eez-studio-shared/validation";

import { remapReferencedItemIds } from "instrument/window/history/item-factory";

import { notebooks, addNotebook, insertSource } from "notebook/store";
import { showNotebook } from "notebook/section";
import { IExportedNotebook } from "notebook/export";

////////////////////////////////////////////////////////////////////////////////

export async function importNotebook(
    filePath: string,
    options?: Partial<{
        showNotebook: boolean;
        notebookName: string;
    }>
) {
    if (!filePath.toLowerCase().endsWith(".eez-notebook")) {
        return false;
    }

    const progressToastId = notification.info("Importing...", {
        autoClose: false
    });

    const [tempDir, cleanupCallback] = await getTempDirPath({
        unsafeCleanup: true
    });

    await zipExtract(filePath, tempDir);

    const notebook: IExportedNotebook = await readJsObjectFromFile(
        tempDir + "/notebook.json"
    );

    const notebookName = (options && options.notebookName) || notebook.name;

    let found = false;
    for (let existingNotebook of notebooks.values()) {
        if (existingNotebook.name === notebookName) {
            found = true;
        }
    }

    if (found) {
        notification.update(progressToastId, {
            autoClose: 1
        });

        confirm(
            `Notebook with the name "${notebookName}" already exists.`,
            "Do you want to enter a different name?",
            () => {
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
                        console.log(result.values.name);
                        importNotebook(
                            filePath,
                            Object.assign({}, options, {
                                notebookName: result.values.name
                            })
                        );
                    })
                    .catch(() => {});
            }
        );
    } else {
        const notebookId = addNotebook({
            name: notebookName
        });

        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

        try {
            const oldToNewId = new Map<string, string>();

            for (let item of notebook.items) {
                let sourceId: string | null = null;
                if (item.source) {
                    const source = notebook.sources[item.source];
                    if (source) {
                        sourceId = insertSource(
                            source.instrumentName,
                            source.instrumentExtensionId
                        );
                    }
                }

                const message = remapReferencedItemIds(item, oldToNewId);

                let data: any = null;
                const dataFilePath = `${tempDir}/${item.id}.data`;
                if (await fileExists(dataFilePath)) {
                    data = await readBinaryFile(dataFilePath);
                }

                const info = db
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
                        <p>Notebook imported!</p>
                        {!(options && options.showNotebook) && (
                            <button
                                className="btn btn-sm"
                                onClick={() => showNotebook(notebookId)}
                            >
                                Show Notebook
                            </button>
                        )}
                    </div>
                ),
                type: notification.SUCCESS,
                autoClose: 8000
            });

            if (options && options.showNotebook) {
                showNotebook(notebookId);
            }
        } catch (err) {
            console.error(err);
            db.exec(`ROLLBACK TRANSACTION`);

            notification.update(progressToastId, {
                render: `Import failed (${err})`,
                type: notification.ERROR,
                autoClose: 5000
            });
        }
    }

    cleanupCallback();

    return true;
}

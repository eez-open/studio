import * as React from "react";

import {
    getTempDirPath,
    zipExtract,
    readJsObjectFromFile,
    readBinaryFile,
    fileExists
} from "shared/util";
import { db } from "shared/db";

import * as notification from "shared/ui/notification";

import { remapReferencedItemIds } from "instrument/window/history/item-factory";

import { notebooks, addNotebook, insertSource } from "notebook/store";
import { showNotebook } from "notebook/section";

////////////////////////////////////////////////////////////////////////////////

export async function importNotebook(
    filePath: string,
    options?: {
        showNotebook: boolean;
    }
) {
    if (!filePath.toLowerCase().endsWith(".eez-notebook")) {
        return false;
    }

    const progressToastId = notification.info("Importing...", {
        autoClose: false
    });

    const [tempDir, cleanupCallback] = await getTempDirPath({ unsafeCleanup: true });

    await zipExtract(filePath, tempDir);

    const notebook: {
        name: string;
        items: {
            id: string;
            date: string;
            type: string;
            message: string;
            source: string;
        }[];
    } = await readJsObjectFromFile(tempDir + "/notebook.json");

    let found = false;
    for (let existingNotebook of notebooks.values()) {
        if (existingNotebook.name === notebook.name) {
            found = true;
        }
    }

    if (found) {
        notification.update(progressToastId, {
            render: `Notebook with the name "${notebook.name}" already exists!`,
            type: "error",
            autoClose: 5000
        });
    } else {
        const notebookId = addNotebook({
            name: notebook.name
        });

        db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

        try {
            const oldToNewId = new Map<string, string>();

            for (let item of notebook.items) {
                const sourceId = insertSource("external", item.source);

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

                oldToNewId.set(item.id, info.lastInsertROWID.toString());
            }

            db.exec(`COMMIT TRANSACTION`);

            notification.update(progressToastId, {
                render: (
                    <div>
                        <p>Notebook imported!</p>
                        {!(options && options.showNotebook) && (
                            <button className="btn btn-sm" onClick={() => showNotebook(notebookId)}>
                                Show Notebook
                            </button>
                        )}
                    </div>
                ),
                type: "success",
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
                type: "error",
                autoClose: 5000
            });
        }
    }

    cleanupCallback();

    return true;
}

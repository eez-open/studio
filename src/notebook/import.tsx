import {
    getTempDirPath,
    zipExtract,
    readJsObjectFromFile,
    readBinaryFile,
    fileExists
} from "shared/util";
import { db } from "shared/db";

import * as notification from "shared/ui/notification";

import { addNotebook } from "notebook/store";

export async function importNotebook(filePath: string) {
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
        }[];
    } = await readJsObjectFromFile(tempDir + "/notebook.json");

    const oid = addNotebook({
        name: notebook.name
    });

    db.exec(`BEGIN EXCLUSIVE TRANSACTION`);

    try {
        for (let item of notebook.items) {
            let data: any = null;

            const dataFilePath = `${tempDir}/${item.id}.data`;

            if (await fileExists(dataFilePath)) {
                data = await readBinaryFile(dataFilePath);
            }

            db.prepare(
                `INSERT INTO "notebook/items" (date, oid, sid, type, message, data, deleted) VALUES(?, ?, ?, ?, ?, ?, ?)`
            ).run([new Date(item.date).getTime(), oid, null, item.type, item.message, data, 0]);
        }

        db.exec(`COMMIT TRANSACTION`);

        notification.update(progressToastId, {
            render: `Notebook imported`,
            type: "success",
            autoClose: 5000
        });

        // TODO navigate to notebook
    } catch (err) {
        console.error(err);
        db.exec(`ROLLBACK TRANSACTION`);

        notification.update(progressToastId, {
            render: `Import failed (${err})`,
            type: "error",
            autoClose: 5000
        });
    }

    cleanupCallback();

    return true;
}

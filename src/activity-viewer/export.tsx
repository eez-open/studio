import * as React from "react";
import { loadData } from "shared/activity-log";
import { db } from "shared/db";

import * as notification from "shared/ui/notification";

import { IActivityLogEntry } from "shared/activity-log";

function doExport(items: IActivityLogEntry[], filePath: string, progressToastId: number) {
    return new Promise((resolve, reject) => {
        const ids = items.map(item => item.id).join(",");

        const rows = db
            .prepare(
                `SELECT id, date, type, message, length(data) as dataLength FROM activityLog WHERE id IN (${ids})`
            )
            .all();

        const fs = EEZStudio.electron.remote.require("fs");
        const archiver = EEZStudio.electron.remote.require("archiver");

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

        archive.append(
            JSON.stringify(
                rows.map(row => ({
                    id: row.id.toString(),
                    date: new Date(row.date),
                    type: row.type,
                    message: row.message
                })),
                undefined,
                2
            ),
            { name: "items.json" }
        );

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
    let filters = [];

    filters.push({ name: "All Files", extensions: ["*"] });

    let options: Electron.SaveDialogOptions = {
        filters: filters
    };

    EEZStudio.electron.remote.dialog.showSaveDialog(
        EEZStudio.electron.remote.getCurrentWindow(),
        options,
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

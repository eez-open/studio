import { roundNumber } from "./roundNumber";
import fs from "fs";
import path from "path";

export let app: Electron.App;

if (isRenderer()) {
    app = require("@electron/remote").app;
} else {
    app = require("electron").app;
}

export const isDev = /[\\/]node_modules[\\/]electron[\\/]/.test(
    process.execPath
);

export function isRenderer() {
    // running in a web browser
    if (typeof process === "undefined") {
        return true;
    }

    // node-integration is disabled
    if (!process) {
        return true;
    }

    // We're in node.js somehow
    if (!process.type) {
        return false;
    }

    return process.type === "renderer";
}

export function getUserDataPath(relativePath: string) {
    return app.getPath("userData") + path.sep + relativePath;
}

export function getHomePath(relativePath: string) {
    return app.getPath("home") + path.sep + relativePath;
}

export function localPathToFileUrl(localPath: string) {
    return "file://" + localPath.replace(/(\\|\/)/g, "/");
}

export async function zipExtract(zipFilePath: string, destFolderPath: string) {
    return new Promise<void>(async (resolve, reject) => {
        try {
            const { default: AdmZip } = await import("adm-zip");
            var zip = new AdmZip(zipFilePath);
            zip.extractAllToAsync(destFolderPath, true, true, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

export async function makeFolder(folderPath: string) {
    let exists = await fileExists(folderPath);
    if (!exists) {
        await makeFolder(path.dirname(folderPath));
        await new Promise<void>(async (resolve, reject) => {
            fs.mkdir(folderPath, err => {
                if (err && err.code != "EEXIST") {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

export function removeFolder(folderPath: string) {
    return new Promise<void>((resolve, reject) => {
        const rimraf = require("rimraf");
        rimraf(folderPath, function () {
            resolve();
        });
    });
}

export function removeFile(filePath: string) {
    const { remove } = require("fs-extra");
    return remove(filePath);
}

export function renameFile(oldPath: string, newPath: string) {
    return new Promise<void>((resolve, reject) => {
        fs.rename(oldPath, newPath, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function fileExists(filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
        fs.exists(filePath, (exists: boolean) => {
            resolve(exists);
        });
    });
}

export function fileExistsSync(filePath: string) {
    return fs.existsSync(filePath);
}

export function copyFile(srcFilePath: string, destFilePath: string) {
    const { copy } = require("fs-extra");
    return copy(srcFilePath, destFilePath);
}

export function copyDir(srcPath: string, destPath: string) {
    const { copy } = require("fs-extra");
    return copy(srcPath, destPath);
}

export function getFileSizeInBytes(filePath: string) {
    return new Promise<number>((resolve, reject) => {
        fs.stat(filePath, function (err: any, stats: any) {
            if (err) {
                reject(err);
            } else {
                resolve(stats.size);
            }
        });
    });
}

export function openFile(filePath: string) {
    return new Promise<any>((resolve, reject) => {
        fs.open(filePath, "r", (err: any, fd: any) => {
            if (err) {
                reject(err);
            } else {
                resolve(fd);
            }
        });
    });
}

export function readFile(
    fd: any,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
) {
    return new Promise<{ bytesRead: number; buffer: Buffer }>(
        (resolve, reject) => {
            fs.read(
                fd,
                buffer,
                offset,
                length,
                position,
                (err: any, bytesRead: number, buffer: Buffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ bytesRead, buffer });
                    }
                }
            );
        }
    );
}

export function closeFile(fd: any) {
    return new Promise<void>((resolve, reject) => {
        fs.close(fd, (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function readTextFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
        fs.readFile(filePath, "utf8", (err: any, data: string) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export function readBinaryFile(filePath: string) {
    return new Promise<Buffer>((resolve, reject) => {
        fs.readFile(filePath, (err: any, data: Buffer) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function readJsObjectFromFile(filePath: string) {
    let data = await readTextFile(filePath);
    return JSON.parse(data);
}

interface ICsvColumnDefinition {
    id: string;
    digits: number;
}

export async function readCsvFile(
    filePath: string,
    columnDefinitions: ICsvColumnDefinition[]
) {
    let data = await readTextFile(filePath);

    let result: any = {};
    columnDefinitions.forEach(
        columnDefinition => (result[columnDefinition.id] = [])
    );

    let rows = data.split("\n");

    for (let row of rows) {
        row = row.trim();
        if (!row) {
            continue;
        }

        let columns = row.split(",");

        if (columns.length !== columnDefinitions.length) {
            return undefined;
        }

        for (let i = 0; i < columns.length; i++) {
            let value = columns[i];
            if (value !== "=") {
                let numValue = parseFloat(value);
                if (isNaN(numValue)) {
                    return undefined;
                }
                result[columnDefinitions[i].id].push(numValue);
            }
        }
    }

    return result;
}

export function makeCsvData(
    data: any,
    columnDefinitions: ICsvColumnDefinition[]
) {
    let rows = [];

    let n = data[columnDefinitions[0].id].length;
    for (let i = 1; i < columnDefinitions.length; i++) {
        n = Math.max(n, data[columnDefinitions[i].id].length);
    }

    for (let i = 0; i < n; i++) {
        let row = [];
        for (let j = 0; j < columnDefinitions.length; j++) {
            let columnDefinition = columnDefinitions[j];
            if (i < data[columnDefinition.id].length) {
                row.push(
                    roundNumber(
                        data[columnDefinition.id][i],
                        columnDefinition.digits
                    )
                );
            } else {
                row.push("=");
            }
        }
        rows.push(row.join(","));
    }

    return rows.join("\n");
}

export async function writeCsvFile(
    filePath: string,
    data: any,
    columnDefinitions: ICsvColumnDefinition[]
) {
    await writeTextFile(filePath, makeCsvData(data, columnDefinitions));
}

export async function writeTextFile(filePath: string, data: string) {
    await makeFolder(path.dirname(filePath));
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, data, "utf8", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export async function writeJsObjectToFile(filePath: string, jsObject: any) {
    await writeTextFile(filePath, JSON.stringify(jsObject, undefined, 4));
}

export async function writeBinaryData(filePath: string, data: string | Buffer) {
    await makeFolder(path.dirname(filePath));
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, data, "binary", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function createEmptyFile(filePath: string) {
    fs.closeSync(fs.openSync(filePath, "w"));
}

export function readFolder(folderPath: string) {
    return new Promise<string[]>((resolve, reject) => {
        fs.readdir(folderPath, (err: any, files: string[]) => {
            if (err) {
                reject(err);
            } else {
                resolve(files.map(file => folderPath + "/" + file));
            }
        });
    });
}

export function getFileName(filePath: string) {
    return path.basename(filePath) as string;
}

export function getFileNameWithoutExtension(filePath: string) {
    let fileName = path.basename(filePath) as string;
    let i = fileName.lastIndexOf(".");
    if (i === -1) {
        return fileName;
    }

    return fileName.substring(0, i);
}

export function getFolderName(filePath: string) {
    return path.dirname(filePath) as string;
}

export function getFileNameExtension(filePath: string) {
    let fileName = path.basename(filePath) as string;
    let i = fileName.lastIndexOf(".");
    if (i === -1) {
        return undefined;
    }
    return fileName.substring(i + 1);
}

export function getValidFileNameFromFileName(fileName: string) {
    var validFileName = "";

    for (let i = 0; i < fileName.length; i++) {
        const codePoint = fileName.codePointAt(i);
        if (
            !codePoint ||
            codePoint < 32 ||
            codePoint === 127 ||
            codePoint > 255 ||
            '"*+,/:;<=>?\\[]|'.indexOf(fileName[i]) !== -1
        ) {
            validFileName += "_";
        } else {
            validFileName += fileName[i];
        }
    }

    return validFileName;
}

export function getShortFileName(filePath: string) {
    let fileNameWithoutExtension = getFileNameWithoutExtension(filePath)
        .replace(/[^\w]/g, "")
        .substring(0, 8)
        .toUpperCase();
    let extension = getFileNameExtension(filePath);

    if (extension === undefined) {
        return fileNameWithoutExtension;
    }

    return (
        fileNameWithoutExtension + "." + extension.substring(0, 3).toUpperCase()
    );
}

export function isValidFileName(fileName: string, shortFileName: boolean) {
    if (shortFileName) {
        if (!fileName.match(/^[\w\-.]+$/)) {
            return false;
        }

        let fileNameWithoutExtension = getFileNameWithoutExtension(fileName);
        if (fileNameWithoutExtension.length > 8) {
            return false;
        }

        let extension = getFileNameExtension(fileName);
        if (extension !== undefined && extension.length > 3) {
            return false;
        }

        return true;
    } else {
        return fileName === getValidFileNameFromFileName(fileName);
    }
}

export function isValidPath(path: string, shortFileName: boolean) {
    if (path[0] >= "0" && path[0] <= "9" && path[1] == ":") {
        path = path.slice(2);
    }

    let parts = path.replace(/\\/g, "/").split("/");
    if (parts[0] === "") {
        parts.shift();
    }
    return !parts.find(part => !isValidFileName(part, shortFileName));
}

export async function getTempFilePath(options?: any) {
    return new Promise<string>((resolve, reject) => {
        const tmp = require("tmp");
        tmp.tmpName(options, function (err: any, path: string) {
            if (err) {
                reject(err);
            } else {
                resolve(path);
            }
        });
    });
}

export async function getTempDirPath(options?: any) {
    return new Promise<[string, () => void]>((resolve, reject) => {
        const tmp = require("tmp");
        tmp.dir(
            options,
            function (err: any, path: string, cleanupCallback: () => void) {
                if (err) {
                    reject(err);
                } else {
                    resolve([path, cleanupCallback] as [string, () => void]);
                }
            }
        );
    });
}

export async function fetchUrlOrReadFromCache(
    url: string,
    resultType: "json" | "buffer"
) {
    const response = await fetch(url, { cache: "reload" });
    if (resultType == "json") {
        return await response.json();
    } else {
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
}

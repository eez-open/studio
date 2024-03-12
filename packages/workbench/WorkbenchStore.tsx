import path from "path";
import fs from "fs";
import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";

import {
    WorkbenchModel,
    WorkbenchEditor,
    WorkbenchModelTypes,
    ViewManagerModelTypes
} from "workbench";
import { computed, makeObservable, observable, runInAction, toJS } from "mobx";

export class WorkbenchStore {
    filePath: string;

    workbenchModel: WorkbenchModel;

    savedRevision: symbol;
    lastRevision: symbol;

    constructor() {
        this.savedRevision = this.lastRevision = Symbol();

        makeObservable(this, {
            savedRevision: observable,
            lastRevision: observable,
            isModified: computed
        });
    }

    get isModified() {
        return this.lastRevision != this.savedRevision;
    }

    async openFile(filePath: string) {
        this.filePath = filePath;

        const json = await fs.promises.readFile(filePath, "utf-8");
        const rootObject = JSON.parse(json);

        function loadValue(value: any): any {
            if (Array.isArray(value)) {
                return value.map(value => loadValue(value));
            } else if (typeof value == "object") {
                return loadObject(value);
            } else {
                return value;
            }
        }

        function loadObject(jsObject: any): any {
            let objectConstructor = WorkbenchModelTypes[jsObject.type];
            if (!objectConstructor) {
                objectConstructor = ViewManagerModelTypes[jsObject.type];
            }

            const object = new objectConstructor();

            for (const key in jsObject) {
                object[key] = loadValue(jsObject[key]);
            }

            return object;
        }

        this.workbenchModel = loadObject(rootObject);
    }

    get title() {
        return path.basename(this.filePath, ".eez-workbench");
    }

    async doSave() {
        fs.writeFile(
            this.filePath,
            JSON.stringify(toJS(this.workbenchModel), undefined, 4),
            "utf8",
            (err: any) => {
                if (err) {
                    console.error(err);
                }
            }
        );

        runInAction(() => {
            this.savedRevision = this.lastRevision;
        });
    }

    async saveToFile(saveAs: boolean) {
        if (this.workbenchModel) {
            if (!this.filePath || saveAs) {
                const result = await dialog.showSaveDialog(getCurrentWindow(), {
                    filters: [
                        {
                            name: "EEZ Project",
                            extensions: ["eez-project"]
                        },
                        { name: "All Files", extensions: ["*"] }
                    ]
                });
                let filePath = result.filePath;
                if (filePath) {
                    if (!filePath.toLowerCase().endsWith(".eez-project")) {
                        filePath += ".eez-project";
                    }
                    runInAction(() => {
                        this.filePath = filePath!;
                    });
                    await this.doSave();
                    return true;
                } else {
                    return false;
                }
            } else {
                await this.doSave();
                return true;
            }
        }

        return true;
    }

    save() {
        return this.saveToFile(false);
    }

    saveAs() {
        return this.saveToFile(true);
    }

    undo() {}

    redo() {}

    render() {
        return <WorkbenchEditor workbenchStore={this}></WorkbenchEditor>;
    }

    unmount() {}

    async closeWindow() {
        return true;
    }
}

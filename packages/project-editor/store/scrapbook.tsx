import fs from "fs";
import path from "path";
import React from "react";
import {
    IObservableValue,
    makeObservable,
    observable,
    runInAction,
    toJS
} from "mobx";
import { observer } from "mobx-react";

import { getUserDataPath } from "eez-studio-shared/util-electron";

import { showDialog } from "eez-studio-ui/dialog";
import { pasteWithDependencies } from "./paste-with-dependencies";
import { getJSON, type ProjectStore } from "project-editor/store";

const DEFAULT_SCRAPBOOK_FILE_PATH = getUserDataPath(
    "/scrapbooks/default.eez-scrapbook"
);

const EMPTY_SCRAPBOOK_PROJECT_JSON = {
    items: []
};

class ScrapbookItem {
    name: string;
    description: string;
    eezProject: any;
}

class ScrapbookProject {
    items: ScrapbookItem[] = [];
}

class ScrapbookStore {
    project: ScrapbookProject = new ScrapbookProject();
    filePath: string;

    async load(filePath: string) {
        const jsonStr = await fs.promises.readFile(filePath, "utf-8");
        const json = JSON.parse(jsonStr);

        for (const itemJson of json.items) {
            const item = new ScrapbookItem();

            item.name = itemJson.name;
            item.description = itemJson.description;
            item.eezProject = itemJson.eezProject;

            runInAction(() => {
                this.project.items.push(item);
            });
        }

        this.filePath = filePath;
    }

    async save() {
        await fs.promises.writeFile(
            this.filePath,
            JSON.stringify(toJS(this.project), undefined, 2),
            "utf-8"
        );
    }
}

class ScrapbookManagerModel {
    store: ScrapbookStore = new ScrapbookStore();

    constructor() {
        makeObservable(this, {});

        this.load();
    }

    async load() {
        try {
            await this.store.load(DEFAULT_SCRAPBOOK_FILE_PATH);
        } catch (err) {
            await fs.promises.mkdir(path.dirname(DEFAULT_SCRAPBOOK_FILE_PATH), {
                recursive: true
            });

            await fs.promises.writeFile(
                DEFAULT_SCRAPBOOK_FILE_PATH,
                JSON.stringify(EMPTY_SCRAPBOOK_PROJECT_JSON, undefined, 2),
                "utf-8"
            );

            await this.store.load(DEFAULT_SCRAPBOOK_FILE_PATH);
        }
    }

    onPasteInNewItem = (projectStore: ProjectStore) => {
        pasteWithDependencies(
            projectStore,
            (destinationProjectStore: ProjectStore) => {
                runInAction(() => {
                    const item = new ScrapbookItem();

                    item.name =
                        "From paste " + (this.store.project.items.length + 1);
                    item.description = "";
                    item.eezProject = JSON.parse(
                        getJSON(destinationProjectStore)
                    );

                    this.store.project.items.push(item);

                    this.store.save();
                });
            }
        );
    };
}

const model = new ScrapbookManagerModel();

const ScrapbookManagerDialog = observer(
    class ScrapbookManagerDialog extends React.Component<{
        modalDialog: IObservableValue<any>;
        destinationProjectStore: ProjectStore;
    }> {
        render() {
            return (
                <div>
                    <button
                        className="btn btn-primary"
                        onClick={() =>
                            model.onPasteInNewItem(
                                this.props.destinationProjectStore
                            )
                        }
                    >
                        Paste
                    </button>
                    <div>Items:</div>
                    {model.store.project.items.map(item => (
                        <div>
                            <div>Name:</div>
                            <div>{item.name}</div>
                            <div>Description:</div>
                            <div>{item.description}</div>
                        </div>
                    ))}
                </div>
            );
        }
    }
);

export function showScrapbookManager(destinationProjectStore: ProjectStore) {
    const modalDialogObservable = observable.box<any>();

    const [modalDialog] = showDialog(
        <ScrapbookManagerDialog
            modalDialog={modalDialogObservable}
            destinationProjectStore={destinationProjectStore}
        />,
        {
            jsPanel: {
                id: "scrapbook-manager-dialog",
                title: "Scrapbook",
                width: 1280,
                height: 800
            }
        }
    );

    modalDialogObservable.set(modalDialog);
}

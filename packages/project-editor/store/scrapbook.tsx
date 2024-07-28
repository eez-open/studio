import fs from "fs";
import path from "path";
import React from "react";
import {
    action,
    computed,
    IObservableValue,
    makeObservable,
    observable,
    runInAction,
    toJS
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import classNames from "classnames";

import { getUserDataPath } from "eez-studio-shared/util-electron";
import { guid } from "eez-studio-shared/guid";

import { showDialog } from "eez-studio-ui/dialog";
import { pasteWithDependencies } from "./paste-with-dependencies";
import { getJSON, type ProjectStore } from "project-editor/store";
import { IconAction } from "eez-studio-ui/action";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import type { Project } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Icon } from "eez-studio-ui/icon";
import type { Style } from "project-editor/features/style/style";
import type { LVGLStyle } from "project-editor/lvgl/style";
import { USER_WIDGET_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const DEFAULT_SCRAPBOOK_FILE_PATH = getUserDataPath(
    "/scrapbooks/default.eez-scrapbook"
);

const EMPTY_SCRAPBOOK_PROJECT_JSON = {
    items: []
};

////////////////////////////////////////////////////////////////////////////////

class ScrapbookItem {
    id: string;
    name: string;
    description: string;
    eezProject: any;

    constructor() {
        makeObservable(this, {
            name: observable,
            description: observable,
            eezProject: observable,
            allObjects: computed
        });
    }

    get allObjects() {
        const project = this.eezProject as Project;

        const objects: {
            name: string;
            icon: any;
        }[] = [];

        if (project.variables) {
            if (project.variables.globalVariables) {
                project.variables.globalVariables.forEach(variable => {
                    objects.push({
                        name: variable.name,
                        icon: ProjectEditor.VariableClass.classInfo.icon!
                    });
                });
            }

            if (project.variables.structures) {
                project.variables.structures.forEach(structure => {
                    objects.push({
                        name: structure.name,
                        icon: ProjectEditor.StructureClass.classInfo.icon!
                    });
                });
            }

            if (project.variables.enums) {
                project.variables.enums.forEach(enumObject => {
                    objects.push({
                        name: enumObject.name,
                        icon: ProjectEditor.EnumClass.classInfo.icon!
                    });
                });
            }
        }

        if (project.actions) {
            project.actions.forEach(action => {
                objects.push({
                    name: action.name,
                    icon: ProjectEditor.ActionClass.classInfo.icon!
                });
            });
        }

        if (project.userPages) {
            project.userPages.forEach(page => {
                objects.push({
                    name: page.name,
                    icon: ProjectEditor.PageClass.classInfo.icon!
                });
            });
        }

        if (project.userWidgets) {
            project.userWidgets.forEach(userWidget => {
                objects.push({
                    name: userWidget.name,
                    icon: USER_WIDGET_ICON
                });
            });
        }

        if (project.styles) {
            function addStyles(styles: Style[]) {
                styles.forEach(style => {
                    objects.push({
                        name: style.name,
                        icon: ProjectEditor.StyleClass.classInfo.icon!
                    });

                    addStyles(style.childStyles);
                });
            }

            addStyles(project.styles);
        }

        if (project.lvglStyles) {
            function addStyles(styles: LVGLStyle[]) {
                styles.forEach(style => {
                    objects.push({
                        name: style.name,
                        icon: ProjectEditor.StyleClass.classInfo.icon!
                    });

                    addStyles(style.childStyles);
                });
            }

            addStyles(project.lvglStyles.styles);
        }

        if (project.bitmaps) {
            project.bitmaps.forEach(bitmap => {
                objects.push({
                    name: bitmap.name,
                    icon: ProjectEditor.BitmapClass.classInfo.icon!
                });
            });
        }

        if (project.fonts) {
            project.fonts.forEach(font => {
                objects.push({
                    name: font.name,
                    icon: ProjectEditor.FontClass.classInfo.icon!
                });
            });
        }

        return objects;
    }
}

////////////////////////////////////////////////////////////////////////////////

class ScrapbookProject {
    items: ScrapbookItem[] = [];

    constructor() {
        makeObservable(this, {
            items: observable
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

class ScrapbookStore {
    filePath: string;
    project: ScrapbookProject = new ScrapbookProject();

    selectedItem: ScrapbookItem | undefined;

    constructor() {
        makeObservable(this, {
            selectedItem: observable
        });
    }

    async load(filePath: string) {
        const jsonStr = await fs.promises.readFile(filePath, "utf-8");
        const json = JSON.parse(jsonStr);

        for (const itemJson of json.items) {
            const item = new ScrapbookItem();

            if (item.id == undefined) {
                item.id = guid();
            }

            item.name = itemJson.name;
            item.description = itemJson.description;
            item.eezProject = itemJson.eezProject;

            runInAction(() => {
                this.project.items.push(item);
                if (!this.selectedItem) {
                    this.selectedItem = item;
                }
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

////////////////////////////////////////////////////////////////////////////////

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
                const item = new ScrapbookItem();

                item.id = guid();
                item.name =
                    "From paste " + (this.store.project.items.length + 1);
                item.description = "";
                item.eezProject = JSON.parse(getJSON(destinationProjectStore));

                runInAction(() => {
                    this.store.project.items.push(item);
                    this.store.selectedItem = item;
                });

                this.store.save();
            }
        );
    };
}

const model = new ScrapbookManagerModel();

////////////////////////////////////////////////////////////////////////////////

const Items = observer(
    class Items extends React.Component {
        render() {
            return (
                <div className="EezStudio_ProjectEditorScrapbook_Items">
                    {model.store.project.items.map(item => (
                        <div
                            key={item.id}
                            className={classNames(
                                "EezStudio_ProjectEditorScrapbook_Item",
                                { selected: model.store.selectedItem == item }
                            )}
                            onClick={() => {
                                runInAction(() => {
                                    model.store.selectedItem = item;
                                });
                            }}
                        >
                            {item.name}
                        </div>
                    ))}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ItemDetails = observer(
    class ItemDetails extends React.Component<{
        item: ScrapbookItem | undefined;
    }> {
        render() {
            const item = model.store.selectedItem;

            if (!item) {
                return null;
            }

            return (
                <div className="EezStudio_ProjectEditorScrapbook_ItemDetails">
                    <div>
                        <form>
                            <div className="mb-3">
                                <label
                                    htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Name"
                                    className="form-label"
                                >
                                    Name
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="EezStudio_ProjectEditorScrapbook_ItemDetails_Name"
                                    value={item.name}
                                    onChange={event => {
                                        runInAction(() => {
                                            item.name = event.target.value;
                                        });
                                        model.store.save();
                                    }}
                                />
                            </div>

                            <div className="mb-3">
                                <label
                                    htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                                    className="form-label"
                                >
                                    Description
                                </label>
                                <textarea
                                    className="form-control"
                                    id="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                                    rows={3}
                                    value={item.description}
                                    onChange={event => {
                                        runInAction(() => {
                                            item.description =
                                                event.target.value;
                                        });
                                        model.store.save();
                                    }}
                                ></textarea>
                            </div>

                            <div className="mb-3">
                                <label className="form-label">Objects</label>
                                <div className="ps-3">
                                    {item.allObjects.map((object, i) => (
                                        <div key={i}>
                                            <Icon icon={object.icon} />
                                            <span>{object.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ScrapbookManagerDialog = observer(
    class ScrapbookManagerDialog extends React.Component<{
        modalDialog: IObservableValue<any>;
        destinationProjectStore: ProjectStore;
    }> {
        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "items") {
                return <Items />;
            }

            if (component === "item-details") {
                return <ItemDetails />;
            }

            return null;
        };

        render() {
            return (
                <div className="EezStudio_ProjectEditorScrapbook">
                    <div className="EezStudio_ProjectEditorScrapbook_Toolbar">
                        <IconAction
                            title="Paste"
                            icon="material:content_paste"
                            iconSize={22}
                            onClick={() =>
                                model.onPasteInNewItem(
                                    this.props.destinationProjectStore
                                )
                            }
                            enabled={
                                this.props.destinationProjectStore.canPaste
                            }
                        />
                    </div>
                    <div className="EezStudio_ProjectEditorScrapbook_Body">
                        <FlexLayoutContainer
                            model={
                                this.props.destinationProjectStore.layoutModels
                                    .scrapbook
                            }
                            factory={this.factory}
                        />
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

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

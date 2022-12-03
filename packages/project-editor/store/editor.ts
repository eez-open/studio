import { makeObservable } from "mobx";
import mobx from "mobx";
import { observable, computed, action, autorun, runInAction } from "mobx";
import * as FlexLayout from "flexlayout-react";

import { getParent, IEezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IEditor, IEditorState } from "project-editor/project/EditorComponent";
import {
    getObjectFromStringPath,
    getObjectPathAsString,
    isObjectExists,
    objectToString
} from "project-editor/store/helper";
import type { ProjectEditorStore } from "project-editor/store";
import { objectEqual } from "eez-studio-shared/util";
import type { LVGLStyle } from "project-editor/lvgl/style";

////////////////////////////////////////////////////////////////////////////////

export class Editor implements IEditor {
    tabId: string;
    object: IEezObject;
    subObject: IEezObject | undefined;
    params: any;
    state: IEditorState | undefined;

    loading = false;

    constructor(
        public projectEditorStore: ProjectEditorStore,
        object?: IEezObject,
        subObject?: IEezObject | undefined,
        params?: any,
        state?: IEditorState | undefined
    ) {
        if (object) {
            this.object = object;
        }
        this.subObject = subObject;
        this.params = params;
        this.state = state;

        makeObservable(this, {
            object: observable,
            subObject: observable,
            state: observable,
            params: observable,
            title: computed,
            makeActive: action
        });
    }

    get title() {
        if (this.state && this.state.getTitle) {
            return this.state.getTitle(this);
        }

        const projectSettings = this.projectEditorStore.project.settings;
        if (
            this.object === projectSettings &&
            this.subObject &&
            this.subObject != this.object
        ) {
            function getTitle(object: IEezObject): string {
                if (object == projectSettings) {
                    return objectToString(object);
                }
                const parent = getParent(object);
                return getTitle(parent) + " / " + objectToString(object);
            }
            return getTitle(this.subObject);
        }

        const scpi = this.projectEditorStore.project.scpi;
        if (
            this.object === scpi &&
            this.subObject &&
            this.subObject != this.object
        ) {
            function getTitle(object: IEezObject): string {
                if (object == scpi) {
                    return objectToString(object);
                }
                const parent = getParent(object);
                return getTitle(parent) + " / " + objectToString(object);
            }
            return getTitle(this.subObject);
        }

        if (this.object == this.projectEditorStore.project.lvglStyles) {
            return `Style: ${(this.subObject as LVGLStyle).name}`;
        }

        return objectToString(this.object);
    }

    makeActive() {
        this.projectEditorStore.editorsStore.activateEditor(this);
        if (this.projectEditorStore.runtime) {
            const flow = ProjectEditor.getFlow(this.object);
            if (flow) {
                this.projectEditorStore.runtime.selectFlowStateForFlow(flow);
            }
        }
    }

    getConfig(): IEditorTabConfig {
        return {
            objectPath: getObjectPathAsString(this.object),
            subObjectPath: this.subObject
                ? getObjectPathAsString(this.subObject)
                : undefined,
            params: this.params
        };
    }

    compare(
        object: IEezObject,
        subObject: IEezObject | undefined,
        params: any
    ) {
        if (this.object != object) {
            return false;
        }

        if (this.subObject != subObject) {
            if (this.object === this.projectEditorStore.project.scpi) {
                return true;
            }
            if (this.object === this.projectEditorStore.project.settings) {
                return true;
            }
            if (this.object === this.projectEditorStore.project.lvglStyles) {
                return true;
            }
            return false;
        }

        if (this.params && !params) {
            return false;
        }

        if (!this.params && params) {
            return false;
        }

        if (this.params && params) {
            if (!objectEqual(this.params, params)) {
                return false;
            }
        }

        return true;
    }
}

type IEditorTabConfig =
    | "string"
    | {
          objectPath: string;
          subObjectPath: string | undefined;
          params: any;
      };

export class EditorsStore {
    tabIdToEditorMap = new Map<string, Editor>();

    editors: Editor[] = [];
    activeEditor: Editor | undefined = undefined;

    dispose1: mobx.IReactionDisposer;

    constructor(
        public projectEditorStore: ProjectEditorStore,
        public getLayoutModel: () => FlexLayout.Model,
        public tabsetID: string
    ) {
        makeObservable(this, {
            editors: observable,
            activeEditor: observable,
            activateEditor: action,
            openEditor: action,
            closeEditor: action
        });

        // close editor if editor object doesn't exists anymore
        this.dispose1 = autorun(() => {
            this.editors.slice().forEach(editor => {
                if (!isObjectExists(editor.object)) {
                    this.closeEditor(editor);
                }
            });
        });
    }

    saveState() {
        for (const editor of this.editors) {
            if (editor.state && editor.state.saveState) {
                editor.state.saveState();
            }
        }
    }

    get tabsModel() {
        return (
            this.getLayoutModel()
                .getNodeById(this.tabsetID)
                .getChildren()[0] as FlexLayout.TabNode
        ).getExtraData().model as FlexLayout.Model;
    }

    get tabsSet() {
        let tabsSet: FlexLayout.TabSetNode;

        this.tabsModel.visitNodes(node => {
            if (!tabsSet && node instanceof FlexLayout.TabSetNode) {
                tabsSet = node;
            }
        });

        return tabsSet!;
    }

    get tabs() {
        const tabs: FlexLayout.TabNode[] = [];
        this.tabsModel?.visitNodes(node => {
            if (node instanceof FlexLayout.TabNode) {
                tabs.push(node);
            }
        });
        return tabs;
    }

    refresh(showActiveEditor: boolean) {
        const editors: Editor[] = [];
        const tabIdToEditorMap = new Map<string, Editor>();

        let activeEditor: Editor | undefined = undefined;

        for (const tab of this.tabs) {
            const tabId = tab.getId();
            const tabConfig: IEditorTabConfig = tab.getConfig();

            let object: IEezObject;
            let subObject: IEezObject | undefined;
            let params: any;
            if (typeof tabConfig == "string") {
                object = getObjectFromStringPath(
                    this.projectEditorStore.project,
                    tabConfig
                );
                subObject = undefined;
                params = undefined;
            } else {
                object = getObjectFromStringPath(
                    this.projectEditorStore.project,
                    tabConfig.objectPath
                );
                subObject = tabConfig.subObjectPath
                    ? getObjectFromStringPath(
                          this.projectEditorStore.project,
                          tabConfig.subObjectPath
                      )
                    : undefined;
                params = tabConfig.params;
            }

            if (!object) {
                this.tabsModel.doAction(FlexLayout.Actions.deleteTab(tabId));
                continue;
            }

            let editor = this.tabIdToEditorMap.get(tabId);
            if (!editor) {
                editor = new Editor(this.projectEditorStore);

                editor.tabId = tabId;
                editor.object = object;
                editor.subObject = subObject;
                editor.params = params;
                editor.state = ProjectEditor.createEditorState(object);
            }

            editors.push(editor);
            tabIdToEditorMap.set(tabId, editor);

            const parentNode = tab.getParent() as FlexLayout.TabSetNode;
            if (parentNode.isActive()) {
                if (parentNode.getSelectedNode() == tab) {
                    activeEditor = editor;
                }
            }
        }

        this.tabIdToEditorMap = tabIdToEditorMap;

        this.saveState();

        setTimeout(() => {
            runInAction(() => {
                this.editors = editors;
                this.activeEditor = activeEditor;
            });

            if (showActiveEditor) {
                const activeEditor = this.activeEditor;
                if (activeEditor) {
                    activeEditor.makeActive();
                    this.projectEditorStore.navigationStore.showObjects(
                        [activeEditor.subObject ?? activeEditor.object],
                        false,
                        false,
                        true
                    );
                }
            }
        });
    }

    activateEditor(editor: Editor) {
        this.tabsModel.doAction(FlexLayout.Actions.selectTab(editor.tabId));
    }

    openEditor(object: IEezObject, subObject?: IEezObject, params?: any) {
        let editorFound: Editor | undefined;

        for (let i = 0; i < this.editors.length; i++) {
            if (this.editors[i].compare(object, subObject, params)) {
                editorFound = this.editors[i];
                break;
            }
        }

        if (editorFound) {
            editorFound.subObject = subObject;
            this.tabsModel.doAction(
                FlexLayout.Actions.selectTab(editorFound.tabId)
            );
            this.tabsModel.doAction(
                FlexLayout.Actions.renameTab(
                    editorFound.tabId,
                    editorFound.title
                )
            );
            return editorFound;
        }

        let editor = new Editor(this.projectEditorStore);
        this.editors.push(editor);

        editor.object = object;
        editor.subObject = subObject;
        editor.params = params;
        editor.state = ProjectEditor.createEditorState(object);

        try {
            const tabNode = this.tabsModel.doAction(
                FlexLayout.Actions.addNode(
                    {
                        type: "tab",
                        name: editor.title,
                        component: "editor",
                        config: editor.getConfig()
                    },
                    this.tabsSet.getId(),
                    FlexLayout.DockLocation.CENTER,
                    0,
                    true
                )
            ) as FlexLayout.TabNode;

            editor.tabId = tabNode.getId();

            this.tabIdToEditorMap.set(editor.tabId, editor);

            this.tabsModel.doAction(FlexLayout.Actions.selectTab(editor.tabId));
        } catch (err) {}

        return editor;
    }

    closeEditor(editor: Editor) {
        let index = this.editors.indexOf(editor);
        if (index != -1) {
            this.editors.splice(index, 1);

            this.tabsModel.doAction(FlexLayout.Actions.deleteTab(editor.tabId));

            this.tabIdToEditorMap.delete(editor.tabId);
        }
    }

    closeEditorForObject(object: IEezObject) {
        let editor = this.editors.find(editor => editor.object == object);
        if (editor) {
            this.closeEditor(editor);
        }
    }

    selectEditorTabForObject(object: IEezObject) {
        let editor = this.editors.find(editor => editor.object == object);
        if (editor) {
            runInAction(() => {
                this.activeEditor = editor;
            });

            this.projectEditorStore.layoutModels.selectTab(
                this.tabsModel,
                editor.tabId
            );

            const editorTab = this.tabsModel.getNodeById(editor.tabId);
            if (editorTab) {
                const node = editorTab.getParent();
                if (node) {
                    this.tabsModel.doAction(
                        FlexLayout.Actions.setActiveTabset(node.getId())
                    );
                }
            }
        }
    }

    unmount() {
        this.dispose1();
    }
}

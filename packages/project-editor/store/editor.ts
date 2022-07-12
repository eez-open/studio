import { makeObservable } from "mobx";
import mobx from "mobx";
import { observable, computed, action, autorun, runInAction } from "mobx";
import * as FlexLayout from "flexlayout-react";

import { IEezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IEditor, IEditorState } from "project-editor/project/EditorComponent";
import {
    getObjectFromStringPath,
    getObjectPathAsString,
    isObjectExists,
    objectToString
} from "project-editor/store/helper";
import type { DocumentStoreClass } from "project-editor/store";
import { LayoutModels } from "project-editor/store/layout-models";

////////////////////////////////////////////////////////////////////////////////

export class Editor implements IEditor {
    tabId: string;
    object: IEezObject;
    subObject: IEezObject | undefined;
    state: IEditorState | undefined;

    loading = false;

    constructor(public DocumentStore: DocumentStoreClass) {
        makeObservable(this, {
            object: observable,
            subObject: observable,
            state: observable,
            title: computed,
            makeActive: action
        });
    }

    get title() {
        return objectToString(this.object);
    }

    makeActive() {
        this.DocumentStore.editorsStore.activateEditor(this);
        if (this.DocumentStore.runtime) {
            const flow = ProjectEditor.getFlow(this.object);
            if (flow) {
                this.DocumentStore.runtime.selectFlowStateForFlow(flow);
            }
        }
    }
}

export class EditorsStore {
    tabIdToEditorMap = new Map<string, Editor>();

    editors: Editor[] = [];
    activeEditor: Editor | undefined = undefined;

    dispose1: mobx.IReactionDisposer;

    constructor(public DocumentStore: DocumentStoreClass) {
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
            if (editor.state) {
                editor.state.saveState();
            }
        }
    }

    get tabsModel() {
        return (
            this.DocumentStore.layoutModels.editors
                .getNodeById(LayoutModels.EDITORS_TABSET_ID)
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
        this.tabsModel.visitNodes(node => {
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
            const tabConfig = tab.getConfig();
            const object = getObjectFromStringPath(
                this.DocumentStore.project,
                tabConfig
            );

            if (!object) {
                this.tabsModel.doAction(FlexLayout.Actions.deleteTab(tabId));
                continue;
            }

            let editor = this.tabIdToEditorMap.get(tabId);
            if (!editor) {
                editor = new Editor(this.DocumentStore);

                editor.tabId = tabId;
                editor.object = object;
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
                    this.DocumentStore.navigationStore.showObjects(
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

        setTimeout(() => {
            const el = document.querySelector(
                "#eez-project-active-editor [tabindex]"
            );
            if (el && el instanceof HTMLElement) {
                el.focus();
            }
        }, 0);
    }

    openEditor(object: IEezObject, subObject?: IEezObject) {
        let editorFound: Editor | undefined;

        for (let i = 0; i < this.editors.length; i++) {
            if (this.editors[i].object == object) {
                editorFound = this.editors[i];
            }
        }

        if (editorFound) {
            editorFound.subObject = subObject;
            this.tabsModel.doAction(
                FlexLayout.Actions.selectTab(editorFound.tabId)
            );
            return editorFound;
        }

        let editor = new Editor(this.DocumentStore);
        this.editors.push(editor);

        editor.object = object;
        editor.subObject = subObject;
        editor.state = ProjectEditor.createEditorState(object);

        try {
            const tabNode = this.tabsModel.doAction(
                FlexLayout.Actions.addNode(
                    {
                        type: "tab",
                        name: editor.title,
                        component: "editor",
                        config: getObjectPathAsString(editor.object)
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

            this.DocumentStore.layoutModels.selectTab(
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

import * as fs from "fs";
import React from "react";
import * as mobx from "mobx";
import {
    observable,
    extendObservable,
    computed,
    action,
    toJS,
    reaction,
    autorun,
    runInAction
} from "mobx";
import type { FSWatcher } from "chokidar";
import * as FlexLayout from "flexlayout-react";

import {
    _each,
    _isArray,
    _map,
    _uniqWith,
    _find
} from "eez-studio-shared/algorithm";
import { confirmSave } from "eez-studio-shared/util";
import { humanize } from "eez-studio-shared/string";
import { guid } from "eez-studio-shared/guid";

import { Icon } from "eez-studio-ui/icon";
import * as notification from "eez-studio-ui/notification";
import { showGenericDialog, TableField } from "eez-studio-ui/generic-dialog";

import { confirm } from "project-editor/core/util";

import {
    IEezObject,
    PropertyInfo,
    PropertyType,
    getProperty,
    isPropertyEnumerable,
    getParent,
    getKey,
    isEezObject,
    getRootObject,
    EezClass,
    EezObject,
    isSubclassOf,
    ClassInfo,
    findClass,
    PropertyProps,
    PropertyValueSourceInfo,
    isPropertyHidden,
    getPropertyInfo,
    getAncestors,
    getObjectPropertyDisplayName,
    registerClass,
    setId,
    setKey,
    setParent,
    setPropertyInfo,
    MessageType,
    IMessage,
    getClassByName,
    SerializedData
} from "project-editor/core/object";
import type { CurrentSearch } from "project-editor/core/search";

import type { DataContext } from "project-editor/features/variable/variable";

import type { Component } from "project-editor/flow/component";

import type { RuntimeBase } from "project-editor/flow/runtime";

import { ProjectEditor } from "project-editor/project-editor-interface";

import type { Project } from "project-editor/project/project";
import type { IObjectVariableValue } from "project-editor/features/variable/value-type";
import { IVariable } from "project-editor/flow/flow-interfaces";
import { IEditor, IEditorState } from "project-editor/project/EditorComponent";

const { Menu, MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export interface IPanel {
    selectedObject: IEezObject | undefined;
    selectedObjects?: IEezObject[];
    cutSelection(): void;
    copySelection(): void;
    pasteSelection(): void;
    deleteSelection(): void;
}

class NavigationStore {
    @observable selectedPanel: IPanel | undefined;

    selectedRootObject = observable.box<IEezObject>();

    selectedPageObject = observable.box<IEezObject>();
    selectedActionObject = observable.box<IEezObject>();
    selectedGlobalVariableObject = observable.box<IEezObject>();
    selectedStructureObject = observable.box<IEezObject>();
    selectedEnumObject = observable.box<IEezObject>();
    selectedStyleObject = observable.box<IEezObject>();
    selectedThemeObject = observable.box<IEezObject>();
    selectedThemeColorObject = observable.box<IEezObject>();
    selectedFontObject = observable.box<IEezObject>();
    selectedGlyphObject = observable.box<IEezObject>();
    selectedBitmapObject = observable.box<IEezObject>();
    selectedExtensionDefinitionObject = observable.box<IEezObject>();
    selectedScpiSubsystemObject = observable.box<IEezObject>();
    selectedScpiCommandObject = observable.box<IEezObject>();
    selectedScpiEnumObject = observable.box<IEezObject>();

    editable = true;

    constructor(public DocumentStore: DocumentStoreClass) {}

    loadState(state: any) {
        let selectedRootObject;
        if (state && state.selectedRootObject) {
            selectedRootObject = getObjectFromStringPath(
                this.DocumentStore.project,
                state.selectedRootObject
            );
        }
        if (!selectedRootObject) {
            selectedRootObject = this.DocumentStore.project.settings;
        }
        this.selectedRootObject.set(selectedRootObject);

        if (state) {
            if (state.selectedPageObject) {
                this.selectedPageObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedPageObject
                    )
                );
            }

            if (state.selectedActionObject) {
                this.selectedActionObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedActionObject
                    )
                );
            }

            if (state.selectedGlobalVariableObject) {
                this.selectedGlobalVariableObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedGlobalVariableObject
                    )
                );
            }

            if (state.selectedStructureObject) {
                this.selectedStructureObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedStructureObject
                    )
                );
            }

            if (state.selectedEnumObject) {
                this.selectedEnumObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedEnumObject
                    )
                );
            }

            if (state.selectedStyleObject) {
                this.selectedStyleObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedStyleObject
                    )
                );
            }

            if (state.selectedThemeObject) {
                this.selectedThemeObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedThemeObject
                    )
                );
            }

            if (state.selectedThemeColorObject) {
                this.selectedThemeColorObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedThemeColorObject
                    )
                );
            }

            if (state.selectedFontObject) {
                this.selectedFontObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedFontObject
                    )
                );
            }

            if (state.selectedGlyphObject) {
                this.selectedGlyphObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedGlyphObject
                    )
                );
            }

            if (state.selectedBitmapObject) {
                this.selectedBitmapObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedBitmapObject
                    )
                );
            }

            if (state.selectedExtensionDefinitionObject) {
                this.selectedExtensionDefinitionObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedExtensionDefinitionObject
                    )
                );
            }

            if (state.selectedScpiSubsystemObject) {
                this.selectedScpiSubsystemObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedScpiSubsystemObject
                    )
                );
            }

            if (state.selectedScpiCommandObject) {
                this.selectedScpiCommandObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedScpiCommandObject
                    )
                );
            }

            if (state.selectedScpiEnumObject) {
                this.selectedScpiEnumObject.set(
                    getObjectFromStringPath(
                        this.DocumentStore.project,
                        state.selectedScpiEnumObject
                    )
                );
            }
        }
    }

    saveState() {
        return {
            selectedRootObject: this.selectedRootObject.get()
                ? getObjectPathAsString(this.selectedRootObject.get())
                : undefined,
            selectedPageObject: this.selectedPageObject.get()
                ? getObjectPathAsString(this.selectedPageObject.get())
                : undefined,
            selectedActionObject: this.selectedActionObject.get()
                ? getObjectPathAsString(this.selectedActionObject.get())
                : undefined,
            selectedGlobalVariableObject:
                this.selectedGlobalVariableObject.get()
                    ? getObjectPathAsString(
                          this.selectedGlobalVariableObject.get()
                      )
                    : undefined,
            selectedStructureObject: this.selectedStructureObject.get()
                ? getObjectPathAsString(this.selectedStructureObject.get())
                : undefined,
            selectedEnumObject: this.selectedEnumObject.get()
                ? getObjectPathAsString(this.selectedEnumObject.get())
                : undefined,
            selectedStyleObject: this.selectedStyleObject.get()
                ? getObjectPathAsString(this.selectedStyleObject.get())
                : undefined,
            selectedThemeObject: this.selectedThemeObject.get()
                ? getObjectPathAsString(this.selectedThemeObject.get())
                : undefined,
            selectedThemeColorObject: this.selectedThemeColorObject.get()
                ? getObjectPathAsString(this.selectedThemeColorObject.get())
                : undefined,
            selectedFontObject: this.selectedFontObject.get()
                ? getObjectPathAsString(this.selectedFontObject.get())
                : undefined,
            selectedGlyphObject: this.selectedGlyphObject.get()
                ? getObjectPathAsString(this.selectedGlyphObject.get())
                : undefined,
            selectedBitmapObject: this.selectedBitmapObject.get()
                ? getObjectPathAsString(this.selectedBitmapObject.get())
                : undefined,
            selectedExtensionDefinitionObject:
                this.selectedExtensionDefinitionObject.get()
                    ? getObjectPathAsString(
                          this.selectedExtensionDefinitionObject.get()
                      )
                    : undefined,
            selectedScpiSubsystemObject: this.selectedScpiSubsystemObject.get()
                ? getObjectPathAsString(this.selectedScpiSubsystemObject.get())
                : undefined,
            selectedScpiCommandObject: this.selectedScpiCommandObject.get()
                ? getObjectPathAsString(this.selectedScpiCommandObject.get())
                : undefined,
            selectedScpiEnumObject: this.selectedScpiEnumObject.get()
                ? getObjectPathAsString(this.selectedScpiEnumObject.get())
                : undefined
        };
    }

    @action
    setSelectedPanel(selectedPanel: IPanel | undefined) {
        this.selectedPanel = selectedPanel;
    }

    @action
    showObjects(
        objects: IEezObject[],
        openEditor: boolean,
        showInNavigation: boolean,
        selectObject: boolean
    ) {
        objects = objects.map(object =>
            isValue(object) ? getParent(object) : object
        );

        if (openEditor) {
            const result = ProjectEditor.getAncestorWithEditorComponent(
                objects[0]
            );
            if (result) {
                const editor = this.DocumentStore.editorsStore.openEditor(
                    result.object,
                    result.subObject
                );
                const editorState = editor.state;
                if (editorState) {
                    editorState.selectObjectsAndEnsureVisible(objects);
                }
            }
        }

        if (showInNavigation) {
            ProjectEditor.navigateTo(objects[0]);
        }

        if (selectObject) {
            ProjectEditor.selectObject(objects[0]);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Editor implements IEditor {
    tabId: string;
    @observable object: IEezObject;
    @observable subObject: IEezObject | undefined;
    @observable state: IEditorState | undefined;

    loading = false;

    constructor(public DocumentStore: DocumentStoreClass) {}

    @computed
    get title() {
        return objectToString(this.object);
    }

    @action
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

class EditorsStore {
    tabIdToEditorMap = new Map<string, Editor>();

    @observable editors: Editor[] = [];
    @observable activeEditor: Editor | undefined = undefined;

    dispose1: mobx.IReactionDisposer;

    constructor(public DocumentStore: DocumentStoreClass) {
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
            this.DocumentStore.layoutModels.root
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

    @action
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

    @action
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

        return editor;
    }

    @action
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

////////////////////////////////////////////////////////////////////////////////

export class LayoutModels {
    static FONT = {
        size: "small"
    };

    static FONT_SUB = {
        size: "small"
    };

    static GLOBAL_OPTIONS = {
        borderEnableAutoHide: true,
        splitterSize: 4,
        splitterExtra: 4,
        legacyOverflowMenu: false,
        tabEnableRename: false
    };

    static CHECKS_TAB_ID = "CHECKS";
    static OUTPUT_TAB_ID = "OUTPUT";
    static SEARCH_RESULTS_TAB_ID = "SEARCH_RESULTS";
    static NAVIGATION_TABSET_ID = "NAVIGATION";
    static EDITORS_TABSET_ID = "EDITORS";
    static PROPERTIES_TAB_ID = "PROPERTIES";
    static COMPONENTS_PALETTE_TAB_ID = "COMPONENTS_PALETTE";
    static BREAKPOINTS_TAB_ID = "BREAKPOINTS_PALETTE";
    static DEBUGGER_TAB_ID = "DEBUGGER";

    static LOCAL_VARS_TAB_ID = "LOCAL_VARS";
    static GLOBAL_VARS_TAB_ID = "GLOBAL_VARS";
    static STRUCTS_TAB_ID = "STRUCTS";
    static ENUMS_TAB_ID = "ENUMS";

    static SCPI_SUBSYSTEMS_TAB_ID = "SCPI_SUBSYSTEMS";
    static SCPI_ENUMS_TAB_ID = "SCPI_ENUMS";
    static SCPI_COMMANDS_TAB_ID = "SCPI_COMMANDS";

    static DEBUGGER_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Debugger",
        id: LayoutModels.DEBUGGER_TAB_ID,
        component: "debuggerPanel"
    };

    static BREAKPOINTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Breakpoints",
        id: LayoutModels.BREAKPOINTS_TAB_ID,
        component: "breakpointsPanel"
    };

    static LOCAL_VARS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Local Vars",
        id: LayoutModels.LOCAL_VARS_TAB_ID,
        component: "locals"
    };

    static STRUCTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Structs",
        id: LayoutModels.STRUCTS_TAB_ID,
        component: "structs"
    };

    models: {
        name: string;
        version: number;
        json: FlexLayout.IJsonModel;
        get: () => FlexLayout.Model;
        set: (model: FlexLayout.Model) => void;
    }[];

    @observable root: FlexLayout.Model;
    @observable variables: FlexLayout.Model;
    @observable bitmaps: FlexLayout.Model;
    @observable fonts: FlexLayout.Model;
    @observable pages: FlexLayout.Model;
    @observable scpi: FlexLayout.Model;
    @observable styles: FlexLayout.Model;
    @observable themes: FlexLayout.Model;
    @observable debugger: FlexLayout.Model;

    constructor(public DocumentStore: DocumentStoreClass) {
        this.models = [
            {
                name: "root",
                version: 13,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [
                        {
                            type: "border",
                            location: "top",
                            children: []
                        },
                        {
                            type: "border",
                            location: "right",
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Themes",
                                    component: "themesSideView"
                                }
                            ]
                        },
                        {
                            type: "border",
                            location: "bottom",
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Checks",
                                    id: LayoutModels.CHECKS_TAB_ID,
                                    component: "checksMessages"
                                },
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Output",
                                    id: LayoutModels.OUTPUT_TAB_ID,
                                    component: "outputMessages"
                                },
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Search Results",
                                    id: LayoutModels.SEARCH_RESULTS_TAB_ID,
                                    component: "searchResultsMessages"
                                }
                            ]
                        }
                    ],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 25,
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                id: LayoutModels.NAVIGATION_TABSET_ID,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Navigation",
                                        component: "navigation"
                                    }
                                ]
                            },

                            {
                                type: "row",
                                weight: 50,
                                children: [
                                    {
                                        type: "tabset",
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        id: LayoutModels.EDITORS_TABSET_ID,
                                        children: [
                                            {
                                                type: "tab",
                                                component: "sub",
                                                config: {
                                                    model: {
                                                        global: {
                                                            ...LayoutModels.GLOBAL_OPTIONS,
                                                            tabEnableClose: true
                                                        },
                                                        borders: [],
                                                        layout: {
                                                            type: "row",
                                                            children: [
                                                                {
                                                                    type: "tabset",
                                                                    children: []
                                                                }
                                                            ]
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 25,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Properties",
                                        id: LayoutModels.PROPERTIES_TAB_ID,
                                        component: "propertiesPanel"
                                    },
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Components Palette",
                                        id: LayoutModels.COMPONENTS_PALETTE_TAB_ID,
                                        component: "componentsPalette"
                                    },
                                    LayoutModels.BREAKPOINTS_TAB,
                                    LayoutModels.DEBUGGER_TAB
                                ]
                            }
                        ]
                    }
                },
                get: () => this.root,
                set: model => (this.root = model)
            },
            {
                name: "variables",
                version: 4,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Global Vars",
                                        id: LayoutModels.GLOBAL_VARS_TAB_ID,
                                        component: "globals"
                                    },
                                    LayoutModels.LOCAL_VARS_TAB,
                                    LayoutModels.STRUCTS_TAB,
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Enums",
                                        id: LayoutModels.ENUMS_TAB_ID,
                                        component: "enums"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.variables,
                set: model => (this.variables = model)
            },
            {
                name: "bitmaps",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 75,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Bitmaps",
                                                component: "bitmaps"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 25,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Preview",
                                                component: "preview"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.bitmaps,
                set: model => (this.bitmaps = model)
            },
            {
                name: "fonts",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        component: "glyphs"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        component: "editor"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.fonts,
                set: model => (this.fonts = model)
            },
            {
                name: "pages",
                version: 2,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Pages",
                                                component: "pages"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Page Structure",
                                                component: "page-structure"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Local Vars",
                                                component: "local-vars"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.pages,
                set: model => (this.pages = model)
            },
            {
                name: "scpi",
                version: 3,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Subsystems",
                                                id: LayoutModels.SCPI_SUBSYSTEMS_TAB_ID,
                                                component: "subsystems"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Enums",
                                                id: LayoutModels.SCPI_ENUMS_TAB_ID,
                                                component: "enums"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Commands",
                                                id: LayoutModels.SCPI_COMMANDS_TAB_ID,
                                                component: "commands"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.scpi,
                set: model => (this.scpi = model)
            },
            {
                name: "styles",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 75,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Styles",
                                                component: "styles"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 25,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Preview",
                                                component: "preview"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.styles,
                set: model => (this.styles = model)
            },
            {
                name: "themes",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                component: "themes"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                component: "colors"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.themes,
                set: model => (this.themes = model)
            },
            {
                name: "debugger",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 25,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Queue",
                                                component: "queue"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 75,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Watch",
                                                component: "watch"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Active Flows",
                                                component: "active-flows"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Logs",
                                                component: "logs"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.debugger,
                set: model => (this.debugger = model)
            }
        ];
    }

    load(layoutModels: any) {
        for (const model of this.models) {
            const savedModel = layoutModels && layoutModels[model.name];
            if (savedModel && savedModel.version == model.version) {
                model.set(FlexLayout.Model.fromJson(savedModel.json));
            } else {
                model.set(FlexLayout.Model.fromJson(model.json));
            }
        }

        this.DocumentStore.project.enableTabs();

        this.DocumentStore.outputSectionsStore.updateTitle(
            this.DocumentStore.outputSectionsStore.sections[Section.CHECKS]
        );
        this.DocumentStore.outputSectionsStore.updateTitle(
            this.DocumentStore.outputSectionsStore.sections[Section.OUTPUT]
        );
        this.DocumentStore.outputSectionsStore.updateTitle(
            this.DocumentStore.outputSectionsStore.sections[Section.SEARCH]
        );
    }

    save() {
        const layoutModels: any = {};

        for (const model of this.models) {
            layoutModels[model.name] = {
                version: model.version,
                json: model.get().toJson()
            };
        }

        return layoutModels;
    }

    selectTab(model: FlexLayout.Model, tabId: string) {
        const node = model.getNodeById(tabId);
        if (node) {
            const parentNode = node.getParent();
            let isSelected = false;

            if (parentNode instanceof FlexLayout.TabSetNode) {
                isSelected = parentNode.getSelectedNode() == node;
            } else if (parentNode instanceof FlexLayout.BorderNode) {
                isSelected = parentNode.getSelectedNode() == node;
            }

            if (!isSelected) {
                model.doAction(FlexLayout.Actions.selectTab(tabId));
            }
        }
    }

    updateTabTitle(model: FlexLayout.Model, tabId: string, title: string) {
        model.doAction(
            FlexLayout.Actions.updateNodeAttributes(tabId, {
                name: title
            })
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class UIStateStore {
    @observable selectedBuildConfiguration: string;
    @observable features: any;
    @observable savedState: any;
    @observable searchPattern: string;
    @observable searchMatchCase: boolean;
    @observable searchMatchWholeWord: boolean;
    @observable activeOutputSection = Section.CHECKS;
    @observable pageEditorFrontFace: boolean = false;
    @observable pageRuntimeFrontFace: boolean = true;
    @observable showCommandPalette: boolean = false;

    objectUIStates = new Map<string, any>();

    constructor(public DocumentStore: DocumentStoreClass) {}

    unmount() {}

    loadObjects(objects: any) {
        this.objectUIStates.clear();
        _each(objects, (value: any, objectPath: any) => {
            this.objectUIStates.set(objectPath, value);
        });
    }

    getUIStateFilePath() {
        if (this.DocumentStore.filePath) {
            return this.DocumentStore.filePath + "-ui-state";
        }
        return undefined;
    }

    async load() {
        const filePath = this.getUIStateFilePath();
        if (!filePath) {
            return;
        }

        let uiState: any = {};
        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            try {
                uiState = JSON.parse(data);
            } catch (err) {
                console.error(err);
            }
        } catch (err) {}

        runInAction(() => {
            this.DocumentStore.navigationStore.loadState(uiState.navigation);

            this.loadObjects(uiState.objects);

            this.DocumentStore.layoutModels.load(uiState.layoutModel);

            this.selectedBuildConfiguration =
                uiState.selectedBuildConfiguration || "Default";

            this.features = observable(uiState.features || {});

            this.activeOutputSection =
                uiState.activeOutputSection ?? Section.CHECKS;

            this.pageEditorFrontFace = uiState.pageEditorFrontFace;

            this.pageRuntimeFrontFace = uiState.pageRuntimeFrontFace;

            if (uiState.breakpoints) {
                for (const key in uiState.breakpoints) {
                    const component =
                        this.DocumentStore.getObjectFromStringPath(
                            key
                        ) as Component;
                    if (component) {
                        this.breakpoints.set(
                            component,
                            uiState.breakpoints[key]
                        );
                    }
                }
            }

            if (uiState.watchExpressions) {
                this.watchExpressions = uiState.watchExpressions;
            } else {
                this.watchExpressions = [];
            }
        });
    }

    get featuresJS() {
        return toJS(this.features);
    }

    get objectsJS() {
        this.DocumentStore.editorsStore.saveState();

        let map: any = {};
        for (let [key, value] of this.objectUIStates) {
            const i = key.indexOf("[");
            let objectPath;
            if (i != -1) {
                objectPath = key.substring(0, i);
            } else {
                objectPath = key;
            }
            if (this.DocumentStore.getObjectFromStringPath(objectPath)) {
                map[key] = value;
            }
        }
        return map;
    }

    get toJS() {
        const state = {
            navigation: this.DocumentStore.navigationStore.saveState(),
            editors: this.DocumentStore.editorsStore.saveState(),
            layoutModel: this.DocumentStore.layoutModels.save(),
            selectedBuildConfiguration: this.selectedBuildConfiguration,
            features: this.featuresJS,
            objects: this.objectsJS,
            activeOutputSection: this.activeOutputSection,
            pageEditorFrontFace: this.pageEditorFrontFace,
            pageRuntimeFrontFace: this.pageRuntimeFrontFace,
            breakpoints: Array.from(this.breakpoints).reduce(
                (obj, [key, value]) =>
                    Object.assign(obj, {
                        [getObjectPathAsString(key)]: value
                    }),
                {}
            ),
            watchExpressions: toJS(this.watchExpressions)
        };

        return state;
    }

    async save() {
        const filePath = this.getUIStateFilePath();
        if (!filePath) {
            return;
        }

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(this.toJS, undefined, 2),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save UI state: " + err);
        }
    }

    @action
    getFeatureParam<T>(
        extensionName: string,
        paramName: string,
        defaultValue: T
    ): T {
        let extension = this.features[extensionName];
        if (!extension) {
            extension = observable({});
            extendObservable(this.features, {
                [extensionName]: extension
            });
        }
        let paramValue = extension[paramName];
        if (!paramValue) {
            extendObservable(extension, {
                [paramName]: defaultValue
            });
            return defaultValue;
        }
        return paramValue as T;
    }

    @action
    setSelectedBuildConfiguration(selectedBuildConfiguration: string) {
        this.selectedBuildConfiguration = selectedBuildConfiguration;
    }

    getObjectUIState(object: IEezObject, option: string) {
        const key = getObjectPathAsString(object) + `[${option}]`;
        return this.objectUIStates.get(key);
    }

    updateObjectUIState(object: IEezObject, option: string, changes: any) {
        const key = getObjectPathAsString(object) + `[${option}]`;
        let objectUIState = this.objectUIStates.get(key);
        if (objectUIState) {
            Object.assign(objectUIState, changes);
        } else {
            this.objectUIStates.set(key, changes);
        }
    }

    ////////////////////////////////////////
    // BREAKPOINTS

    @observable breakpoints = new Map<Component, boolean>();
    @observable selectedBreakpoint = observable.box<Component | undefined>(
        undefined
    );

    isBreakpointAddedForComponent(component: Component) {
        return this.breakpoints.has(component);
    }

    isBreakpointEnabledForComponent(component: Component) {
        return this.breakpoints.get(component) == true;
    }

    @action
    addBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointAdded(component);
        }
    }

    @action
    removeBreakpoint(component: Component) {
        this.breakpoints.delete(component);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointRemoved(component);
        }
    }

    @action
    enableBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointEnabled(component);
        }
    }

    @action
    disableBreakpoint(component: Component) {
        this.breakpoints.set(component, false);
        if (this.DocumentStore.runtime) {
            this.DocumentStore.runtime.onBreakpointDisabled(component);
        }
    }

    ////////////////////////////////////////
    // WATCH EXPRESSIONS

    @observable watchExpressions: string[] = [];
}

////////////////////////////////////////////////////////////////////////////////

class RuntimeSettings {
    @observable settings: any = {};
    modified = false;

    constructor(public DocumentStore: DocumentStoreClass) {}

    getVariableValue(variable: IVariable) {
        const persistentVariables: any =
            this.settings.__persistentVariables || {};

        let value = persistentVariables[variable.name];

        const objectVariableType = ProjectEditor.getObjectVariableTypeFromType(
            variable.type
        );
        if (objectVariableType) {
            const constructorParams = value;
            if (value) {
                return objectVariableType.constructorFunction(
                    constructorParams,
                    !!this.DocumentStore.runtime
                );
            }
        }
        return value;
    }

    setVariableValue(variable: IVariable, value: any) {
        runInAction(() => {
            if (!this.settings.__persistentVariables) {
                this.settings.__persistentVariables = {};
            }
            this.settings.__persistentVariables[variable.name] = value;
        });
        this.modified = true;
    }

    async loadPersistentVariables() {
        const DocumentStore = this.DocumentStore;
        const globalVariables = DocumentStore.project.allGlobalVariables;
        const dataContext = DocumentStore.dataContext;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.getVariableValue(variable);
                if (value !== undefined) {
                    dataContext.set(variable.name, value);
                }
            }
        }
    }

    async savePersistentVariables() {
        const globalVariables = this.DocumentStore.project.allGlobalVariables;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.DocumentStore.dataContext.get(variable.name);
                if (value != null) {
                    const objectVariableType =
                        ProjectEditor.getObjectVariableTypeFromType(
                            variable.type
                        );
                    if (objectVariableType) {
                        const objectVariableValue:
                            | IObjectVariableValue
                            | undefined = value;

                        const constructorParams =
                            objectVariableValue?.constructorParams ?? null;

                        this.setVariableValue(variable, constructorParams);
                    } else {
                        this.setVariableValue(variable, value);
                    }
                }
            }
        }
    }

    getSettingsFilePath() {
        if (this.DocumentStore.filePath) {
            return this.DocumentStore.filePath + "-runtime-settings";
        }
        return undefined;
    }

    async load() {
        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            runInAction(() => {
                try {
                    this.settings = JSON.parse(data);
                } catch (err) {
                    console.error(err);
                    this.settings = {};
                }
            });
        } catch (err) {}
    }

    async save() {
        if (!this.modified) {
            return;
        }

        const filePath = this.getSettingsFilePath();
        if (!filePath) {
            return;
        }

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(toJS(this.settings), undefined, "  "),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save runtime settings: " + err);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

interface IUndoItem {
    commands: ICommand[];
    selectionBefore: any;
    selectionAfter: any;
}

export class UndoManager {
    @observable undoStack: IUndoItem[] = [];
    @observable redoStack: IUndoItem[] = [];
    @observable commands: ICommand[] = [];

    private selectionBeforeFirstCommand: any;
    public combineCommands: boolean = false;

    constructor(public DocumentStore: DocumentStoreClass) {}

    @action
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    @action
    pushToUndoStack() {
        if (this.commands.length > 0) {
            // TODO set selectionAfter to current selection
            const selectionAfter = undefined;

            this.undoStack.push({
                commands: this.commands,
                selectionBefore: this.selectionBeforeFirstCommand,
                selectionAfter: selectionAfter
            });

            this.commands = [];

            // TODO set this.selectionBeforeFirstCommand to current selection
            this.selectionBeforeFirstCommand = undefined;
        }
    }

    @action
    setCombineCommands(value: boolean) {
        this.pushToUndoStack();
        this.combineCommands = value;
    }

    @action
    executeCommand(command: ICommand) {
        if (this.commands.length == 0) {
            // TODO set this.selectionBeforeFirstCommand to current selection
            this.selectionBeforeFirstCommand = undefined;
        } else {
            if (!this.combineCommands) {
                this.pushToUndoStack();
            }
        }

        command.execute();
        this.commands.push(command);

        this.redoStack = [];

        this.DocumentStore.setModified(true);
    }

    static getCommandsDescription(commands: ICommand[]) {
        return commands[commands.length - 1].description;
    }

    @computed
    get canUndo() {
        return this.undoStack.length > 0 || this.commands.length > 0;
    }

    @computed
    get undoDescription() {
        let commands;
        if (this.commands.length > 0) {
            commands = this.commands;
        } else if (this.undoStack.length > 0) {
            commands = this.undoStack[this.undoStack.length - 1].commands;
        }
        if (commands) {
            return UndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    @action
    undo() {
        this.pushToUndoStack();

        let undoItem = this.undoStack.pop();
        if (undoItem) {
            for (let i = undoItem.commands.length - 1; i >= 0; i--) {
                undoItem.commands[i].undo();
            }

            // TODO select undoItem.selectionBefore

            this.redoStack.push(undoItem);

            this.DocumentStore.setModified(true);
        }
    }

    @computed
    get canRedo() {
        return this.redoStack.length > 0;
    }

    @computed
    get redoDescription() {
        let commands;
        if (this.redoStack.length > 0) {
            commands = this.redoStack[this.redoStack.length - 1].commands;
        }
        if (commands) {
            return UndoManager.getCommandsDescription(commands);
        }
        return undefined;
    }

    @action
    redo() {
        let redoItem = this.redoStack.pop();
        if (redoItem) {
            for (let i = 0; i < redoItem.commands.length; i++) {
                redoItem.commands[i].execute();
            }

            // TODO select redoItem.selectionAfter

            this.undoStack.push(redoItem);

            this.DocumentStore.setModified(true);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export async function load(
    DocumentStore: DocumentStoreClass,
    filePath: string
) {
    let fileData: Buffer;
    try {
        fileData = await fs.promises.readFile(filePath);
    } catch (err) {
        throw new Error(`File read error: ${err.toString()}`);
    }

    const isDashboardBuild = filePath.endsWith(".eez-dashboard");

    let projectJs;
    if (isDashboardBuild) {
        const decompress = require("decompress");
        const files = await decompress(fileData);
        projectJs = files[0].data.toString("utf8");
    } else {
        projectJs = fileData.toString("utf8");
    }

    const project: Project = loadObject(
        DocumentStore,
        undefined,
        projectJs,
        ProjectEditor.ProjectClass
    ) as Project;

    project._isDashboardBuild = isDashboardBuild;

    return project;
}

export function getJSON(
    DocumentStore: DocumentStoreClass,
    tabWidth: number = 2
) {
    const toJsHook = (jsObject: any, object: IEezObject) => {
        let projectFeatures = ProjectEditor.extensions;
        for (let projectFeature of projectFeatures) {
            if (
                projectFeature.eezStudioExtension.implementation.projectFeature
                    .toJsHook
            ) {
                projectFeature.eezStudioExtension.implementation.projectFeature.toJsHook(
                    jsObject,
                    object
                );
            }
        }
    };

    (DocumentStore.project as any)._DocumentStore = undefined;

    const json = objectToJson(DocumentStore.project, tabWidth, toJsHook);

    DocumentStore.project._DocumentStore = DocumentStore;

    return json;
}

export function save(DocumentStore: DocumentStoreClass, filePath: string) {
    const json = getJSON(DocumentStore);

    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, json, "utf8", (err: any) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

////////////////////////////////////////////////////////////////////////////////

export enum Section {
    CHECKS,
    OUTPUT,
    SEARCH
}

export class Message implements IMessage {
    id: string = guid();
    @observable selected: boolean = false;

    constructor(
        public type: MessageType,
        public text: string,
        public object?: IEezObject
    ) {}
}

////////////////////////////////////////////////////////////////////////////////

export function propertyNotSetMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": not set.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyNotUniqueMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": is not unique.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertySetButNotUsedMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": set but not used.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyNotFoundMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": "${getProperty(
            object,
            propertyName
        )}" not found.`,
        getChildOfObject(object, propertyName)
    );
}

export function propertyInvalidValueMessage(
    object: IEezObject,
    propertyName: string,
    type: MessageType = MessageType.ERROR
) {
    return new Message(
        type,
        `"${humanizePropertyName(object, propertyName)}": invalid value.`,
        getChildOfObject(object, propertyName)
    );
}

export class OutputSection implements IPanel {
    permanent: boolean = true;

    @observable loading = false;

    @observable messages: Message[] = [];
    @observable selectedMessage: Message | undefined;

    constructor(
        public DocumentStore: DocumentStoreClass,
        public id: number,
        public name: string,
        public scrollToBottom: boolean,
        public tabId: string
    ) {}

    @computed get active() {
        return this.DocumentStore.uiStateStore.activeOutputSection === this.id;
    }

    @computed
    get title(): string | React.ReactNode {
        if (this.id == Section.CHECKS) {
            return (
                <React.Fragment>
                    <span className="title">{this.name}</span>

                    {this.numErrors > 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:error" className="error" />
                            <span>{this.numErrors}</span>
                        </React.Fragment>
                    )}

                    {this.numWarnings > 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:warning" className="warning" />
                            <span>{this.numWarnings}</span>
                        </React.Fragment>
                    )}

                    {this.numErrors === 0 && this.numWarnings === 0 && (
                        <React.Fragment>
                            <span>&nbsp;</span>
                            <Icon icon="material:check" className="info" />
                        </React.Fragment>
                    )}
                </React.Fragment>
            );
        }

        if (
            this.id == Section.SEARCH &&
            (this.DocumentStore.uiStateStore.searchPattern ||
                this.messages.length > 0)
        ) {
            return `${this.name} (${this.messages.length})`;
        }

        return this.name;
    }

    @computed
    get numErrors() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.ERROR) {
                n++;
            }
        }
        return n;
    }

    @computed
    get numWarnings() {
        let n = 0;
        for (let i = 0; i < this.messages.length; i++) {
            if (this.messages[i].type == MessageType.WARNING) {
                n++;
            }
        }
        return n;
    }

    @action
    clear() {
        this.messages = [];
        this.selectedMessage = undefined;
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.selectedMessage &&
            this.messages.indexOf(this.selectedMessage) !== -1
            ? this.selectedMessage.object
            : undefined;
    }

    cutSelection() {
        // TODO
    }

    copySelection() {
        // TODO
    }

    pasteSelection() {
        // TODO
    }

    deleteSelection() {
        // TODO
    }

    @action
    selectMessage(message: Message) {
        if (this.selectedMessage !== message) {
            if (this.selectedMessage) {
                this.selectedMessage.selected = false;
            }
            message.selected = true;
            this.selectedMessage = message;
        }

        if (message.object) {
            this.DocumentStore.navigationStore.showObjects(
                [message.object],
                true,
                true,
                true
            );
        }
    }
}

export class OutputSections {
    sections: OutputSection[] = [];

    constructor(public DocumentStore: DocumentStoreClass) {
        this.sections[Section.CHECKS] = new OutputSection(
            DocumentStore,
            Section.CHECKS,
            "Checks",
            false,
            "CHECKS"
        );
        this.sections[Section.OUTPUT] = new OutputSection(
            DocumentStore,
            Section.OUTPUT,
            "Output",
            true,
            "OUTPUT"
        );
        this.sections[Section.SEARCH] = new OutputSection(
            DocumentStore,
            Section.SEARCH,
            "Search results",
            false,
            "SEARCH_RESULTS"
        );
    }

    getSection(sectionType: Section) {
        return this.sections[sectionType];
    }

    @action
    setLoading(sectionType: Section, loading: boolean) {
        this.sections[sectionType].loading = loading;
    }

    @action
    clear(sectionType: Section) {
        const section = this.sections[sectionType];
        section.clear();
        this.updateTitle(section);
    }

    updateTitle(section: OutputSection) {
        this.DocumentStore.layoutModels.updateTabTitle(
            this.DocumentStore.layoutModels.root,
            section.tabId,
            `${section.name} ${
                section.messages.length > 0
                    ? ` (${section.messages.length})`
                    : ""
            }`
        );
    }

    @action
    write(
        sectionType: Section,
        type: MessageType,
        text: string,
        object?: IEezObject
    ) {
        let section = this.sections[sectionType];
        section.messages.push(new Message(type, text, object));
        this.updateTitle(section);
    }

    @action
    setMessages(sectionType: Section, messages: IMessage[]) {
        let section = this.sections[sectionType];
        section.messages = messages as Message[];
        this.updateTitle(section);
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DocumentStoreClass {
    undoManager = new UndoManager(this);
    navigationStore = new NavigationStore(this);
    editorsStore = new EditorsStore(this);
    layoutModels = new LayoutModels(this);
    uiStateStore = new UIStateStore(this);
    runtimeSettings = new RuntimeSettings(this);
    outputSectionsStore = new OutputSections(this);

    @observable runtime: RuntimeBase | undefined;

    @observable private _project: Project | undefined;
    @observable modified: boolean = false;

    @observable filePath: string | undefined;
    @observable backgroundCheckEnabled = true;

    dataContext: DataContext;

    currentSearch: CurrentSearch;

    objects = new Map<string, IEezObject>();
    lastChildId = 0;

    @observable externalProjects = new Map<string, Project>();
    @observable mapExternalProjectToAbsolutePath = new Map<Project, string>();
    externalProjectsLoading = new Map<string, boolean>();

    dispose1: mobx.IReactionDisposer;
    dispose2: mobx.IReactionDisposer;
    dispose3: mobx.IReactionDisposer;
    dispose4: mobx.IReactionDisposer;
    dispose5: mobx.IReactionDisposer;

    watcher: FSWatcher | undefined = undefined;

    static async create() {
        return new DocumentStoreClass();
    }

    constructor() {
        this.currentSearch = new ProjectEditor.documentSearch.CurrentSearch(
            this
        );

        this.dispose1 = autorun(
            () => {
                this.updateProjectWindowState();
            },
            {
                delay: 100
            }
        );

        this.dispose2 = autorun(
            () => {
                if (this.filePath) {
                    this.updateMruFilePath();
                }
            },
            {
                delay: 100
            }
        );

        this.watch();
    }

    async watch() {
        const chokidarModuleName = "chokidar";
        const { watch } = require(chokidarModuleName);
        this.dispose3 = autorun(() => {
            if (this.watcher) {
                this.watcher.close();
            }
            if (this.project) {
                const importedProjectFiles =
                    this.project.settings.general.imports
                        .filter(
                            importDirective => !!importDirective.projectFilePath
                        )
                        .map(importDirective =>
                            this.getAbsoluteFilePath(
                                importDirective.projectFilePath
                            )
                        );
                this.watcher = watch(importedProjectFiles) as FSWatcher;
                this.watcher.on("change", path => {
                    const project = this.externalProjects.get(path);
                    if (project) {
                        runInAction(() => {
                            this.externalProjects.delete(path);
                            this.mapExternalProjectToAbsolutePath.delete(
                                project
                            );
                            this.loadExternalProject(path);
                        });
                    }
                });
            }
        });
    }

    unmount() {
        this.dispose1();
        this.dispose2();
        if (this.dispose3) {
            this.dispose3();
        }
        if (this.watcher) {
            this.watcher.close();
        }
        if (this.dispose4) {
            this.dispose4();
        }
        if (this.dispose5) {
            this.dispose5();
        }
    }

    async loadMasterProject() {
        const project = this.project!;

        if (project.settings.general.masterProject) {
            try {
                await project.loadMasterProject();
            } catch (err) {
                notification.error(
                    `Failed to load project ${project.settings.general.masterProject}`
                );
            }
        }
    }

    async loadAllExternalProjects() {
        const project = this.project!;

        // load master project
        await this.loadMasterProject();

        // load imported projects
        for (let i = 0; i < project.settings.general.imports.length; i++) {
            try {
                await project.settings.general.imports[i].loadProject();
            } catch (err) {
                notification.error(
                    `Failed to load project ${project.settings.general.imports[i].projectFilePath}`
                );
            }
        }

        this.dispose5 = reaction(
            () => this.project.settings.general.masterProject,
            masterProject => {
                this.loadMasterProject();
            }
        );
    }

    startBackgroundCheck() {
        this.dispose4 = autorun(() => {
            // check the project in the background
            if (
                this.project &&
                this.project._DocumentStore.backgroundCheckEnabled
            ) {
                ProjectEditor.build.backgroundCheck(this);
            }
        });
    }

    get title() {
        const path = EEZStudio.remote.require("path");

        if (this.filePath) {
            if (this.filePath.endsWith(".eez-project")) {
                return path.basename(this.filePath, ".eez-project");
            } else {
                return (
                    path.basename(this.filePath, ".eez-dashboard") +
                    " dashboard"
                );
            }
        } else {
            return "Untitled project";
        }
    }

    updateProjectWindowState() {
        let title = "";

        if (this.project) {
            if (this.modified) {
                title += "\u25CF ";
            }
            title += this.title + " - ";
        }

        title += "EEZ Studio";

        if (title != document.title) {
            document.title = title;
        }

        EEZStudio.electron.ipcRenderer.send("windowSetState", {
            modified: this.modified,
            projectFilePath: this.filePath,
            undo:
                (this.undoManager &&
                    this.undoManager.canUndo &&
                    this.undoManager.undoDescription) ||
                null,
            redo:
                (this.undoManager &&
                    this.undoManager.canRedo &&
                    this.undoManager.redoDescription) ||
                null
        });
    }

    updateMruFilePath() {
        EEZStudio.electron.ipcRenderer.send("setMruFilePath", this.filePath);
    }

    getFilePathRelativeToProjectPath(absoluteFilePath: string) {
        const path = EEZStudio.remote.require("path");
        return path.relative(path.dirname(this.filePath), absoluteFilePath);
    }

    getProjectFilePath(project: Project) {
        if (project == this.project) {
            return this.filePath;
        } else {
            return this.mapExternalProjectToAbsolutePath.get(project);
        }
    }

    getAbsoluteFilePath(relativeFilePath: string, project?: Project) {
        if (!relativeFilePath) {
            relativeFilePath = "";
        }
        const path = EEZStudio.remote.require("path");
        const filePath = this.getProjectFilePath(project ?? this.project);
        return filePath
            ? path.resolve(
                  path.dirname(filePath),
                  relativeFilePath.replace(/(\\|\/)/g, path.sep)
              )
            : relativeFilePath;
    }

    getFolderPathRelativeToProjectPath(absoluteFolderPath: string) {
        const path = EEZStudio.remote.require("path");
        let folder = path.relative(
            path.dirname(this.filePath),
            absoluteFolderPath
        );
        if (folder == "") {
            folder = ".";
        }
        return folder;
    }

    getAbsoluteProjectFolderPath() {
        const path = EEZStudio.remote.require("path");
        return path.dirname(this.filePath);
    }

    @computed
    get selectedBuildConfiguration() {
        let configuration =
            this.project &&
            this.project.settings.build.configurations.find(
                configuration =>
                    configuration.name ==
                    this.uiStateStore.selectedBuildConfiguration
            );
        if (!configuration) {
            if (this.project.settings.build.configurations.length > 0) {
                configuration = this.project.settings.build.configurations[0];
            }
        }
        return configuration;
    }

    async doSave() {
        if (!this.project._isDashboardBuild) {
            await save(this, this.filePath!);
        }
        this.setModified(false);
    }

    async saveToFile(saveAs: boolean) {
        if (this.project) {
            if (!this.filePath || saveAs) {
                const result = await EEZStudio.remote.dialog.showSaveDialog(
                    EEZStudio.remote.getCurrentWindow(),
                    {
                        filters: [
                            {
                                name: "EEZ Project",
                                extensions: ["eez-project"]
                            },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    }
                );
                let filePath = result.filePath;
                if (filePath) {
                    if (!filePath.toLowerCase().endsWith(".eez-project")) {
                        filePath += ".eez-project";
                    }
                    runInAction(() => {
                        this.filePath = filePath;
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

    getNewProject(): Project {
        let project: any = {
            settings: {
                general: {},
                build: {
                    configurations: [
                        {
                            name: "Default"
                        }
                    ],
                    files: []
                }
            }
        };

        return loadObject(
            this,
            undefined,
            project as Project,
            ProjectEditor.ProjectClass
        ) as Project;
    }

    async newProject() {
        await this.changeProject(undefined, this.getNewProject());
    }

    async openFile(filePath: string) {
        const project = await load(this, filePath);
        await this.changeProject(filePath, project);
    }

    async saveModified() {
        if (this.project._isDashboardBuild) {
            return true;
        }

        if (this.project && this.modified) {
            return new Promise<boolean>(resolve => {
                confirmSave({
                    saveCallback: async () => {
                        resolve(await this.saveToFile(false));
                    },
                    dontSaveCallback: () => resolve(true),
                    cancelCallback: () => resolve(false)
                });
            });
        }

        return true;
    }

    save() {
        return this.saveToFile(false);
    }

    saveAs() {
        return this.saveToFile(true);
    }

    check() {
        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.CHECKS_TAB_ID
        );
        ProjectEditor.build.buildProject(this, { onlyCheck: true });
    }

    async build() {
        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.OUTPUT_TAB_ID
        );
        return await ProjectEditor.build.buildProject(this, {
            onlyCheck: false
        });
    }

    buildExtensions() {
        ProjectEditor.build.buildExtensions(this);
    }

    async closeWindow() {
        if (this.runtime) {
            await this.runtime.stopRuntime(false);
            this.dataContext.clear();
        }
        await this.runtimeSettings.save();

        if (!this.project._isDashboardBuild) {
            await this.uiStateStore.save();
        }

        if (this.project) {
            return await this.saveModified();
        }

        return true;
    }

    showMetrics() {
        const ID = "eez-project-editor-project-metrics";
        if (!document.getElementById(ID)) {
            showGenericDialog({
                dialogDefinition: {
                    id: ID,
                    title: "Project Metrics",
                    fields: [
                        {
                            name: "metrics",
                            fullLine: true,
                            type: TableField
                        }
                    ]
                },
                values: {
                    metrics: ProjectEditor.getAllMetrics(this)
                },
                showOkButton: false
            }).catch(() => {});
        }
    }

    @computed
    get masterProjectEnabled() {
        return !!this.project.settings.general.masterProject;
    }

    @computed
    get masterProject() {
        return this.project.masterProject;
    }

    async loadExternalProject(filePath: string) {
        if (
            filePath == this.filePath ||
            this.externalProjects.get(filePath) ||
            this.externalProjectsLoading.get(filePath)
        ) {
            // already loaded or loading
            return;
        }

        this.externalProjectsLoading.set(filePath, true);

        const project = await load(this, filePath);

        project._isReadOnly = true;
        project._DocumentStore = this;

        runInAction(() => {
            this.externalProjects.set(filePath, project);
            this.mapExternalProjectToAbsolutePath.set(project, filePath);
        });

        this.externalProjectsLoading.set(filePath, false);
    }

    getChildId() {
        return (++this.lastChildId).toString();
    }

    get project() {
        return this._project!;
    }

    getObjectFromPath(path: string[]) {
        return getObjectFromPath(this.project, path);
    }

    getObjectFromStringPath(objectID: string) {
        return getObjectFromStringPath(this.project, objectID);
    }

    getObjectFromObjectId(objectID: string) {
        return this.objects.get(objectID);
    }

    @computed
    get isModified() {
        return this.modified;
    }

    @action
    setModified(modified_: boolean) {
        this.modified = modified_;
    }

    @action
    async changeProject(
        projectFilePath: string | undefined,
        project?: Project
    ) {
        if (!project) {
            this.project.settings.general.imports.forEach(importDirective => {
                if (importDirective.project) {
                    importDirective.project._DocumentStore.unmount();
                }
            });
        }

        this.filePath = projectFilePath;

        if (project) {
            project._DocumentStore = this;
            this.dataContext = new ProjectEditor.DataContextClass(project);
        } else {
            this.dataContext = undefined as any;
        }

        this._project = project;
        if (!project) {
            this.objects.clear();
            this.lastChildId = 0;
        }
        this.undoManager.clear();

        if (project) {
            await this.uiStateStore.load();
            await this.runtimeSettings.load();
        } else {
            this.editorsStore.unmount();
            this.uiStateStore.unmount();
            this.unmount();
        }
    }

    canSave() {
        return this.modified;
    }

    addObject(parentObject: IEezObject, object: any) {
        if (getParent(parentObject) && getKey(parentObject)) {
            const propertyInfo = findPropertyByNameInObject(
                getParent(parentObject),
                getKey(parentObject)
            );
            if (propertyInfo && propertyInfo.interceptAddObject) {
                object = propertyInfo.interceptAddObject(parentObject, object);
            }
        }

        return addObject(parentObject, object);
    }

    addObjects(parentObject: IEezObject, objects: any[]) {
        return addObjects(parentObject, objects);
    }

    insertObject(parentObject: IEezObject, index: number, object: any) {
        return insertObject(parentObject, index, object);
    }

    updateObject(object: IEezObject, inputValues: any) {
        // make sure that plain JavaScript objects to EezObject's
        let values: any = {};

        let oldValues: any;
        if (getClassInfo(object).afterUpdateObjectHook) {
            oldValues = {};
        }

        for (let propertyName in inputValues) {
            if (inputValues.hasOwnProperty(propertyName)) {
                if (getClassInfo(object).afterUpdateObjectHook) {
                    oldValues[propertyName] = getProperty(object, propertyName);
                }

                let propertyInfo = findPropertyByNameInObject(
                    object,
                    propertyName
                );

                if (propertyInfo) {
                    if (propertyInfo.computed !== true) {
                        const value = inputValues[propertyName];
                        if (
                            (propertyInfo.type === PropertyType.Object ||
                                propertyInfo.type === PropertyType.Array) &&
                            value !== undefined &&
                            !isEezObject(value)
                        ) {
                            // convert to EezObject
                            values[propertyName] = loadObject(
                                this,
                                object,
                                inputValues[propertyName],
                                propertyInfo.typeClass!
                            );
                        } else {
                            // use as is
                            values[propertyName] = value;
                        }
                    } else {
                        console.warn("ignored computed property", propertyName);
                    }
                } else {
                    console.error("ignored unknown property", propertyName);
                }
            }
        }

        updateObject(object, values);

        const afterUpdateObjectHook =
            getClassInfo(object).afterUpdateObjectHook;
        if (afterUpdateObjectHook) {
            afterUpdateObjectHook(object, inputValues, oldValues);
        }
    }

    deleteObject(object: IEezObject, options?: { dropPlace?: IEezObject }) {
        let closeCombineCommands = false;
        if (!this.undoManager.combineCommands) {
            this.undoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        const classInfo = getClassInfo(object);
        if (classInfo.deleteObjectRefHook) {
            classInfo.deleteObjectRefHook(object, options);
        }

        deleteObject(object);

        if (closeCombineCommands) {
            this.undoManager.setCombineCommands(false);
        }
    }

    deleteObjects(objects: IEezObject[]) {
        if (objects.length === 1) {
            this.deleteObject(objects[0]);
        } else {
            let closeCombineCommands = false;
            if (!this.undoManager.combineCommands) {
                this.undoManager.setCombineCommands(true);
                closeCombineCommands = true;
            }

            objects.forEach(object => {
                const classInfo = getClassInfo(object);
                if (classInfo.deleteObjectRefHook) {
                    classInfo.deleteObjectRefHook(object);
                }
            });

            objects = objects.filter(object => {
                const classInfo = getClassInfo(object);
                if (classInfo.deleteObjectFilterHook) {
                    return classInfo.deleteObjectFilterHook(object);
                }
                return true;
            });

            deleteObjects(objects);

            if (closeCombineCommands) {
                this.undoManager.setCombineCommands(false);
            }
        }
    }

    replaceObject(object: IEezObject, replaceWithObject: IEezObject) {
        if (getParent(object) !== getParent(replaceWithObject)) {
            console.error("assert failed");
        }

        return replaceObject(object, replaceWithObject);
    }

    replaceObjects(objects: IEezObject[], replaceWithObject: IEezObject) {
        if (getParent(objects[0]) !== getParent(replaceWithObject)) {
            console.error("assert failed");
        }

        return replaceObjects(objects, replaceWithObject);
    }

    insertObjectBefore(object: IEezObject, objectToInsert: any) {
        return insertObjectBefore(object, objectToInsert);
    }

    insertObjectAfter(object: IEezObject, objectToInsert: any) {
        return insertObjectAfter(object, objectToInsert);
    }

    objectsToClipboardData(objects: IEezObject[]) {
        const classInfo = getClassInfo(objects[0]);
        if (classInfo.objectsToClipboardData) {
            return classInfo.objectsToClipboardData(objects);
        }
        return objectsToClipboardData(objects);
    }

    setRuntimeMode(isDebuggerActive: boolean) {
        let runtime: RuntimeBase | undefined;

        if (this.project.isDashboardProject) {
            runtime = new ProjectEditor.LocalRuntimeClass(this);
        } else {
            runtime = new ProjectEditor.RemoteRuntimeClass(this);
        }

        runInAction(() => (this.runtime = runtime));

        runtime.startRuntime(isDebuggerActive);
    }

    @action
    setEditorMode() {
        if (this.runtime) {
            this.runtime.stopRuntime(false);
            this.dataContext.clear();

            if (this.runtime.isDebuggerActive) {
                const editorState = this.editorsStore.activeEditor?.state;
                if (editorState) {
                    editorState.selectObjects([]);
                }
            }

            this.runtime = undefined;
        }
    }

    @action
    onSetEditorMode = () => {
        this.setEditorMode();
        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.PROPERTIES_TAB_ID
        );
    };

    onSetRuntimeMode = async () => {
        if (this.runtime) {
            if (this.runtime.isDebuggerActive) {
                this.runtime.toggleDebugger();
            }
        } else {
            this.setRuntimeMode(false);
        }
    };

    onSetDebuggerMode = () => {
        if (!this.runtime) {
            this.setRuntimeMode(true);
        } else {
            if (!this.runtime.isDebuggerActive) {
                this.editorsStore.openEditor(this.runtime.selectedPage);
                this.runtime.toggleDebugger();
            }
        }

        this.layoutModels.selectTab(
            this.layoutModels.root,
            LayoutModels.DEBUGGER_TAB_ID
        );

        if (
            this.navigationStore.selectedRootObject.get() !=
                this.project.pages ||
            this.navigationStore.selectedRootObject.get() !=
                this.project.actions
        ) {
            runInAction(() => {
                this.navigationStore.selectedRootObject.set(this.project.pages);
            });
        }
    };

    onRestart = () => {
        this.setRuntimeMode(false);
    };

    onRestartRuntimeWithDebuggerActive = () => {
        this.onSetEditorMode();
        this.setRuntimeMode(true);
    };

    loadDebugInfo(filePath: string) {
        if (this.runtime) {
            this.runtime.stopRuntime(false);
            this.dataContext.clear();
        }

        const runtime = new ProjectEditor.DebugInfoRuntimeClass(this);
        runtime.startRuntime(true);
        runtime.loadDebugInfo(filePath);
        runInAction(() => (this.runtime = runtime));
    }
}

////////////////////////////////////////////////////////////////////////////////

export function extendContextMenu(
    context: IContextMenuContext,
    object: IEezObject,
    objects: IEezObject[],
    menuItems: Electron.MenuItem[]
) {
    const extendContextMenu = getClassInfo(object).extendContextMenu;
    if (extendContextMenu) {
        extendContextMenu(object, context, objects, menuItems);
    }
}

export function canAdd(object: IEezObject) {
    return (
        (isArrayElement(object) || isArray(object)) &&
        getClassInfo(object).newItem != undefined
    );
}

export function canDuplicate(object: IEezObject) {
    return isArrayElement(object);
}

function isOptional(object: IEezObject) {
    let parent = getParent(object);
    if (!parent) {
        return false;
    }

    let property: PropertyInfo | undefined = findPropertyByNameInObject(
        parent,
        getKey(object)
    );

    if (property == undefined) {
        return false;
    }

    return property.isOptional;
}

export function canDelete(object: IEezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canCut(object: IEezObject) {
    return canCopy(object) && canDelete(object);
}

export function canCopy(object: IEezObject) {
    return isArrayElement(object) || isOptional(object);
}

export function canContainChildren(object: IEezObject) {
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            isPropertyEnumerable(object, propertyInfo) &&
            (propertyInfo.type === PropertyType.Array ||
                propertyInfo.type === PropertyType.Object)
        ) {
            return true;
        }
    }

    return false;
}

export function canPaste(
    DocumentStore: DocumentStoreClass,
    object: IEezObject
) {
    try {
        return checkClipboard(DocumentStore, object);
    } catch (e) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export function getDocumentStore(object: IEezObject) {
    return (getRootObject(object) as Project)._DocumentStore;
}

export async function addItem(object: IEezObject) {
    const parent = isArray(object) ? object : getParent(object);
    if (!parent) {
        return null;
    }

    const parentClassInfo = getClassInfo(parent);
    if (!parentClassInfo.newItem) {
        return null;
    }

    let newObjectProperties;
    try {
        newObjectProperties = await parentClassInfo.newItem(parent);
    } catch (err) {
        if (err !== undefined) {
            notification.error(
                `Adding ${getClass(parent).name} failed: ${err}!`
            );
        }
        return null;
    }

    if (!newObjectProperties) {
        console.log(`Canceled adding ${getClass(parent).name}`);
        return null;
    }

    return getDocumentStore(object).addObject(parent, newObjectProperties);
}

export function pasteItem(object: IEezObject) {
    try {
        const DocumentStore = getDocumentStore(object);

        let c = checkClipboard(DocumentStore, object);
        if (c) {
            if (typeof c.pastePlace === "string") {
                DocumentStore.updateObject(object, {
                    [c.pastePlace]: c.serializedData.object
                });
            } else {
                if (c.serializedData.object) {
                    if (
                        isArray(c.pastePlace as IEezObject) &&
                        getParent(object) === (c.pastePlace as IEezObject)
                    ) {
                        return DocumentStore.insertObject(
                            c.pastePlace as IEezObject,
                            (c.pastePlace as IEezObject[]).indexOf(object) + 1,
                            objectToJS(c.serializedData.object)
                        );
                    } else {
                        const aClass = getClassByName(
                            c.serializedData.objectClassName
                        );

                        if (aClass && aClass.classInfo.pasteItemHook) {
                            return aClass.classInfo.pasteItemHook(object, c);
                        }

                        return DocumentStore.addObject(
                            c.pastePlace as IEezObject,
                            objectToJS(c.serializedData.object)
                        );
                    }
                } else if (c.serializedData.objects) {
                    return DocumentStore.addObjects(
                        c.pastePlace as IEezObject,
                        objectToJS(c.serializedData.objects)
                    );
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
    return undefined;
}

export function deleteItem(object: IEezObject) {
    deleteItems([object]);
}

export function cutItem(object: IEezObject) {
    let clipboardText = objectToClipboardData(object);

    deleteItems([object], () => {
        copyToClipboard(clipboardText);
    });
}

export function copyItem(object: IEezObject) {
    copyToClipboard(objectToClipboardData(object));
}

function duplicateItem(object: IEezObject) {
    let parent = getParent(object) as IEezObject;
    return getDocumentStore(object).addObject(parent, toJS(object));
}

export interface IContextMenuContext {
    selectObject(object: IEezObject): void;
    selectObjects(objects: IEezObject[]): void;
}

export function createContextMenu(
    context: IContextMenuContext,
    object: IEezObject
) {
    let menuItems: Electron.MenuItem[] = [];

    const DocumentStore = getDocumentStore(object);

    if (canAdd(object)) {
        menuItems.push(
            new MenuItem({
                label: "Add",
                click: async () => {
                    const aNewObject = await addItem(object);
                    if (aNewObject) {
                        context.selectObject(aNewObject);
                    }
                }
            })
        );
    }

    if (canDuplicate(object)) {
        menuItems.push(
            new MenuItem({
                label: "Duplicate",
                click: () => {
                    const aNewObject = duplicateItem(object);
                    if (aNewObject) {
                        context.selectObject(aNewObject);
                    }
                }
            })
        );
    }

    if (isArrayElement(object)) {
        if (menuItems.length > 0) {
            menuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }

        menuItems.push(
            new MenuItem({
                label: "Find All References",
                click: () => {
                    ProjectEditor.documentSearch.findAllReferences(object);
                }
            })
        );
    }

    let clipboardMenuItems: Electron.MenuItem[] = [];

    if (canCut(object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Cut",
                click: () => {
                    cutItem(object);
                }
            })
        );
    }

    if (canCopy(object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Copy",
                click: () => {
                    copyItem(object);
                }
            })
        );
    }

    if (canPaste(DocumentStore, object)) {
        clipboardMenuItems.push(
            new MenuItem({
                label: "Paste",
                click: () => {
                    const aNewObject = pasteItem(object);
                    if (aNewObject) {
                        if (Array.isArray(aNewObject)) {
                            context.selectObjects(aNewObject);
                        } else {
                            context.selectObject(aNewObject);
                        }
                    }
                }
            })
        );
    }

    if (clipboardMenuItems.length > 0) {
        if (menuItems.length > 0) {
            menuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }
        menuItems = menuItems.concat(clipboardMenuItems);
    }

    if (canDelete(object)) {
        if (menuItems.length > 0) {
            menuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }

        menuItems.push(
            new MenuItem({
                label: "Delete",
                click: () => {
                    deleteItems([object]);
                }
            })
        );
    }

    extendContextMenu(context, object, [object], menuItems);

    if (menuItems.length > 0) {
        const menu = new Menu();
        menuItems.forEach(menuItem => menu.append(menuItem));
        return menu;
    }

    return undefined;
}

export function showContextMenu(
    context: IContextMenuContext,
    object: IEezObject
) {
    const menu = createContextMenu(context, object);

    if (menu) {
        menu.popup();
    }
}

////////////////////////////////////////////////////////////////////////////////

export function deleteItems(objects: IEezObject[], callback?: () => void) {
    const DocumentStore = getDocumentStore(objects[0]);

    function doDelete() {
        DocumentStore.deleteObjects(objects);
        if (callback) {
            callback();
        }
    }

    if (objects.length === 1) {
        if (ProjectEditor.documentSearch.isReferenced(objects[0])) {
            confirm(
                "Are you sure you want to delete this item?",
                "It is used in other parts.",
                doDelete
            );
        } else {
            doDelete();
        }
    } else {
        let isAnyItemReferenced = false;

        for (let i = 0; i < objects.length; i++) {
            if (ProjectEditor.documentSearch.isReferenced(objects[i])) {
                isAnyItemReferenced = true;
                break;
            }
        }

        if (isAnyItemReferenced) {
            confirm(
                "Are you sure you want to delete this items?",
                "Some of them are used in other parts.",
                doDelete
            );
        } else {
            doDelete();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const CLIPOARD_DATA_ID = "application/eez-studio-project-editor-data";

export function objectToClipboardData(object: IEezObject): string {
    return JSON.stringify({
        objectClassName: getClass(object).name,
        object: objectToJson(object)
    });
}

export function objectsToClipboardData(objects: IEezObject[]): string {
    return JSON.stringify({
        objectClassName: getClass(objects[0]).name,
        objects: objects.map(object => objectToJson(object))
    });
}

export function clipboardDataToObject(
    DocumentStore: DocumentStoreClass,
    data: string
) {
    let serializedData: SerializedData = JSON.parse(data);

    const aClass = findClass(serializedData.objectClassName);
    if (aClass) {
        serializedData.classInfo = aClass.classInfo;
        if (serializedData.object) {
            serializedData.object = loadObject(
                DocumentStore,
                undefined,
                serializedData.object,
                aClass
            );
        } else if (serializedData.objects) {
            serializedData.objects = serializedData.objects.map(object =>
                loadObject(DocumentStore, undefined, object, aClass)
            );
        }
    }

    return serializedData;
}

let clipboardData: string;

export function setClipboardData(event: any, value: string) {
    clipboardData = value;
    event.dataTransfer.setData(CLIPOARD_DATA_ID, clipboardData);
}

export function getEezStudioDataFromDragEvent(
    DocumentStore: DocumentStoreClass,
    event: any
) {
    let data = event.dataTransfer.getData(CLIPOARD_DATA_ID);
    if (!data) {
        data = clipboardData;
    }
    if (data) {
        return clipboardDataToObject(DocumentStore, data);
    }
    return undefined;
}

export function findPastePlaceInside(
    object: IEezObject,
    classInfo: ClassInfo,
    isSingleObject: boolean
) {
    if (isArray(object) && isSubclassOf(classInfo, getClassInfo(object))) {
        return object;
    }

    if (isObject(object)) {
        const findPastePlaceInside = getClassInfo(object).findPastePlaceInside;
        if (findPastePlaceInside) {
            return findPastePlaceInside(object, classInfo, isSingleObject);
        }
    }

    // first, find among array properties
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            propertyInfo.type === PropertyType.Array &&
            isSubclassOf(classInfo, propertyInfo.typeClass!.classInfo)
        ) {
            let collectionObject = getChildOfObject(object, propertyInfo);
            if (collectionObject) {
                return collectionObject;
            }
        }
    }

    // then, find among object properties
    for (const propertyInfo of getClassInfo(object).properties) {
        if (
            propertyInfo.type == PropertyType.Object &&
            isSubclassOf(classInfo, propertyInfo.typeClass!.classInfo) &&
            isSingleObject
        ) {
            let childObject = getChildOfObject(object, propertyInfo);
            if (!childObject) {
                return propertyInfo;
            }
        }
    }

    return undefined;
}

export function findPastePlaceInsideAndOutside(
    object: IEezObject,
    serializedData: SerializedData
): EezObject | undefined {
    if (!serializedData.classInfo) {
        return undefined;
    }

    let place = findPastePlaceInside(
        object,
        serializedData.classInfo,
        !!serializedData.object
    );
    if (place) {
        return place;
    }

    let parent = getParent(object);
    return parent && findPastePlaceInsideAndOutside(parent, serializedData);
}

export function checkClipboard(
    DocumentStore: DocumentStoreClass,
    object: IEezObject
) {
    let text = pasteFromClipboard();
    if (text) {
        let serializedData = clipboardDataToObject(DocumentStore, text);
        if (serializedData) {
            let pastePlace = findPastePlaceInsideAndOutside(
                object,
                serializedData
            );
            if (pastePlace) {
                return {
                    serializedData: serializedData,
                    pastePlace: pastePlace
                };
            }
        }
    }
    return undefined;
}

export function copyToClipboard(text: string) {
    EEZStudio.remote.clipboard.write({
        text
    });
}

export function pasteFromClipboard(): string | undefined {
    return EEZStudio.remote.clipboard.readText();
}

////////////////////////////////////////////////////////////////////////////////

export class EezValueObject extends EezObject {
    static classInfo: ClassInfo = {
        label: (object: EezValueObject) => {
            return object.value && object.value.toString();
        },
        properties: []
    };

    public propertyInfo: PropertyInfo;
    public value: any;

    static create(object: IEezObject, propertyInfo: PropertyInfo, value: any) {
        const valueObject = new EezValueObject();

        const DocumentStore = getDocumentStore(object);

        setId(DocumentStore.objects, valueObject, DocumentStore.getChildId());
        setKey(valueObject, propertyInfo.name);
        setParent(valueObject, object);

        valueObject.propertyInfo = propertyInfo;
        valueObject.value = value;

        return valueObject;
    }
}
registerClass("EezValueObject", EezValueObject);

////////////////////////////////////////////////////////////////////////////////

export function isValue(object: IEezObject | undefined) {
    return !!object && object instanceof EezValueObject;
}

export function getChildOfObject(
    object: IEezObject,
    key: PropertyInfo | string | number
): IEezObject | undefined {
    let propertyInfo: PropertyInfo | undefined;

    if (isArray(object)) {
        let elementIndex: number | undefined = undefined;

        if (typeof key == "string") {
            elementIndex = parseInt(key);
        } else if (typeof key == "number") {
            elementIndex = key;
        }

        const array = object as IEezObject[];

        if (
            elementIndex !== undefined &&
            elementIndex >= 0 &&
            elementIndex < array.length
        ) {
            return array[elementIndex];
        } else {
            console.error("invalid array index");
        }
    } else {
        if (typeof key == "string") {
            propertyInfo = findPropertyByNameInObject(object, key);
        } else if (typeof key == "number") {
            console.error("invalid key type");
        } else {
            propertyInfo = key;
        }
    }

    if (propertyInfo) {
        let childObjectOrValue = getProperty(object, propertyInfo.name);
        if (propertyInfo.typeClass) {
            return childObjectOrValue;
        } else {
            return EezValueObject.create(
                object,
                propertyInfo,
                childObjectOrValue
            );
        }
    }

    return undefined;
}

export function getObjectPropertyAsObject(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    return getChildOfObject(object, propertyInfo) as EezValueObject;
}

export function getObjectFromPath(rootObject: IEezObject, path: string[]) {
    let object = rootObject;

    for (let i = 0; i < path.length && object; i++) {
        object = getChildOfObject(object, path[i]) as IEezObject;
    }

    return object;
}

export function getObjectFromStringPath(
    rootObject: IEezObject,
    stringPath: string
) {
    if (stringPath == "/") {
        return rootObject;
    }
    return getObjectFromPath(rootObject, stringPath.split("/").slice(1));
}

export function objectToString(object: IEezObject) {
    let label: string;

    if (isValue(object)) {
        label = getProperty(getParent(object), getKey(object));
    } else if (isArray(object)) {
        let propertyInfo = findPropertyByNameInObject(
            getParent(object),
            getKey(object)
        );
        label =
            (propertyInfo &&
                getObjectPropertyDisplayName(object, propertyInfo)) ||
            humanize(getKey(object));
    } else {
        label = getLabel(object);
    }

    if (
        object &&
        getParent(object) &&
        isArray(getParent(object)) &&
        getParent(getParent(object)) &&
        getKey(getParent(object))
    ) {
        let propertyInfo = findPropertyByNameInObject(
            getParent(getParent(object)),
            getKey(getParent(object))
        );
        if (propertyInfo && propertyInfo.childLabel) {
            label = propertyInfo.childLabel(object, label);
        }
    }

    return label;
}

export function getPropertyAsString(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    let value = getProperty(object, propertyInfo.name);
    if (typeof value === "boolean") {
        return value.toString();
    }
    if (typeof value === "number") {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "undefined") {
        return "";
    }
    if (isArray(value)) {
        return (value as IEezObject[])
            .map(object => getLabel(object))
            .join(", ");
    }
    return objectToString(value);
}

export function getHumanReadableObjectPath(object: IEezObject) {
    let ancestors = getAncestors(object);
    return ancestors
        .slice(1)
        .map(object => objectToString(object))
        .join(" / ");
}

export function isObject(object: IEezObject | undefined) {
    return !!object && !isValue(object) && !isArray(object);
}

export function isArray(
    object: IEezObject | undefined
): object is IEezObject[] {
    return !!object && !isValue(object) && Array.isArray(object);
}

export function getChildren(parent: IEezObject): IEezObject[] {
    if (isArray(parent)) {
        return parent;
    } else {
        let properties = getClassInfo(parent).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array) &&
                isPropertyEnumerable(parent, propertyInfo) &&
                getProperty(parent, propertyInfo.name)
        );

        if (
            properties.length == 1 &&
            properties[0].type === PropertyType.Array &&
            !(properties[0].showOnlyChildrenInTree === false)
        ) {
            return getProperty(parent, properties[0].name);
        }

        return properties.map(propertyInfo =>
            getProperty(parent, propertyInfo.name)
        );
    }
}

export function getClass(object: IEezObject) {
    if (isArray(object)) {
        return getPropertyInfo(object).typeClass!;
    } else {
        return object.constructor as EezClass;
    }
}

export function getClassInfo(object: IEezObject): ClassInfo {
    return getClass(object).classInfo;
}

export function isObjectInstanceOf(
    object: IEezObject,
    baseClassInfo: ClassInfo
) {
    return isSubclassOf(getClassInfo(object), baseClassInfo);
}

export function getLabel(object: IEezObject): string {
    if (typeof object === "string") {
        return object;
    }

    const label = getClassInfo(object).label;
    if (label) {
        return label(object);
    }

    let name = (object as any).name;
    if (name) {
        return name;
    }

    return getClass(object).name;
}

export function isArrayElement(object: IEezObject) {
    return isArray(getParent(object));
}

export function findPropertyByNameInObject(
    object: IEezObject,
    propertyName: string
) {
    return getClassInfo(object).properties.find(
        propertyInfo => propertyInfo.name == propertyName
    );
}

export function findPropertyByChildObject(
    object: IEezObject,
    childObject: IEezObject
) {
    return getClassInfo(object).properties.find(
        propertyInfo => getProperty(object, propertyInfo.name) === childObject
    );
}

export function getInheritedValue(object: IEezObject, propertyName: string) {
    const getInheritedValue = getClassInfo(object).getInheritedValue;
    if (getInheritedValue) {
        return getInheritedValue(object, propertyName);
    }
    return undefined;
}

export function humanizePropertyName(object: IEezObject, propertyName: string) {
    const property = findPropertyByNameInObject(object, propertyName);
    if (property && property.displayName) {
        if (typeof property.displayName == "string") {
            return property.displayName;
        }
        return property.displayName(object);
    }
    return humanize(propertyName);
}

export function getAncestorOfType<T = IEezObject>(
    object: IEezObject,
    classInfo: ClassInfo
): T | undefined {
    if (object) {
        if (isObjectInstanceOf(object, classInfo)) {
            return object as T;
        }
        return (
            getParent(object) && getAncestorOfType(getParent(object), classInfo)
        );
    }
    return undefined;
}

export function getObjectPath(object: IEezObject): (string | number)[] {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            return getObjectPath(parent).concat(
                parent.indexOf(object as IEezObject)
            );
        } else {
            return getObjectPath(parent).concat(getKey(object));
        }
    }
    return [];
}

export function getObjectPathAsString(object: IEezObject) {
    return "/" + getObjectPath(object).join("/");
}

export function isObjectExists(object: IEezObject) {
    let parent = getParent(object);
    if (parent) {
        if (isArray(parent)) {
            if (parent.indexOf(object) === -1) {
                return false;
            }
        } else {
            const key = getKey(object);
            if (key && (parent as any)[key] !== object) {
                return false;
            }
        }
    }
    return true;
}

export function isShowOnlyChildrenInTree(object: IEezObject) {
    if (!getParent(object) || !getKey(object)) {
        return true;
    }

    const propertyInfo = findPropertyByNameInObject(
        getParent(object),
        getKey(object)
    );
    if (!propertyInfo) {
        return true;
    }

    return !(propertyInfo.showOnlyChildrenInTree === false);
}

export function isPartOfNavigation(object: IEezObject) {
    if (getParent(object)) {
        let propertyInfo = findPropertyByChildObject(getParent(object), object);
        if (propertyInfo && propertyInfo.partOfNavigation === false) {
            return false;
        }
    }
    return true;
}

export function getArrayAndObjectProperties(object: IEezObject) {
    if (!getClassInfo(object)._arrayAndObjectProperties) {
        getClassInfo(object)._arrayAndObjectProperties = getClassInfo(
            object
        ).properties.filter(
            propertyInfo =>
                (propertyInfo.type === PropertyType.Array ||
                    propertyInfo.type === PropertyType.Object) &&
                getProperty(object, propertyInfo.name)
        );
    }
    return getClassInfo(object)._arrayAndObjectProperties!;
}

export function getCommonProperties(objects: IEezObject[]) {
    let properties = getClassInfo(objects[0]).properties;

    properties = properties.filter(
        propertyInfo =>
            !objects.find(
                object =>
                    isArray(object) || isPropertyHidden(object, propertyInfo)
            )
    );

    if (objects.length > 1) {
        // some property types are not supported in multi-objects property grid
        properties = properties.filter(
            propertyInfo =>
                propertyInfo.type !== PropertyType.Array &&
                !(
                    propertyInfo.type === PropertyType.String &&
                    propertyInfo.unique === true
                )
        );

        // show only common properties
        properties = properties.filter(
            propertyInfo =>
                !objects.find(
                    object =>
                        !getClassInfo(object).properties.find(
                            pi => pi === propertyInfo
                        )
                )
        );
    }

    return properties;
}

export function getPropertySourceInfo(
    props: PropertyProps
): PropertyValueSourceInfo {
    function getSourceInfo(
        object: IEezObject,
        propertyInfo: PropertyInfo
    ): PropertyValueSourceInfo {
        if (props.propertyInfo.propertyMenu && !propertyInfo.inheritable) {
            return {
                source: ""
            };
        }

        let value = (object as any)[propertyInfo.name];

        if (propertyInfo.inheritable) {
            if (value === undefined) {
                let inheritedValue = getInheritedValue(
                    object,
                    propertyInfo.name
                );
                if (inheritedValue) {
                    return {
                        source: "inherited",
                        inheritedFrom: inheritedValue.source
                    };
                }
            }
        }

        if (value !== undefined) {
            return {
                source: "modified"
            };
        }

        return {
            source: "default"
        };
    }

    const sourceInfoArray = props.objects.map(object =>
        getSourceInfo(object, props.propertyInfo)
    );

    for (let i = 1; i < sourceInfoArray.length; i++) {
        if (sourceInfoArray[i].source !== sourceInfoArray[0].source) {
            return {
                source: "modified"
            };
        }
    }

    return sourceInfoArray[0];
}

export function isAnyPropertyModified(props: PropertyProps) {
    const properties = getCommonProperties(props.objects);
    for (let propertyInfo of properties) {
        const sourceInfo = getPropertySourceInfo({ ...props, propertyInfo });
        if (sourceInfo.source === "modified") {
            return true;
        }
    }
    return false;
}

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

export interface ICommand {
    execute(): void;
    undo(): void;
    description: string;
}

export interface IUndoManager {
    executeCommand(command: ICommand): void;
    combineCommands: boolean;
    commands: ICommand[];
}

////////////////////////////////////////////////////////////////////////////////

function getUniquePropertyValue(
    existingObjects: IEezObject[],
    key: string,
    value: string | number
) {
    if (value === undefined) {
        return value;
    }
    while (true) {
        if (
            !existingObjects.find(object => getProperty(object, key) == value)
        ) {
            return value;
        }

        if (typeof value == "number") {
            value++;
        } else {
            var groups = value.match(/(.+) \((\d+)\)/);
            if (groups) {
                value = groups[1] + " (" + (parseInt(groups[2]) + 1) + ")";
            } else {
                value += " (1)";
            }
        }
    }
}

// ensure that unique properties are unique inside parent
function ensureUniqueProperties(
    parentObject: IEezObject,
    objects: IEezObject[]
) {
    let existingObjects = (parentObject as IEezObject[]).map(
        (object: IEezObject) => object
    );
    objects.forEach(object => {
        for (const propertyInfo of getClassInfo(object).properties) {
            if (propertyInfo.unique) {
                (object as any)[propertyInfo.name] = getUniquePropertyValue(
                    existingObjects,
                    propertyInfo.name,
                    getProperty(object, propertyInfo.name)
                );
            }
        }
        existingObjects.push(object);
    });
}

////////////////////////////////////////////////////////////////////////////////

export let addObject = action(
    (parentObject: IEezObject, object: IEezObject) => {
        object = loadObject(
            getDocumentStore(parentObject),
            parentObject,
            object,
            getClass(parentObject)
        );
        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).push(object);
            }),

            undo: action(() => {
                (parentObject as IEezObject[]).pop();
            }),

            get description() {
                return "Added: " + getHumanReadableObjectPath(object);
            }
        });

        return object;
    }
);

export let addObjects = action(
    (parentObject: IEezObject, objects: IEezObject[]) => {
        objects = objects.map(object =>
            loadObject(
                getDocumentStore(parentObject),
                parentObject,
                object,
                getClass(parentObject)
            )
        );
        ensureUniqueProperties(parentObject, objects);

        getDocumentStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).push(...objects);
            }),

            undo: action(() => {
                for (let i = 0; i < objects.length; i++) {
                    (parentObject as IEezObject[]).pop();
                }
            }),

            get description() {
                return (
                    "Added: " +
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return objects;
    }
);

export let insertObject = action(
    (parentObject: IEezObject, index: number, object: any) => {
        object = loadObject(
            getDocumentStore(parentObject),
            parentObject,
            object,
            getClass(parentObject)
        );
        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).splice(index, 0, object);
            }),

            undo: action(() => {
                (parentObject as IEezObject[]).splice(index, 1);
            }),

            get description() {
                return "Inserted: " + getHumanReadableObjectPath(object);
            }
        });

        return object;
    }
);

class UpdateCommand implements ICommand {
    private oldValues: any = {};
    private newValues: any = {};

    constructor(
        public object: IEezObject,
        private values: any,
        lastCommand?: UpdateCommand
    ) {
        if (lastCommand) {
            values = Object.assign(lastCommand.newValues, values);
            this.oldValues = lastCommand.oldValues;
        }

        for (let propertyName in values) {
            let propertyInfo = findPropertyByNameInObject(object, propertyName);

            if (propertyInfo) {
                if (!(propertyName in this.oldValues)) {
                    this.oldValues[propertyName] = getProperty(
                        object,
                        propertyName
                    );
                }
                this.newValues[propertyName] = values[propertyName];
            }
        }
    }

    @action
    execute() {
        Object.assign(this.object, this.newValues);
    }

    @action
    undo() {
        Object.assign(this.object, this.oldValues);
    }

    @computed
    get description() {
        return (
            `Changed (${_map(this.values, (value, name) => humanize(name)).join(
                ", "
            )}): ` + getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((object: IEezObject, values: any) => {
    const undoManager = getDocumentStore(object).undoManager;

    let closeCombineCommands = false;

    const updateObjectValueHook = getClassInfo(object).updateObjectValueHook;
    if (updateObjectValueHook) {
        if (!undoManager.combineCommands) {
            undoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        updateObjectValueHook(object, values);
    }

    let previousCommand;

    // TODO this should be moved to undoManager implementation
    // merge with previous command
    if (undoManager.combineCommands && undoManager.commands.length > 0) {
        let command = undoManager.commands[undoManager.commands.length - 1];
        if (command instanceof UpdateCommand && command.object == object) {
            undoManager.commands.pop();
            previousCommand = command;
        }
    }

    undoManager.executeCommand(
        new UpdateCommand(object, values, previousCommand)
    );

    if (closeCombineCommands) {
        undoManager.setCombineCommands(false);
    }
});

export let deleteObject = action((object: any) => {
    const parent = getParent(object);

    if (isArrayElement(object)) {
        const array = parent as IEezObject[];
        const index = array.indexOf(object);

        getDocumentStore(object).undoManager.executeCommand({
            execute: action(() => {
                array.splice(index, 1);
            }),

            undo: action(() => {
                array.splice(index, 0, object);
            }),

            get description() {
                return "Deleted: " + getHumanReadableObjectPath(object);
            }
        });
    } else {
        updateObject(parent, {
            [getKey(object)]: undefined
        });
    }
});

export let deleteObjects = action((objects: IEezObject[]) => {
    let undoIndexes: number[];

    getDocumentStore(objects[0]).undoManager.executeCommand({
        execute: action(() => {
            undoIndexes = [];
            for (let i = 0; i < objects.length; i++) {
                let object = objects[i];
                let parent = getParent(object);

                if (isArrayElement(object)) {
                    const array = parent as IEezObject[];
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                } else {
                    undoIndexes.push(-1);
                    (parent as any)[getKey(object)] = undefined;
                }
            }
        }),

        undo: action(() => {
            for (let i = objects.length - 1; i >= 0; i--) {
                let object = objects[i];
                let parent = getParent(object);
                if (isArrayElement(object)) {
                    const array = parent as IEezObject[];
                    let index = undoIndexes[i];
                    array.splice(index, 0, object);
                } else {
                    (parent as any)[getKey(object)] = object;
                }
            }
        }),

        get description() {
            return (
                "Deleted: " +
                objects
                    .map(object => getHumanReadableObjectPath(object))
                    .join(", ")
            );
        }
    });
});

export let replaceObject = action(
    (object: IEezObject, replaceWithObject: IEezObject) => {
        let parent = getParent(object);
        const undoManager = getDocumentStore(parent).undoManager;
        if (isArrayElement(object)) {
            const array = parent as IEezObject[];

            let index = array.indexOf(object);

            undoManager.executeCommand({
                execute: action(() => {
                    array[index] = replaceWithObject;
                }),

                undo: action(() => {
                    array[index] = object;
                }),

                get description() {
                    return "Replaced: " + getHumanReadableObjectPath(object);
                }
            });
        } else {
            updateObject(parent as any, {
                [getKey(object)]: replaceWithObject
            });
        }

        return replaceWithObject;
    }
);

export let replaceObjects = action(
    (objects: IEezObject[], replaceWithObject: IEezObject) => {
        if (objects.length === 1) {
            return replaceObject(objects[0], replaceWithObject);
        }

        const parent = getParent(objects[0]);
        const array = parent as IEezObject[];
        const index = array.indexOf(objects[0]);

        let undoIndexes: number[];

        getDocumentStore(parent).undoManager.executeCommand({
            execute: action(() => {
                array[index] = replaceWithObject;

                undoIndexes = [];
                for (let i = 1; i < objects.length; i++) {
                    let object = objects[i];
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                }
            }),

            undo: action(() => {
                for (let i = objects.length - 1; i >= 1; i--) {
                    let object = objects[i];
                    let index = undoIndexes[i - 1];
                    array.splice(index, 0, object);
                }

                array[index] = objects[0];
            }),

            get description() {
                return (
                    "Replaced: " +
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return replaceWithObject;
    }
);

////////////////////////////////////////////////////////////////////////////////

export function insertObjectBefore(object: IEezObject, objectToInsert: any) {
    const parent = getParent(object);
    const array = parent as IEezObject[];
    const index = array.indexOf(object);
    return insertObject(parent, index, objectToInsert);
}

export function insertObjectAfter(object: IEezObject, objectToInsert: any) {
    const parent = getParent(object);
    const array = parent as IEezObject[];
    const index = array.indexOf(object);
    return insertObject(parent, index + 1, objectToInsert);
}

////////////////////////////////////////////////////////////////////////////////

let CurrentDocumentStore: DocumentStoreClass | undefined;

function loadArrayObject(
    arrayObject: any,
    parent: any,
    propertyInfo: PropertyInfo
) {
    const eezArray: EezObject[] = observable([]);

    setId(
        CurrentDocumentStore!.objects,
        eezArray,
        CurrentDocumentStore!.getChildId()
    );
    setParent(eezArray, parent);
    setKey(eezArray, propertyInfo.name);
    setPropertyInfo(eezArray, propertyInfo);

    arrayObject.forEach((object: any) =>
        eezArray.push(
            loadObjectInternal(eezArray, object, propertyInfo.typeClass!)
        )
    );

    return eezArray;
}

export function loadObject(
    DocumentStore: DocumentStoreClass,
    parent: IEezObject | IEezObject[] | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): IEezObject {
    CurrentDocumentStore = DocumentStore;
    const result = loadObjectInternal(parent, jsObjectOrString, aClass, key);
    CurrentDocumentStore = undefined;
    return result;
}

function loadObjectInternal(
    parent: IEezObject | IEezObject[] | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): IEezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string"
            ? JSON.parse(jsObjectOrString)
            : jsObjectOrString;

    if (Array.isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClass: aClass
        });
    }

    let object: IEezObject;

    try {
        object = aClass.classInfo.getClass
            ? new (aClass.classInfo.getClass(jsObject, aClass))()
            : new aClass();
    } catch (err) {
        // TODO we need much better error recovery here
        console.error(err);
        return new EezObject();
    }

    const classInfo = getClassInfo(object);

    setId(
        CurrentDocumentStore!.objects,
        object,
        CurrentDocumentStore!.getChildId()
    );
    setParent(object, parent as IEezObject);

    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(object, jsObject);
    }

    for (const propertyInfo of classInfo.properties) {
        if (propertyInfo.computed === true) {
            continue;
        }

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: IEezObject | undefined;

            if (value) {
                childObject = loadObjectInternal(
                    object,
                    value,
                    propertyInfo.typeClass!
                );
            } else if (!propertyInfo.isOptional) {
                let typeClass = propertyInfo.typeClass!;
                childObject = loadObjectInternal(
                    object,
                    typeClass.classInfo.defaultValue,
                    typeClass
                );
            }

            if (childObject) {
                setKey(childObject, propertyInfo.name);
                (object as any)[propertyInfo.name] = childObject;
            }
        } else if (propertyInfo.type === PropertyType.Array) {
            if (!value && !propertyInfo.isOptional) {
                value = [];
            }

            if (value) {
                (object as any)[propertyInfo.name] = loadArrayObject(
                    value,
                    object,
                    propertyInfo
                );
            }
        } else {
            if (value !== undefined) {
                (object as any)[propertyInfo.name] = value;
            }
        }
    }

    return object;
}

////////////////////////////////////////////////////////////////////////////////

export function objectToJson(
    object: IEezObject | IEezObject[],
    space?: number,
    toJsHook?: (jsObject: any, object: IEezObject) => void
) {
    const saved = {
        _eez_parent: (object as any)._eez_parent,
        _eez_propertyInfo: (object as any)._eez_propertyInfo,
        _eez_id: (object as any)._eez_id,
        _eez_key: (object as any)._eez_key
    };
    delete (object as any)._eez_parent;
    delete (object as any)._eez_propertyInfo;
    delete (object as any)._eez_id;
    delete (object as any)._eez_key;

    let jsObject = toJS(object);

    Object.assign(object, saved);

    if (toJsHook) {
        toJsHook(jsObject, object);
    }

    return JSON.stringify(
        jsObject,
        (key: string | number, value: any) => {
            if (typeof key === "string" && key[0] === "_") {
                return undefined;
            }
            return value;
        },
        space
    );
}

export function objectToJS(object: IEezObject | IEezObject[]): any {
    return JSON.parse(objectToJson(object));
}

export function cloneObject(
    DocumentStore: DocumentStoreClass,
    obj: IEezObject
) {
    return loadObject(
        DocumentStore,
        undefined,
        objectToJson(obj),
        getClass(obj)
    );
}

export function isDashboardProject(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.isDashboardProject;
}

export function isNotDashboardProject(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return !documentStore.project.isDashboardProject;
}

export function isAppletOrFirmwareWithFlowSupportProject(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return (
        documentStore.project.isAppletProject ||
        documentStore.project.isFirmwareWithFlowSupportProject
    );
}

export function isDashboardOrApplet(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return (
        documentStore.project.isDashboardProject ||
        documentStore.project.isAppletProject
    );
}

export function isDashboardOrAppletOrFirmwareWithFlowSupportProject(
    object: IEezObject
) {
    const documentStore = getDocumentStore(object);
    return (
        documentStore.project.isDashboardProject ||
        documentStore.project.isAppletProject ||
        documentStore.project.isFirmwareWithFlowSupportProject
    );
}

export function isV1Project(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.settings.general.projectVersion === "v1";
}

export function isNotV1Project(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return documentStore.project.settings.general.projectVersion !== "v1";
}

export function isV3OrNewerProject(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return (
        documentStore.project.settings.general.projectVersion !== "v1" &&
        documentStore.project.settings.general.projectVersion !== "v2"
    );
}

export function isNotFirmwareWithFlowSupportProject(object: IEezObject) {
    const documentStore = getDocumentStore(object);
    return !documentStore.project.isFirmwareWithFlowSupportProject;
}

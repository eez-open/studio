import {
    autorun,
    computed,
    IReactionDisposer,
    makeObservable,
    runInAction
} from "mobx";
import { observable, action } from "mobx";
import * as FlexLayout from "flexlayout-react";

import {
    IEezObject,
    getParent,
    getRootObject
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { LayoutModels, type ProjectStore } from "project-editor/store";
import {
    isValue,
    getObjectPathAsString,
    findPropertyByChildObject
} from "project-editor/store/helper";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import type { SortDirectionType } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

export interface IPanel {
    selectedObject: IEezObject | undefined;
    selectedObjects?: IEezObject[];

    selectAll?(): void;

    canCut?(): boolean;
    cutSelection?(): void;

    canCopy?(): boolean;
    copySelection?(): void;

    canPaste?(): boolean;
    pasteSelection?(): void;

    canDelete?(): boolean;
    deleteSelection?(): void;

    doNotUsePropertyGrid?(): boolean;
}

export class NavigationStore {
    selectedPanelForEdit: IPanel | undefined;
    selectedPanelForRuntime: IPanel | undefined;

    get selectedPanel() {
        return this.projectStore.runtime
            ? this.selectedPanelForRuntime
            : this.selectedPanelForEdit;
    }

    set selectedPanel(panel: IPanel | undefined) {
        if (this.projectStore.runtime) {
            this.selectedPanelForRuntime = panel;
        } else {
            this.selectedPanelForEdit = panel;
        }
    }

    selectedUserPageObject = observable.box<IEezObject>();
    selectedUserWidgetObject = observable.box<IEezObject>();
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
    selectedInstrumentCommandsObject = observable.box<IEezObject>();
    selectedTextResourceObject = observable.box<IEezObject>();
    selectedLanguageObject = observable.box<IEezObject>();
    selectedLvglGroupObject = observable.box<IEezObject>();

    static VARIABLES_SUB_NAVIGATION_ID =
        "variables-tab/sub-navigation/selected-item";
    static VARIABLES_SUB_NAVIGATION_ITEM_GLOBAL = "Global";
    static VARIABLES_SUB_NAVIGATION_ITEM_LOCAL = "Local";
    static VARIABLES_SUB_NAVIGATION_ITEM_STRUCTS = "Structs";
    static VARIABLES_SUB_NAVIGATION_ITEM_ENUMS = "Enums";

    static FLOW_STRUCTURE_SUB_NAVIGATION_ID =
        "flow-structure-tab/sub-navigation/selected-item";
    static FLOW_STRUCTURE_SUB_NAVIGATION_ITEM_WIDGETS = "Widgets";
    static FLOW_STRUCTURE_SUB_NAVIGATION_ITEM_ACTIONS = "Actions";

    static COMPONENTS_PALETTE_SUB_NAVIGATION_ID =
        "variables-tab/sub-navigation/selected-item";
    static COMPONENTS_PALETTE_SUB_NAVIGATION_ITEM_WIDGETS = "Widgets";
    static COMPONENTS_PALETTE_SUB_NAVIGATION_ITEM_ACTIONS = "Actions";

    subnavigationSelectedItems: {
        [id: string]: string;
    } = {};

    editable = true;

    selectedLocalVariable = observable.box<IEezObject>();

    // Project Explorer state (used when "Project Explorer" project editor
    // layout is selected). The selected group is identified by the id of the
    // tab which shows the same items in the "Classic" layout.
    projectExplorerSelectedGroup: string = LayoutModels.PAGES_TAB_ID;
    // the group last selected from each of the toolbar menus (menu id -> group key)
    projectExplorerMenuSelectedGroups: { [menuId: string]: string } = {};
    projectExplorerSearchText: string = "";
    projectExplorerSortDirection: SortDirectionType = "none";

    // pinned Properties dialog was opened when the project was closed
    propertiesDialogRestorePending: boolean = false;

    dispose1: IReactionDisposer;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            selectedPanelForEdit: observable,
            selectedPanelForRuntime: observable,
            subnavigationSelectedItems: observable,
            projectExplorerSelectedGroup: observable,
            projectExplorerMenuSelectedGroups: observable,
            projectExplorerSearchText: observable,
            projectExplorerSortDirection: observable,
            propertyGridObjects: computed,
            setSelectedPanel: action,
            showObjects: action
        });

        this.dispose1 = autorun(() => {
            const objects = this.propertyGridObjects ?? [];

            const objectsLength = objects.length;

            const layoutModel = this.projectStore.layoutModels?.rootEditor;
            if (!layoutModel) {
                return;
            }

            const node = layoutModel.getNodeById(
                LayoutModels.PROPERTIES_TAB_ID
            );
            if (!node) {
                return;
            }

            const parent = node.getParent() as FlexLayout.BorderNode;
            if (!(parent instanceof FlexLayout.BorderNode)) {
                return;
            }

            const isSelected = parent.getSelectedNode() == node;

            if (
                (isSelected && objectsLength == 0) ||
                (!isSelected && objectsLength > 0)
            ) {
                layoutModel.doAction(
                    FlexLayout.Actions.selectTab(node.getId())
                );
            }
        });
    }

    loadState(state: any) {
        if (state) {
            if (state.selectedUserPageObject) {
                this.selectedUserPageObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedUserPageObject
                    )
                );
            }

            if (state.selectedUserWidgetObject) {
                this.selectedUserWidgetObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedUserWidgetObject
                    )
                );
            }

            if (state.selectedActionObject) {
                this.selectedActionObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedActionObject
                    )
                );
            }

            if (state.selectedGlobalVariableObject) {
                this.selectedGlobalVariableObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedGlobalVariableObject
                    )
                );
            }

            if (state.selectedStructureObject) {
                this.selectedStructureObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedStructureObject
                    )
                );
            }

            if (state.selectedEnumObject) {
                this.selectedEnumObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedEnumObject
                    )
                );
            }

            if (state.selectedStyleObject) {
                this.selectedStyleObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedStyleObject
                    )
                );
            }

            if (state.selectedThemeObject) {
                this.selectedThemeObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedThemeObject
                    )
                );
            }

            if (state.selectedThemeColorObject) {
                this.selectedThemeColorObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedThemeColorObject
                    )
                );
            }

            if (state.selectedFontObject) {
                this.selectedFontObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedFontObject
                    )
                );
            }

            if (state.selectedGlyphObject) {
                this.selectedGlyphObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedGlyphObject
                    )
                );
            }

            if (state.selectedBitmapObject) {
                this.selectedBitmapObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedBitmapObject
                    )
                );
            }

            if (state.selectedExtensionDefinitionObject) {
                this.selectedExtensionDefinitionObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedExtensionDefinitionObject
                    )
                );
            }

            if (state.selectedScpiSubsystemObject) {
                this.selectedScpiSubsystemObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedScpiSubsystemObject
                    )
                );
            }

            if (state.selectedScpiCommandObject) {
                this.selectedScpiCommandObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedScpiCommandObject
                    )
                );
            }

            if (state.selectedScpiEnumObject) {
                this.selectedScpiEnumObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedScpiEnumObject
                    )
                );
            }

            if (state.selectedInstrumentCommandsObject) {
                this.selectedInstrumentCommandsObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedInstrumentCommandsObject
                    )
                );
            }

            if (state.selectedTextResourceObject) {
                this.selectedTextResourceObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedTextResourceObject
                    )
                );
            }

            if (state.selectedLanguageObject) {
                this.selectedLanguageObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedLanguageObject
                    )
                );
            }

            if (state.selectedLvglGroupObject) {
                this.selectedLvglGroupObject.set(
                    this.projectStore.getObjectFromStringPath(
                        state.selectedLvglGroupObject
                    )
                );
            }

            if (state.subnavigationSelectedItems) {
                this.subnavigationSelectedItems =
                    state.subnavigationSelectedItems;
            }

            if (typeof state.projectExplorerSelectedGroup == "string") {
                this.projectExplorerSelectedGroup =
                    state.projectExplorerSelectedGroup;
            }

            if (
                state.projectExplorerMenuSelectedGroups &&
                typeof state.projectExplorerMenuSelectedGroups == "object"
            ) {
                this.projectExplorerMenuSelectedGroups =
                    state.projectExplorerMenuSelectedGroups;
            }

            if (
                state.projectExplorerSortDirection == "asc" ||
                state.projectExplorerSortDirection == "desc" ||
                state.projectExplorerSortDirection == "none"
            ) {
                this.projectExplorerSortDirection =
                    state.projectExplorerSortDirection;
            }

            this.propertiesDialogRestorePending =
                state.propertiesDialogOpened === true;
        }
    }

    saveState() {
        // an object of another project (the master project items listed in
        // a module project) can't be found by its path in this project
        const path = (object: IEezObject | undefined) =>
            object && getRootObject(object) === this.projectStore.project
                ? getObjectPathAsString(object)
                : undefined;

        return {
            selectedUserPageObject: this.selectedUserPageObject.get()
                ? path(this.selectedUserPageObject.get())
                : undefined,
            selectedUserWidgetObject: this.selectedUserWidgetObject.get()
                ? path(this.selectedUserWidgetObject.get())
                : undefined,
            selectedActionObject: this.selectedActionObject.get()
                ? path(this.selectedActionObject.get())
                : undefined,
            selectedGlobalVariableObject:
                this.selectedGlobalVariableObject.get()
                    ? path(
                          this.selectedGlobalVariableObject.get()
                      )
                    : undefined,
            selectedStructureObject: this.selectedStructureObject.get()
                ? path(this.selectedStructureObject.get())
                : undefined,
            selectedEnumObject: this.selectedEnumObject.get()
                ? path(this.selectedEnumObject.get())
                : undefined,
            selectedStyleObject: this.selectedStyleObject.get()
                ? path(this.selectedStyleObject.get())
                : undefined,
            selectedThemeObject: this.selectedThemeObject.get()
                ? path(this.selectedThemeObject.get())
                : undefined,
            selectedThemeColorObject: this.selectedThemeColorObject.get()
                ? path(this.selectedThemeColorObject.get())
                : undefined,
            selectedFontObject: this.selectedFontObject.get()
                ? path(this.selectedFontObject.get())
                : undefined,
            selectedGlyphObject: this.selectedGlyphObject.get()
                ? path(this.selectedGlyphObject.get())
                : undefined,
            selectedBitmapObject: this.selectedBitmapObject.get()
                ? path(this.selectedBitmapObject.get())
                : undefined,
            selectedExtensionDefinitionObject:
                this.selectedExtensionDefinitionObject.get()
                    ? path(
                          this.selectedExtensionDefinitionObject.get()
                      )
                    : undefined,
            selectedScpiSubsystemObject: this.selectedScpiSubsystemObject.get()
                ? path(this.selectedScpiSubsystemObject.get())
                : undefined,
            selectedScpiCommandObject: this.selectedScpiCommandObject.get()
                ? path(this.selectedScpiCommandObject.get())
                : undefined,
            selectedScpiEnumObject: this.selectedScpiEnumObject.get()
                ? path(this.selectedScpiEnumObject.get())
                : undefined,
            selectedInstrumentCommandsObject:
                this.selectedInstrumentCommandsObject.get()
                    ? path(
                          this.selectedInstrumentCommandsObject.get()
                      )
                    : undefined,
            selectedTextResourceObject: this.selectedTextResourceObject.get()
                ? path(this.selectedTextResourceObject.get())
                : undefined,
            selectedLanguageObject: this.selectedLanguageObject.get()
                ? path(this.selectedLanguageObject.get())
                : undefined,
            selectedLvglGroupObject: this.selectedLvglGroupObject.get()
                ? path(this.selectedLvglGroupObject.get())
                : undefined,

            subnavigationSelectedItems: this.subnavigationSelectedItems,

            projectExplorerSelectedGroup: this.projectExplorerSelectedGroup,
            projectExplorerMenuSelectedGroups:
                this.projectExplorerMenuSelectedGroups,
            projectExplorerSortDirection: this.projectExplorerSortDirection,

            propertiesDialogOpened:
                (ProjectEditor.isPinnedPropertiesDialogOpened?.(
                    this.projectStore
                ) ??
                    false) ||
                this.propertiesDialogRestorePending
        };
    }

    initialPanelSet = false;

    mountPanel(panel: IPanel) {
        if (!this.initialPanelSet) {
            if (this.selectedPanel) {
                let selectedObject = panel.selectedObject;
                if (
                    !selectedObject &&
                    panel.selectedObjects &&
                    panel.selectedObjects.length > 0
                ) {
                    selectedObject = panel.selectedObjects[0];
                }

                if (
                    selectedObject &&
                    ProjectEditor.getFlow(selectedObject)
                ) {
                    this.setSelectedPanel(panel);
                }
            } else {
                this.setSelectedPanel(panel);
            }

            setTimeout(() => {
                this.initialPanelSet = true;
            }, 100);
        }
    }

    unmountPanel(panel: IPanel) {
        // if (this.selectedPanel === panel) {
        //     this.setSelectedPanel(undefined);
        // }
    }

    setSelectedPanel(selectedPanel: IPanel | undefined) {
        this.selectedPanel = selectedPanel;
    }

    showObjects(
        objects: IEezObject[],
        openEditor: boolean,
        showInNavigation: boolean,
        selectObject: boolean,
        openEditorParams?: any
    ) {
        objects = objects.map(object =>
            isValue(object) ? getParent(object) : object
        );

        if (openEditor) {
            const result = ProjectEditor.getAncestorWithEditorComponent(
                objects[0], openEditorParams
            );
            if (result) {
                const editor = this.projectStore.editorsStore.openEditor(
                    result.object,
                    result.subObject,
                    result.params
                );
                const editorState = editor.state;
                if (editorState && editorState.selectObjectsAndEnsureVisible) {
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

    lastPropertyGridObjects: IEezObject[] = [];

    get propertyGridObjects() {
        let objects: IEezObject[];

        const navigationStore = this;

        if (
            navigationStore.selectedPanel &&
            navigationStore.selectedPanel.doNotUsePropertyGrid &&
            navigationStore.selectedPanel.doNotUsePropertyGrid()
        ) {
            return this.lastPropertyGridObjects;
        }

        if (
            navigationStore.selectedPanel &&
            navigationStore.selectedPanel.selectedObjects !== undefined &&
            navigationStore.selectedPanel.selectedObjects.length > 0
        ) {
            objects = navigationStore.selectedPanel.selectedObjects;
        } else if (
            navigationStore.selectedPanel &&
            navigationStore.selectedPanel.selectedObject !== undefined
        ) {
            objects = [navigationStore.selectedPanel.selectedObject];
        } else if (
            this.projectStore.editorsStore &&
            this.projectStore.editorsStore.activeEditor &&
            this.projectStore.editorsStore.activeEditor.object instanceof
                ProjectEditor.FlowClass
        ) {
            const editor = this.projectStore.editorsStore.activeEditor;
            const pageTabState = editor.state as PageTabState;
            if (
                pageTabState &&
                pageTabState.selectedObjects != undefined &&
                pageTabState.selectedObjects.length > 0
            ) {
                objects = pageTabState.selectedObjects;
            } else {
                objects = [];
            }
        } else {
            objects = [];
        }

        if (objects.length === 1) {
            if (isValue(objects[0])) {
                const object = objects[0];
                const childObject = getParent(object);
                const parent = getParent(childObject);
                if (parent) {
                    const propertyInfo = findPropertyByChildObject(
                        parent,
                        childObject
                    );
                    if (propertyInfo && !propertyInfo.hideInPropertyGrid) {
                        objects = [parent];
                    }
                }
            }
        }

        this.lastPropertyGridObjects = objects;

        return objects;
    }

    unmount() {
        runInAction(() => {
            this.selectedPanel = undefined;
        });
        this.dispose1();
    }
}

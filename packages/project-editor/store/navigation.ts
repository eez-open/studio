import {
    autorun,
    computed,
    IReactionDisposer,
    makeObservable,
    runInAction
} from "mobx";
import { observable, action } from "mobx";
import * as FlexLayout from "flexlayout-react";

import { IEezObject, getParent } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { LayoutModels, type ProjectStore } from "project-editor/store";
import {
    isValue,
    getObjectPathAsString,
    findPropertyByChildObject,
    getAncestorOfType
} from "project-editor/store/helper";
import type { PageTabState } from "project-editor/features/page/PageEditor";

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

    dispose1: IReactionDisposer;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            selectedPanelForEdit: observable,
            selectedPanelForRuntime: observable,
            subnavigationSelectedItems: observable,
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
        }
    }

    saveState() {
        return {
            selectedUserPageObject: this.selectedUserPageObject.get()
                ? getObjectPathAsString(this.selectedUserPageObject.get())
                : undefined,
            selectedUserWidgetObject: this.selectedUserWidgetObject.get()
                ? getObjectPathAsString(this.selectedUserWidgetObject.get())
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
                : undefined,
            selectedInstrumentCommandsObject:
                this.selectedInstrumentCommandsObject.get()
                    ? getObjectPathAsString(
                          this.selectedInstrumentCommandsObject.get()
                      )
                    : undefined,
            selectedTextResourceObject: this.selectedTextResourceObject.get()
                ? getObjectPathAsString(this.selectedTextResourceObject.get())
                : undefined,
            selectedLanguageObject: this.selectedLanguageObject.get()
                ? getObjectPathAsString(this.selectedLanguageObject.get())
                : undefined,
            selectedLvglGroupObject: this.selectedLvglGroupObject.get()
                ? getObjectPathAsString(this.selectedLvglGroupObject.get())
                : undefined,

            subnavigationSelectedItems: this.subnavigationSelectedItems
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
                    getAncestorOfType(
                        selectedObject,
                        ProjectEditor.FlowClass.classInfo
                    )
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
                const editor = this.projectStore.editorsStore.openEditor(
                    result.object,
                    result.subObject
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

    get propertyGridObjects() {
        let objects: IEezObject[];

        const navigationStore = this;

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

        return objects;
    }

    unmount() {
        runInAction(() => {
            this.selectedPanel = undefined;
        });
        this.dispose1();
    }
}

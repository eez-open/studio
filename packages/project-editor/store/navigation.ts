import { makeObservable } from "mobx";
import { observable, action } from "mobx";

import { IEezObject, getParent } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { ProjectEditorStore } from "project-editor/store";
import {
    isValue,
    getObjectPathAsString,
    findPropertyByChildObject
} from "project-editor/store/helper";

////////////////////////////////////////////////////////////////////////////////

export interface IPanel {
    selectedObject: IEezObject | undefined;
    selectedObjects?: IEezObject[];
    cutSelection(): void;
    copySelection(): void;
    pasteSelection(): void;
    deleteSelection(): void;
}

export class NavigationStore {
    selectedPanel: IPanel | undefined;

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
    selectedTextResourceObject = observable.box<IEezObject>();
    selectedLanguageObject = observable.box<IEezObject>();

    editable = true;

    constructor(public projectEditorStore: ProjectEditorStore) {
        makeObservable(this, {
            selectedPanel: observable,
            setSelectedPanel: action,
            showObjects: action
        });
    }

    loadState(state: any) {
        let selectedRootObject: IEezObject | undefined;

        if (state && state.selectedRootObject) {
            selectedRootObject =
                this.projectEditorStore.getObjectFromStringPath(
                    state.selectedRootObject
                );
        }

        if (!selectedRootObject) {
            selectedRootObject =
                this.projectEditorStore.project.readme ||
                this.projectEditorStore.project.pages ||
                this.projectEditorStore.project.settings;

            let editorObject: IEezObject | undefined;
            if (this.projectEditorStore.project.readme) {
                selectedRootObject = this.projectEditorStore.project.readme;
                editorObject = selectedRootObject;
            } else if (this.projectEditorStore.project.changes) {
                selectedRootObject = this.projectEditorStore.project.changes;
                editorObject = selectedRootObject;
            } else if (this.projectEditorStore.project.pages) {
                selectedRootObject = this.projectEditorStore.project.pages;
                if (this.projectEditorStore.project.pages.length > 0) {
                    editorObject = this.projectEditorStore.project.pages[0];
                }
            } else {
                selectedRootObject = this.projectEditorStore.project.settings;
                editorObject = selectedRootObject;
            }

            if (editorObject) {
                setTimeout(() => {
                    this.showObjects([editorObject!], true, true, true);
                }, 50);
            }
        }
        this.selectedRootObject.set(selectedRootObject);

        if (state) {
            if (state.selectedPageObject) {
                this.selectedPageObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedPageObject
                    )
                );
            }

            if (state.selectedActionObject) {
                this.selectedActionObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedActionObject
                    )
                );
            }

            if (state.selectedGlobalVariableObject) {
                this.selectedGlobalVariableObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedGlobalVariableObject
                    )
                );
            }

            if (state.selectedStructureObject) {
                this.selectedStructureObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedStructureObject
                    )
                );
            }

            if (state.selectedEnumObject) {
                this.selectedEnumObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedEnumObject
                    )
                );
            }

            if (state.selectedStyleObject) {
                this.selectedStyleObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedStyleObject
                    )
                );
            }

            if (state.selectedThemeObject) {
                this.selectedThemeObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedThemeObject
                    )
                );
            }

            if (state.selectedThemeColorObject) {
                this.selectedThemeColorObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedThemeColorObject
                    )
                );
            }

            if (state.selectedFontObject) {
                this.selectedFontObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedFontObject
                    )
                );
            }

            if (state.selectedGlyphObject) {
                this.selectedGlyphObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedGlyphObject
                    )
                );
            }

            if (state.selectedBitmapObject) {
                this.selectedBitmapObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedBitmapObject
                    )
                );
            }

            if (state.selectedExtensionDefinitionObject) {
                this.selectedExtensionDefinitionObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedExtensionDefinitionObject
                    )
                );
            }

            if (state.selectedScpiSubsystemObject) {
                this.selectedScpiSubsystemObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedScpiSubsystemObject
                    )
                );
            }

            if (state.selectedScpiCommandObject) {
                this.selectedScpiCommandObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedScpiCommandObject
                    )
                );
            }

            if (state.selectedScpiEnumObject) {
                this.selectedScpiEnumObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedScpiEnumObject
                    )
                );
            }

            if (state.selectedTextResourceObject) {
                this.selectedTextResourceObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedTextResourceObject
                    )
                );
            }

            if (state.selectedLanguageObject) {
                this.selectedLanguageObject.set(
                    this.projectEditorStore.getObjectFromStringPath(
                        state.selectedLanguageObject
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
                : undefined,
            selectedTextResourceObject: this.selectedTextResourceObject.get()
                ? getObjectPathAsString(this.selectedTextResourceObject.get())
                : undefined,
            selectedLanguageObject: this.selectedLanguageObject.get()
                ? getObjectPathAsString(this.selectedLanguageObject.get())
                : undefined
        };
    }

    setInitialSelectedPanel(selectedPanel: IPanel) {
        this.setSelectedPanel(selectedPanel);
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
                const editor = this.projectEditorStore.editorsStore.openEditor(
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
}

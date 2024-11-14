import React from "react";
import { observer } from "mobx-react";
import {
    action,
    computed,
    IObservableValue,
    makeObservable,
    observable,
    reaction,
    runInAction
} from "mobx";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";
import { Icon } from "eez-studio-ui/icon";

import {
    EezObject,
    getParent,
    getProperty,
    IEezObject,
    isPropertyDisabled,
    PropertyType,
    setParent
} from "project-editor/core/object";
import {
    cloneObjectWithNewObjIds,
    cloneObjectWithoutNewObjIds,
    getProjectEditorDataFromClipboard
} from "project-editor/store/clipboard";
import {
    addObject,
    createObject,
    getAncestorOfType,
    getChildOfObject,
    getClass,
    getClassInfo,
    getJSON,
    getLabel,
    getObjectFromPath,
    getObjectFromStringPath,
    loadProject,
    ProjectStore,
    replaceObject,
    rewireBegin,
    rewireEnd,
    updateObject
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    replaceObjectReference,
    searchForObjectDependencies
} from "project-editor/core/search";
import type { Flow } from "project-editor/flow/flow";
import {
    getArrayElementTypeFromType,
    getEnumFromType,
    getStructureFromType
} from "project-editor/features/variable/value-type";
import { USER_WIDGET_ICON } from "project-editor/ui-components/icons";
import {
    FLOW_FRAGMENT_PAGE_NAME,
    type Page
} from "project-editor/features/page/page";
import { Project } from "project-editor/project/project";
import { isArray } from "lodash";
import type { ConnectionLine } from "project-editor/flow/connection-line";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";
import { VALIDATION_MESSAGE_REQUIRED } from "eez-studio-shared/validation";
import { validators as validatorsRenderer } from "eez-studio-shared/validation-renderer";
import type { Style } from "project-editor/features/style/style";
import { LVGLStyle } from "project-editor/lvgl/style";
import {
    type Theme,
    type Color,
    getProjectWithThemes
} from "project-editor/features/style/theme";

////////////////////////////////////////////////////////////////////////////////

const NOT_COMPATIBLE_WITH_PROJECT_TYPE =
    "Not compatible with this project type, will be skipped.";

////////////////////////////////////////////////////////////////////////////////

type ObjectWithName = { name: string } & EezObject;

type CommonStyle = {
    name: string;
    childStyles: CommonStyle[];
} & EezObject;

////////////////////////////////////////////////////////////////////////////////

type Conflict =
    | { kind: "doesnt-exists" }
    | { kind: "exists-same" }
    | { kind: "exists-different"; destinationObject: EezObject }
    | { kind: "not-compatible"; message: string };

type ConflictResolution =
    | "rename-source"
    | "rename-destination"
    | "replace"
    | "keep";

////////////////////////////////////////////////////////////////////////////////

function compareThemes(
    sourceProjectStore: ProjectStore,
    destinationProjectStore: ProjectStore
) {
    for (const sourceTheme of sourceProjectStore.project.themes) {
        let destinationTheme = destinationProjectStore.project.themes.find(
            destinationTheme => destinationTheme.name == sourceTheme.name
        );
        if (!destinationTheme) {
            return false;
        }
    }
    return true;
}

function getSelectedTheme(projectStore: ProjectStore) {
    const project = getProjectWithThemes(projectStore);

    let selectedTheme =
        projectStore.navigationStore?.selectedThemeObject.get() as Theme;

    if (!selectedTheme) {
        selectedTheme = project.themes[0];
    }

    return selectedTheme!;
}

////////////////////////////////////////////////////////////////////////////////

class PasteObject {
    constructor(
        public model: PasteWithDependenciesModel,
        public sourceObject: EezObject,
        object: EezObject
    ) {
        this.object = object;

        if (object instanceof ProjectEditor.VariableClass) {
            this.isLocalVariable =
                getAncestorOfType(object, ProjectEditor.FlowClass.classInfo) !=
                undefined;
        }

        makeObservable(this, {
            destinationStyle: computed,
            destinationCollection: computed,
            conflictResolution: observable,
            conflictResolutionName: observable,
            conflictResolutionError: computed
        });
    }

    object: EezObject;
    parentStylePasteObject: PasteObject;
    isLocalVariable: boolean = false;
    styleLevel: number = 0;

    get destinationStyle(): CommonStyle | undefined {
        let collection;
        if (this.object instanceof LVGLStyle) {
            collection =
                this.model.destinationProjectStore.project.lvglStyles.styles;
        } else {
            collection = this.model.destinationProjectStore.project.styles;
        }

        if (this.styleLevel == 0) {
            return collection.find(
                destinationObject =>
                    destinationObject.name == (this.object as any).name
            );
        } else {
            const parentDestinationStyle =
                this.parentStylePasteObject.destinationStyle;
            if (!parentDestinationStyle) {
                return undefined;
            }
            return parentDestinationStyle.childStyles.find(
                destinationObject =>
                    destinationObject.name == (this.object as any).name
            );
        }
    }

    get destinationCollection(): ObjectWithName[] | undefined {
        if (this.object instanceof ProjectEditor.FlowFragmentClass) {
            return undefined;
        }

        if (
            this.object instanceof ProjectEditor.StyleClass ||
            this.object instanceof ProjectEditor.LVGLStyleClass
        ) {
            return this.destinationStyle
                ? (getParent(this.destinationStyle) as
                      | ObjectWithName[]
                      | undefined)
                : undefined;
        }

        let collection:
            | ({
                  name: string;
              } & EezObject)[]
            | undefined;

        if (this.object instanceof ProjectEditor.VariableClass) {
            if (this.isLocalVariable) {
                const destinationFlow = this.model.destinationFlow;
                if (destinationFlow) {
                    collection = destinationFlow.localVariables;
                }
            } else {
                collection =
                    this.model.destinationProjectStore.project.variables
                        .globalVariables;
            }
        } else if (this.object instanceof ProjectEditor.StructureClass) {
            collection =
                this.model.destinationProjectStore.project.variables.structures;
        } else if (this.object instanceof ProjectEditor.EnumClass) {
            collection =
                this.model.destinationProjectStore.project.variables.enums;
        } else if (this.object instanceof ProjectEditor.ActionClass) {
            collection = this.model.destinationProjectStore.project.actions;
        } else if (this.object instanceof ProjectEditor.PageClass) {
            const page = this.object;
            if (page.isUsedAsUserWidget) {
                collection =
                    this.model.destinationProjectStore.project.userWidgets;
            } else {
                collection =
                    this.model.destinationProjectStore.project.userPages;
            }
        } else if (this.object instanceof ProjectEditor.BitmapClass) {
            collection = this.model.destinationProjectStore.project.bitmaps;
        } else if (this.object instanceof ProjectEditor.FontClass) {
            collection = this.model.destinationProjectStore.project.fonts;
        } else if (this.object instanceof ProjectEditor.ColorClass) {
            collection = this.model.destinationProjectStore.project.colors;
        }

        return collection;
    }

    conflict: Conflict = { kind: "doesnt-exists" };

    conflictResolution: ConflictResolution = "rename-source";

    conflictResolutionName: string;

    get conflictResolutionError() {
        if (this.conflictResolutionName == undefined) {
            return "";
        }

        if (this.conflictResolutionName.trim() == "") {
            return VALIDATION_MESSAGE_REQUIRED;
        }

        if (this.object instanceof ProjectEditor.VariableClass) {
            const errorMessage = validatorsRenderer.identifierValidator(
                this,
                "conflictResolutionName"
            );
            if (errorMessage) {
                return errorMessage;
            }
        }

        if (this.conflict.kind != "exists-different") {
            return "";
        }

        if (
            this.conflictResolution != "rename-source" &&
            this.conflictResolution != "rename-destination"
        ) {
            return "";
        }

        if (!this.destinationCollection) {
            return "";
        }

        if (
            !this.destinationCollection.find(
                destinationObject =>
                    destinationObject.name == this.conflictResolutionName
            )
        ) {
            if (
                !this.model.pasteObjects.find(pasteObject => {
                    if (
                        pasteObject == this ||
                        pasteObject.destinationCollection !=
                            this.destinationCollection
                    ) {
                        return false;
                    }

                    if (
                        pasteObject.conflict.kind != "exists-different" &&
                        (pasteObject.object as any).name ==
                            this.conflictResolutionName
                    ) {
                        return true;
                    }

                    return (
                        pasteObject.conflictResolutionName ==
                        this.conflictResolutionName
                    );
                })
            ) {
                return "";
            }
        }

        return "This name already exists.";
    }
}

////////////////////////////////////////////////////////////////////////////////

class PasteWithDependenciesModel {
    interProjectStore: ProjectStore;
    interProjectStoreFlowFragmentFlow: Page | undefined;

    foundObjects = new Map<EezObject, PasteObject>();
    pasteObjects: PasteObject[] = [];

    remaining: number = 0;
    allDependenciesFound: boolean;

    constructor(
        public sourceProjectStore: ProjectStore,
        private sourceObjects: EezObject[],
        private sourceObjectsParentPath: string[],
        public destinationProjectStore: ProjectStore,
        private _destinationFlow: Flow | undefined
    ) {
        this.createInterProjectStore();

        makeObservable(this, {
            pasteObjects: observable,
            allDependenciesFound: observable,
            posteObjectsWithConflicts: computed
        });
    }

    createInterProjectStore() {
        const { projectStore, projectStoreFlowFragmentFlow } =
            createEmptyProjectStore(this.sourceProjectStore);

        this.interProjectStore = projectStore;

        this.interProjectStoreFlowFragmentFlow = projectStoreFlowFragmentFlow;
    }

    static addObjectToProject(
        projectStore: ProjectStore,
        flow: Flow | undefined,
        object: EezObject,
        isLocalVariable: boolean
    ) {
        if (object instanceof ProjectEditor.FlowFragmentClass) {
            ProjectEditor.FlowFragmentClass.paste(
                projectStore,
                flow!,
                object,
                flow!
            );
        } else if (object instanceof ProjectEditor.VariableClass) {
            if (isLocalVariable) {
                addObject(flow!.localVariables, object);
            } else {
                addObject(
                    projectStore.project.variables.globalVariables,
                    object
                );
            }
        } else if (object instanceof ProjectEditor.StructureClass) {
            addObject(projectStore.project.variables.structures, object);
        } else if (object instanceof ProjectEditor.EnumClass) {
            addObject(projectStore.project.variables.enums, object);
        } else if (object instanceof ProjectEditor.ActionClass) {
            addObject(projectStore.project.actions, object);
        } else if (object instanceof ProjectEditor.PageClass) {
            if (object.isUsedAsUserWidget) {
                addObject(projectStore.project.userWidgets, object);
            } else {
                addObject(projectStore.project.userPages, object);
            }
        } else if (object instanceof ProjectEditor.StyleClass) {
            addObject(projectStore.project.styles, object);
        } else if (object instanceof ProjectEditor.LVGLStyleClass) {
            addObject(projectStore.project.lvglStyles.styles, object);
        } else if (object instanceof ProjectEditor.BitmapClass) {
            addObject(projectStore.project.bitmaps, object);
        } else if (object instanceof ProjectEditor.FontClass) {
            addObject(projectStore.project.fonts, object);
        } else if (object instanceof ProjectEditor.ColorClass) {
            addObject(projectStore.project.colors, object);
        }
    }

    findAllDependencies() {
        for (let i = 0; i < this.sourceObjects.length; i++) {
            this.addObject(
                this.sourceObjects[i],
                this.sourceObjectsParentPath[i]
            );
        }
    }

    addObject(object: EezObject, objectParentPath?: string) {
        let pasteObject = this.foundObjects.get(object);
        if (pasteObject) {
            return pasteObject;
        }

        const clonedObject = cloneObjectWithoutNewObjIds(
            this.interProjectStore,
            object
        );
        setParent(clonedObject, getParent(object));

        let parentStyleObject: CommonStyle | undefined;
        if (
            object instanceof ProjectEditor.StyleClass ||
            object instanceof ProjectEditor.LVGLStyleClass
        ) {
            const collection = getParent(object);
            if (collection) {
                const parentObject = getParent(collection);
                if (
                    parentObject &&
                    (parentObject instanceof ProjectEditor.StyleClass ||
                        parentObject instanceof ProjectEditor.LVGLStyleClass)
                ) {
                    parentStyleObject = parentObject;
                }
            }
        }

        if (!parentStyleObject) {
            PasteWithDependenciesModel.addObjectToProject(
                this.interProjectStore,
                this.interProjectStoreFlowFragmentFlow,
                clonedObject,
                false
            );
        }

        if (
            !objectParentPath &&
            (clonedObject instanceof ProjectEditor.StyleClass ||
                clonedObject instanceof ProjectEditor.LVGLStyleClass)
        ) {
            clonedObject.childStyles.splice(0, clonedObject.childStyles.length);
        }

        pasteObject = new PasteObject(this, object, clonedObject);

        runInAction(() => {
            this.foundObjects.set(object, pasteObject);
            this.pasteObjects.push(pasteObject);
            this.remaining++;
        });

        if (parentStyleObject) {
            pasteObject.parentStylePasteObject =
                this.addObject(parentStyleObject);

            addObject(
                (pasteObject.parentStylePasteObject.object as CommonStyle)
                    .childStyles,
                pasteObject.object
            );

            pasteObject.styleLevel =
                pasteObject.parentStylePasteObject.styleLevel + 1;
        }

        if (objectParentPath) {
            const parent = getParent(object);
            setParent(
                object,
                getObjectFromStringPath(
                    this.sourceProjectStore.project,
                    objectParentPath
                )
            );
            this.searchForDependencies(object, parent);
        } else {
            this.searchForDependencies(clonedObject);
        }

        return pasteObject;
    }

    searchForDependencies(object: EezObject, parent?: IEezObject) {
        const search = searchForObjectDependencies(
            this.sourceProjectStore,
            object,
            true,
            true
        );

        const interval = setInterval(() => {
            while (true) {
                let visitResult = search.next();
                if (visitResult.done) {
                    clearInterval(interval);

                    if (parent) {
                        setParent(object, parent);
                    }

                    runInAction(() => this.remaining--);

                    if (this.remaining == 0) {
                        this.finalize();
                    }

                    return;
                }

                let dependency = visitResult.value;
                if (!dependency) {
                    return;
                }

                if (dependency.kind == "object-reference") {
                    let path =
                        dependency.valueObject.propertyInfo
                            .referencedObjectCollectionPath!;
                    const name = dependency.valueObject.value;

                    if (path == "userWidgets" || path == "userPages") {
                        path = "pages";
                    }

                    if (
                        this.sourceProjectStore.project._assets.maps[
                            "name"
                        ].assetCollectionPaths.has(path)
                    ) {
                        let collection = getObjectFromPath(
                            this.sourceProjectStore.project,
                            path.split("/")
                        ) as EezObject[];

                        if (!collection) {
                            if (
                                path == "allStyles" ||
                                path == "allLvglStyles"
                            ) {
                                collection =
                                    this.sourceProjectStore.project[path];
                                path = "styles";
                            } else if (path == "pages") {
                                collection =
                                    this.sourceProjectStore.project[path];
                            }
                        }

                        const referencedObject =
                            collection &&
                            collection.find(
                                object => name == getProperty(object, "name")
                            );

                        if (referencedObject) {
                            this.addObject(referencedObject, undefined);
                        }
                    }
                } else if (dependency.kind == "expression-start") {
                } else if (dependency.kind == "expression-node") {
                    const node = dependency.node;
                    if (node.type == "Identifier") {
                        if (node.identifierType == "local-variable") {
                            const flow = getAncestorOfType<Flow>(
                                object,
                                ProjectEditor.FlowClass.classInfo
                            );
                            if (flow) {
                                const localVariable = flow.localVariables.find(
                                    localVariable =>
                                        localVariable.name == node.name
                                );
                                if (localVariable) {
                                    const pasteObject = this.addObject(
                                        localVariable,
                                        undefined
                                    );
                                    pasteObject.isLocalVariable = true;
                                }
                            }
                        } else if (node.identifierType == "global-variable") {
                            const globalVariable =
                                this.sourceProjectStore.project.variables.globalVariables.find(
                                    globalVariable =>
                                        globalVariable.name == node.name
                                );
                            if (globalVariable) {
                                this.addObject(globalVariable, undefined);
                            }
                        }
                    }
                } else if (dependency.kind == "expression-end") {
                } else if (dependency.kind == "variable-type") {
                    const checkType = (
                        variableType: string,
                        fromIndex: number
                    ) => {
                        const enumType = getEnumFromType(
                            this.sourceProjectStore.project,
                            variableType
                        );
                        if (enumType instanceof ProjectEditor.EnumClass) {
                            this.addObject(enumType, undefined);
                        }

                        const structure = getStructureFromType(
                            this.sourceProjectStore.project,
                            variableType
                        );
                        if (structure instanceof ProjectEditor.StructureClass) {
                            this.addObject(structure, undefined);
                        }

                        const elementType =
                            getArrayElementTypeFromType(variableType);
                        if (elementType) {
                            checkType(elementType, fromIndex + "array:".length);
                        }
                    };

                    checkType(dependency.valueObject.value, 0);
                }
            }
        }, 0);
    }

    compareObjects(
        existingObject: IEezObject | undefined,
        newObject: IEezObject | undefined
    ) {
        if (!existingObject) {
            // console.log("T1", existingObject, newObject);
            return newObject ? false : true;
        }

        if (!newObject) {
            // console.log("T2", existingObject, newObject);
            return false;
        }

        const classInfo = getClassInfo(existingObject);

        if (isArray(existingObject) || isArray(newObject)) {
            if (!isArray(existingObject) || !isArray(newObject)) {
                // console.log("T3", existingObject, newObject);
                return false;
            }

            if (existingObject.length != newObject.length) {
                // console.log("T4", existingObject, newObject);
                return false;
            }

            for (let i = 0; i < existingObject.length; i++) {
                if (!this.compareObjects(existingObject[i], newObject[i])) {
                    return false;
                }
            }
        } else {
            for (const propertyInfo of classInfo.properties) {
                if (!isPropertyDisabled(existingObject, propertyInfo)) {
                    if (
                        propertyInfo.type == PropertyType.Array &&
                        (existingObject instanceof
                            ProjectEditor.LVGLStyleClass ||
                            existingObject instanceof
                                ProjectEditor.StyleClass) &&
                        propertyInfo.name == "childStyles"
                    ) {
                        continue;
                    }

                    if (
                        existingObject instanceof
                            ProjectEditor.ConnectionLineClass &&
                        propertyInfo.name == "source"
                    ) {
                        if (
                            !this.compareObjects(
                                existingObject.sourceComponent,
                                (newObject as ConnectionLine).sourceComponent
                            )
                        ) {
                            // console.log("T4", existingObject, newObject);
                            return false;
                        }
                        continue;
                    }

                    if (
                        existingObject instanceof
                            ProjectEditor.ConnectionLineClass &&
                        propertyInfo.name == "output"
                    ) {
                        if (
                            getOutputDisplayName(
                                existingObject.sourceComponent,
                                existingObject.output
                            ) !=
                            getOutputDisplayName(
                                (newObject as ConnectionLine).sourceComponent,
                                (newObject as ConnectionLine).output
                            )
                        ) {
                            // console.log("T5", existingObject, newObject);
                            return false;
                        }
                        continue;
                    }

                    if (
                        existingObject instanceof
                            ProjectEditor.ConnectionLineClass &&
                        propertyInfo.name == "target"
                    ) {
                        if (
                            !this.compareObjects(
                                existingObject.targetComponent,
                                (newObject as ConnectionLine).targetComponent
                            )
                        ) {
                            // console.log("T6", existingObject, newObject);
                            return false;
                        }
                        continue;
                    }

                    if (
                        existingObject instanceof
                            ProjectEditor.ConnectionLineClass &&
                        propertyInfo.name == "input"
                    ) {
                        if (
                            getInputDisplayName(
                                existingObject.targetComponent,
                                existingObject.input
                            ) !=
                            getInputDisplayName(
                                (newObject as ConnectionLine).targetComponent,
                                (newObject as ConnectionLine).input
                            )
                        ) {
                            // console.log("T7", existingObject, newObject);
                            return false;
                        }
                        continue;
                    }

                    if (
                        propertyInfo.type == PropertyType.Object ||
                        propertyInfo.type == PropertyType.Array
                    ) {
                        let childObject1 = getChildOfObject(
                            existingObject,
                            propertyInfo
                        );
                        let childObject2 = getChildOfObject(
                            newObject,
                            propertyInfo
                        );

                        if (!this.compareObjects(childObject1, childObject2)) {
                            // console.log(
                            //     "T8",
                            //     propertyInfo,
                            //     existingObject,
                            //     newObject
                            // );
                            return false;
                        }
                    } else if (
                        (existingObject as any)[propertyInfo.name] !=
                        (newObject as any)[propertyInfo.name]
                    ) {
                        // console.log(
                        //     "T9",
                        //     propertyInfo,
                        //     existingObject,
                        //     newObject
                        // );
                        return false;
                    }
                }
            }
        }

        return true;
    }

    get destinationFlow() {
        if (this._destinationFlow) {
            return this._destinationFlow;
        }
        const editorState =
            this.destinationProjectStore.editorsStore.activeEditor?.state;
        if (editorState instanceof ProjectEditor.FlowTabStateClass) {
            return editorState.flow;
        }
        return undefined;
    }

    hasConflict(pasteObject: PasteObject): Conflict {
        if (pasteObject.object instanceof ProjectEditor.FlowFragmentClass) {
            if (
                this.sourceProjectStore.project.settings.general.projectType !=
                this.destinationProjectStore.project.settings.general
                    .projectType
            ) {
                return {
                    kind: "not-compatible",
                    message: NOT_COMPATIBLE_WITH_PROJECT_TYPE
                };
            }

            const hasWidgets = pasteObject.object.components.find(
                component => component instanceof ProjectEditor.WidgetClass
            );

            if (!this.destinationFlow) {
                return {
                    kind: "not-compatible",
                    message: hasWidgets
                        ? "No Page, UserWidget or UserAction selected, will be skipped."
                        : "No Page or UserWidget selected, will be skipped."
                };
            }

            if (
                hasWidgets &&
                this.destinationFlow &&
                this.destinationFlow instanceof ProjectEditor.ActionClass
            ) {
                return {
                    kind: "not-compatible",
                    message:
                        "Can't paste Flow Fragment with the Widgets to the User Action, will be skipped."
                };
            }

            const hasActions = pasteObject.object.components.find(
                component =>
                    component instanceof ProjectEditor.ActionComponentClass
            );

            if (
                hasActions &&
                !this.destinationProjectStore.projectTypeTraits.hasFlowSupport
            ) {
                return {
                    kind: "not-compatible",
                    message: "Destination project has no flow support."
                };
            }

            return { kind: "doesnt-exists" };
        }

        if (pasteObject.object instanceof ProjectEditor.FlowClass) {
            const hasActions = pasteObject.object.components.find(
                component =>
                    component instanceof ProjectEditor.ActionComponentClass
            );

            if (
                hasActions &&
                !this.destinationProjectStore.projectTypeTraits.hasFlowSupport
            ) {
                return {
                    kind: "not-compatible",
                    message: "Destination project has no flow support."
                };
            }
        }

        if (
            pasteObject.object instanceof ProjectEditor.StyleClass ||
            pasteObject.object instanceof ProjectEditor.LVGLStyleClass
        ) {
            if (
                this.sourceProjectStore.project.settings.general.projectType !=
                this.destinationProjectStore.project.settings.general
                    .projectType
            ) {
                return {
                    kind: "not-compatible",
                    message: NOT_COMPATIBLE_WITH_PROJECT_TYPE
                };
            }

            const destinationStyle = pasteObject.destinationStyle;
            if (!destinationStyle) {
                return { kind: "doesnt-exists" };
            }

            if (this.compareObjects(destinationStyle, pasteObject.object)) {
                return { kind: "exists-same" };
            }

            return {
                kind: "exists-different",
                destinationObject: destinationStyle
            };
        }

        if (
            pasteObject.object instanceof ProjectEditor.FontClass ||
            pasteObject.object instanceof ProjectEditor.PageClass ||
            pasteObject.object instanceof ProjectEditor.ActionClass
        ) {
            if (
                this.sourceProjectStore.project.settings.general.projectType !=
                this.destinationProjectStore.project.settings.general
                    .projectType
            ) {
                return {
                    kind: "not-compatible",
                    message: NOT_COMPATIBLE_WITH_PROJECT_TYPE
                };
            }
        }

        // if (pasteObject.object instanceof ProjectEditor.ColorClass) {
        //     if (
        //         this.destinationProjectStore.project.settings.general
        //             .projectType == ProjectType.LVGL
        //     ) {
        //         return {
        //             kind: "not-compatible",
        //             message: NOT_COMPATIBLE_WITH_PROJECT_TYPE
        //         };
        //     }
        // }

        if (!pasteObject.destinationCollection) {
            return { kind: "doesnt-exists" };
        }

        const destinationObject = pasteObject.destinationCollection.find(
            destinationObject =>
                destinationObject.name == (pasteObject.object as any).name
        );

        if (!destinationObject) {
            return { kind: "doesnt-exists" };
        }

        if (this.compareObjects(destinationObject, pasteObject.object)) {
            if (pasteObject.object instanceof ProjectEditor.ColorClass) {
                const sourceColor = pasteObject.object;
                const destinationColor = destinationObject as Color;

                const checkColorConflict = (
                    sourceTheme: Theme,
                    destinationTheme: Theme
                ): Conflict | undefined => {
                    const sourceColorValue =
                        this.sourceProjectStore.project.getThemeColor(
                            sourceTheme.objID,
                            sourceColor.objID
                        );

                    const destinationColorValue =
                        this.destinationProjectStore.project.getThemeColor(
                            destinationTheme.objID,
                            destinationColor.objID
                        );

                    if (sourceColorValue != destinationColorValue) {
                        return {
                            kind: "exists-different",
                            destinationObject
                        };
                    }
                    return undefined;
                };

                if (
                    compareThemes(
                        this.sourceProjectStore,
                        this.destinationProjectStore
                    )
                ) {
                    for (const sourceTheme of this.sourceProjectStore.project
                        .themes) {
                        let destinationTheme =
                            this.destinationProjectStore.project.themes.find(
                                destinationTheme =>
                                    destinationTheme.name == sourceTheme.name
                            )!;

                        const result = checkColorConflict(
                            sourceTheme,
                            destinationTheme
                        );
                        if (result) {
                            return result;
                        }
                    }
                } else {
                    const sourceTheme = getSelectedTheme(
                        this.sourceProjectStore
                    );
                    const destinationTheme = getSelectedTheme(
                        this.destinationProjectStore
                    );

                    const result = checkColorConflict(
                        sourceTheme,
                        destinationTheme
                    );
                    if (result) {
                        return result;
                    }
                }
            }

            return { kind: "exists-same" };
        }

        return { kind: "exists-different", destinationObject };
    }

    findConflicts() {
        this.pasteObjects.forEach(pasteObject => {
            runInAction(() => {
                pasteObject.conflict = this.hasConflict(pasteObject);
            });
        });
    }

    sortPasteObjects() {
        runInAction(() => {
            this.pasteObjects.sort((a: PasteObject, b: PasteObject) => {
                function order(pasteObject: PasteObject) {
                    const object = pasteObject.object;
                    if (object instanceof ProjectEditor.FlowFragmentClass) {
                        return 0;
                    } else if (object instanceof ProjectEditor.VariableClass) {
                        return pasteObject.isLocalVariable ? 1 : 2;
                    } else if (object instanceof ProjectEditor.StructureClass) {
                        return 3;
                    } else if (object instanceof ProjectEditor.EnumClass) {
                        return 4;
                    } else if (object instanceof ProjectEditor.ActionClass) {
                        return 5;
                    } else if (object instanceof ProjectEditor.PageClass) {
                        return !object.isUsedAsUserWidget ? 6 : 7;
                    } else if (object instanceof ProjectEditor.StyleClass) {
                        return 8;
                    } else if (object instanceof ProjectEditor.LVGLStyleClass) {
                        return 9;
                    } else if (object instanceof ProjectEditor.BitmapClass) {
                        return 10;
                    } else if (object instanceof ProjectEditor.FontClass) {
                        return 11;
                    } else if (object instanceof ProjectEditor.ColorClass) {
                        return 12;
                    } else {
                        return 13;
                    }
                }

                let result = order(a) - order(b);

                if (result == 0) {
                    if (
                        a.object instanceof ProjectEditor.StyleClass ||
                        a.object instanceof ProjectEditor.LVGLStyleClass
                    ) {
                        function getRootStyle(object: EezObject) {
                            let collection = getParent(object);
                            if (!collection) {
                                return object;
                            }

                            let parent = getParent(collection);
                            if (!parent) {
                                return object;
                            }

                            if (
                                parent instanceof ProjectEditor.StyleClass ||
                                parent instanceof ProjectEditor.LVGLStyleClass
                            ) {
                                return getRootStyle(parent);
                            }

                            return object;
                        }

                        let aRoot = getRootStyle(a.object);
                        let bRoot = getRootStyle(b.object);

                        if (aRoot == bRoot) {
                            result = a.styleLevel - b.styleLevel;
                        }
                    }
                }

                if (result == 0) {
                    const aName = (a.object as any).name;
                    const bName = (b.object as any).name;

                    if (aName && bName) {
                        if (aName < bName) {
                            return -1;
                        } else if (aName > bName) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                }

                return result;
            });
        });
    }

    finalize() {
        //
        this.findConflicts();

        this.sortPasteObjects();

        runInAction(() => (this.allDependenciesFound = true));
    }

    get posteObjectsWithConflicts() {
        return this.pasteObjects.filter(
            pasteObject =>
                pasteObject.conflict.kind == "exists-different" ||
                pasteObject.conflict.kind == "not-compatible"
        );
    }

    beforePaste() {
        // rename source objects
        runInAction(() => {
            // make sure flow fragment is included in replaceObjectReference
            let includeAdditionObjects;
            const flowFragmentPasteObject = this.pasteObjects.find(
                pasteObject =>
                    pasteObject.object instanceof
                    ProjectEditor.FlowFragmentClass
            );
            if (flowFragmentPasteObject) {
                const flowFragment = flowFragmentPasteObject.object;
                if (getParent(flowFragment) == undefined) {
                    setParent(flowFragment, this.interProjectStore.project);
                }

                includeAdditionObjects = [flowFragment];
            }

            for (const pasteObject of this.pasteObjects) {
                if (
                    pasteObject.conflict.kind == "exists-different" &&
                    pasteObject.conflictResolution == "rename-source"
                ) {
                    replaceObjectReference(
                        pasteObject.object,
                        pasteObject.conflictResolutionName,
                        includeAdditionObjects
                    );

                    (pasteObject.object as ObjectWithName).name =
                        pasteObject.conflictResolutionName;

                    pasteObject.conflict = { kind: "doesnt-exists" };
                }
            }
        });

        // Clone objects once more, this time with new ID's and in destination project store.
        // Do not clone non-root level style objects.
        const rootPasteObjects = this.pasteObjects.filter(
            pasteObject => pasteObject.styleLevel == 0
        );
        rewireBegin();
        const clonedObjects = rootPasteObjects.map(pasteObject =>
            cloneObjectWithNewObjIds(
                this.destinationProjectStore,
                pasteObject.object
            )
        );
        rewireEnd(clonedObjects);

        let i = 0;
        for (const pasteObject of this.pasteObjects) {
            if (pasteObject.styleLevel == 0) {
                pasteObject.object = clonedObjects[i++];
            }
        }

        // find non-root level style objects in newly cloned objects
        for (let level = 1; ; level++) {
            let found = false;
            for (let i = 0; i < this.pasteObjects.length; i++) {
                const pasteObject = this.pasteObjects[i];
                if (pasteObject.styleLevel == level) {
                    found = true;

                    const styleName = (pasteObject.object as CommonStyle).name;

                    pasteObject.object = (
                        pasteObject.parentStylePasteObject.object as CommonStyle
                    ).childStyles.find(
                        childStyle => childStyle.name == styleName
                    )!;
                }
            }
            if (!found) {
                break;
            }
        }
    }

    doPaste() {
        this.beforePaste();

        this.destinationProjectStore.undoManager.setCombineCommands(true);

        // rename destination objects
        runInAction(() => {
            for (const pasteObject of this.pasteObjects) {
                if (
                    pasteObject.conflict.kind == "exists-different" &&
                    pasteObject.conflictResolution == "rename-destination"
                ) {
                    replaceObjectReference(
                        pasteObject.conflict.destinationObject,
                        pasteObject.conflictResolutionName
                    );

                    updateObject(pasteObject.conflict.destinationObject, {
                        name: pasteObject.conflictResolutionName
                    });

                    pasteObject.conflict = { kind: "doesnt-exists" };
                }
            }
        });

        for (const pasteObject of this.pasteObjects) {
            if (
                pasteObject.conflict.kind == "exists-same" ||
                pasteObject.conflict.kind == "not-compatible"
            ) {
                continue;
            }

            if (pasteObject.conflictResolution == "keep") {
                continue;
            }

            const object = pasteObject.object;
            if (object instanceof ProjectEditor.FlowFragmentClass) {
                if (this.destinationFlow) {
                    ProjectEditor.FlowFragmentClass.paste(
                        this.destinationProjectStore,
                        this.destinationFlow,
                        object,
                        this.destinationFlow
                    );
                } else {
                    const editorState =
                        this.destinationProjectStore.editorsStore.activeEditor
                            ?.state;
                    if (
                        editorState instanceof ProjectEditor.FlowTabStateClass
                    ) {
                        let fromObject;
                        if (
                            editorState.widgetContainer.selectedItems.length ==
                            0
                        ) {
                            fromObject = editorState.widgetContainer.object;
                        } else {
                            fromObject =
                                editorState.widgetContainer.selectedItems[0]
                                    .object;
                        }

                        ProjectEditor.FlowFragmentClass.paste(
                            this.destinationProjectStore,
                            editorState.flow,
                            object,
                            fromObject
                        );
                    }
                }
            } else {
                let collection: IEezObject | undefined;

                if (object instanceof ProjectEditor.VariableClass) {
                    if (pasteObject.isLocalVariable) {
                        if (this.destinationFlow) {
                            collection = this.destinationFlow.localVariables;
                        }
                    } else {
                        collection =
                            this.destinationProjectStore.project.variables
                                .globalVariables;
                    }
                } else if (object instanceof ProjectEditor.StructureClass) {
                    collection =
                        this.destinationProjectStore.project.variables
                            .structures;
                } else if (object instanceof ProjectEditor.EnumClass) {
                    collection =
                        this.destinationProjectStore.project.variables.enums;
                } else if (object instanceof ProjectEditor.ActionClass) {
                    collection = this.destinationProjectStore.project.actions;
                } else if (object instanceof ProjectEditor.PageClass) {
                    if (object.isUsedAsUserWidget) {
                        collection =
                            this.destinationProjectStore.project.userWidgets;
                    } else {
                        collection =
                            this.destinationProjectStore.project.userPages;
                    }
                } else if (object instanceof ProjectEditor.StyleClass) {
                    if (pasteObject.styleLevel == 0) {
                        collection =
                            this.destinationProjectStore.project.styles;
                    }
                } else if (object instanceof ProjectEditor.LVGLStyleClass) {
                    if (pasteObject.styleLevel == 0) {
                        collection =
                            this.destinationProjectStore.project.lvglStyles
                                .styles;
                    }
                } else if (object instanceof ProjectEditor.BitmapClass) {
                    collection = this.destinationProjectStore.project.bitmaps;
                } else if (object instanceof ProjectEditor.FontClass) {
                    collection = this.destinationProjectStore.project.fonts;
                } else if (object instanceof ProjectEditor.ColorClass) {
                    collection = this.destinationProjectStore.project.colors;
                }

                if (collection) {
                    if (
                        pasteObject.conflict.kind == "exists-different" &&
                        pasteObject.conflictResolution == "replace"
                    ) {
                        replaceObject(
                            pasteObject.conflict.destinationObject,
                            object
                        );
                    } else {
                        addObject(collection, object);
                    }
                }

                if (object instanceof ProjectEditor.ColorClass) {
                    const destinationColor = object;
                    const sourceColor = pasteObject.sourceObject as Color;
                    if (sourceColor) {
                        const destinationColorIndex =
                            this.destinationProjectStore.project.colors.findIndex(
                                color => color.name == destinationColor.name
                            );

                        const updateColor = (
                            sourceTheme: Theme,
                            destinationTheme: Theme
                        ) => {
                            const colors = destinationTheme.colors.slice();

                            colors[destinationColorIndex] =
                                this.sourceProjectStore.project.getThemeColor(
                                    sourceTheme.objID,
                                    sourceColor.objID
                                );

                            updateObject(destinationTheme, {
                                colors
                            });
                        };

                        if (
                            compareThemes(
                                this.sourceProjectStore,
                                this.destinationProjectStore
                            )
                        ) {
                            for (const sourceTheme of this.sourceProjectStore
                                .project.themes) {
                                let destinationTheme =
                                    this.destinationProjectStore.project.themes.find(
                                        destinationTheme =>
                                            destinationTheme.name ==
                                            sourceTheme.name
                                    )!;

                                updateColor(sourceTheme, destinationTheme);
                            }
                        } else {
                            const sourceTheme = getSelectedTheme(
                                this.sourceProjectStore
                            );
                            const destinationTheme = getSelectedTheme(
                                this.destinationProjectStore
                            );
                            updateColor(sourceTheme, destinationTheme);
                        }
                    }
                }
            }
        }

        this.destinationProjectStore.undoManager.setCombineCommands(false);
    }

    get allConflictsResolved() {
        return !this.pasteObjects.find(
            pasteObject =>
                pasteObject.conflict.kind == "exists-different" &&
                (pasteObject.conflictResolution == "rename-source" ||
                    pasteObject.conflictResolution == "rename-destination") &&
                (!pasteObject.conflictResolutionName ||
                    pasteObject.conflictResolutionError)
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export const ResolvePasteConflictsDialog = observer(
    class ResolvePasteConflictsDialog extends React.Component<{
        pasteWithDependenciesModel: PasteWithDependenciesModel;
        modalDialog: IObservableValue<any>;
        onOk: () => void;
        onCancel: () => void;
    }> {
        enableAllCheckboxRef = React.createRef<HTMLInputElement>();

        get allDependenciesFound() {
            return this.props.pasteWithDependenciesModel.allDependenciesFound;
        }

        onOkEnabled = () => {
            return (
                this.allDependenciesFound &&
                this.props.pasteWithDependenciesModel.allConflictsResolved
            );
        };

        onOk = () => {
            this.props.onOk();
        };

        render() {
            const pasteWithDependenciesModel =
                this.props.pasteWithDependenciesModel;

            const posteObjectsWithConflicts =
                this.props.pasteWithDependenciesModel.posteObjectsWithConflicts;

            return (
                <Dialog
                    modal={false}
                    okButtonText="Paste"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div className="EezStudio_ResolvePasteConflictsDialog">
                        {posteObjectsWithConflicts.length == 0 ? (
                            "No conflicts found."
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Object Type</th>
                                        <th>Object Name</th>
                                        <th>Conflict Resolution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {posteObjectsWithConflicts.map(
                                        pasteObject => {
                                            const object = pasteObject.object;

                                            const classInfo =
                                                getClassInfo(object);

                                            const isUserWidget =
                                                object instanceof
                                                    ProjectEditor.PageClass &&
                                                object.isUsedAsUserWidget;

                                            const isFlowFragment =
                                                object instanceof
                                                ProjectEditor.FlowFragmentClass;

                                            const icon = isUserWidget
                                                ? USER_WIDGET_ICON
                                                : classInfo.icon;

                                            let objectType = isUserWidget
                                                ? "User Widget"
                                                : isFlowFragment
                                                ? "Flow Fragment"
                                                : pasteObject.isLocalVariable
                                                ? "Local Variable"
                                                : getClass(object).name;

                                            return (
                                                <tr key={object.objID}>
                                                    <td>
                                                        <div
                                                            style={{
                                                                paddingLeft:
                                                                    pasteObject.styleLevel *
                                                                    10
                                                            }}
                                                        >
                                                            {icon && (
                                                                <Icon
                                                                    icon={icon}
                                                                />
                                                            )}
                                                            {objectType}
                                                        </div>
                                                    </td>

                                                    <td>
                                                        {" "}
                                                        {isFlowFragment
                                                            ? ""
                                                            : getLabel(object)}
                                                    </td>

                                                    <td>
                                                        <ConflictResolution
                                                            pasteWithDependenciesModel={
                                                                pasteWithDependenciesModel
                                                            }
                                                            pasteObject={
                                                                pasteObject
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Dialog>
            );
        }
    }
);

const ConflictResolution = observer(
    class ConflictResolution extends React.Component<{
        pasteWithDependenciesModel: PasteWithDependenciesModel;
        pasteObject: PasteObject;
    }> {
        render() {
            const { pasteObject } = this.props;

            if (pasteObject.conflict.kind == "doesnt-exists") {
                return "No conflict - Doesn't exists.";
            } else if (pasteObject.conflict.kind == "exists-same") {
                return "No conflict - Exists, but same.";
            } else if (pasteObject.conflict.kind == "not-compatible") {
                return pasteObject.conflict.message;
            }

            return (
                <div className="EezStudio_PasteWithDependenciesDialog_ConflictResolution">
                    <select
                        className="form-select"
                        value={pasteObject.conflictResolution}
                        onChange={action(
                            event =>
                                (pasteObject.conflictResolution = event.target
                                    .value as any)
                        )}
                    >
                        <option value="rename-source">Rename source</option>
                        <option value="rename-destination">
                            Rename destination
                        </option>
                        <option value="replace">Replace</option>
                        <option value="keep">Keep</option>
                    </select>
                    {(pasteObject.conflictResolution == "rename-source" ||
                        pasteObject.conflictResolution ==
                            "rename-destination") && (
                        <input
                            className="form-control"
                            type="text"
                            value={pasteObject.conflictResolutionName || ""}
                            onChange={action(
                                event =>
                                    (pasteObject.conflictResolutionName =
                                        event.target.value)
                            )}
                            placeholder="Name"
                        ></input>
                    )}
                    {pasteObject.conflictResolutionError && (
                        <div className="alert alert-danger" role="alert">
                            {pasteObject.conflictResolutionError}
                        </div>
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function createEmptyProjectStore(sourceProjectStore: ProjectStore) {
    const projectStore = ProjectStore.create({
        type: "project-editor"
    });

    const projectJsonStr = getJSON(sourceProjectStore);

    const projectJson: Partial<Project> = JSON.parse(projectJsonStr);

    runInAction(() => {
        if (projectJson.variables) {
            projectJson.variables.globalVariables = [];
            projectJson.variables.structures = [];
            projectJson.variables.enums = [];
        }
        projectJson.actions = [];
        projectJson.userPages = [];
        projectJson.userWidgets = [];
        projectJson.styles = [];
        projectJson.fonts = [];
        if (projectJson.texts) {
            projectJson.texts.languages = [];
            projectJson.texts.resources = [];
        }
        if (projectJson.readme) {
            projectJson.readme.readmeFile = undefined;
        }
        projectJson.bitmaps = [];
        if (projectJson.scpi) {
            projectJson.scpi.subsystems = [];
            projectJson.scpi.enums = [];
        }
        if (projectJson.instrumentCommands) {
            projectJson.instrumentCommands.commands = [];
        }
        if (projectJson.shortcuts) {
            projectJson.shortcuts.shortcuts = [];
        }
        if (projectJson.micropython) {
            projectJson.micropython.code = "";
        }
        projectJson.extensionDefinitions = [];
        projectJson.colors = [];

        // leave projectJson.themes

        if (projectJson.lvglStyles) {
            projectJson.lvglStyles.styles = [];
            projectJson.lvglStyles.defaultStyles = {};
        }
    });

    const project = loadProject(projectStore, projectJson, false);

    projectStore.setProject(project, "");

    const projectStoreFlowFragmentFlow = createObject<Page>(
        projectStore,
        {
            name: FLOW_FRAGMENT_PAGE_NAME,
            left: 0,
            top: 0,
            width: 900,
            height: 600,
            components: [],
            connectionLines: [],
            localVariables: [],
            isUsedAsUserWidget: false
        },
        ProjectEditor.PageClass,
        undefined,
        false
    );

    addObject(projectStore.project.userPages, projectStoreFlowFragmentFlow);

    return {
        projectStore,
        projectStoreFlowFragmentFlow
    };
}

////////////////////////////////////////////////////////////////////////////////

const FindAllPasteDependenciesProgressDialog = observer(
    class FindAllPasteDependenciesProgressDialog extends React.Component<{
        pasteWithDependenciesModel: PasteWithDependenciesModel;
    }> {
        render() {
            return (
                <Dialog
                    size="small"
                    cancelDisabled={true}
                    open={
                        !this.props.pasteWithDependenciesModel
                            .allDependenciesFound
                    }
                    modal={true}
                >
                    <div className="EezStudio_FindAllPasteDependenciesProgressDialog">
                        <div>
                            <div>Searching for dependencies ...</div>
                            <Loader />
                        </div>
                    </div>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function showResolvePasteConflictsDialog(
    pasteWithDependenciesModel: PasteWithDependenciesModel,
    onFinished: ((destinationProjectStore: ProjectStore) => void) | undefined
) {
    const modalDialogObservable = observable.box<any>();

    let disposed = false;

    const onDispose = () => {
        if (!disposed) {
            disposed = true;

            if (modalDialog) {
                modalDialog.close();
            }
        }
    };

    const onOk = () => {
        pasteWithDependenciesModel.doPaste();

        if (onFinished) {
            onFinished(pasteWithDependenciesModel.destinationProjectStore);
        }

        onDispose();
    };

    const [modalDialog] = showDialog(
        <ResolvePasteConflictsDialog
            pasteWithDependenciesModel={pasteWithDependenciesModel}
            modalDialog={modalDialogObservable}
            onOk={onOk}
            onCancel={onDispose}
        />,
        {
            jsPanel: {
                id: "resolve-paste-conflicts-dialog",
                title: "Paste - Resolve Conflicts",
                width: 800,
                height: 600
            }
        }
    );

    modalDialogObservable.set(modalDialog);
}

export function showFindAllPasteDependenciesProgressDialog(
    sourceProjectStore: ProjectStore,
    sourceObjects: EezObject[],
    sourceObjectsParentPath: string[],
    destinationProjectStore: ProjectStore,
    destinationFlow: Flow | undefined,
    onFinished?: (destinationProjectStore: ProjectStore) => void
) {
    const pasteWithDependenciesModel = new PasteWithDependenciesModel(
        sourceProjectStore,
        sourceObjects,
        sourceObjectsParentPath,
        destinationProjectStore,
        destinationFlow
    );

    const onFindDependenciesFinished = () => {
        if (pasteWithDependenciesModel.posteObjectsWithConflicts.length > 0) {
            showResolvePasteConflictsDialog(
                pasteWithDependenciesModel,
                onFinished
            );
        } else {
            pasteWithDependenciesModel.doPaste();
            if (onFinished) {
                onFinished(pasteWithDependenciesModel.destinationProjectStore);
            }
        }
    };

    const reactionDisposer = reaction(
        () => pasteWithDependenciesModel.allDependenciesFound,
        () => {
            reactionDisposer();

            // all dependencies found, cancel showing progress dialog
            if (showProgressTimeout) {
                clearTimeout(showProgressTimeout);
                showProgressTimeout = undefined;
            }

            onFindDependenciesFinished();
        }
    );

    // show progress dialog after period of time
    let showProgressTimeout: any;
    showProgressTimeout = setTimeout(() => {
        showProgressTimeout = undefined;
        showDialog(
            <FindAllPasteDependenciesProgressDialog
                pasteWithDependenciesModel={pasteWithDependenciesModel}
            />
        );
    }, 250);

    pasteWithDependenciesModel.findAllDependencies();

    return true;
}

export function canPasteWithDependencies(
    destinationProjectStore: ProjectStore
) {
    let serializedData = getProjectEditorDataFromClipboard(
        destinationProjectStore
    );
    if (!serializedData) {
        return false;
    }

    if (serializedData.object) {
        if (serializedData.object instanceof ProjectEditor.BuildFileClass) {
            return false;
        }
    } else if (serializedData.objects) {
        if (
            !serializedData.objects.find(
                object => !(object instanceof ProjectEditor.BuildFileClass)
            )
        ) {
            return false;
        }
    }

    if (
        serializedData.originProjectFilePath == destinationProjectStore.filePath
    ) {
        return false;
    }

    const sourceProjectEditorTab = ProjectEditor.homeTabs?.findProjectEditorTab(
        serializedData.originProjectFilePath,
        false
    );
    if (!sourceProjectEditorTab) {
        return false;
    }

    const sourceProjectStore = sourceProjectEditorTab.projectStore;
    if (!sourceProjectStore) {
        return false;
    }

    return true;
}

export function pasteWithDependencies(destinationProjectStore: ProjectStore) {
    let serializedData = getProjectEditorDataFromClipboard(
        destinationProjectStore
    );
    if (!serializedData) {
        return;
    }

    if (
        serializedData.originProjectFilePath == destinationProjectStore.filePath
    ) {
        return;
    }

    const sourceProjectEditorTab = ProjectEditor.homeTabs?.findProjectEditorTab(
        serializedData.originProjectFilePath,
        false
    );
    if (!sourceProjectEditorTab) {
        return;
    }

    const sourceProjectStore = sourceProjectEditorTab.projectStore;
    if (!sourceProjectStore) {
        return;
    }

    const sourceObjects = serializedData.object
        ? [serializedData.object]
        : serializedData.objects!;

    const sourceObjectsParentPath = serializedData.object
        ? [serializedData.objectParentPath!]
        : serializedData.objectsParentPath!;

    showFindAllPasteDependenciesProgressDialog(
        sourceProjectStore,
        sourceObjects,
        sourceObjectsParentPath,
        destinationProjectStore,
        undefined,
        undefined
    );
}

export function pasteWithDependenciesIntoNewStorebookItem(
    pasteModelSourceProjectStore: ProjectStore,
    onFinished: (destinationProjectStore: ProjectStore) => void
) {
    let serializedData = getProjectEditorDataFromClipboard(
        pasteModelSourceProjectStore
    );
    if (!serializedData) {
        return;
    }

    const sourceObjects = serializedData.object
        ? [serializedData.object]
        : serializedData.objects!;

    const sourceObjectsParentPath = serializedData.object
        ? [serializedData.objectParentPath!]
        : serializedData.objectsParentPath!;

    const { projectStore, projectStoreFlowFragmentFlow } =
        createEmptyProjectStore(pasteModelSourceProjectStore);

    showFindAllPasteDependenciesProgressDialog(
        pasteModelSourceProjectStore,
        sourceObjects,
        sourceObjectsParentPath,
        projectStore,
        projectStoreFlowFragmentFlow,
        onFinished
    );
}

export function pasteWithDependenciesIntoExistingStorebookItem(
    pasteModelSourceProjectStore: ProjectStore,
    destinationProjectStore: ProjectStore,
    onFinished: () => void
) {
    let serializedData = getProjectEditorDataFromClipboard(
        pasteModelSourceProjectStore
    );
    if (!serializedData) {
        return;
    }

    const sourceObjects = serializedData.object
        ? [serializedData.object]
        : serializedData.objects!;

    const sourceObjectsParentPath = serializedData.object
        ? [serializedData.objectParentPath!]
        : serializedData.objectsParentPath!;

    const destinationFlow = destinationProjectStore.project.userPages.find(
        page => page.name == FLOW_FRAGMENT_PAGE_NAME
    );

    showFindAllPasteDependenciesProgressDialog(
        pasteModelSourceProjectStore,
        sourceObjects,
        sourceObjectsParentPath,
        destinationProjectStore,
        destinationFlow,
        onFinished
    );
}

export function copyObjects(
    sourceProjectStore: ProjectStore,
    sourceObjects: EezObject[],
    destinationProjectStore: ProjectStore
) {
    sourceObjects = sourceObjects.map(object => {
        if (
            object instanceof ProjectEditor.PageClass &&
            object.name == FLOW_FRAGMENT_PAGE_NAME
        ) {
            const flowFragment = new ProjectEditor.FlowFragmentClass();
            setParent(flowFragment, object);

            if (destinationProjectStore.projectTypeTraits.isLVGL) {
                flowFragment.components = [];

                object.components.forEach(component => {
                    if (
                        component instanceof ProjectEditor.LVGLScreenWidgetClass
                    ) {
                        component.children.forEach(child => {
                            flowFragment.components.push(child);
                        });
                    } else {
                        flowFragment.components.push(component);
                    }
                });
            } else {
                flowFragment.components = object.components.slice();
            }

            setParent(flowFragment.components, flowFragment);

            flowFragment.components.forEach(component =>
                setParent(component, flowFragment.components)
            );

            flowFragment.connectionLines = object.connectionLines.slice();
            setParent(flowFragment.connectionLines, flowFragment);
            flowFragment.connectionLines.forEach(connectionLine =>
                setParent(connectionLine, flowFragment.connectionLines)
            );

            return flowFragment;
        }
        return object;
    });

    const sourceObjectsParentPath = sourceObjects.map(sourceObject => "");

    showFindAllPasteDependenciesProgressDialog(
        sourceProjectStore,
        sourceObjects,
        sourceObjectsParentPath,
        destinationProjectStore,
        undefined
    );
}

////////////////////////////////////////////////////////////////////////////////

export function getAllObjects(project: Project) {
    interface ObjectInfo {
        object: EezObject;
        name: string;
        icon: any;
    }

    const objects: {
        groupName: string;
        objects: ObjectInfo[];
    }[] = [];

    function addObject(groupName: string, object: ObjectInfo) {
        let group = objects.find(group => group.groupName == groupName);
        if (!group) {
            group = {
                groupName,
                objects: []
            };
            objects.push(group);
        }
        group.objects.push(object);
    }

    if (project.userPages) {
        project.userPages.forEach(page => {
            if (
                page.name == FLOW_FRAGMENT_PAGE_NAME &&
                page.components.length > 0
            ) {
                addObject("Flow Fragment", {
                    object: page,
                    name: page.name,
                    icon: ProjectEditor.PageClass.classInfo.icon!
                });
            }
        });
    }

    if (project.variables) {
        if (project.variables.globalVariables) {
            project.variables.globalVariables.forEach(variable => {
                addObject("Variables", {
                    object: variable,
                    name: variable.name,
                    icon: ProjectEditor.VariableClass.classInfo.icon!
                });
            });
        }

        if (project.variables.structures) {
            project.variables.structures.forEach(structure => {
                addObject("Structures", {
                    object: structure,
                    name: structure.name,
                    icon: ProjectEditor.StructureClass.classInfo.icon!
                });
            });
        }

        if (project.variables.enums) {
            project.variables.enums.forEach(enumObject => {
                addObject("Enums", {
                    object: enumObject,
                    name: enumObject.name,
                    icon: ProjectEditor.EnumClass.classInfo.icon!
                });
            });
        }
    }

    if (project.actions) {
        project.actions.forEach(action => {
            addObject("User Actions", {
                object: action,
                name: action.name,
                icon: ProjectEditor.ActionClass.classInfo.icon!
            });
        });
    }

    if (project.userPages) {
        project.userPages.forEach(page => {
            if (page.name != FLOW_FRAGMENT_PAGE_NAME) {
                addObject("Pages", {
                    object: page,
                    name: page.name,
                    icon: ProjectEditor.PageClass.classInfo.icon!
                });
            }
        });
    }

    if (project.userWidgets) {
        project.userWidgets.forEach(userWidget => {
            addObject("User Widgets", {
                object: userWidget,
                name: userWidget.name,
                icon: USER_WIDGET_ICON
            });
        });
    }

    if (project.styles) {
        function addStyles(styles: Style[]) {
            styles.forEach(style => {
                addObject("Styles", {
                    object: style,
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
                addObject("LVGL Styles", {
                    object: style,
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
            addObject("Bitmaps", {
                object: bitmap,
                name: bitmap.name,
                icon: ProjectEditor.BitmapClass.classInfo.icon!
            });
        });
    }

    if (project.fonts) {
        project.fonts.forEach(font => {
            addObject("Fonts", {
                object: font,
                name: font.name,
                icon: ProjectEditor.FontClass.classInfo.icon!
            });
        });
    }

    if (project.colors) {
        project.colors.forEach(color => {
            addObject("Colors", {
                object: color,
                name: color.name,
                icon: ProjectEditor.ColorClass.classInfo.icon!
            });
        });
    }

    return objects;
}

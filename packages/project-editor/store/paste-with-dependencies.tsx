import React from "react";
import { observer } from "mobx-react";
import {
    action,
    computed,
    IObservableValue,
    makeObservable,
    observable,
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
    SerializedData,
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
    rewireEnd
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
import type { Page } from "project-editor/features/page/page";
import { Project } from "project-editor/project/project";
import { isArray } from "lodash";
import type { ConnectionLine } from "project-editor/flow/connection-line";
import {
    getInputDisplayName,
    getOutputDisplayName
} from "project-editor/flow/helper";

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
    | { kind: "exists-different"; destinationObject: EezObject };

type ConflictResolution =
    | "rename-source"
    | "rename-destination"
    | "replace"
    | "keep";

class PasteObject {
    constructor(public model: PasteWithDependenciesModel, object: EezObject) {
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
        if (this.styleLevel == 0) {
            return this.model.destinationProjectStore.project.styles.find(
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
        }

        return collection;
    }

    conflict: Conflict = { kind: "doesnt-exists" };

    conflictResolution: ConflictResolution = "rename-source";

    conflictResolutionName: string;

    get conflictResolutionError() {
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
                        pasteObject.destinationCollection !=
                        this.destinationCollection
                    ) {
                        return false;
                    }

                    if (pasteObject.conflict.kind != "exists-different") {
                        if (
                            (pasteObject.object as any).name ==
                            this.conflictResolutionName
                        ) {
                            return true;
                        }
                    }

                    return (
                        pasteObject.conflictResolutionName !=
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

class PasteWithDependenciesModel {
    interProjectStore: ProjectStore;
    interProjectStoreFlowFragmentFlow: Page;

    foundObjects = new Map<EezObject, PasteObject>();
    pasteObjects: PasteObject[] = [];

    remaining: number = 0;
    allDependenciesFound: boolean;

    constructor(
        public sourceProjectStore: ProjectStore,
        public destinationProjectStore: ProjectStore,
        public serializedData: SerializedData
    ) {
        this.createInterProjectStore();

        makeObservable(this, {
            pasteObjects: observable,
            allDependenciesFound: observable
        });
    }

    createInterProjectStore() {
        this.interProjectStore = ProjectStore.create({
            type: "project-editor"
        });

        const projectJsonStr = getJSON(this.sourceProjectStore);

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
            projectJson.themes = [
                {
                    name: "default",
                    colors: []
                } as any
            ];
            if (projectJson.lvglStyles) {
                projectJson.lvglStyles.styles = [];
                projectJson.lvglStyles.defaultStyles = {};
            }
        });

        const project = loadProject(this.interProjectStore, projectJson, false);

        this.interProjectStore.setProject(project, "");

        this.interProjectStoreFlowFragmentFlow = createObject<Page>(
            this.interProjectStore,
            {
                name: "$$$FLOW_FRAGMENT$$$",
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

        addObject(
            this.interProjectStore.project.userPages,
            this.interProjectStoreFlowFragmentFlow
        );
    }

    static addObjectToProject(
        projectStore: ProjectStore,
        flow: Flow,
        object: EezObject,
        isLocalVariable: boolean
    ) {
        if (object instanceof ProjectEditor.FlowFragmentClass) {
            ProjectEditor.FlowFragmentClass.paste(
                projectStore,
                flow,
                object,
                flow
            );
        } else if (object instanceof ProjectEditor.VariableClass) {
            if (isLocalVariable) {
                addObject(flow.localVariables, object);
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
            addObject(projectStore.project.lvglStyles, object);
        } else if (object instanceof ProjectEditor.BitmapClass) {
            addObject(projectStore.project.bitmaps, object);
        } else if (object instanceof ProjectEditor.FontClass) {
            addObject(projectStore.project.fonts, object);
        }
    }

    findAllDependencies() {
        if (this.serializedData.object) {
            this.addObject(
                this.serializedData.object,
                this.serializedData.objectParentPath
            );
        } else {
            for (let i = 0; i < this.serializedData.objects!.length; i++) {
                this.addObject(
                    this.serializedData.objects![i],
                    this.serializedData.objectsParentPath![i]
                );
            }
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

        let parentStyleObject: CommonStyle | undefined;
        if (
            object instanceof ProjectEditor.StyleClass ||
            object instanceof ProjectEditor.LVGLStyleClass
        ) {
            const parentObject = getParent(getParent(object));
            if (
                parentObject instanceof ProjectEditor.StyleClass ||
                parentObject instanceof ProjectEditor.LVGLStyleClass
            ) {
                parentStyleObject = parentObject;
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

        pasteObject = new PasteObject(this, clonedObject);

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
            setParent(
                object,
                getObjectFromStringPath(
                    this.sourceProjectStore.project,
                    objectParentPath
                )
            );
            this.searchForDependencies(object);
        } else {
            this.searchForDependencies(clonedObject);
        }

        return pasteObject;
    }

    searchForDependencies(object: EezObject) {
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
        const editorState =
            this.destinationProjectStore.editorsStore.activeEditor?.state;
        if (editorState instanceof ProjectEditor.FlowTabStateClass) {
            return editorState.flow;
        }
        return undefined;
    }

    hasConflict(pasteObject: PasteObject): Conflict {
        if (pasteObject.object instanceof ProjectEditor.FlowFragmentClass) {
            return { kind: "doesnt-exists" };
        }

        if (
            pasteObject.object instanceof ProjectEditor.StyleClass ||
            pasteObject.object instanceof ProjectEditor.LVGLStyleClass
        ) {
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
                        return 6;
                    } else if (object instanceof ProjectEditor.StyleClass) {
                        return 7;
                    } else if (object instanceof ProjectEditor.LVGLStyleClass) {
                        return 8;
                    } else if (object instanceof ProjectEditor.BitmapClass) {
                        return 9;
                    } else if (object instanceof ProjectEditor.FontClass) {
                        return 10;
                    } else {
                        return 11;
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
        // rename source objects
        runInAction(() => {
            for (const pasteObject of this.pasteObjects) {
                if (
                    pasteObject.conflict.kind == "exists-different" &&
                    pasteObject.conflictResolution == "rename-source"
                ) {
                    replaceObjectReference(
                        pasteObject.object,
                        pasteObject.conflictResolutionName
                    );
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

        //
        this.findConflicts();

        this.sortPasteObjects();

        runInAction(() => (this.allDependenciesFound = true));

        // TODO remove this
        this.interProjectStore.filePath = `c:/Users/mvladic/Downloads/interProjectStore.eez-project`;
        this.interProjectStore.save();
    }

    doPaste() {
        this.destinationProjectStore.undoManager.setCombineCommands(true);

        // rename destination objects
        runInAction(() => {
            for (const pasteObject of this.pasteObjects) {
                if (
                    pasteObject.conflict.kind == "exists-different" &&
                    pasteObject.conflictResolution == "rename-source"
                ) {
                    replaceObjectReference(
                        pasteObject.conflict.destinationObject,
                        pasteObject.conflictResolutionName
                    );
                }
            }
        });

        for (const pasteObject of this.pasteObjects) {
            if (pasteObject.conflict.kind == "exists-same") {
                continue;
            }

            if (pasteObject.conflictResolution == "keep") {
                continue;
            }

            const object = pasteObject.object;
            if (object instanceof ProjectEditor.FlowFragmentClass) {
                const editorState =
                    this.destinationProjectStore.editorsStore.activeEditor
                        ?.state;
                if (editorState instanceof ProjectEditor.FlowTabStateClass) {
                    let fromObject;
                    if (editorState.widgetContainer.selectedItems.length == 0) {
                        fromObject = editorState.widgetContainer.object;
                    } else {
                        fromObject =
                            editorState.widgetContainer.selectedItems[0].object;
                    }

                    ProjectEditor.FlowFragmentClass.paste(
                        this.destinationProjectStore,
                        editorState.flow,
                        object,
                        fromObject
                    );
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
                            this.destinationProjectStore.project.lvglStyles;
                    }
                } else if (object instanceof ProjectEditor.BitmapClass) {
                    collection = this.destinationProjectStore.project.bitmaps;
                } else if (object instanceof ProjectEditor.FontClass) {
                    collection = this.destinationProjectStore.project.fonts;
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

export const PasteWithDependenciesDialog = observer(
    class PasteWithDependenciesDialog extends React.Component<{
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
                this.props.pasteWithDependenciesModel.pasteObjects.filter(
                    pasteObject =>
                        pasteObject.conflict.kind == "exists-different"
                );

            return (
                <Dialog
                    modal={false}
                    okButtonText="Paste"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div className="EezStudio_PasteWithDependenciesDialog">
                        {!this.allDependenciesFound && (
                            <div>
                                <div>
                                    <div>Searching for dependencies ...</div>
                                    <Loader />
                                </div>
                            </div>
                        )}
                        {this.allDependenciesFound &&
                            (posteObjectsWithConflicts.length == 0 ? (
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
                                                const object =
                                                    pasteObject.object;

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
                                                                        icon={
                                                                            icon
                                                                        }
                                                                    />
                                                                )}
                                                                {objectType}
                                                            </div>
                                                        </td>

                                                        <td>
                                                            {" "}
                                                            {isFlowFragment
                                                                ? ""
                                                                : getLabel(
                                                                      object
                                                                  )}
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
                            ))}
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
                            value={pasteObject.conflictResolutionName}
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

export function pasteWithDependencies(projectStore: ProjectStore) {
    let serializedData = getProjectEditorDataFromClipboard(projectStore);
    if (!serializedData) {
        return false;
    }

    if (serializedData.originProjectFilePath == projectStore.filePath) {
        return false;
    }

    const projectEditorTab = ProjectEditor.homeTabs?.findProjectEditorTab(
        serializedData.originProjectFilePath,
        false
    );
    if (!projectEditorTab) {
        return false;
    }

    if (!projectEditorTab.projectStore) {
        return false;
    }

    const pasteWithDependenciesModel = new PasteWithDependenciesModel(
        projectEditorTab.projectStore,
        projectStore,
        serializedData
    );

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

        onDispose();
    };

    const [modalDialog] = showDialog(
        <PasteWithDependenciesDialog
            pasteWithDependenciesModel={pasteWithDependenciesModel}
            modalDialog={modalDialogObservable}
            onOk={onOk}
            onCancel={onDispose}
        />,
        {
            jsPanel: {
                id: "paste-with-dependencies-dialog",
                title: "Paste - Resolve Conflicts",
                width: 800,
                height: 600
            }
        }
    );

    modalDialogObservable.set(modalDialog);

    pasteWithDependenciesModel.findAllDependencies();

    return true;
}

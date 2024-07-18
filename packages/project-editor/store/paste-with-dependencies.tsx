import React from "react";
import { observer } from "mobx-react";
import {
    action,
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
    isPropertyHidden,
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
    rewireBegin,
    rewireEnd
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { searchForObjectDependencies } from "project-editor/core/search";
import type { Style } from "project-editor/features/style/style";
import type { Flow } from "project-editor/flow/flow";
import {
    getArrayElementTypeFromType,
    getEnumFromType,
    getStructureFromType
} from "project-editor/features/variable/value-type";
import { USER_WIDGET_ICON } from "project-editor/ui-components/icons";
import type { Page } from "project-editor/features/page/page";
import { Project } from "project-editor/project/project";
import type { LVGLStyle } from "project-editor/lvgl/style";
import { isArray } from "lodash";

////////////////////////////////////////////////////////////////////////////////

type Conflict =
    | { kind: "doesnt-exists" }
    | { kind: "exists-same" }
    | { kind: "exists-different" };

type ConflictResolution =
    | { kind: "rename-source"; newName: string }
    | { kind: "rename-destination"; newName: string }
    | { kind: "replace" }
    | { kind: "keep" };

class PasteObject {
    constructor(object: EezObject) {
        this.object = object;

        if (object instanceof ProjectEditor.VariableClass) {
            this.isLocalVariable =
                getAncestorOfType(object, ProjectEditor.FlowClass.classInfo) !=
                undefined;
        }

        makeObservable(this, {
            enabled: observable
        });
    }

    object: EezObject;
    isLocalVariable: boolean = false;
    styleLevel: number = 0;
    enabled: boolean = true;
    conflict: Conflict = { kind: "doesnt-exists" };
    conflictResolution: ConflictResolution;
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

        let parentStyleObject: Style | LVGLStyle | undefined;

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

        let clonedObject: EezObject;
        if (objectParentPath) {
            const clonedObjectTemp = cloneObjectWithoutNewObjIds(
                this.interProjectStore,
                object
            );

            if (!parentStyleObject) {
                PasteWithDependenciesModel.addObjectToProject(
                    this.interProjectStore,
                    this.interProjectStoreFlowFragmentFlow,
                    clonedObjectTemp,
                    false
                );
            }

            clonedObject = object;

            setParent(
                object,
                getObjectFromStringPath(
                    this.sourceProjectStore.project,
                    objectParentPath
                )
            );
        } else {
            clonedObject = cloneObjectWithoutNewObjIds(
                this.interProjectStore,
                object
            );

            if (!parentStyleObject) {
                PasteWithDependenciesModel.addObjectToProject(
                    this.interProjectStore,
                    this.interProjectStoreFlowFragmentFlow,
                    clonedObject,
                    false
                );
            }

            if (
                clonedObject instanceof ProjectEditor.StyleClass ||
                clonedObject instanceof ProjectEditor.LVGLStyleClass
            ) {
                clonedObject.childStyles = [];
            }
        }

        pasteObject = new PasteObject(clonedObject);

        runInAction(() => {
            this.foundObjects.set(object, pasteObject);
            this.pasteObjects.push(pasteObject);
            this.remaining++;
        });

        if (parentStyleObject) {
            let parentPasteObject = this.addObject(parentStyleObject);

            (parentPasteObject.object as Style).childStyles.push(
                pasteObject.object as Style
            );

            pasteObject.styleLevel = parentPasteObject.styleLevel + 1;
        }

        this.searchForDependencies(object);

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

    finalize() {
        rewireBegin();
        const clonedObjects = this.pasteObjects.map(pasteObject =>
            cloneObjectWithNewObjIds(
                this.destinationProjectStore,
                pasteObject.object
            )
        );
        rewireEnd(clonedObjects);

        this.pasteObjects.forEach((pasteObject, i) => {
            pasteObject.object = clonedObjects[i];
        });

        this.pasteObjects.forEach(pasteObject => {
            runInAction(() => {
                pasteObject.conflict = this.hasConflict(pasteObject);
            });
        });

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
                    (a.object instanceof ProjectEditor.StyleClass &&
                        b.object instanceof ProjectEditor.StyleClass) ||
                    (a.object instanceof ProjectEditor.LVGLStyleClass &&
                        b.object instanceof ProjectEditor.LVGLStyleClass)
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

        runInAction(() => (this.allDependenciesFound = true));

        // TODO remove this
        this.interProjectStore.filePath = `interProjectStore.eez-project`;
        this.interProjectStore.save();
    }

    hasConflict(pasteObject: PasteObject): Conflict {
        if (pasteObject.object instanceof ProjectEditor.FlowFragmentClass) {
            return { kind: "doesnt-exists" };
        }

        let collection:
            | ({
                  name: string;
              } & IEezObject)[]
            | undefined;

        if (pasteObject.object instanceof ProjectEditor.VariableClass) {
            if (pasteObject.isLocalVariable) {
                const destinationFlow = this.destinationFlow;
                if (destinationFlow) {
                    collection = destinationFlow.localVariables;
                }
            } else {
                collection =
                    this.destinationProjectStore.project.variables
                        .globalVariables;
            }
        } else if (pasteObject.object instanceof ProjectEditor.StructureClass) {
            collection =
                this.destinationProjectStore.project.variables.structures;
        } else if (pasteObject.object instanceof ProjectEditor.EnumClass) {
            collection = this.destinationProjectStore.project.variables.enums;
        } else if (pasteObject.object instanceof ProjectEditor.ActionClass) {
            collection = this.destinationProjectStore.project.actions;
        } else if (pasteObject.object instanceof ProjectEditor.PageClass) {
            const page = pasteObject.object;
            if (page.isUsedAsUserWidget) {
                collection = this.destinationProjectStore.project.userWidgets;
            } else {
                collection = this.destinationProjectStore.project.userPages;
            }
        } else if (pasteObject.object instanceof ProjectEditor.BitmapClass) {
            collection = this.destinationProjectStore.project.bitmaps;
        } else if (pasteObject.object instanceof ProjectEditor.FontClass) {
            collection = this.destinationProjectStore.project.fonts;
        }

        if (!collection) {
            return { kind: "doesnt-exists" };
        }

        const destinationObject = collection.find(
            destinationObject =>
                destinationObject.name == (pasteObject.object as any).name
        );

        if (!destinationObject) {
            return { kind: "doesnt-exists" };
        }

        if (this.compareObjects(destinationObject, pasteObject.object)) {
            return { kind: "exists-same" };
        }

        return { kind: "exists-different" };
    }

    compareObjects(
        existingObject: IEezObject | undefined,
        newObject: IEezObject | undefined
    ) {
        if (!existingObject) {
            return newObject ? false : true;
        }

        if (!newObject) {
            return false;
        }

        const classInfo = getClassInfo(existingObject);

        if (isArray(existingObject) || isArray(newObject)) {
            if (!isArray(existingObject) || !isArray(newObject)) {
                return false;
            }

            if (existingObject.length != newObject.length) {
                return false;
            }

            for (let i = 0; i < existingObject.length; i++) {
                if (!this.compareObjects(existingObject[i], newObject[i])) {
                    return false;
                }
            }
        } else {
            for (const propertyInfo of classInfo.properties) {
                if (!isPropertyHidden(existingObject, propertyInfo)) {
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
                            return false;
                        }
                    } else if (
                        (existingObject as any)[propertyInfo.name] !=
                        (newObject as any)[propertyInfo.name]
                    ) {
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

    doPaste() {
        this.destinationProjectStore.undoManager.setCombineCommands(true);

        for (const pasteObject of this.pasteObjects) {
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
            } else if (object instanceof ProjectEditor.BitmapClass) {
                addObject(this.destinationProjectStore.project.bitmaps, object);
            } else if (object instanceof ProjectEditor.StyleClass) {
                if (pasteObject.styleLevel == 0) {
                    addObject(
                        this.destinationProjectStore.project.styles,
                        object
                    );
                }
            } else if (object instanceof ProjectEditor.VariableClass) {
                if (pasteObject.isLocalVariable) {
                    if (this.destinationFlow) {
                        addObject(this.destinationFlow.localVariables, object);
                    }
                } else {
                    addObject(
                        this.destinationProjectStore.project.variables
                            .globalVariables,
                        object
                    );
                }
            } else if (object instanceof ProjectEditor.EnumClass) {
                addObject(
                    this.destinationProjectStore.project.variables.enums,
                    object
                );
            } else if (object instanceof ProjectEditor.StructureClass) {
                addObject(
                    this.destinationProjectStore.project.variables.structures,
                    object
                );
            } else if (object instanceof ProjectEditor.PageClass) {
                if (object.isUsedAsUserWidget) {
                    addObject(
                        this.destinationProjectStore.project.userWidgets,
                        object
                    );
                } else {
                    addObject(
                        this.destinationProjectStore.project.userPages,
                        object
                    );
                }
            } else if (object instanceof ProjectEditor.ActionClass) {
                addObject(this.destinationProjectStore.project.actions, object);
            } else if (object instanceof ProjectEditor.BitmapClass) {
                addObject(this.destinationProjectStore.project.bitmaps, object);
            } else if (object instanceof ProjectEditor.FontClass) {
                addObject(this.destinationProjectStore.project.fonts, object);
            }
        }

        this.destinationProjectStore.undoManager.setCombineCommands(false);
    }

    get allEnabled() {
        return !this.pasteObjects.find(pasteObject => !pasteObject.enabled);
    }

    get allDisabled() {
        return !this.pasteObjects.find(pasteObject => pasteObject.enabled);
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

        updateIndeterminate() {
            if (this.enableAllCheckboxRef.current) {
                this.enableAllCheckboxRef.current.indeterminate =
                    !this.props.pasteWithDependenciesModel.allEnabled &&
                    !this.props.pasteWithDependenciesModel.allDisabled;
            }
        }

        componentDidMount() {
            this.updateIndeterminate();
        }

        componentDidUpdate() {
            this.updateIndeterminate();
        }

        onOkEnabled = () => {
            return (
                this.allDependenciesFound &&
                !this.props.pasteWithDependenciesModel.allDisabled
            );
        };

        onOk = () => {
            this.props.onOk();
        };

        onChangeEnableAllCheckbox = (
            event: React.ChangeEvent<HTMLInputElement>
        ) => {
            runInAction(() => {
                this.props.pasteWithDependenciesModel.pasteObjects.forEach(
                    pasteObject => (pasteObject.enabled = event.target.checked)
                );
            });
        };

        render() {
            const pasteWithDependenciesModel =
                this.props.pasteWithDependenciesModel;
            const objects = this.props.pasteWithDependenciesModel.pasteObjects;

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
                        {this.allDependenciesFound && (
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            {this.allDependenciesFound && (
                                                <input
                                                    ref={
                                                        this
                                                            .enableAllCheckboxRef
                                                    }
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    checked={
                                                        pasteWithDependenciesModel.allEnabled
                                                    }
                                                    onChange={
                                                        this
                                                            .onChangeEnableAllCheckbox
                                                    }
                                                ></input>
                                            )}
                                        </th>
                                        <th>Object Type</th>
                                        <th>Object Name</th>
                                        <th>Conflict Resolution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {objects.map(pasteObject => {
                                        const object = pasteObject.object;

                                        const classInfo = getClassInfo(object);

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
                                                    {this
                                                        .allDependenciesFound && (
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            checked={
                                                                pasteObject.enabled
                                                            }
                                                            onChange={action(
                                                                event =>
                                                                    (pasteObject.enabled =
                                                                        event.target.checked)
                                                            )}
                                                        ></input>
                                                    )}
                                                </td>

                                                <td>
                                                    <div
                                                        style={{
                                                            paddingLeft:
                                                                pasteObject.styleLevel *
                                                                10
                                                        }}
                                                    >
                                                        {icon && (
                                                            <Icon icon={icon} />
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
                                    })}
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
            }

            return (
                <select>
                    <option>Rename source</option>
                    <option>Rename destination</option>
                    <option>Replace</option>
                    <option>Keep</option>
                </select>
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
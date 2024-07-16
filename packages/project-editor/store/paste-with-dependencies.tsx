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
    SerializedData,
    setParent
} from "project-editor/core/object";
import {
    cloneObjectWithNewObjIds,
    getProjectEditorDataFromClipboard
} from "project-editor/store/clipboard";
import {
    addObject,
    getAncestorOfType,
    getClass,
    getClassInfo,
    getLabel,
    getObjectFromPath,
    getObjectFromStringPath,
    type ProjectStore
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

////////////////////////////////////////////////////////////////////////////////

interface ObjectReference {
    inObject: EezObject;
    inPropertyName: string;
    fromIndex: number;
    toIndex: number;
}

interface ObjectsMapValue {
    clonedObject: EezObject;
    references: ObjectReference[];

    enabled: boolean;
}

class PasteWithDependenciesModel {
    objects = new Map<EezObject, ObjectsMapValue>();
    remaining: number = 0;

    constructor(
        public sourceProjectStore: ProjectStore,
        public destinationProjectStore: ProjectStore,
        public serializedData: SerializedData
    ) {
        makeObservable(this, {
            objects: observable,
            remaining: observable
        });
    }

    async findAllDependencies() {
        if (this.serializedData.object) {
            this.findObjectDependencies(
                this.serializedData.object,
                this.serializedData.objectParentPath
            );
        } else {
            for (let i = 0; i < this.serializedData.objects!.length; i++) {
                this.findObjectDependencies(
                    this.serializedData.objects![i],
                    this.serializedData.objectsParentPath![i]
                );
            }
        }
    }

    findObjectDependencies(
        object: EezObject,
        objectParentPath?: string,
        reference?: ObjectReference
    ) {
        let objectsMapValue = this.objects.get(object);
        if (objectsMapValue) {
            if (reference) {
                objectsMapValue.references.push(reference);
            }
            return objectsMapValue;
        }

        let clonedObject: EezObject;
        if (objectParentPath) {
            clonedObject = object;
            setParent(
                object,
                getObjectFromStringPath(
                    this.sourceProjectStore.project,
                    objectParentPath
                )
            );
        } else {
            clonedObject = cloneObjectWithNewObjIds(
                this.destinationProjectStore,
                object
            );

            if (
                clonedObject instanceof ProjectEditor.StyleClass ||
                clonedObject instanceof ProjectEditor.LVGLStyleClass
            ) {
                clonedObject.childStyles = [];
            }
        }

        objectsMapValue = {
            clonedObject,
            references: reference ? [reference] : [],
            enabled: true
        };

        runInAction(() => {
            this.objects.set(object, objectsMapValue);
            this.remaining++;
        });

        if (
            object instanceof ProjectEditor.StyleClass ||
            object instanceof ProjectEditor.LVGLStyleClass
        ) {
            if (object.parentStyle) {
                let parentObjectMapValue = this.findObjectDependencies(
                    object.parentStyle
                );

                runInAction(() => {
                    (
                        parentObjectMapValue.clonedObject as Style
                    ).childStyles.push(objectsMapValue.clonedObject as Style);
                });

                setParent(
                    objectsMapValue.clonedObject,
                    parentObjectMapValue.clonedObject
                );
            }
        }

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
                    setTimeout(
                        action(() => this.remaining--),
                        250
                    );
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
                            this.findObjectDependencies(
                                referencedObject,
                                undefined,
                                {
                                    inObject: getParent(
                                        dependency.valueObject
                                    ) as EezObject,
                                    inPropertyName:
                                        dependency.valueObject.propertyInfo
                                            .name,
                                    fromIndex: 0,
                                    toIndex: name.length
                                }
                            );
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
                                    this.findObjectDependencies(
                                        localVariable,
                                        undefined,
                                        {
                                            inObject: getParent(
                                                dependency.valueObject
                                            ) as EezObject,
                                            inPropertyName:
                                                dependency.valueObject
                                                    .propertyInfo.name,
                                            fromIndex:
                                                node.location.start.offset,
                                            toIndex: node.location.end.offset
                                        }
                                    );
                                }
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
                            this.findObjectDependencies(enumType, undefined, {
                                inObject: getParent(
                                    dependency.valueObject
                                ) as EezObject,
                                inPropertyName:
                                    dependency.valueObject.propertyInfo.name,
                                fromIndex: fromIndex + "enum:".length,
                                toIndex: dependency.valueObject.value.length
                            });
                        }

                        const structure = getStructureFromType(
                            this.sourceProjectStore.project,
                            variableType
                        );
                        if (structure instanceof ProjectEditor.StructureClass) {
                            this.findObjectDependencies(structure, undefined, {
                                inObject: getParent(
                                    dependency.valueObject
                                ) as EezObject,
                                inPropertyName:
                                    dependency.valueObject.propertyInfo.name,
                                fromIndex: fromIndex + "struct:".length,
                                toIndex: dependency.valueObject.value.length
                            });
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

        return objectsMapValue;
    }

    doPaste() {
        this.destinationProjectStore.undoManager.setCombineCommands(true);

        for (const objectsMapValue of this.objects.values()) {
            const object = objectsMapValue.clonedObject;
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
                if (getParent(object) == undefined) {
                    addObject(
                        this.destinationProjectStore.project.styles,
                        object
                    );
                }
            }
        }

        this.destinationProjectStore.undoManager.setCombineCommands(false);
    }

    get allEnabled() {
        return ![...this.objects.values()].find(
            objectsMapValue => !objectsMapValue.enabled
        );
    }

    get allDisabled() {
        return ![...this.objects.values()].find(
            objectsMapValue => objectsMapValue.enabled
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export const PasteWithDependenciesDialog = observer(
    class NewProjectWizard extends React.Component<{
        pasteWithDependenciesModel: PasteWithDependenciesModel;
        modalDialog: IObservableValue<any>;
        onOk: () => void;
        onCancel: () => void;
    }> {
        enableAllCheckboxRef = React.createRef<HTMLInputElement>();

        get allDependenciesFound() {
            return this.props.pasteWithDependenciesModel.remaining == 0;
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
                this.props.pasteWithDependenciesModel.remaining == 0 &&
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
                this.props.pasteWithDependenciesModel.objects.forEach(
                    objectsMapValue =>
                        (objectsMapValue.enabled = event.target.checked)
                );
            });
        };

        render() {
            const pasteWithDependenciesModel =
                this.props.pasteWithDependenciesModel;
            const objects = this.props.pasteWithDependenciesModel.objects;

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
                                        <th></th>
                                        <th>Conflict Resolution</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...objects.keys()].map(object => {
                                        const objectsMapValue =
                                            objects.get(object)!;

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

                                        return (
                                            <tr key={object.objID}>
                                                <td>
                                                    {this
                                                        .allDependenciesFound && (
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            checked={
                                                                objectsMapValue.enabled
                                                            }
                                                            onChange={action(
                                                                event =>
                                                                    (objectsMapValue.enabled =
                                                                        event.target.checked)
                                                            )}
                                                        ></input>
                                                    )}
                                                </td>

                                                <td>
                                                    {icon && (
                                                        <Icon icon={icon} />
                                                    )}
                                                    {isUserWidget
                                                        ? "User Widget"
                                                        : isFlowFragment
                                                        ? "Flow Fragment"
                                                        : getClass(object).name}
                                                </td>

                                                <td>
                                                    {" "}
                                                    {isFlowFragment
                                                        ? ""
                                                        : getLabel(object)}
                                                </td>

                                                <td>
                                                    {objectsMapValue.references.map(
                                                        (reference, i) => (
                                                            <div key={i}>
                                                                <div>
                                                                    inPropertyName:{" "}
                                                                    {
                                                                        reference.inPropertyName
                                                                    }
                                                                </div>
                                                                <div>
                                                                    value:{" "}
                                                                    {
                                                                        (
                                                                            reference.inObject as any
                                                                        )[
                                                                            reference
                                                                                .inPropertyName
                                                                        ]
                                                                    }
                                                                </div>
                                                                <div>
                                                                    fromIndex:{" "}
                                                                    {
                                                                        reference.fromIndex
                                                                    }
                                                                </div>
                                                                <div>
                                                                    toIndex:{" "}
                                                                    {
                                                                        reference.toIndex
                                                                    }
                                                                </div>
                                                            </div>
                                                        )
                                                    )}
                                                </td>

                                                <td>
                                                    <select>
                                                        <option>
                                                            Rename source
                                                        </option>
                                                        <option>
                                                            Rename destination
                                                        </option>
                                                        <option>Replace</option>
                                                        <option>Keep</option>
                                                    </select>
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
                title: "Paste",
                width: 800,
                height: 600
            }
        }
    );

    modalDialogObservable.set(modalDialog);

    pasteWithDependenciesModel.findAllDependencies();

    return true;
}

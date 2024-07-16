import React from "react";
import { observer } from "mobx-react";
import {
    IObservableValue,
    makeObservable,
    observable,
    runInAction
} from "mobx";

import { Dialog, showDialog } from "eez-studio-ui/dialog";

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
    getLabel,
    getObjectFromPath,
    getObjectFromStringPath,
    type ProjectStore
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { searchForObjectDependencies } from "project-editor/core/search";
import type { Style } from "project-editor/features/style/style";
import { Loader } from "eez-studio-ui/loader";
import type { Flow } from "project-editor/flow/flow";
import {
    getArrayElementTypeFromType,
    getEnumFromType,
    getStructureFromType
} from "project-editor/features/variable/value-type";

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
}

class DeepPasteModel {
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
            references: reference ? [reference] : []
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
                    runInAction(() => {
                        this.remaining--;
                    });
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
}

////////////////////////////////////////////////////////////////////////////////

export const DeepPasteDialog = observer(
    class NewProjectWizard extends React.Component<{
        deepPasteModel: DeepPasteModel;
        modalDialog: IObservableValue<any>;
        onOk: () => void;
        onCancel: () => void;
    }> {
        onOkEnabled = () => {
            return this.props.deepPasteModel.remaining == 0;
        };

        onOk = () => {
            this.props.onOk();
        };

        render() {
            const objects = this.props.deepPasteModel.objects;

            return (
                <Dialog
                    modal={false}
                    okButtonText="Paste"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div>
                        {this.props.deepPasteModel.remaining > 0 && (
                            <div>
                                <div>Searching for dependencies ...</div>
                                <Loader />
                            </div>
                        )}
                        <div>
                            {[...objects.keys()].map(object => {
                                const objectsMapValue = objects.get(object)!;

                                return (
                                    <div key={object.objID}>
                                        {getClass(object).name}:{" "}
                                        {getLabel(object)}
                                        <div style={{ marginLeft: 20 }}>
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
                                                            {reference.toIndex}
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Dialog>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function deepPaste(projectStore: ProjectStore) {
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

    const deepPasteModel = new DeepPasteModel(
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
        deepPasteModel.doPaste();

        onDispose();
    };

    const [modalDialog] = showDialog(
        <DeepPasteDialog
            deepPasteModel={deepPasteModel}
            modalDialog={modalDialogObservable}
            onOk={onOk}
            onCancel={onDispose}
        />,
        {
            jsPanel: {
                id: "deep-paste",
                title: "Deep Paste",
                width: 800,
                height: 600
            }
        }
    );

    modalDialogObservable.set(modalDialog);

    deepPasteModel.findAllDependencies();

    return true;
}

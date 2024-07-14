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
    copyProjectEditorDataToClipboard,
    getProjectEditorDataFromClipboard,
    objectsToClipboardData
} from "project-editor/store/clipboard";
import {
    getLabel,
    getObjectFromPath,
    type ProjectStore
} from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { searchForObjectDependencies } from "project-editor/core/search";

////////////////////////////////////////////////////////////////////////////////

interface ObjectReference {
    inObject: EezObject;
    inPropertyName: string;
    fromIndex: number;
    toIndex: number;
}

class DeepPasteModel {
    objects = new Map<EezObject, ObjectReference[]>();

    constructor(
        public sourceProjectStore: ProjectStore,
        public destinationProjectStore: ProjectStore,
        public serializedData: SerializedData
    ) {
        makeObservable(this, {
            objects: observable
        });
    }

    async findAllDependencies() {
        if (this.serializedData.object) {
            this.findObjectDependencies(this.serializedData.object);
        } else {
            for (const object of this.serializedData.objects!) {
                this.findObjectDependencies(object);
            }
        }
    }

    findObjectDependencies(object: EezObject, reference?: ObjectReference) {
        let references = this.objects.get(object);
        if (references) {
            if (reference) {
                references.push(reference);
            }
            return;
        }

        runInAction(() => {
            this.objects.set(object, reference ? [reference] : []);
        });

        setParent(object, this.sourceProjectStore.project);

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
                            }
                        }

                        const referencedObject =
                            collection &&
                            collection.find(
                                object => name == getProperty(object, "name")
                            );
                        if (referencedObject) {
                            this.findObjectDependencies(referencedObject, {
                                inObject: getParent(
                                    dependency.valueObject
                                ) as EezObject,
                                inPropertyName:
                                    dependency.valueObject.propertyInfo.name,
                                fromIndex: 0,
                                toIndex: name.length
                            });
                        }
                    }
                }
            }
        }, 0);
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
            return true;
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
                        {[...objects.keys()].map(object => {
                            // const references = objects.get(object)!;

                            return (
                                <div key={object.objID}>{getLabel(object)}</div>
                            );
                        })}
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
        copyProjectEditorDataToClipboard(
            objectsToClipboardData(deepPasteModel.sourceProjectStore, [
                ...deepPasteModel.objects.keys()
            ])
        );

        deepPasteModel.destinationProjectStore.paste();

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

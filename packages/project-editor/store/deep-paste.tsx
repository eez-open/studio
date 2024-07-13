import React from "react";
import { observer } from "mobx-react";

import { showDialog } from "eez-studio-ui/dialog";

import {
    EezObject,
    getParent,
    SerializedData
} from "project-editor/core/object";
import {
    isPropertySearchable,
    visitWithPause
} from "project-editor/core/search";
import { getProjectEditorDataFromClipboard } from "project-editor/store/clipboard";
import type { ProjectStore } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IObservableValue, observable } from "mobx";

////////////////////////////////////////////////////////////////////////////////

interface ObjectDependency {
    reference: {
        object: EezObject;
        propertyName: string;
        startIndex: number;
        endIndex: number;
    };
    referencedObject: EezObject;
}

export function* getObjectDependencies(
    object: EezObject
): IterableIterator<ObjectDependency> {
    const result: ObjectDependency[] = [];

    const v = visitWithPause(object);

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        let valueObject = visitResult.value;
        if (valueObject) {
            if (
                !isPropertySearchable(
                    getParent(valueObject),
                    valueObject.propertyInfo
                ) ||
                !valueObject.value
            ) {
                continue;
            }

            let flowProperty;
            if (valueObject.propertyInfo.flowProperty) {
                if (typeof valueObject.propertyInfo.flowProperty == "string") {
                    flowProperty = valueObject.propertyInfo.flowProperty;
                } else {
                    flowProperty =
                        valueObject.propertyInfo.flowProperty(object);
                }
            }

            console.log(flowProperty);
        }
    }

    return result;
}

////////////////////////////////////////////////////////////////////////////////

class DeepPasteModel {
    constructor(serializedData: SerializedData) {}
}

////////////////////////////////////////////////////////////////////////////////

export const DeepPasteDialog = observer(
    class NewProjectWizard extends React.Component<{
        deepPasteModel: DeepPasteModel;
        modalDialog: IObservableValue<any>;
    }> {
        render() {
            return <div className="EezStudio_DeepPasteDialog"></div>;
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

    const deepPasteModel = new DeepPasteModel(serializedData);

    const modalDialogObservable = observable.box<any>();

    const [modalDialog] = showDialog(
        <DeepPasteDialog
            deepPasteModel={deepPasteModel}
            modalDialog={modalDialogObservable}
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

    return true;
}

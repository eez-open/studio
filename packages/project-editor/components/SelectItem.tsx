import React from "react";
import { observer } from "mobx-react";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { styled } from "eez-studio-ui/styled-components";

import {
    EezObject,
    PropertyInfo,
    getProperty,
    PropertyType,
    getObjectFromPath,
    IOnSelectParams,
    getClassInfo
} from "project-editor/core/object";
import {
    ProjectStore,
    SimpleNavigationStoreClass,
    INavigationStore
} from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";

import { Widget } from "project-editor/features/gui/widget";
import { Glyph } from "project-editor/features/gui/font";

////////////////////////////////////////////////////////////////////////////////

const SelectItemDialogDiv = styled.div`
    flex-grow: 1;
    display: flex;
`;

@observer
class SelectItemDialog extends React.Component<{
    navigationStore: INavigationStore;
    dragAndDropManager: DragAndDropManagerClass;
    collectionObject: EezObject;
    okDisabled: () => boolean;
    onOk: () => boolean;
    onCancel: () => void;
}> {
    render() {
        const {
            navigationStore,
            dragAndDropManager,
            collectionObject,
            okDisabled,
            onOk,
            onCancel
        } = this.props;

        let NavigationComponent = getClassInfo(collectionObject).navigationComponent!;

        return (
            <Dialog
                modal={false}
                okButtonText="Select"
                okDisabled={okDisabled}
                onOk={onOk}
                onCancel={onCancel}
            >
                <SelectItemDialogDiv>
                    <NavigationComponent
                        id={getClassInfo(collectionObject!).navigationComponentId! + "-dialog"}
                        navigationObject={collectionObject}
                        navigationStore={navigationStore}
                        dragAndDropManager={dragAndDropManager}
                        onDoubleClickItem={onOk}
                    />
                </SelectItemDialogDiv>
            </Dialog>
        );
    }
}

export async function onSelectItem(
    object: EezObject,
    propertyInfo: PropertyInfo,
    opts: {
        title: string;
        width: number;
    },
    params?: IOnSelectParams
) {
    return new Promise<{
        [propertyName: string]: string;
    }>((resolve, reject) => {
        const collectionObject =
            propertyInfo.type === PropertyType.String
                ? getObjectFromPath(ProjectStore.project, ["gui", "fonts"])
                : getObjectFromPath(
                      ProjectStore.project,
                      propertyInfo.referencedObjectCollectionPath!
                  );

        const navigationStore = new SimpleNavigationStoreClass(
            getClassInfo(collectionObject!).findItemByName!(
                propertyInfo.type === PropertyType.String
                    ? (object as Widget).style.fontName
                    : getProperty(object, propertyInfo.name)
            )
        );

        const dragAndDropManager = new DragAndDropManagerClass();

        const onOkDisabled = () => {
            if (propertyInfo.type === PropertyType.String) {
                return !(navigationStore.selectedObject instanceof Glyph);
            }

            return !navigationStore.selectedObject;
        };

        const onOk = () => {
            if (!navigationStore.selectedObject) {
                return false;
            }

            let value;

            if (propertyInfo.type === PropertyType.String) {
                const glyphCode = `\\u${(navigationStore.selectedObject as Glyph).encoding
                    .toString(16)
                    .padStart(4, "0")}`;

                if (
                    params &&
                    params.textInputSelection &&
                    params.textInputSelection.start != null &&
                    params.textInputSelection.end != null
                ) {
                    const existingValue: string = getProperty(object, propertyInfo.name);
                    value =
                        existingValue.substring(0, params.textInputSelection.start) +
                        glyphCode +
                        existingValue.substring(params.textInputSelection.end);
                } else {
                    value = glyphCode;
                }
            } else {
                value = (navigationStore.selectedObject! as any).name;
            }

            resolve({
                [propertyInfo.name]: value
            });

            modalDialog.close();

            return true;
        };

        const onCancel = () => {
            modalDialog.close();
        };

        const modalDialog = showDialog(
            <SelectItemDialog
                collectionObject={collectionObject}
                navigationStore={navigationStore}
                dragAndDropManager={dragAndDropManager}
                okDisabled={onOkDisabled}
                onOk={onOk}
                onCancel={onCancel}
            />,
            {
                jsPanel: Object.assign({}, opts)
            }
        );
    });
}

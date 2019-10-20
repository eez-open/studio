import React from "react";
import { observer } from "mobx-react";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { styled } from "eez-studio-ui/styled-components";

import {
    EezObject,
    PropertyInfo,
    getProperty,
    getObjectFromPath
} from "project-editor/core/object";
import {
    ProjectStore,
    SimpleNavigationStoreClass,
    INavigationStore
} from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";

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

        let NavigationComponent = collectionObject._classInfo.navigationComponent!;

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
                        id={collectionObject!._classInfo.navigationComponentId!}
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
    }
) {
    return new Promise<{
        [propertyName: string]: string;
    }>((resolve, reject) => {
        const collectionObject = getObjectFromPath(
            ProjectStore.project,
            propertyInfo.referencedObjectCollectionPath!
        );

        const navigationStore = new SimpleNavigationStoreClass(
            collectionObject!._classInfo.findItemByName!(getProperty(object, propertyInfo.name))
        );

        const dragAndDropManager = new DragAndDropManagerClass();

        const onOk = () => {
            if (!navigationStore.selectedObject) {
                return false;
            }
            resolve({
                [propertyInfo.name]: (navigationStore.selectedObject! as any).name
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
                okDisabled={() => !navigationStore.selectedObject}
                onOk={onOk}
                onCancel={onCancel}
            />,
            {
                jsPanel: Object.assign({}, opts)
            }
        );
    });
}

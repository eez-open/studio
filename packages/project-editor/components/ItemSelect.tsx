import React from "react";
import { observable, IObservableValue, action } from "mobx";
import { observer } from "mobx-react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
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

////////////////////////////////////////////////////////////////////////////////

const ItemSelectDialogDiv = styled.div`
    display: flex;
    height: 500px;
    border: 1px solid ${props => props.theme.borderColor};
`;

@observer
class ItemSelectDialog extends React.Component<{
    open: IObservableValue<boolean>;
    navigationStore: INavigationStore;
    collectionObject: EezObject;
    okDisabled: () => boolean;
    onOk: () => boolean;
    onCancel: () => void;
}> {
    render() {
        const { navigationStore, collectionObject, okDisabled, onOk, onCancel } = this.props;

        let NavigationComponent = collectionObject._classInfo.navigationComponent!;

        return (
            <Dialog
                open={this.props.open.get()}
                size="large"
                okButtonText="Select"
                okDisabled={okDisabled}
                onOk={onOk}
                onCancel={onCancel}
            >
                <ItemSelectDialogDiv>
                    <NavigationComponent
                        id={collectionObject!._classInfo.navigationComponentId!}
                        navigationObject={collectionObject}
                        navigationStore={navigationStore}
                        onDoubleClickItem={onOk}
                    />
                </ItemSelectDialogDiv>
            </Dialog>
        );
    }
}

export async function onSelectItem(object: EezObject, propertyInfo: PropertyInfo) {
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

        const open = observable.box(true);

        const onOk = action(() => {
            if (!navigationStore.selectedObject) {
                return false;
            }
            resolve({
                [propertyInfo.name]: (navigationStore.selectedObject! as any).name
            });
            open.set(false);
            return true;
        });

        showDialog(
            <ItemSelectDialog
                open={open}
                collectionObject={collectionObject}
                navigationStore={navigationStore}
                okDisabled={() => !navigationStore.selectedObject}
                onOk={onOk}
                onCancel={reject}
            />
        );
    });
}

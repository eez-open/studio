import React from "react";
import ReactDOM from "react-dom";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { PropertyList, BooleanProperty } from "eez-studio-ui/properties";
import { styled } from "eez-studio-ui/styled-components";

import {
    IEezObject,
    PropertyInfo,
    getProperty,
    PropertyType,
    getObjectFromPath,
    IOnSelectParams,
    getClassInfo,
    getClass
} from "project-editor/core/object";
import { loadObject, objectToJS } from "project-editor/core/serialization";
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
    object: IEezObject;
    propertyInfo: PropertyInfo;
    okDisabled: (navigationStore: INavigationStore) => boolean;
    onOk: (navigationStore: INavigationStore) => boolean;
    onCancel: () => void;
}> {
    @observable showOnlyLocalAssets = false;

    @computed
    get hasImportedProjects() {
        return ProjectStore.project.settings.general.imports.length > 0;
    }

    @computed
    get collectionPath() {
        const { propertyInfo } = this.props;
        return propertyInfo.type === PropertyType.String
            ? "gui/fonts"
            : propertyInfo.referencedObjectCollectionPath!;
    }

    @computed
    get collectionObject() {
        const collectionObject = getObjectFromPath(
            ProjectStore.project,
            this.collectionPath.split("/")
        );
        if (this.showOnlyLocalAssets || !this.hasImportedProjects) {
            return collectionObject;
        } else {
            return loadObject(
                ProjectStore.project,
                objectToJS(ProjectStore.project.getAllObjectsOfType(this.collectionPath)),
                getClass(collectionObject),
                "_all_" + this.collectionPath.split("/").slice(-1)[0]
            );
        }
    }

    @computed
    get navigationStore() {
        const { object, propertyInfo } = this.props;
        return new SimpleNavigationStoreClass(
            (this.collectionObject as IEezObject[]).find(
                item =>
                    (item as any).name ===
                    (propertyInfo.type === PropertyType.String
                        ? (object as Widget).style.fontName
                        : getProperty(object, propertyInfo.name))
            )
        );
    }

    @computed
    get dragAndDropManager() {
        return new DragAndDropManagerClass();
    }

    render() {
        const { okDisabled, onOk, onCancel } = this.props;

        let NavigationComponent = getClassInfo(this.collectionObject).navigationComponent!;

        return (
            <Dialog
                modal={false}
                okButtonText="Select"
                okDisabled={() => okDisabled(this.navigationStore)}
                onOk={() => onOk(this.navigationStore)}
                onCancel={onCancel}
                additionalFooterControl={
                    this.hasImportedProjects && (
                        <PropertyList>
                            <BooleanProperty
                                name={`Show only local ${this.collectionPath
                                    .split("/")
                                    .slice(-1)[0]
                                    .toLowerCase()}`}
                                value={this.showOnlyLocalAssets}
                                onChange={action(value => (this.showOnlyLocalAssets = value))}
                            />
                        </PropertyList>
                    )
                }
            >
                <SelectItemDialogDiv>
                    <NavigationComponent
                        id={getClassInfo(this.collectionObject!).navigationComponentId! + "-dialog"}
                        navigationObject={this.collectionObject}
                        navigationStore={this.navigationStore}
                        dragAndDropManager={this.dragAndDropManager}
                        onDoubleClickItem={onOk}
                    />
                </SelectItemDialogDiv>
            </Dialog>
        );
    }
}

export async function onSelectItem(
    object: IEezObject,
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
        const onOkDisabled = (navigationStore: INavigationStore) => {
            if (propertyInfo.type === PropertyType.String) {
                return !(navigationStore.selectedObject instanceof Glyph);
            }

            return !navigationStore.selectedObject;
        };

        const onOk = (navigationStore: INavigationStore) => {
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

            ReactDOM.unmountComponentAtNode(element);
            modalDialog.close();

            return true;
        };

        const onCancel = () => {
            ReactDOM.unmountComponentAtNode(element);
            modalDialog.close();
        };

        const [modalDialog, element] = showDialog(
            <SelectItemDialog
                object={object}
                propertyInfo={propertyInfo}
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

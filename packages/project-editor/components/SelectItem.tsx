import React from "react";
import ReactDOM from "react-dom";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { PropertyList, SelectProperty } from "eez-studio-ui/properties";
import { styled } from "eez-studio-ui/styled-components";

import {
    IEezObject,
    PropertyInfo,
    getProperty,
    PropertyType,
    getObjectFromPath,
    IOnSelectParams,
    getClassInfo
} from "project-editor/core/object";
import { SimpleNavigationStoreClass } from "project-editor/core/store";
import { DragAndDropManagerClass } from "project-editor/core/dd";

import { Widget } from "project-editor/features/gui/widget";
import { Glyph } from "project-editor/features/gui/font";

import {
    Project,
    getNameProperty,
    findReferencedObject,
    getProject,
    getProjectStore
} from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

const SelectItemDialogDiv = styled.div`
    flex-grow: 1;
    display: flex;
`;

@observer
class SelectItemDialog extends React.Component<{
    object: IEezObject;
    propertyInfo: PropertyInfo;
    params?: IOnSelectParams;
    onOk: (value: any) => void;
    onCancel: () => void;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>

    @observable _selectedProject: Project | undefined;

    @computed
    get allProjects() {
        return [
            this.context.project,
            ...this.context.project.settings.general.imports
                .filter(importDirective => !!importDirective.project)
                .map(importDirective => importDirective.project!)
        ];
    }

    @computed
    get selectedProject(): Project {
        if (this._selectedProject) {
            return this._selectedProject;
        }
        if (this.currentlySelectedObject) {
            return getProject(this.currentlySelectedObject);
        }
        return this.context.project;
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
        return getObjectFromPath(
            this.selectedProject,
            this.collectionPath.split("/")
        );
    }

    @computed
    get currentlySelectedObject() {
        const { object, propertyInfo } = this.props;

        const name =
            propertyInfo.type === PropertyType.String
                ? (object as Widget).style.fontName
                : getProperty(object, propertyInfo.name);

        return findReferencedObject(
            this.context.project,
            this.collectionPath,
            name
        );
    }

    @computed
    get navigationStore() {
        return new SimpleNavigationStoreClass(
            this.currentlySelectedObject,
            this.selectedProject === this.context.project // editable
        );
    }

    @computed
    get dragAndDropManager() {
        return new DragAndDropManagerClass();
    }

    onSelectProject = action((projectName: string) => {
        this._selectedProject = this.allProjects.find(
            project => project.projectName === projectName
        );
    });

    onOkEnabled = () => {
        if (this.props.propertyInfo.type === PropertyType.String) {
            return this.navigationStore.selectedObject instanceof Glyph;
        }
        return !!this.navigationStore.selectedObject;
    };

    onOk = () => {
        if (!this.navigationStore.selectedObject) {
            return false;
        }

        const { object, propertyInfo, params } = this.props;

        let value;

        if (propertyInfo.type === PropertyType.String) {
            const glyphCode = `\\u${(this.navigationStore
                .selectedObject as Glyph).encoding
                .toString(16)
                .padStart(4, "0")}`;

            if (
                params &&
                params.textInputSelection &&
                params.textInputSelection.start != null &&
                params.textInputSelection.end != null
            ) {
                const existingValue: string = getProperty(
                    object,
                    propertyInfo.name
                );
                value =
                    existingValue.substring(
                        0,
                        params.textInputSelection.start
                    ) +
                    glyphCode +
                    existingValue.substring(params.textInputSelection.end);
            } else {
                value = glyphCode;
            }
        } else {
            value = getNameProperty(this.navigationStore.selectedObject!);
        }

        this.props.onOk({
            [propertyInfo.name]: value
        });

        return true;
    };

    render() {
        let NavigationComponent = getClassInfo(this.collectionObject)
            .navigationComponent!;

        return (
            <Dialog
                modal={false}
                okButtonText="Select"
                okEnabled={this.onOkEnabled}
                onOk={this.onOk}
                onCancel={this.props.onCancel}
                additionalFooterControl={
                    this.allProjects.length > 1 && (
                        <PropertyList>
                            <SelectProperty
                                name="Project"
                                value={this.selectedProject.projectName}
                                onChange={this.onSelectProject}
                                selectStyle={{ width: "auto" }}
                            >
                                {this.allProjects.map(project => (
                                    <option
                                        key={project.projectName}
                                        value={project.projectName}
                                    >
                                        {project.projectName}
                                    </option>
                                ))}
                            </SelectProperty>
                        </PropertyList>
                    )
                }
            >
                <SelectItemDialogDiv>
                    <NavigationComponent
                        id={
                            getClassInfo(this.collectionObject!)
                                .navigationComponentId! + "-dialog"
                        }
                        navigationObject={this.collectionObject}
                        navigationStore={this.navigationStore}
                        dragAndDropManager={this.dragAndDropManager}
                        onDoubleClickItem={this.onOk}
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
        const onDispose = () => {
            ReactDOM.unmountComponentAtNode(element);
            modalDialog.close();
        };

        const onOk = (value: any) => {
            resolve(value);
            onDispose();
        };

        const [modalDialog, element] = showDialog(
            <ProjectContext.Provider value={getProjectStore(object)}>
                <SelectItemDialog
                    object={object}
                    propertyInfo={propertyInfo}
                    params={params}
                    onOk={onOk}
                    onCancel={onDispose}
                />
            </ProjectContext.Provider>,
            {
                jsPanel: Object.assign({}, opts)
            }
        );
    });
}

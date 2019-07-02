import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";

import { Splitter } from "eez-studio-ui/splitter";
import styled from "eez-studio-ui/styled-components";

import { NavigationComponent, EezObject, getProperty } from "project-editor/core/object";
import { loadObject } from "project-editor/core/serialization";
import { DocumentStore, NavigationStore, UIStateStore } from "project-editor/core/store";

import { ProjectStore } from "project-editor/core/store";
import { confirm } from "project-editor/core/util";
import { Extension, getExtensionsByCategory } from "project-editor/core/extensions";

import { TreeNavigationPanel } from "project-editor/components/TreeNavigation";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

////////////////////////////////////////////////////////////////////////////////

const ProjectFeatureDiv = styled.div`
    padding: 10px;
    margin-bottom: 20px;
    h4 {
        margin: 0;
        border-bottom: 1px solid ${props => props.theme.borderColor};
    }
`;

const ExtensionCardAuthor = styled.div`
    margin-top: 5px;
    font-size: 120%;
`;

@observer
class ProjectFeature extends React.Component<
    {
        extension: Extension;
    },
    {}
> {
    onAdd() {
        let newFeatureObject = loadObject(
            ProjectStore.project,
            this.props.extension.eezStudioExtension.implementation.projectFeature.create(),
            this.props.extension.eezStudioExtension.implementation.projectFeature.typeClass,
            this.props.extension.eezStudioExtension.implementation.projectFeature.key
        );

        let changes = {
            [this.props.extension.eezStudioExtension.implementation.projectFeature
                .key]: newFeatureObject
        };

        DocumentStore.updateObject(ProjectStore.project, changes);
    }

    onRemove() {
        confirm("Are you sure you want to remove this feature?", undefined, () => {
            if (ProjectStore.project) {
                DocumentStore.updateObject(ProjectStore.project, {
                    [this.props.extension.eezStudioExtension.implementation.projectFeature
                        .key]: undefined
                });
            }
        });
    }

    render() {
        let button: JSX.Element | undefined;
        if (
            getProperty(
                ProjectStore.project,
                this.props.extension.eezStudioExtension.implementation.projectFeature.key
            )
        ) {
            if (this.props.extension.eezStudioExtension.implementation.projectFeature.mandatory) {
                button = (
                    <button
                        className="btn btn-secondary float-right"
                        disabled={true}
                        title="This feature can't be removed"
                    >
                        Remove
                    </button>
                );
            } else {
                button = (
                    <button
                        className="btn btn-secondary float-right"
                        onClick={this.onRemove.bind(this)}
                        title="Remove feature from the project"
                    >
                        Remove
                    </button>
                );
            }
        } else {
            button = (
                <button
                    className="btn btn-secondary float-right"
                    onClick={this.onAdd.bind(this)}
                    title="Add feature to the project"
                >
                    Add
                </button>
            );
        }

        return (
            <ProjectFeatureDiv>
                <div className="float-right" title="Feature version">
                    v{this.props.extension.version}
                </div>
                <h4 title="Feature name">
                    {this.props.extension.eezStudioExtension.displayName ||
                        this.props.extension.name}
                </h4>
                <div className="extension-card-description" title="Feature description">
                    {this.props.extension.description}
                </div>
                <ExtensionCardAuthor title="Feature author">
                    {button}
                    <img src={this.props.extension.authorLogo} width="32" height="32" />{" "}
                    {this.props.extension.author}
                </ExtensionCardAuthor>
            </ProjectFeatureDiv>
        );
    }
}

const SettingsEditorDiv = styled.div`
    padding: 10px;
    overflow: auto;

    .EezStudio_ProjectEditor_PropertyGrid {
        position: static;
    }

    .EezStudio_ProjectEditor_PropertyGrid {
        overflow: visible;
    }
`;

@observer
export class SettingsEditor extends React.Component<{ object: EezObject | undefined }, {}> {
    render() {
        if (!this.props.object || this.props.object === ProjectStore.project.settings.general) {
            let projectFeatures = getExtensionsByCategory("project-feature").map(extension => (
                <ProjectFeature key={extension.name} extension={extension} />
            ));

            return (
                <SettingsEditorDiv>
                    {this.props.object && <PropertyGrid object={this.props.object} />}
                    <h3>Project features</h3>
                    {projectFeatures}
                </SettingsEditorDiv>
            );
        } else {
            return <PropertyGrid object={this.props.object} />;
        }
    }
}

@observer
export class SettingsNavigation extends NavigationComponent {
    @computed
    get object() {
        if (NavigationStore.selectedPanel) {
            return NavigationStore.selectedPanel.selectedObject;
        }
        return NavigationStore.selectedObject;
    }

    render() {
        let content = this.props.content;
        if (this.object && this.object.editorComponent) {
            content = this.props.content;
        } else {
            content = <SettingsEditor object={this.object} />;
        }

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/navigation-${this.props.id}`}
                    sizes={`240px|100%`}
                    childrenOverflow="hidden"
                >
                    <TreeNavigationPanel navigationObject={this.props.navigationObject} />
                    {content}
                </Splitter>
            );
        } else {
            return content;
        }
    }
}

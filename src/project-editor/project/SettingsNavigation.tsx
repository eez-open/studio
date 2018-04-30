import { computed } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";

import { NavigationComponent, EezObject } from "project-editor/core/metaData";
import {
    ProjectStore,
    updateObject,
    loadObject,
    NavigationStore,
    UIStateStore
} from "project-editor/core/store";
import { confirm } from "project-editor/core/util";
import { Extension, getExtensionsByCategory } from "project-editor/core/extensions";

import * as Layout from "project-editor/components/Layout";
import { TreeNavigationPanel } from "project-editor/project/TreeNavigation";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

@observer
class ProjectFeature extends React.Component<
    {
        extension: Extension;
    },
    {}
> {
    onAdd() {
        let newFeatureObject = loadObject(
            ProjectStore.projectProperties,
            this.props.extension.eezStudioExtension.implementation.projectFeature.create(),
            this.props.extension.eezStudioExtension.implementation.projectFeature.metaData,
            this.props.extension.eezStudioExtension.implementation.projectFeature.key
        );

        let changes = {
            [this.props.extension.eezStudioExtension.implementation.projectFeature
                .key]: newFeatureObject
        };

        updateObject(ProjectStore.projectProperties, changes);
    }

    onRemove() {
        confirm("Are you sure you want to remove this feature?", undefined, () => {
            if (ProjectStore.projectProperties) {
                updateObject(ProjectStore.projectProperties, {
                    [this.props.extension.eezStudioExtension.implementation.projectFeature
                        .key]: undefined
                });
            }
        });
    }

    render() {
        let button: JSX.Element | undefined;
        if (
            ProjectStore.projectProperties[
                this.props.extension.eezStudioExtension.implementation.projectFeature.key
            ]
        ) {
            if (this.props.extension.eezStudioExtension.implementation.projectFeature.mandatory) {
                button = (
                    <button
                        className="btn float-right"
                        disabled={true}
                        title="This feature can't be removed"
                    >
                        Remove
                    </button>
                );
            } else {
                button = (
                    <button
                        className="btn float-right"
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
                    className="btn float-right"
                    onClick={this.onAdd.bind(this)}
                    title="Add feature to the project"
                >
                    Add
                </button>
            );
        }

        return (
            <div className="EezStudio_ProjectEditor_settings-editor-project-feature">
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
                <div className="extension-card-author" title="Feature author">
                    {button}
                    <img src={this.props.extension.authorLogo} width="32" height="32" />{" "}
                    {this.props.extension.author}
                </div>
            </div>
        );
    }
}

@observer
export class SettingsEditor extends React.Component<{ object: EezObject | undefined }, {}> {
    render() {
        if (
            !this.props.object ||
            this.props.object === ProjectStore.projectProperties.settings.general
        ) {
            let projectFeatures = getExtensionsByCategory("project-feature").map(extension => (
                <ProjectFeature key={extension.name} extension={extension} />
            ));

            return (
                <div className="EezStudio_ProjectEditor_settings-editor layoutCenter">
                    <div className="EezStudio_ProjectEditor_settings-editor-inner">
                        {this.props.object && <PropertyGrid object={this.props.object} />}
                        <h3>Project features</h3>
                        {projectFeatures}
                    </div>
                </div>
            );
        } else {
            return <PropertyGrid object={this.props.object} className="layoutCenter" />;
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
        if (this.object && this.object.$eez.metaData.editorComponent) {
            content = this.props.content;
        } else {
            content = <SettingsEditor object={this.object} />;
        }

        if (UIStateStore.viewOptions.navigationVisible) {
            return (
                <Layout.Split
                    orientation="horizontal"
                    splitId={`navigation-${this.props.id}`}
                    splitPosition="0.25"
                >
                    <TreeNavigationPanel navigationObject={this.props.navigationObject} />
                    {content}
                </Layout.Split>
            );
        } else {
            return content;
        }
    }
}

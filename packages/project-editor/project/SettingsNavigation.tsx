import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";

import { Splitter } from "eez-studio-ui/splitter";

import {
    NavigationComponent,
    IEezObject,
    getProperty,
    getParent
} from "project-editor/core/object";
import { loadObject } from "project-editor/core/serialization";

import { confirm } from "project-editor/core/util";
import { Extension, getProjectFeatures } from "project-editor/core/extensions";

import { BuildFile } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/components/Panel";
import { TreeNavigationPanel } from "project-editor/components/TreeNavigation";
import { PropertyGrid } from "project-editor/components/PropertyGrid";
import { BuildFileEditor } from "project-editor/project/BuildFileEditor";

////////////////////////////////////////////////////////////////////////////////

@observer
class ProjectFeature extends React.Component<
    {
        extension: Extension;
    },
    {}
> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    onAdd() {
        let newFeatureObject = loadObject(
            this.context,
            this.context.project,
            this.props.extension.eezStudioExtension.implementation.projectFeature.create(),
            this.props.extension.eezStudioExtension.implementation
                .projectFeature.typeClass,
            this.props.extension.eezStudioExtension.implementation
                .projectFeature.key
        );

        let changes = {
            [this.props.extension.eezStudioExtension.implementation
                .projectFeature.key]: newFeatureObject
        };

        this.context.updateObject(this.context.project, changes);
    }

    onRemove() {
        confirm(
            "Are you sure you want to remove this feature?",
            undefined,
            () => {
                if (this.context.project) {
                    this.context.updateObject(this.context.project, {
                        [this.props.extension.eezStudioExtension.implementation
                            .projectFeature.key]: undefined
                    });
                }
            }
        );
    }

    render() {
        let button: JSX.Element | undefined;
        if (
            getProperty(
                this.context.project,
                this.props.extension.eezStudioExtension.implementation
                    .projectFeature.key
            )
        ) {
            if (
                this.props.extension.eezStudioExtension.implementation
                    .projectFeature.mandatory
            ) {
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
                    className="btn btn-success float-right"
                    onClick={this.onAdd.bind(this)}
                    title="Add feature to the project"
                >
                    Add
                </button>
            );
        }

        return (
            <div
                className="card shadow-sm m-2 rounded"
                style={{ width: "18rem" }}
            >
                <div className="card-body pb-5">
                    <h5 className="card-title">
                        <i
                            className="material-icons card-img-top"
                            style={{
                                fontSize: 32,
                                display: "inline",
                                marginRight: 5
                            }}
                        >
                            {
                                this.props.extension.eezStudioExtension
                                    .implementation.projectFeature.icon
                            }
                        </i>
                        {this.props.extension.eezStudioExtension.displayName ||
                            this.props.extension.name}
                    </h5>
                    <p className="card-text">
                        {this.props.extension.description}.
                    </p>
                    <div
                        style={{
                            position: "absolute",
                            bottom: "1rem",
                            right: "1rem"
                        }}
                    >
                        {button}
                    </div>
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class SettingsEditor extends React.Component<
    { object: IEezObject | undefined },
    {}
> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        const object =
            this.props.object || this.context.project.settings.general;
        if (object === this.context.project.settings.general) {
            let projectFeatures = getProjectFeatures().map(extension => (
                <ProjectFeature key={extension.name} extension={extension} />
            ));

            return (
                <div className="EezStudio_SettingsEditor">
                    <PropertyGrid objects={[object]} />
                    <h3>Project features</h3>
                    <div className="d-flex flex-wrap">{projectFeatures}</div>
                </div>
            );
        } else {
            const properties = (
                <Panel
                    id="properties"
                    title="Properties"
                    body={<PropertyGrid objects={object ? [object] : []} />}
                />
            );
            if (
                getParent(object) === this.context.project.settings.build.files
            ) {
                return (
                    <Splitter
                        type="horizontal"
                        persistId={`project-editor/build-file`}
                        sizes={`100%|240px`}
                        childrenOverflow="hidden"
                    >
                        <BuildFileEditor buildFile={object as BuildFile} />
                        {properties}
                    </Splitter>
                );
            } else {
                return properties;
            }
        }
    }
}

@observer
export class SettingsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    render() {
        if (this.context.isDashboardProject || this.context.isAppletProject) {
            return <SettingsEditor object={this.object} />;
        }

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/navigation-${this.props.id}`}
                sizes={`240px|100%`}
                childrenOverflow="hidden"
            >
                <TreeNavigationPanel
                    navigationObject={this.props.navigationObject}
                />
                <SettingsEditor object={this.object} />
            </Splitter>
        );
    }
}

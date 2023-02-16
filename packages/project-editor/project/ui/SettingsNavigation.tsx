import { observer } from "mobx-react";
import React from "react";
import * as FlexLayout from "flexlayout-react";

import { getProperty, getParent, IEezObject } from "project-editor/core/object";
import {
    addItem,
    canAdd,
    createObject,
    LayoutModels
} from "project-editor/store";

import { confirm } from "project-editor/core/util";
import type { ProjectEditorFeature } from "project-editor/store/features";

import { BuildFile, ImportDirective } from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/ui-components/Panel";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";
import {
    ITreeObjectAdapter,
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IconAction } from "eez-studio-ui/action";
import { Tree } from "project-editor/ui-components/Tree";
import { computed, makeObservable } from "mobx";
import { CodeEditor } from "eez-studio-ui/code-editor";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { NavigationComponent } from "project-editor/project/ui/NavigationComponent";

////////////////////////////////////////////////////////////////////////////////

const ProjectFeature = observer(
    class ProjectFeature extends React.Component<
        {
            projectFeature: ProjectEditorFeature;
        },
        {}
    > {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        onAdd() {
            let newFeatureObject = createObject(
                this.context,
                this.props.projectFeature.create(),
                this.props.projectFeature.typeClass,
                this.props.projectFeature.key
            );

            let changes = {
                [this.props.projectFeature.key]: newFeatureObject
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
                            [this.props.projectFeature.key]: undefined
                        });
                    }
                }
            );
        }

        render() {
            let button: JSX.Element | undefined;
            if (
                getProperty(this.context.project, this.props.projectFeature.key)
            ) {
                let mandatory = this.props.projectFeature.mandatory;

                if (this.context.projectTypeTraits.isLVGL) {
                    if (
                        this.props.projectFeature.key == "fonts" ||
                        this.props.projectFeature.key == "bitmaps"
                    ) {
                        mandatory = true;
                    }
                }

                if (mandatory) {
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
                            {typeof this.props.projectFeature.icon ==
                            "string" ? (
                                <i
                                    className="material-icons card-img-top"
                                    style={{
                                        fontSize: 32,
                                        display: "inline",
                                        marginRight: 5
                                    }}
                                >
                                    {this.props.projectFeature.icon}
                                </i>
                            ) : (
                                <span className="EezStudio_SettingsEditor_FeatureIcon">
                                    {this.props.projectFeature.icon}
                                </span>
                            )}
                            {this.props.projectFeature.displayName ||
                                this.props.projectFeature.name}
                        </h5>
                        <p className="card-text">
                            {this.props.projectFeature.description}.
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
);

////////////////////////////////////////////////////////////////////////////////

export const SettingsEditor = observer(
    class SettingsEditor extends EditorComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                object: computed
            });
        }

        get object() {
            let object =
                this.props.editor.subObject ||
                this.context.project.settings.general;

            if (object === this.context.project.settings) {
                object = this.context.project.settings.general;
            }

            return object;
        }

        get model() {
            return FlexLayout.Model.fromJson({
                global: LayoutModels.GLOBAL_OPTIONS,
                borders: [],
                layout: {
                    type: "row",
                    children: [
                        {
                            type: "row",
                            children: [
                                {
                                    type: "tabset",
                                    enableTabStrip: false,
                                    enableDrag: false,
                                    enableDrop: false,
                                    enableClose: false,
                                    children: [
                                        {
                                            type: "tab",
                                            enableClose: false,
                                            component: "code-editor"
                                        }
                                    ]
                                },
                                {
                                    type: "tabset",
                                    enableTabStrip: false,
                                    enableDrag: false,
                                    enableDrop: false,
                                    enableClose: false,
                                    children: [
                                        {
                                            type: "tab",
                                            enableClose: false,
                                            component: "properties"
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            });
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "code-editor") {
                return <BuildFileEditor buildFile={this.object as BuildFile} />;
            }

            if (component === "properties") {
                return (
                    <PropertyGrid objects={this.object ? [this.object] : []} />
                );
            }

            return null;
        };

        render() {
            if (this.object === this.context.project.settings.general) {
                let projectFeatures = ProjectEditor.extensions
                    .filter(extension => {
                        if (this.context.projectTypeTraits.isLVGL) {
                            if (
                                extension.key == "styles" ||
                                extension.key == "texts" ||
                                extension.key == "micropython" ||
                                extension.key == "extensionDefinitions" ||
                                extension.key == "scpi" ||
                                extension.key == "shortcuts"
                            ) {
                                return false;
                            }
                        } else {
                            if (extension.key == "lvglStyles") {
                                return false;
                            }
                        }
                        return true;
                    })
                    .map(extension => (
                        <ProjectFeature
                            key={extension.name}
                            projectFeature={extension}
                        />
                    ));

                return (
                    <div className="EezStudio_SettingsEditor">
                        <PropertyGrid objects={[this.object]} />
                        <h3>Project features</h3>
                        <div className="d-flex flex-wrap">
                            {projectFeatures}
                        </div>
                    </div>
                );
            } else {
                if (
                    getParent(this.object) ===
                    this.context.project.settings.build.files
                ) {
                    return (
                        <FlexLayout.Layout
                            model={this.model}
                            factory={this.factory}
                            realtimeResize={true}
                            font={LayoutModels.FONT_SUB}
                        />
                    );
                } else {
                    return (
                        <PropertyGrid
                            objects={this.object ? [this.object] : []}
                        />
                    );
                }
            }
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const SettingsNavigation = observer(
    class SettingsNavigation extends NavigationComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        static navigationTreeFilter(object: IEezObject) {
            if (object instanceof ImportDirective) {
                return false;
            }
            return true;
        }

        onFocus() {
            this.context.navigationStore.setSelectedPanel(undefined);
        }

        onClick = (object: IEezObject) => {
            this.context.editorsStore.openEditor(
                this.context.project.settings,
                object
            );
        };

        render() {
            const navigationObjectAdapter = new TreeObjectAdapter(
                this.context.project.settings,
                undefined,
                true // expanded
            );

            return (
                <Panel
                    id="navigation"
                    title=""
                    buttons={[
                        <AddButton
                            key="add"
                            objectAdapter={navigationObjectAdapter}
                        />,
                        <DeleteButton
                            key="delete"
                            objectAdapter={navigationObjectAdapter}
                        />
                    ]}
                    body={
                        <Tree
                            treeAdapter={
                                new TreeAdapter(
                                    navigationObjectAdapter,
                                    undefined,
                                    SettingsNavigation.navigationTreeFilter,
                                    true,
                                    "none",
                                    undefined,
                                    this.onClick
                                )
                            }
                            tabIndex={0}
                            onFocus={this.onFocus.bind(this)}
                        />
                    }
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const AddButton = observer(
    class AddButton extends React.Component<{
        objectAdapter: ITreeObjectAdapter;
    }> {
        async onAdd() {
            if (this.props.objectAdapter.selectedObject) {
                const aNewItem = await addItem(
                    this.props.objectAdapter.selectedObject
                );
                if (aNewItem) {
                    this.props.objectAdapter.selectObject(aNewItem);
                }
            }
        }

        render() {
            return (
                <IconAction
                    title="Add Item"
                    icon="material:add"
                    iconSize={16}
                    onClick={this.onAdd.bind(this)}
                    enabled={
                        this.props.objectAdapter.selectedObject &&
                        canAdd(this.props.objectAdapter.selectedObject)
                    }
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const DeleteButton = observer(
    class DeleteButton extends React.Component<
        {
            objectAdapter: ITreeObjectAdapter;
        },
        {}
    > {
        onDelete() {
            this.props.objectAdapter.deleteSelection();
        }

        render() {
            return (
                <IconAction
                    title="Delete Selected Item"
                    icon="material:delete"
                    iconSize={16}
                    onClick={this.onDelete.bind(this)}
                    enabled={this.props.objectAdapter.canDelete()}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const BuildFileEditor = observer(
    class BuildFileEditor extends React.Component<{
        buildFile: BuildFile;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        codeEditor: CodeEditor;

        onChange = (value: string) => {
            this.context.updateObject(this.props.buildFile, {
                template: value
            });
        };

        onFocus = () => {
            this.context.undoManager.setCombineCommands(true);
        };

        onBlur = () => {
            this.context.undoManager.setCombineCommands(false);
        };

        componentDidMount() {
            this.codeEditor.resize();
        }

        componentDidUpdate() {
            this.codeEditor.resize();
        }

        render() {
            const { buildFile } = this.props;
            return (
                <div style={{ height: "100%", display: "flex" }}>
                    <CodeEditor
                        ref={ref => (this.codeEditor = ref!)}
                        mode="c_cpp"
                        value={buildFile.template}
                        onChange={this.onChange}
                        onFocus={this.onFocus}
                        onBlur={this.onBlur}
                    />
                </div>
            );
        }
    }
);

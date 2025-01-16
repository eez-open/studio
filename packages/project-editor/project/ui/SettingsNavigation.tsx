import { observer } from "mobx-react";
import React from "react";
import { computed, makeObservable, observable } from "mobx";
import * as FlexLayout from "flexlayout-react";

import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { Icon } from "eez-studio-ui/icon";

import { getProperty, getParent, IEezObject } from "project-editor/core/object";
import {
    addItem,
    canAdd,
    createObject,
    getAddItemName,
    getAncestorOfType,
    IPanel,
    LayoutModels
} from "project-editor/store";

import { confirm } from "project-editor/core/util";
import type { ProjectEditorFeature } from "project-editor/store/features";

import {
    BuildFile,
    General,
    ImportDirective,
    ProjectType
} from "project-editor/project/project";
import { ProjectContext } from "project-editor/project/context";
import { Panel } from "project-editor/ui-components/Panel";
import { PropertyGrid } from "project-editor/ui-components/PropertyGrid";
import {
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IconAction } from "eez-studio-ui/action";
import { Tree } from "project-editor/ui-components/Tree";
import { CodeEditor } from "eez-studio-ui/code-editor";
import {
    EditorComponent,
    IEditor
} from "project-editor/project/ui/EditorComponent";

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

        onAdd = () => {
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

            this.context.project.enableTabs();
        };

        onRemove = () => {
            confirm(
                "Are you sure you want to remove this feature?",
                undefined,
                () => {
                    if (this.context.project) {
                        const values = {
                            [this.props.projectFeature.key]: undefined
                        };

                        if (
                            this.props.projectFeature.key ==
                            "extensionDefinitions"
                        ) {
                            values["scpi"] = undefined;
                            values["instrumentCommands"] = undefined;
                            values["shortcuts"] = undefined;
                        }

                        this.context.updateObject(this.context.project, values);

                        this.context.project.enableTabs();
                    }
                }
            );
        };

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

                if (this.context.projectTypeTraits.isIEXT) {
                    if (
                        this.props.projectFeature.key == "extensionDefinitions"
                    ) {
                        mandatory = true;
                    } else if (this.props.projectFeature.key == "scpi") {
                        mandatory =
                            this.context.project.settings.general
                                .commandsProtocol == "SCPI";
                    } else if (
                        this.props.projectFeature.key == "instrumentCommands"
                    ) {
                        mandatory =
                            this.context.project.settings.general
                                .commandsProtocol == "PROPRIETARY";
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
                            onClick={this.onRemove}
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
                        onClick={this.onAdd}
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
                            <Icon
                                icon={this.props.projectFeature.icon}
                                size={32}
                                style={{ marginRight: 5 }}
                            />
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

        get layoutModel() {
            return FlexLayout.Model.fromJson({
                global: LayoutModels.GLOBAL_OPTIONS,
                borders: [],
                layout: {
                    type: "row",
                    children: [
                        {
                            type: "tabset",
                            enableTabStrip: false,
                            enableDrag: false,
                            enableDrop: false,
                            enableClose: false,
                            width: 240,
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    component: "navigation"
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
                                    component: "content"
                                }
                            ]
                        }
                    ]
                }
            });
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "navigation") {
                return (
                    <SettingsNavigation
                        selectedObject={this.props.editor.subObject}
                    />
                );
            }

            if (component === "content") {
                return <SettingsContent editor={this.props.editor} />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayoutContainer
                    model={this.layoutModel}
                    factory={this.factory}
                />
            );
        }
    }
);

export const SettingsContent = observer(
    class SettingsContent extends React.Component<{ editor: IEditor }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get object() {
            let object =
                this.props.editor.subObject ||
                this.context.project.settings.general;

            if (object === this.context.project.settings) {
                object = this.context.project.settings.general;
            }

            if (getAncestorOfType(object, General.classInfo)) {
                object = this.context.project.settings.general;
            }

            return object;
        }

        get layoutModel() {
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
                                    height: 120,
                                    children: [
                                        {
                                            type: "tab",
                                            enableClose: false,
                                            component: "file-properties"
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

            if (component === "file-properties") {
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
                        if (extension.key == "micropython") {
                            return this.context.projectTypeTraits.isResource;
                        }

                        if (extension.key == "extensionDefinitions") {
                            return (
                                this.context.project.settings.general
                                    .projectType == ProjectType.FIRMWARE ||
                                this.context.project.settings.general
                                    .projectType == ProjectType.IEXT
                            );
                        }

                        if (extension.key == "scpi") {
                            return (
                                this.context.project.settings.general
                                    .commandsProtocol == "SCPI" &&
                                this.context.project.extensionDefinitions !=
                                    undefined
                            );
                        }

                        if (extension.key == "instrumentCommands") {
                            return (
                                this.context.project.settings.general
                                    .commandsProtocol == "PROPRIETARY" &&
                                this.context.project.extensionDefinitions !=
                                    undefined
                            );
                        }

                        if (extension.key == "shortcuts") {
                            return (
                                this.context.project.extensionDefinitions !=
                                undefined
                            );
                        }

                        if (extension.key == "texts") {
                            return (
                                this.context.projectTypeTraits.hasFlowSupport &&
                                !this.context.projectTypeTraits.isLVGL
                            );
                        }

                        if (this.context.projectTypeTraits.isLVGL) {
                            if (
                                extension.key == "styles" ||
                                extension.key == "texts" ||
                                extension.key == "micropython" ||
                                extension.key == "extensionDefinitions" ||
                                extension.key == "scpi" ||
                                extension.key == "instrumentCommands" ||
                                extension.key == "shortcuts"
                            ) {
                                return false;
                            }
                        } else if (this.context.projectTypeTraits.isIEXT) {
                            if (
                                extension.key == "userPages" ||
                                extension.key == "userWidgets" ||
                                extension.key == "actions" ||
                                extension.key == "variables" ||
                                extension.key == "styles" ||
                                extension.key == "lvglStyles" ||
                                extension.key == "lvglGroups" ||
                                extension.key == "fonts" ||
                                extension.key == "bitmaps" ||
                                extension.key == "texts" ||
                                extension.key == "micropython"
                            ) {
                                return false;
                            }
                        } else {
                            if (
                                extension.key == "lvglStyles" ||
                                extension.key == "lvglGroups"
                            ) {
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
                        <FlexLayoutContainer
                            model={this.layoutModel}
                            factory={this.factory}
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
    class SettingsNavigation
        extends React.Component<{
            selectedObject: IEezObject | undefined;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                navigationObjectAdapter: computed,
                treeAdapter: computed
            });
        }

        componentDidMount() {
            this.treeAdapter.selectItem(this.treeAdapter.allRows[0].item);

            this.context.navigationStore.mountPanel(this);
        }

        static navigationTreeFilter(object: IEezObject) {
            if (object instanceof ImportDirective) {
                return false;
            }
            return true;
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
        }

        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        onClick = (object: IEezObject) => {
            this.context.editorsStore.openEditor(
                this.context.project.settings,
                object
            );
        };

        get navigationObjectAdapter() {
            return new TreeObjectAdapter(
                this.context.project.settings,
                undefined,
                true // expanded
            );
        }

        get treeAdapter() {
            return new TreeAdapter(
                this.navigationObjectAdapter,
                observable.box<IEezObject | undefined>(
                    this.props.selectedObject
                ),
                SettingsNavigation.navigationTreeFilter,
                true,
                "none",
                undefined,
                this.onClick
            );
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.treeAdapter.rootItem.selectedObject;
        }
        get selectedObjects() {
            return this.treeAdapter.rootItem.selectedObjects;
        }
        canCut() {
            return this.treeAdapter.canCut();
        }
        cutSelection() {
            this.treeAdapter.cutSelection();
        }
        canCopy() {
            return this.treeAdapter.canCopy();
        }
        copySelection() {
            this.treeAdapter.copySelection();
        }
        canPaste() {
            return this.treeAdapter.canPaste();
        }
        pasteSelection() {
            this.treeAdapter.pasteSelection();
        }
        canDelete() {
            return this.treeAdapter.canDelete();
        }
        deleteSelection() {
            this.treeAdapter.deleteSelection();
        }
        selectAll() {
            this.treeAdapter.selectItems(
                this.treeAdapter.allRows.map(row => row.item)
            );
        }

        render() {
            return (
                <Panel
                    id="navigation"
                    title=""
                    buttons={[
                        <AddButton
                            key="add"
                            objectAdapter={this.navigationObjectAdapter}
                        />,
                        <DeleteButton
                            key="delete"
                            objectAdapter={this.navigationObjectAdapter}
                        />
                    ]}
                    body={
                        <Tree
                            treeAdapter={
                                new TreeAdapter(
                                    this.navigationObjectAdapter,
                                    undefined,
                                    SettingsNavigation.navigationTreeFilter,
                                    true,
                                    "none",
                                    undefined,
                                    this.onClick
                                )
                            }
                            tabIndex={0}
                            onFocus={this.onFocus}
                        />
                    }
                    style={{ overflow: "hidden" }}
                    tabIndex={0}
                    onFocus={this.onFocus}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const AddButton = observer(
    class AddButton extends React.Component<{
        objectAdapter: TreeObjectAdapter;
    }> {
        onAdd = async () => {
            if (this.props.objectAdapter.selectedObject) {
                const aNewItem = await addItem(
                    this.props.objectAdapter.selectedObject
                );
                if (aNewItem) {
                    this.props.objectAdapter.selectObject(aNewItem);
                }
            }
        };

        render() {
            return (
                this.props.objectAdapter.selectedObject &&
                canAdd(this.props.objectAdapter.selectedObject) && (
                    <IconAction
                        title={`Add ${getAddItemName(
                            this.props.objectAdapter.selectedObject
                        )}...`}
                        icon="material:add"
                        iconSize={16}
                        onClick={this.onAdd}
                    />
                )
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const DeleteButton = observer(
    class DeleteButton extends React.Component<{
        objectAdapter: TreeObjectAdapter;
    }> {
        onDelete = () => {
            this.props.objectAdapter.deleteSelection();
        };

        render() {
            return (
                <IconAction
                    title="Delete Selected Item"
                    icon="material:delete"
                    iconSize={16}
                    onClick={this.onDelete}
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

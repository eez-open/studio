import React from "react";
import { action, computed, observable } from "mobx";
import { observer } from "mobx-react";

import { validators } from "eez-studio-shared/validation";
import {
    makeDerivedClassInfo,
    registerClass,
    IEezObject,
    PropertyType,
    NavigationComponent,
    EditorComponent
} from "project-editor/core/object";
import { Message, Type } from "project-editor/core/output";
import {
    findReferencedObject,
    Project,
    getProject,
    ProjectType
} from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";
import { ProjectContext } from "project-editor/project/context";
import { Splitter } from "eez-studio-ui/splitter";
import {
    ListNavigation,
    ListNavigationWithProperties
} from "project-editor/components/ListNavigation";
import { Editors, PropertiesPanel } from "project-editor/project/ProjectEditor";
import { FlowEditor } from "project-editor/flow/flow-editor/editor";
import { FlowViewer } from "project-editor/flow/flow-runtime/viewer";
import { IPanel } from "project-editor/core/store";
import { ComponentsPalette } from "project-editor/flow/flow-editor/ComponentsPalette";
import { ThemesSideView } from "project-editor/features/style/theme";
import { bind } from "bind-decorator";
import { TreeAdapter } from "project-editor/core/objectAdapter";
import { Panel } from "project-editor/components/Panel";
import { Tree } from "project-editor/components/Tree";
import { IconAction } from "eez-studio-ui/action";
import { Flow, FlowTabState } from "project-editor/flow/flow";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ComponentsContainerEnclosure } from "project-editor/flow/flow-editor/render";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @bind
    focusHandler() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    @computed
    get treeAdapter() {
        let flowTabState = this.props.editor.state as FlowTabState;
        return new TreeAdapter(
            flowTabState.componentContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    @computed
    get selectedObject() {
        let flowTabState = this.props.editor.state as FlowTabState;
        return flowTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        let flowTabState = this.props.editor.state as FlowTabState;
        return flowTabState.selectedObjects;
    }

    cutSelection() {
        this.treeAdapter.cutSelection();
    }

    copySelection() {
        this.treeAdapter.copySelection();
    }

    pasteSelection() {
        this.treeAdapter.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter.deleteSelection();
    }

    render() {
        let flowTabState = this.props.editor.state as FlowTabState;
        if (this.context.RuntimeStore.isRuntimeMode) {
            return (
                <FlowViewer
                    widgetContainer={flowTabState.componentContainerDisplayItem}
                    frontFace={false}
                />
            );
        } else {
            return (
                <FlowEditor
                    widgetContainer={flowTabState.componentContainerDisplayItem}
                    frontFace={false}
                />
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionsNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get NavigationStore() {
        return this.props.navigationStore || this.context.NavigationStore;
    }

    @computed
    get object() {
        if (this.NavigationStore.selectedPanel) {
            return this.NavigationStore.selectedPanel.selectedObject;
        }
        return this.NavigationStore.selectedObject;
    }

    @computed
    get flowContainerDisplayItem() {
        if (this.props.navigationStore) {
            return undefined;
        }
        if (!this.context.EditorsStore.activeEditor) {
            return undefined;
        }
        let flowTabState = this.context.EditorsStore.activeEditor
            .state as FlowTabState;
        if (!flowTabState) {
            return undefined;
        }
        return flowTabState.componentContainerDisplayItem;
    }

    @computed
    get treeAdapter() {
        if (!this.flowContainerDisplayItem) {
            return null;
        }
        return new TreeAdapter(
            this.flowContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    cutSelection() {
        this.treeAdapter!.cutSelection();
    }

    copySelection() {
        this.treeAdapter!.copySelection();
    }

    pasteSelection() {
        this.treeAdapter!.pasteSelection();
    }

    deleteSelection() {
        this.treeAdapter!.deleteSelection();
    }

    get selectedObject() {
        return this.selectedObjects[0];
    }

    get selectedObjects() {
        const selectedObjects =
            this.flowContainerDisplayItem &&
            this.flowContainerDisplayItem.selectedObjects;
        if (selectedObjects && selectedObjects.length > 0) {
            return selectedObjects;
        }

        if (this.context.EditorsStore.activeEditor) {
            let flowTabState = this.context.EditorsStore.activeEditor
                .state as FlowTabState;
            return [flowTabState.flow];
        }

        return [];
    }

    @bind
    onFocus() {
        this.NavigationStore.setSelectedPanel(this);
    }

    render() {
        if (!this.flowContainerDisplayItem) {
            return <ListNavigationWithProperties {...this.props} />;
        }

        const listNavigation = (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
            />
        );
        const navigation = this.context.RuntimeStore.isRuntimeMode ? (
            listNavigation
        ) : (
            <Splitter
                type="vertical"
                persistId="page-editor/navigation-structure"
                sizes={`50%|50%`}
                childrenOverflow="hidden|hidden"
            >
                {listNavigation}
                <Panel
                    id="page-structure"
                    title="Action Structure"
                    body={
                        this.treeAdapter ? (
                            <Tree
                                treeAdapter={this.treeAdapter}
                                tabIndex={0}
                                onFocus={this.onFocus}
                            />
                        ) : (
                            <div />
                        )
                    }
                />
            </Splitter>
        );

        if (this.context.RuntimeStore.isRuntimeMode) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/actions-runtime"`}
                    sizes={`240px|100%`}
                    childrenOverflow={`hidden|hidden`}
                >
                    {navigation}
                    <Editors />
                </Splitter>
            );
        } else {
            const buttons: JSX.Element[] = [];

            if (!this.context.UIStateStore.viewOptions.themesVisible) {
                buttons.push(
                    <IconAction
                        key="show-themes"
                        icon="material:palette"
                        iconSize={16}
                        onClick={action(
                            () =>
                                (this.context.UIStateStore.viewOptions.themesVisible = true)
                        )}
                        title="Show themes panel"
                    ></IconAction>
                );
            }

            const properties = (
                <Splitter
                    type="vertical"
                    persistId="page-editor/properties-widgets-palette"
                    sizes={`100%|200px`}
                    childrenOverflow="hidden|hidden"
                >
                    <PropertiesPanel
                        object={this.selectedObject}
                        buttons={buttons}
                    />
                    <ComponentsPalette showOnlyActions={true} />
                </Splitter>
            );

            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/actions${
                        this.context.UIStateStore.viewOptions.themesVisible
                            ? ""
                            : "-without-themes"
                    }`}
                    sizes={`240px|100%|400px${
                        this.context.UIStateStore.viewOptions.themesVisible
                            ? "|240px"
                            : ""
                    }`}
                    childrenOverflow={`hidden|hidden|hidden${
                        this.context.UIStateStore.viewOptions.themesVisible
                            ? "|hidden"
                            : ""
                    }`}
                >
                    {navigation}
                    <Editors />
                    {properties}
                    {this.context.UIStateStore.viewOptions.themesVisible && (
                        <ThemesSideView hasCloseButton={true} />
                    )}
                </Splitter>
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Action extends Flow {
    @observable name: string;
    @observable description?: string;
    @observable implementationType: "native" | "flow";
    @observable implementation?: string;
    @observable usedIn?: string[];

    static classInfo = makeDerivedClassInfo(Flow.classInfo, {
        properties: [
            {
                name: "name",
                type: PropertyType.String,
                unique: true,
                isAssetName: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "implementationType",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "native"
                    }
                ],
                hideInPropertyGrid: (object: IEezObject) =>
                    getProject(object).settings.general.projectVersion !== "v1"
            },
            {
                name: "implementation",
                type: PropertyType.CPP,
                hideInPropertyGrid: (object: IEezObject) =>
                    getProject(object).settings.general.projectVersion !== "v1"
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: (object: IEezObject) =>
                    getProject(object).settings.general.projectType ===
                    ProjectType.DASHBOARD
            }
        ],
        beforeLoadHook: (action: Action, jsObject: any) => {
            if (jsObject.page) {
                jsObject.components = jsObject.page.components;
                jsObject.connectionLines = jsObject.page.connectionLines;
                delete jsObject.page;
                jsObject.implementationType = "flow";
            }
        },
        newItem: (parent: IEezObject) => {
            return showGenericDialog({
                dialogDefinition: {
                    title: "New Action",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, parent)
                            ]
                        }
                    ]
                },
                values: {}
            }).then(result => {
                return Promise.resolve(
                    Object.assign(
                        {
                            name: result.values.name
                        },
                        getProject(parent).settings.general.projectType ===
                            ProjectType.DASHBOARD
                            ? ({
                                  implementationType: "flow",
                                  components: [],
                                  connectionLine: []
                              } as Partial<Action>)
                            : {}
                    )
                );
            });
        },
        createEditorState: (action: Action) => {
            return action.implementationType === "flow"
                ? new FlowTabState(action)
                : undefined;
        },
        editorComponent: ActionEditor,
        navigationComponent: ActionsNavigation,
        navigationComponentId: "actions",
        icon: "code"
    });

    get pageRect() {
        return { left: 0, top: 0, width: 0, height: 0 };
    }

    renderComponents(flowContext: IFlowContext) {
        return (
            <ComponentsContainerEnclosure
                components={this.components}
                flowContext={flowContext}
            />
        );
    }
}

registerClass(Action);

////////////////////////////////////////////////////////////////////////////////

export function findAction(project: Project, actionName: string) {
    return findReferencedObject(project, "actions", actionName) as
        | Action
        | undefined;
}

////////////////////////////////////////////////////////////////////////////////

export default {
    name: "eezstudio-project-feature-action",
    version: "0.1.0",
    description: "Project actions",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    eezStudioExtension: {
        displayName: "Action",
        implementation: {
            projectFeature: {
                mandatory: false,
                key: "actions",
                type: PropertyType.Array,
                typeClass: Action,
                icon: "code",
                create: () => [],
                check: (object: IEezObject[]) => {
                    let messages: Message[] = [];

                    if (object.length > 32000) {
                        messages.push(
                            new Message(
                                Type.ERROR,
                                "Max. 32000 actions are supported",
                                object
                            )
                        );
                    }

                    return messages;
                },
                build: build,
                metrics: metrics
            }
        }
    }
};

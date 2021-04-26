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
    EditorComponent,
    IEditorState,
    getParent
} from "project-editor/core/object";
import { Message, Type } from "project-editor/core/output";
import {
    findReferencedObject,
    Project,
    getProject
} from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";
import { ProjectContext } from "project-editor/project/context";
import { Splitter } from "eez-studio-ui/splitter";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";
import { FlowEditor } from "project-editor/flow/flow-editor/editor";
import { FlowViewer } from "project-editor/flow/flow-runtime/viewer";
import { getDocumentStore, IPanel } from "project-editor/core/store";
import { ComponentsPalette } from "project-editor/flow/flow-editor/ComponentsPalette";
import { bind } from "bind-decorator";
import {
    ITreeObjectAdapter,
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { Flow, FlowTabState } from "project-editor/flow/flow";
import {
    IFlowContext,
    IViewStatePersistantState
} from "project-editor/flow/flow-interfaces";
import { ComponentsContainerEnclosure } from "project-editor/flow/flow-editor/render";
import { PropertyGrid } from "project-editor/components/PropertyGrid";

////////////////////////////////////////////////////////////////////////////////

class ActionFlowTabState extends FlowTabState {
    flow: Flow;
    frontFace = false;

    componentContainerDisplayItem: ITreeObjectAdapter;

    viewState: IViewStatePersistantState | undefined;

    constructor(object: IEezObject) {
        super();

        this.flow = object as Flow;
        this.componentContainerDisplayItem = new TreeObjectAdapter(this.flow);
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.componentContainerDisplayItem.selectedObject || this.flow;
    }

    @computed
    get selectedObjects() {
        return this.componentContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        this.componentContainerDisplayItem.loadState(state.selection);
        if (state.transform) {
            this.viewState = { transform: state.transform };
        }
    }

    saveState() {
        return {
            selection: this.componentContainerDisplayItem.saveState(),
            transform: this.viewState?.transform
        };
    }

    @action
    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item = this.componentContainerDisplayItem.getObjectAdapter(
                ancestor
            );
            if (item) {
                this.componentContainerDisplayItem.selectItems([item]);
                return;
            }
        }
    }

    @action
    selectObjects(objects: IEezObject[]) {
        const items: ITreeObjectAdapter[] = [];

        for (let i = 0; i < objects.length; i++) {
            const object = objects[i];

            let ancestor: IEezObject | undefined;
            for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
                let item = this.componentContainerDisplayItem.getObjectAdapter(
                    ancestor
                );
                if (item) {
                    items.push(item);
                    break;
                }
            }
        }

        this.componentContainerDisplayItem.selectItems(items);
    }
}

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
        let flowTabState = this.props.editor.state as ActionFlowTabState;
        return new TreeAdapter(
            flowTabState.componentContainerDisplayItem,
            undefined,
            undefined,
            true
        );
    }

    @computed
    get selectedObject() {
        let flowTabState = this.props.editor.state as ActionFlowTabState;
        return flowTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        let flowTabState = this.props.editor.state as ActionFlowTabState;
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
        const tabState = this.props.editor.state as
            | ActionTabState
            | ActionFlowTabState;

        if (tabState instanceof ActionTabState) {
            return <PropertyGrid objects={[tabState.selectedObject!]} />;
        } else {
            if (this.context.RuntimeStore.isRuntimeMode) {
                return (
                    <div
                        style={{
                            flexGrow: 1,
                            position: "relative"
                        }}
                    >
                        <FlowViewer
                            widgetContainer={
                                tabState.componentContainerDisplayItem
                            }
                            viewStatePersistantState={tabState.viewState}
                            onSavePersistantState={viewState =>
                                (tabState.viewState = viewState)
                            }
                            frontFace={false}
                            runningFlow={tabState.runningFlow}
                        />
                    </div>
                );
            }

            return (
                <Splitter
                    type="horizontal"
                    persistId="project-editor/action-editor"
                    sizes="100%|400px"
                    childrenOverflow="hidden|hidden"
                >
                    <FlowEditor
                        widgetContainer={tabState.componentContainerDisplayItem}
                        viewStatePersistantState={tabState.viewState}
                        onSavePersistantState={viewState =>
                            (tabState.viewState = viewState)
                        }
                        frontFace={false}
                    />
                    <Splitter
                        type="vertical"
                        persistId="page-editor/properties-widgets-palette"
                        sizes={`100%|200px`}
                        childrenOverflow="hidden|hidden"
                    >
                        <PropertiesPanel
                            object={this.selectedObject}
                            readOnly={this.context.RuntimeStore.isRuntimeMode}
                        />
                        <ComponentsPalette showOnlyActions={true} />
                    </Splitter>
                </Splitter>
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
            .state as ActionFlowTabState;
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
                .state as ActionFlowTabState;
            return [flowTabState.flow];
        }

        return [];
    }

    @bind
    onFocus() {
        this.NavigationStore.setSelectedPanel(this);
    }

    render() {
        const listNavigation = (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
                editable={!this.context.RuntimeStore.isRuntimeMode}
                navigationStore={this.props.navigationStore}
                dragAndDropManager={this.props.dragAndDropManager}
                onDoubleClickItem={this.props.onDoubleClickItem}
            />
        );

        return listNavigation;

        // if (this.props.navigationStore) {
        //     return listNavigation;
        // }

        // const navigation = this.context.RuntimeStore.isRuntimeMode ? (
        //     listNavigation
        // ) : (
        //     <Splitter
        //         type="vertical"
        //         persistId="page-editor/navigation-structure"
        //         sizes={`50%|50%`}
        //         childrenOverflow="hidden|hidden"
        //     >
        //         {listNavigation}
        //         <Panel
        //             id="page-structure"
        //             title="Action Structure"
        //             body={
        //                 this.treeAdapter ? (
        //                     <Tree
        //                         treeAdapter={this.treeAdapter}
        //                         tabIndex={0}
        //                         onFocus={this.onFocus}
        //                     />
        //                 ) : (
        //                     <div />
        //                 )
        //             }
        //         />
        //     </Splitter>
        // );

        // return navigation;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ActionTabState implements IEditorState {
    action: Action;

    constructor(object: IEezObject) {
        this.action = object as Action;
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.action;
    }

    @computed
    get selectedObjects() {
        return [];
    }

    loadState(state: any) {}

    saveState() {}

    selectObject(object: IEezObject) {}

    selectObjects(objects: IEezObject[]) {}
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
                    getDocumentStore(object).isDashboardProject
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
                        getDocumentStore(parent).isDashboardProject
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
                ? new ActionFlowTabState(action)
                : new ActionTabState(action);
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

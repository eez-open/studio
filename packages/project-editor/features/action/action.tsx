import React from "react";
import { computed, observable, runInAction } from "mobx";
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
    MessageType
} from "project-editor/core/object";
import {
    hideInPropertyGridIfDashboardOrApplet,
    hideInPropertyGridIfNotV1,
    Message
} from "project-editor/core/store";
import type { Project } from "project-editor/project/project";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { build } from "project-editor/features/action/build";
import { metrics } from "project-editor/features/action/metrics";
import { ProjectContext } from "project-editor/project/context";
import { Splitter } from "eez-studio-ui/splitter";
import { ListNavigation } from "project-editor/components/ListNavigation";
import { PropertiesPanel } from "project-editor/project/PropertiesPanel";
import { FlowEditor } from "project-editor/flow/editor/editor";
import { FlowViewer } from "project-editor/flow/runtime-viewer/viewer";
import {
    getAncestorOfType,
    getDocumentStore,
    IPanel
} from "project-editor/core/store";
import { ComponentsPalette } from "project-editor/flow/editor/ComponentsPalette";

import {
    ITreeObjectAdapter,
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { Flow, FlowTabState } from "project-editor/flow/flow";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { ComponentsContainerEnclosure } from "project-editor/flow/editor/render";
import { PropertyGrid } from "project-editor/components/PropertyGrid";
import { Transform } from "project-editor/flow/editor/transform";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

class ActionFlowTabState extends FlowTabState {
    frontFace = false;

    widgetContainer: ITreeObjectAdapter;

    @observable _transform: Transform = new Transform({
        translate: { x: 0, y: 0 },
        scale: 1
    });

    constructor(object: IEezObject) {
        super(object as Flow);

        this.widgetContainer = new TreeObjectAdapter(this.flow);
        this.resetTransform();
        this.loadState();
    }

    get transform() {
        return this._transform;
    }

    set transform(transform: Transform) {
        runInAction(() => (this._transform = transform));
    }

    loadState() {
        if (this.isRuntime) {
            return;
        }

        const state = this.DocumentStore.uiStateStore.getObjectUIState(
            this.flow,
            "flow-state"
        );

        if (!state) {
            return;
        }

        if (state.selection) {
            this.widgetContainer.loadState(state.selection);
        }

        if (state.transform && state.transform.translate) {
            this._transform = new Transform({
                translate: {
                    x: state.transform.translate.x ?? 0,
                    y: state.transform.translate.y ?? 0
                },
                scale: state.transform.scale ?? 1
            });
        }
    }

    saveState() {
        if (this.isRuntime) {
            return;
        }

        const state = {
            selection: this.widgetContainer.saveState(),
            transform: this._transform
                ? {
                      translate: {
                          x: this._transform.translate.x,
                          y: this._transform.translate.y
                      },
                      scale: this._transform.scale
                  }
                : undefined
        };

        this.DocumentStore.uiStateStore.updateObjectUIState(
            this.flow,
            "flow-state",
            state
        );

        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    focusHandler = () => {
        this.context.navigationStore.setSelectedPanel(this);
    };

    @computed
    get treeAdapter() {
        let flowTabState = this.props.editor.state as ActionFlowTabState;
        return new TreeAdapter(
            flowTabState.widgetContainer,
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
            if (this.context.runtime) {
                return (
                    <div
                        style={{
                            flexGrow: 1,
                            position: "relative"
                        }}
                    >
                        <FlowViewer tabState={tabState} />
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
                    <FlowEditor tabState={tabState} />
                    {this.context.uiStateStore.breakpoints.size > 0 ? (
                        <Splitter
                            type="vertical"
                            persistId="page-editor/properties-widgets-palette"
                            sizes={`100%|200px|100px`}
                            childrenOverflow="hidden|hidden|hidden"
                        >
                            <PropertiesPanel
                                object={this.selectedObject}
                                readOnly={this.context.runtime}
                            />
                            <ComponentsPalette showOnlyActions={true} />
                            <BreakpointsPanel />
                        </Splitter>
                    ) : (
                        <Splitter
                            type="vertical"
                            persistId="page-editor/properties-widgets-palette"
                            sizes={`100%|200px`}
                            childrenOverflow="hidden|hidden"
                        >
                            <PropertiesPanel
                                object={this.selectedObject}
                                readOnly={this.context.runtime}
                            />
                            <ComponentsPalette showOnlyActions={true} />
                        </Splitter>
                    )}
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

    get navigationStore() {
        return this.props.navigationStore || this.context.navigationStore;
    }

    @computed
    get object() {
        if (this.navigationStore.selectedPanel) {
            return this.navigationStore.selectedPanel.selectedObject;
        }
        return this.navigationStore.selectedObject;
    }

    @computed
    get flowContainerDisplayItem() {
        if (this.props.navigationStore) {
            return undefined;
        }
        if (!this.context.editorsStore.activeEditor) {
            return undefined;
        }
        let flowTabState = this.context.editorsStore.activeEditor
            .state as ActionFlowTabState;
        if (!flowTabState) {
            return undefined;
        }
        return flowTabState.widgetContainer;
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

        if (this.context.editorsStore.activeEditor) {
            let flowTabState = this.context.editorsStore.activeEditor
                .state as ActionFlowTabState;
            return [flowTabState.flow];
        }

        return [];
    }

    onFocus = () => {
        this.navigationStore.setSelectedPanel(this);
    };

    render() {
        const listNavigation = (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
                editable={!this.context.runtime}
                navigationStore={this.props.navigationStore}
                dragAndDropManager={this.props.dragAndDropManager}
                onDoubleClickItem={this.props.onDoubleClickItem}
            />
        );

        const action = getAncestorOfType<Action>(
            this.selectedObject,
            Action.classInfo
        );

        if (this.context.runtime || !action) {
            return listNavigation;
        }

        return (
            <Splitter
                type="vertical"
                persistId="action-editor/navigation-structure-1"
                sizes={`100%|240px`}
                childrenOverflow="hidden|hidden"
            >
                {listNavigation}

                <ListNavigation
                    id={"action-editor/local-variables"}
                    navigationObject={action.localVariables}
                />
            </Splitter>
        );

        // if (this.props.navigationStore) {
        //     return listNavigation;
        // }

        // const navigation = this.context.runtimeStore.isRuntimeMode ? (
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

    ensureSelectionVisible() {}
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
                unique: true
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
                hideInPropertyGrid: hideInPropertyGridIfNotV1
            },
            {
                name: "implementation",
                type: PropertyType.CPP,
                hideInPropertyGrid: hideInPropertyGridIfNotV1
            },
            {
                name: "usedIn",
                type: PropertyType.ConfigurationReference,
                referencedObjectCollectionPath: "settings/build/configurations",
                hideInPropertyGrid: hideInPropertyGridIfDashboardOrApplet
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
                const DocumentStore = getDocumentStore(parent);
                return Promise.resolve(
                    Object.assign(
                        {
                            name: result.values.name
                        },
                        DocumentStore.project.isDashboardProject ||
                            DocumentStore.project.isAppletProject ||
                            DocumentStore.project
                                .isFirmwareWithFlowSupportProject
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

registerClass("Action", Action);

////////////////////////////////////////////////////////////////////////////////

export function findAction(project: Project, actionName: string) {
    return ProjectEditor.documentSearch.findReferencedObject(
        project,
        "actions",
        actionName
    ) as Action | undefined;
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
                                MessageType.ERROR,
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

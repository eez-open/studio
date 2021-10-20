import React from "react";
import { computed, action, runInAction, observable } from "mobx";
import { observer } from "mobx-react";

import { _find } from "eez-studio-shared/algorithm";

import { Splitter } from "eez-studio-ui/splitter";
import { IconAction } from "eez-studio-ui/action";

import {
    EditorComponent,
    IEezObject,
    NavigationComponent
} from "project-editor/core/object";
import {
    ITreeObjectAdapter,
    TreeAdapter,
    TreeObjectAdapter,
    TreeObjectAdapterChildren
} from "project-editor/core/objectAdapter";
import { IPanel, getAncestorOfType } from "project-editor/core/store";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";
import { Panel } from "project-editor/components/Panel";

import { FlowEditor } from "project-editor/flow/flow-editor/editor";
import { FlowViewer } from "project-editor/flow/flow-runtime/viewer";
import { ComponentsPalette } from "project-editor/flow/flow-editor/ComponentsPalette";

import { PropertiesPanel } from "project-editor/project/PropertiesPanel";

import { ThemesSideView } from "project-editor/features/style/theme";
import { ProjectContext } from "project-editor/project/context";

import type { Page } from "project-editor/features/page/page";
import { Flow, FlowTabState } from "project-editor/flow/flow";
import { Transform } from "project-editor/flow/flow-editor/transform";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get pageTabState() {
        return this.props.editor.state as PageTabState;
    }

    focusHandler = () => {
        this.context.navigationStore.setSelectedPanel(this);
    };

    @computed
    get treeAdapter() {
        return new TreeAdapter(
            this.pageTabState.widgetContainer,
            undefined,
            undefined,
            true
        );
    }

    @computed
    get selectedObject() {
        return this.pageTabState.selectedObject;
    }

    @computed
    get selectedObjects() {
        return this.pageTabState.selectedObjects;
    }

    cutSelection() {
        if (!this.pageTabState.isRuntime) {
            this.treeAdapter.cutSelection();
        }
    }

    copySelection() {
        if (!this.pageTabState.isRuntime) {
            this.treeAdapter.copySelection();
        }
    }

    pasteSelection() {
        if (!this.pageTabState.isRuntime) {
            this.treeAdapter.pasteSelection();
        }
    }

    deleteSelection() {
        if (!this.pageTabState.isRuntime) {
            this.treeAdapter.deleteSelection();
        }
    }

    render() {
        const editor = (
            <div>
                {this.pageTabState.isRuntime ? (
                    <FlowViewer tabState={this.pageTabState} />
                ) : (
                    <FlowEditor tabState={this.pageTabState} />
                )}
            </div>
        );

        if (this.pageTabState.isRuntime) {
            return editor;
        }

        const buttons: JSX.Element[] = [];

        const hasThemes = !this.context.project.isDashboardProject;

        if (hasThemes && !this.context.uiStateStore.viewOptions.themesVisible) {
            buttons.push(
                <IconAction
                    key="show-themes"
                    icon="material:palette"
                    iconSize={16}
                    onClick={action(
                        () =>
                            (this.context.uiStateStore.viewOptions.themesVisible =
                                true)
                    )}
                    title="Show themes panel"
                ></IconAction>
            );
        }

        let properties;

        properties =
            this.context.uiStateStore.breakpoints.size > 0 ? (
                <Splitter
                    type="vertical"
                    persistId="page-editor/properties-widgets-palette-breakpoints"
                    sizes={`100%|200px|120px`}
                    childrenOverflow="hidden|hidden|hidden"
                >
                    <PropertiesPanel
                        object={this.selectedObject}
                        buttons={buttons}
                        readOnly={this.pageTabState.isRuntime}
                    />
                    <ComponentsPalette />
                    <BreakpointsPanel />
                </Splitter>
            ) : (
                <Splitter
                    type="vertical"
                    persistId="page-editor/properties-widgets-palette-breakpoints"
                    sizes={`100%|200px`}
                    childrenOverflow="hidden|hidden"
                >
                    <PropertiesPanel
                        object={this.selectedObject}
                        buttons={buttons}
                        readOnly={this.pageTabState.isRuntime}
                    />
                    <ComponentsPalette />
                </Splitter>
            );

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/page-editor${
                    hasThemes &&
                    this.context.uiStateStore.viewOptions.themesVisible
                        ? ""
                        : "-without-themes"
                }`}
                sizes={`100%|400px${
                    hasThemes &&
                    this.context.uiStateStore.viewOptions.themesVisible
                        ? "|240px"
                        : ""
                }`}
                childrenOverflow={`hidden|hidden${
                    hasThemes &&
                    this.context.uiStateStore.viewOptions.themesVisible
                        ? "|hidden"
                        : ""
                }`}
            >
                {editor}
                {properties}
                {hasThemes &&
                    this.context.uiStateStore.viewOptions.themesVisible && (
                        <ThemesSideView hasCloseButton={true} />
                    )}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class PageTreeObjectAdapter extends TreeObjectAdapter {
    constructor(private page: Page, private frontFace: boolean) {
        super(page);
    }

    @computed
    get children(): TreeObjectAdapterChildren {
        if (this.frontFace) {
            return this.page.components
                .filter(
                    component => component instanceof ProjectEditor.WidgetClass
                )
                .map(child => this.transformer(child));
        }

        return [
            ...this.page.components.map(child => this.transformer(child)),
            ...this.page.connectionLines.map(child => this.transformer(child))
        ];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PageTabState extends FlowTabState {
    widgetContainerFrontFace: ITreeObjectAdapter;
    widgetContainerBackFace: ITreeObjectAdapter;

    @observable _transform: Transform = new Transform({
        translate: { x: 0, y: 0 },
        scale: 1
    });

    constructor(object: IEezObject) {
        super(object as Flow);

        this.widgetContainerFrontFace = new PageTreeObjectAdapter(
            this.page,
            true
        );

        this.widgetContainerBackFace = new PageTreeObjectAdapter(
            this.page,
            false
        );

        this.resetTransform(this.transform);

        this.loadState();
    }

    get page() {
        return this.flow as Page;
    }

    @computed get frontFace() {
        return this.isRuntime
            ? this.DocumentStore.uiStateStore.pageRuntimeFrontFace
            : this.DocumentStore.uiStateStore.pageEditorFrontFace;
    }

    set frontFace(frontFace: boolean) {
        runInAction(() => {
            if (this.isRuntime) {
                this.DocumentStore.uiStateStore.pageRuntimeFrontFace =
                    frontFace;
            } else {
                this.DocumentStore.uiStateStore.pageEditorFrontFace = frontFace;
            }
        });
    }

    get widgetContainer() {
        if (this.frontFace) {
            return this.widgetContainerFrontFace;
        } else {
            return this.widgetContainerBackFace;
        }
    }

    get transform() {
        return this._transform;
    }

    set transform(transform: Transform) {
        runInAction(() => {
            this._transform = transform;
        });
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
            transform: {
                translate: {
                    x: this._transform.translate.x,
                    y: this._transform.translate.y
                },
                scale: this._transform.scale
            }
        };

        this.DocumentStore.uiStateStore.updateObjectUIState(
            this.flow,
            "flow-state",
            state
        );

        return undefined;
    }
}

@observer
export class PagesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.navigationStore.selectedPanel) {
            return this.context.navigationStore.selectedPanel.selectedObject;
        }
        return this.context.navigationStore.selectedObject;
    }

    @computed
    get componentContainerDisplayItem() {
        if (!this.context.editorsStore.activeEditor) {
            return undefined;
        }

        let pageTabState = this.context.editorsStore.activeEditor
            .state as PageTabState;
        if (!pageTabState) {
            return undefined;
        }

        return pageTabState.widgetContainer;
    }

    @computed
    get treeAdapter() {
        if (!this.componentContainerDisplayItem) {
            return null;
        }
        return new TreeAdapter(
            this.componentContainerDisplayItem,
            undefined,
            (object: IEezObject) => {
                return object instanceof ProjectEditor.WidgetClass;
            },
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
            this.componentContainerDisplayItem &&
            this.componentContainerDisplayItem.selectedObjects;
        if (selectedObjects && selectedObjects.length > 0) {
            return selectedObjects;
        }

        if (this.context.editorsStore.activeEditor) {
            let pageTabState = this.context.editorsStore.activeEditor
                .state as PageTabState;
            return [pageTabState.page];
        }

        return [];
    }

    onFocus = () => {
        this.context.navigationStore.setSelectedPanel(this);
    };

    render() {
        const listNavigation = (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
                editable={!this.context.runtime}
            />
        );

        const page = getAncestorOfType<Page>(
            this.selectedObject,
            ProjectEditor.PageClass.classInfo
        );

        const navigation = this.context.runtime ? (
            listNavigation
        ) : (
            <Splitter
                type="vertical"
                persistId="page-editor/navigation-structure-4"
                sizes={`100%|240px|240px`}
                childrenOverflow="hidden|hidden"
            >
                {listNavigation}
                <Panel
                    id="page-structure"
                    title="Page Structure"
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
                {page ? (
                    <ListNavigation
                        id={"page-editor/local-variables"}
                        navigationObject={page.localVariables}
                    />
                ) : (
                    <div />
                )}
            </Splitter>
        );

        return navigation;
    }
}

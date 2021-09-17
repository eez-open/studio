import React from "react";
import { computed, action, observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import classNames from "classnames";

import { _find } from "eez-studio-shared/algorithm";

import { Splitter } from "eez-studio-ui/splitter";
import { IconAction } from "eez-studio-ui/action";

import {
    EditorComponent,
    getAncestorOfType,
    getParent,
    IEezObject,
    NavigationComponent
} from "project-editor/core/object";
import {
    ITreeObjectAdapter,
    TreeAdapter,
    TreeObjectAdapter,
    TreeObjectAdapterChildren
} from "project-editor/core/objectAdapter";
import { getDocumentStore, IPanel } from "project-editor/core/store";

import { ListNavigation } from "project-editor/components/ListNavigation";
import { Tree } from "project-editor/components/Tree";
import { Panel } from "project-editor/components/Panel";

import { FlowEditor } from "project-editor/flow/flow-editor/editor";
import { FlowViewer } from "project-editor/flow/flow-runtime/viewer";
import { ComponentsPalette } from "project-editor/flow/flow-editor/ComponentsPalette";

import { PropertiesPanel } from "project-editor/project/PropertiesPanel";

import { ThemesSideView } from "project-editor/features/style/theme";
import { ProjectContext } from "project-editor/project/context";

import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { Page } from "project-editor/features/page/page";
import { Widget } from "project-editor/flow/component";
import { FlowTabState } from "project-editor/flow/flow";
import { IViewStatePersistantState } from "project-editor/flow/flow-interfaces";

////////////////////////////////////////////////////////////////////////////////

@observer
export class PageEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable transitionIsActive = false;

    @action.bound switchFaces() {
        // this.transitionIsActive = true;

        // setTimeout(() => {
        //     this.pageTabState.frontFace = !this.pageTabState.frontFace;
        //     setTimeout(
        //         action(() => {
        //             this.transitionIsActive = false;
        //         }),
        //         FLIP_CARD_ANIMATION_DURATION
        //     );
        // });

        this.pageTabState.frontFace = !this.pageTabState.frontFace;
    }

    get pageTabState() {
        return this.props.editor.state as PageTabState;
    }

    @bind
    focusHandler() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    @computed
    get treeAdapter() {
        return new TreeAdapter(
            this.pageTabState.componentContainerDisplayItem,
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
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <IconAction
                        title="Show front face"
                        icon="material:flip_to_front"
                        iconSize={16}
                        onClick={this.switchFaces}
                        selected={this.pageTabState.frontFace}
                    />
                    <IconAction
                        title="Show back face"
                        icon="material:flip_to_back"
                        iconSize={16}
                        onClick={this.switchFaces}
                        selected={!this.pageTabState.frontFace}
                    />
                    <div style={{ flexGrow: 1 }}></div>
                </ToolbarHeader>
                <Body>
                    {!this.transitionIsActive &&
                        (this.pageTabState.isRuntime ? (
                            <FlowViewer
                                widgetContainer={
                                    this.pageTabState
                                        .componentContainerDisplayItemRuntime
                                }
                                viewStatePersistantState={
                                    this.pageTabState.runtimeViewState
                                }
                                onSavePersistantState={viewState =>
                                    (this.pageTabState.runtimeViewState =
                                        viewState)
                                }
                                frontFace={this.pageTabState.frontFace}
                                runningFlow={this.pageTabState.runningFlow}
                            />
                        ) : (
                            <FlowEditor
                                widgetContainer={
                                    this.pageTabState
                                        .componentContainerDisplayItemEditor
                                }
                                viewStatePersistantState={
                                    this.pageTabState.editorViewState
                                }
                                onSavePersistantState={viewState =>
                                    (this.pageTabState.editorViewState =
                                        viewState)
                                }
                                frontFace={this.pageTabState.frontFace}
                            />
                        ))}
                    {this.transitionIsActive && (
                        <div className="EezStudio_FlipCardDiv">
                            <div
                                className={classNames("flip-card-inner", {
                                    "show-back-face":
                                        !this.pageTabState.frontFace
                                })}
                            >
                                <div className="flip-card-front">
                                    {this.pageTabState.isRuntime ? (
                                        <FlowViewer
                                            widgetContainer={
                                                this.pageTabState
                                                    .componentContainerDisplayItemRuntimeFrontFace
                                            }
                                            viewStatePersistantState={
                                                this.pageTabState
                                                    .runtimeFrontViewState
                                            }
                                            onSavePersistantState={viewState =>
                                                (this.pageTabState.runtimeFrontViewState =
                                                    viewState)
                                            }
                                            transitionIsActive={true}
                                            frontFace={true}
                                            runningFlow={
                                                this.pageTabState.runningFlow
                                            }
                                        />
                                    ) : (
                                        <FlowEditor
                                            widgetContainer={
                                                this.pageTabState
                                                    .componentContainerDisplayItemEditorFrontFace
                                            }
                                            viewStatePersistantState={
                                                this.pageTabState
                                                    .editorFrontViewState
                                            }
                                            onSavePersistantState={viewState =>
                                                (this.pageTabState.editorFrontViewState =
                                                    viewState)
                                            }
                                            transitionIsActive={true}
                                            frontFace={true}
                                        />
                                    )}
                                </div>
                                <div className="flip-card-back">
                                    {this.pageTabState.isRuntime ? (
                                        <FlowViewer
                                            widgetContainer={
                                                this.pageTabState
                                                    .componentContainerDisplayItemRuntimeBackFace
                                            }
                                            viewStatePersistantState={
                                                this.pageTabState
                                                    .runtimeBackViewState
                                            }
                                            onSavePersistantState={viewState =>
                                                (this.pageTabState.runtimeBackViewState =
                                                    viewState)
                                            }
                                            transitionIsActive={true}
                                            frontFace={false}
                                            runningFlow={
                                                this.pageTabState.runningFlow
                                            }
                                        />
                                    ) : (
                                        <FlowEditor
                                            widgetContainer={
                                                this.pageTabState
                                                    .componentContainerDisplayItemEditorBackFace
                                            }
                                            viewStatePersistantState={
                                                this.pageTabState
                                                    .editorBackViewState
                                            }
                                            onSavePersistantState={viewState =>
                                                (this.pageTabState.editorBackViewState =
                                                    viewState)
                                            }
                                            transitionIsActive={true}
                                            frontFace={false}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </Body>
            </VerticalHeaderWithBody>
        );

        if (this.pageTabState.isRuntime) {
            return editor;
        }

        const buttons: JSX.Element[] = [];

        const hasThemes = !this.context.isDashboardProject;

        if (hasThemes && !this.context.UIStateStore.viewOptions.themesVisible) {
            buttons.push(
                <IconAction
                    key="show-themes"
                    icon="material:palette"
                    iconSize={16}
                    onClick={action(
                        () =>
                            (this.context.UIStateStore.viewOptions.themesVisible =
                                true)
                    )}
                    title="Show themes panel"
                ></IconAction>
            );
        }

        let properties;

        properties = (
            <Splitter
                type="vertical"
                persistId="page-editor/properties-widgets-palette"
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
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? ""
                        : "-without-themes"
                }`}
                sizes={`100%|400px${
                    hasThemes &&
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? "|240px"
                        : ""
                }`}
                childrenOverflow={`hidden|hidden${
                    hasThemes &&
                    this.context.UIStateStore.viewOptions.themesVisible
                        ? "|hidden"
                        : ""
                }`}
            >
                {editor}
                {properties}
                {hasThemes &&
                    this.context.UIStateStore.viewOptions.themesVisible && (
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

    @computed({
        keepAlive: true
    })
    get children(): TreeObjectAdapterChildren {
        if (this.frontFace) {
            return this.page.components
                .filter(component => component instanceof Widget)
                .map(child => this.transformer(child));
        }

        return [
            ...this.page.components.map(child => this.transformer(child)),
            ...this.page.connectionLines.map(child => this.transformer(child))
        ];
    }
}

export class PageTabState extends FlowTabState {
    page: Page;

    componentContainerDisplayItemEditorFrontFace: ITreeObjectAdapter;
    componentContainerDisplayItemEditorBackFace: ITreeObjectAdapter;
    componentContainerDisplayItemRuntimeFrontFace: ITreeObjectAdapter;
    componentContainerDisplayItemRuntimeBackFace: ITreeObjectAdapter;

    editorFrontViewState: IViewStatePersistantState | undefined;
    editorBackViewState: IViewStatePersistantState | undefined;
    runtimeFrontViewState: IViewStatePersistantState | undefined;
    runtimeBackViewState: IViewStatePersistantState | undefined;

    constructor(object: IEezObject) {
        super();

        this.page = object as Page;

        this.componentContainerDisplayItemEditorFrontFace =
            new PageTreeObjectAdapter(this.page, true);

        this.componentContainerDisplayItemEditorBackFace =
            new PageTreeObjectAdapter(this.page, false);

        this.componentContainerDisplayItemRuntimeFrontFace =
            new PageTreeObjectAdapter(this.page, true);

        this.componentContainerDisplayItemRuntimeBackFace =
            new PageTreeObjectAdapter(this.page, false);
    }

    get flow() {
        return this.page;
    }

    @computed get DocumentStore() {
        return getDocumentStore(this.page);
    }

    @computed get isRuntime() {
        return this.DocumentStore.RuntimeStore.isRuntimeMode;
    }

    @computed get frontFace() {
        return this.isRuntime
            ? this.DocumentStore.UIStateStore.pageRuntimeFrontFace
            : this.DocumentStore.UIStateStore.pageEditorFrontFace;
    }

    set frontFace(frontFace: boolean) {
        runInAction(() => {
            if (this.isRuntime) {
                this.DocumentStore.UIStateStore.pageRuntimeFrontFace =
                    frontFace;
            } else {
                this.DocumentStore.UIStateStore.pageEditorFrontFace = frontFace;
            }
        });
    }

    @computed get componentContainerDisplayItemRuntime() {
        return this.frontFace
            ? this.componentContainerDisplayItemRuntimeFrontFace
            : this.componentContainerDisplayItemRuntimeBackFace;
    }

    @computed get componentContainerDisplayItemEditor() {
        return this.frontFace
            ? this.componentContainerDisplayItemEditorFrontFace
            : this.componentContainerDisplayItemEditorBackFace;
    }

    @computed get componentContainerDisplayItem() {
        if (this.isRuntime) {
            return this.componentContainerDisplayItemRuntime;
        }

        return this.componentContainerDisplayItemEditor;
    }

    get editorViewState() {
        return this.frontFace
            ? this.editorFrontViewState
            : this.editorBackViewState;
    }

    set editorViewState(viewState: IViewStatePersistantState | undefined) {
        if (this.frontFace) {
            this.editorFrontViewState = viewState;
        } else {
            this.editorBackViewState = viewState;
        }
    }

    get runtimeViewState() {
        return this.frontFace
            ? this.runtimeFrontViewState
            : this.runtimeBackViewState;
    }

    set runtimeViewState(viewState: IViewStatePersistantState | undefined) {
        if (this.frontFace) {
            this.runtimeFrontViewState = viewState;
        } else {
            this.runtimeBackViewState = viewState;
        }
    }

    @computed
    get selectedObject(): IEezObject | undefined {
        return this.componentContainerDisplayItem.selectedObject || this.page;
    }

    @computed
    get selectedObjects() {
        return this.componentContainerDisplayItem.selectedObjects;
    }

    loadState(state: any) {
        if (state.editorFront) {
            this.componentContainerDisplayItemEditorFrontFace.loadState(
                state.editorFront.selection
            );
            if (state.editorFront.transform) {
                this.editorFrontViewState = {
                    transform: state.editorFront.transform
                };
            }
        }

        if (state.editorBack) {
            this.componentContainerDisplayItemEditorBackFace.loadState(
                state.editorBack.selection
            );
            if (state.editorBack.transform) {
                this.editorBackViewState = {
                    transform: state.editorBack.transform
                };
            }
        }

        if (state.runtimeFront) {
            this.componentContainerDisplayItemRuntimeFrontFace.loadState(
                state.runtimeFront.selection
            );
            if (state.runtimeFront.transform) {
                this.runtimeFrontViewState = {
                    transform: state.runtimeFront.transform
                };
            }
        }

        if (state.runtimeBack) {
            this.componentContainerDisplayItemRuntimeBackFace.loadState(
                state.runtimeBack.selection
            );
            if (state.runtimeBack.transform) {
                this.runtimeBackViewState = {
                    transform: state.runtimeBack.transform
                };
            }
        }
    }

    saveState() {
        return {
            editorFront: {
                selection:
                    this.componentContainerDisplayItemEditorFrontFace.saveState(),
                transform: this.editorFrontViewState?.transform
            },
            editorBack: {
                selection:
                    this.componentContainerDisplayItemEditorBackFace.saveState(),
                transform: this.editorBackViewState?.transform
            },
            runtimeFront: {
                selection:
                    this.componentContainerDisplayItemRuntimeFrontFace.saveState(),
                transform: this.runtimeFrontViewState?.transform
            },
            runtimeBack: {
                selection:
                    this.componentContainerDisplayItemRuntimeBackFace.saveState(),
                transform: this.runtimeBackViewState?.transform
            }
        };
    }

    @action
    selectObject(object: IEezObject) {
        let ancestor: IEezObject | undefined;
        for (ancestor = object; ancestor; ancestor = getParent(ancestor)) {
            let item =
                this.componentContainerDisplayItem.getObjectAdapter(ancestor);
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
                let item =
                    this.componentContainerDisplayItem.getObjectAdapter(
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

@observer
export class PagesNavigation extends NavigationComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @computed
    get object() {
        if (this.context.NavigationStore.selectedPanel) {
            return this.context.NavigationStore.selectedPanel.selectedObject;
        }
        return this.context.NavigationStore.selectedObject;
    }

    @computed
    get componentContainerDisplayItem() {
        if (!this.context.EditorsStore.activeEditor) {
            return undefined;
        }
        let pageTabState = this.context.EditorsStore.activeEditor
            .state as PageTabState;
        if (!pageTabState) {
            return undefined;
        }
        return pageTabState.componentContainerDisplayItem;
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
                return object instanceof Widget;
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

        if (this.context.EditorsStore.activeEditor) {
            let pageTabState = this.context.EditorsStore.activeEditor
                .state as PageTabState;
            return [pageTabState.page];
        }

        return [];
    }

    @bind
    onFocus() {
        this.context.NavigationStore.setSelectedPanel(this);
    }

    render() {
        const listNavigation = (
            <ListNavigation
                id={this.props.id}
                navigationObject={this.props.navigationObject}
                editable={!this.context.RuntimeStore.isRuntimeMode}
                filter={(page: Page) =>
                    !this.context.RuntimeStore.isRuntimeMode ||
                    !page.isUsedAsCustomWidget
                }
            />
        );

        const page = getAncestorOfType<Page>(
            this.selectedObject,
            Page.classInfo
        );

        const navigation = this.context.RuntimeStore.isRuntimeMode ? (
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

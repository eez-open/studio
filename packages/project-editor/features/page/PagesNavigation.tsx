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
    getParent,
    IEditorState,
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

import { Editors, PropertiesPanel } from "project-editor/project/ProjectEditor";

import { ThemesSideView } from "project-editor/features/style/theme";
import { ProjectContext } from "project-editor/project/context";

import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { styled } from "eez-studio-ui/styled-components";
import { Page } from "project-editor/features/page/page";
import { Widget } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

const FlipCardDiv = styled.div`
    perspective: 1000px;
    flex-grow: 1;
    overflow: hidden;
    background-color: ${props => props.theme.panelHeaderColor};

    .flip-card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transition: transform 0.6s;
        transform-style: preserve-3d;
    }

    .flip-card-inner.show-back-face {
        transform: rotateY(-180deg);
    }

    .flip-card-front,
    .flip-card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
    }

    .flip-card-back {
        transform: rotateY(180deg);
    }
`;

@observer
export class PageEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    @observable transitionIsActive = false;

    flipCardInnerRef = React.createRef<HTMLDivElement>();

    get pageTabState() {
        return this.props.editor.state as PageTabState;
    }

    @action.bound
    onTransitionStart(event: TransitionEvent) {
        if (event.target === this.flipCardInnerRef.current) {
            this.transitionIsActive = true;
        }
    }

    @action.bound
    onTransitionEnd(event: TransitionEvent) {
        if (event.target === this.flipCardInnerRef.current) {
            this.transitionIsActive = false;
        }
    }

    componentDidMount() {
        const el = this.flipCardInnerRef.current!;

        el.addEventListener("transitionstart", this.onTransitionStart, false);

        el.addEventListener("transitionend", this.onTransitionEnd, false);
    }

    componentWillUnmount() {
        const el = this.flipCardInnerRef.current!;

        el.removeEventListener(
            "transitionstart",
            this.onTransitionStart,
            false
        );

        el.removeEventListener("transitionend", this.onTransitionEnd, false);
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
        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader>
                    <IconAction
                        title="Show front face"
                        icon="material:flip_to_front"
                        iconSize={16}
                        onClick={action(
                            () => (this.pageTabState.frontFace = true)
                        )}
                        selected={this.pageTabState.frontFace}
                    />
                    <IconAction
                        title="Show back face"
                        icon="material:flip_to_back"
                        iconSize={16}
                        onClick={action(
                            () => (this.pageTabState.frontFace = false)
                        )}
                        selected={!this.pageTabState.frontFace}
                    />
                    <div style={{ flexGrow: 1 }}></div>
                </ToolbarHeader>
                <Body>
                    <FlipCardDiv>
                        <div
                            ref={this.flipCardInnerRef}
                            className={classNames("flip-card-inner", {
                                "show-back-face": !this.pageTabState.frontFace
                            })}
                        >
                            <div
                                className="flip-card-front"
                                style={{
                                    display:
                                        this.pageTabState.frontFace ||
                                        this.transitionIsActive
                                            ? "flex"
                                            : "none"
                                }}
                            >
                                {this.pageTabState.isRuntime ? (
                                    <FlowViewer
                                        widgetContainer={
                                            this.pageTabState
                                                .componentContainerDisplayItemRuntimeFrontFace
                                        }
                                        transitionIsActive={
                                            this.transitionIsActive
                                        }
                                        frontFace={true}
                                    />
                                ) : (
                                    <FlowEditor
                                        widgetContainer={
                                            this.pageTabState
                                                .componentContainerDisplayItemEditorFrontFace
                                        }
                                        transitionIsActive={
                                            this.transitionIsActive
                                        }
                                        frontFace={true}
                                    />
                                )}
                            </div>
                            <div
                                className="flip-card-back"
                                style={{
                                    display:
                                        !this.pageTabState.frontFace ||
                                        this.transitionIsActive
                                            ? "flex"
                                            : "none"
                                }}
                            >
                                {this.pageTabState.isRuntime ? (
                                    <FlowViewer
                                        widgetContainer={
                                            this.pageTabState
                                                .componentContainerDisplayItemRuntimeBackFace
                                        }
                                        transitionIsActive={
                                            this.transitionIsActive
                                        }
                                        frontFace={false}
                                    />
                                ) : (
                                    <FlowEditor
                                        widgetContainer={
                                            this.pageTabState
                                                .componentContainerDisplayItemEditorBackFace
                                        }
                                        transitionIsActive={
                                            this.transitionIsActive
                                        }
                                        frontFace={false}
                                    />
                                )}
                            </div>
                        </div>
                    </FlipCardDiv>
                </Body>
            </VerticalHeaderWithBody>
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

export class PageTabState implements IEditorState {
    page: Page;
    componentContainerDisplayItemEditorFrontFace: ITreeObjectAdapter;
    componentContainerDisplayItemEditorBackFace: ITreeObjectAdapter;
    componentContainerDisplayItemRuntimeFrontFace: ITreeObjectAdapter;
    componentContainerDisplayItemRuntimeBackFace: ITreeObjectAdapter;

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
                this.DocumentStore.UIStateStore.pageRuntimeFrontFace = frontFace;
            } else {
                this.DocumentStore.UIStateStore.pageEditorFrontFace = frontFace;
            }
        });
    }

    constructor(object: IEezObject) {
        this.page = object as Page;

        this.componentContainerDisplayItemEditorFrontFace = new PageTreeObjectAdapter(
            this.page,
            true
        );

        this.componentContainerDisplayItemEditorBackFace = new PageTreeObjectAdapter(
            this.page,
            false
        );

        this.componentContainerDisplayItemRuntimeFrontFace = new PageTreeObjectAdapter(
            this.page,
            true
        );

        this.componentContainerDisplayItemRuntimeBackFace = new PageTreeObjectAdapter(
            this.page,
            false
        );
    }

    @computed get componentContainerDisplayItem() {
        if (this.isRuntime) {
            return this.frontFace
                ? this.componentContainerDisplayItemRuntimeFrontFace
                : this.componentContainerDisplayItemRuntimeBackFace;
        }

        return this.frontFace
            ? this.componentContainerDisplayItemEditorFrontFace
            : this.componentContainerDisplayItemEditorBackFace;
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
        this.componentContainerDisplayItemEditorFrontFace.loadState(
            state.editorFront
        );
        this.componentContainerDisplayItemEditorBackFace.loadState(
            state.editorBack
        );
        this.componentContainerDisplayItemRuntimeFrontFace.loadState(
            state.runtimeFront
        );
        this.componentContainerDisplayItemRuntimeBackFace.loadState(
            state.runtimeBack
        );
    }

    saveState() {
        return {
            editorFront: this.componentContainerDisplayItemEditorFrontFace.saveState(),
            editorBack: this.componentContainerDisplayItemEditorBackFace.saveState(),
            runtimeFront: this.componentContainerDisplayItemRuntimeFrontFace.saveState(),
            runtimeBack: this.componentContainerDisplayItemRuntimeBackFace.saveState()
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
            </Splitter>
        );

        const editors = <Editors />;

        if (this.context.RuntimeStore.isRuntimeMode) {
            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/pages-runtime"`}
                    sizes={"240px|100%"}
                    childrenOverflow={`hidden|hidden`}
                >
                    {navigation}
                    {editors}
                </Splitter>
            );
        } else {
            const buttons: JSX.Element[] = [];

            const hasThemes = !this.context.isDashboardProject;

            if (
                hasThemes &&
                !this.context.UIStateStore.viewOptions.themesVisible
            ) {
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
                    />
                    <ComponentsPalette />
                </Splitter>
            );

            return (
                <Splitter
                    type="horizontal"
                    persistId={`project-editor/pages${
                        hasThemes &&
                        this.context.UIStateStore.viewOptions.themesVisible
                            ? ""
                            : "-without-themes"
                    }`}
                    sizes={`240px|100%|400px${
                        hasThemes &&
                        this.context.UIStateStore.viewOptions.themesVisible
                            ? "|240px"
                            : ""
                    }`}
                    childrenOverflow={`hidden|hidden|hidden${
                        hasThemes &&
                        this.context.UIStateStore.viewOptions.themesVisible
                            ? "|hidden"
                            : ""
                    }`}
                >
                    {navigation}
                    {editors}
                    {properties}
                    {hasThemes &&
                        this.context.UIStateStore.viewOptions.themesVisible && (
                            <ThemesSideView hasCloseButton={true} />
                        )}
                </Splitter>
            );
        }
    }
}

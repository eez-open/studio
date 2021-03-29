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

import { FlowEditor as StudioPageEditor } from "project-editor/features/gui/flow-editor/editor";
import { ComponentsPalette } from "project-editor/features/gui/flow-editor/ComponentsPalette";

import { Editors, PropertiesPanel } from "project-editor/project/ProjectEditor";

import { ThemesSideView } from "project-editor/features/gui/theme";
import { ProjectContext } from "project-editor/project/context";

import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { styled } from "eez-studio-ui/styled-components";
import { Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/component";

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
        display: flex;
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

    componentDidMount() {
        const el = this.flipCardInnerRef.current!;

        console.log(el);

        el.addEventListener(
            "transitionstart",
            action(() => (this.transitionIsActive = true)),
            false
        );

        el.addEventListener(
            "transitionend",
            action(() => (this.transitionIsActive = false)),
            false
        );
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
                                <StudioPageEditor
                                    widgetContainer={
                                        this.pageTabState
                                            .componentContainerDisplayItem
                                    }
                                    transitionIsActive={this.transitionIsActive}
                                    frontFace={true}
                                />
                            </div>
                            <div className="flip-card-back">
                                <StudioPageEditor
                                    widgetContainer={
                                        this.pageTabState
                                            .componentContainerDisplayItem
                                    }
                                    transitionIsActive={this.transitionIsActive}
                                    frontFace={false}
                                />
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
    componentContainerDisplayItemFrontFace: ITreeObjectAdapter;
    componentContainerDisplayItemBackFace: ITreeObjectAdapter;

    @computed get frontFace() {
        return getDocumentStore(this.page).UIStateStore.pageFrontFace;
    }

    set frontFace(frontFace: boolean) {
        runInAction(
            () =>
                (getDocumentStore(
                    this.page
                ).UIStateStore.pageFrontFace = frontFace)
        );
    }

    constructor(object: IEezObject) {
        this.page = object as Page;
        this.componentContainerDisplayItemFrontFace = new PageTreeObjectAdapter(
            this.page,
            true
        );
        this.componentContainerDisplayItemBackFace = new PageTreeObjectAdapter(
            this.page,
            false
        );
    }

    @computed get componentContainerDisplayItem() {
        return this.frontFace
            ? this.componentContainerDisplayItemFrontFace
            : this.componentContainerDisplayItemBackFace;
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
        this.componentContainerDisplayItem.loadState(state);
    }

    saveState() {
        return this.componentContainerDisplayItem.saveState();
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
        const navigation = (
            <Splitter
                type="vertical"
                persistId="page-editor/navigation-structure"
                sizes={`50%|50%`}
                childrenOverflow="hidden|hidden"
            >
                <ListNavigation
                    id={this.props.id}
                    navigationObject={this.props.navigationObject}
                />
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
                <ComponentsPalette />
            </Splitter>
        );

        return (
            <Splitter
                type="horizontal"
                persistId={`project-editor/pages${
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

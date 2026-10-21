import React from "react";
import {
    action,
    computed,
    runInAction,
    makeObservable,
    observable
} from "mobx";
import { observer } from "mobx-react";
import { IEezObject } from "project-editor/core/object";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { FlowEditor } from "project-editor/flow/editor/editor";
import { FlowViewer } from "project-editor/flow/runtime-viewer/viewer";
import { ProjectContext } from "project-editor/project/context";
import type { Page, PageLayout } from "project-editor/features/page/page";
import { getPageLayouts } from "project-editor/features/page/page-layouts";
import { Flow } from "project-editor/flow/flow";
import { FlowTabState } from "project-editor/flow/flow-tab-state";
import { Transform } from "project-editor/flow/editor/transform";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { Splitter } from "eez-studio-ui/splitter";
import { ButtonAction } from "eez-studio-ui/action";
import { objectToString } from "project-editor/store/helper";
import { PageTimelineEditorState, PageTimelineEditor } from "./PageTimeline";

////////////////////////////////////////////////////////////////////////////////

export const PageEditor = observer(
    class PageEditor extends EditorComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get pageTabState() {
            return this.props.editor.state as PageTabState;
        }

        renderFlowEditor() {
            return (
                <>
                    <FlowEditor tabState={this.pageTabState} />
                    {this.pageTabState.selectedPageLayout && (
                        <PageLayoutsToolbar pageTabState={this.pageTabState} />
                    )}
                </>
            );
        }

        render() {
            return this.pageTabState.isRuntime ? (
                <FlowViewer tabState={this.pageTabState} />
            ) : this.context.projectTypeTraits.hasFlowSupport &&
              this.pageTabState.timeline.isEditorActive ? (
                <Splitter
                    type="vertical"
                    sizes="65%|35%"
                    persistId="project-editor/page/page-timeline-splitter"
                    className="EezStudio_PageTimelineSplitter"
                    splitterSize={5}
                >
                    {this.renderFlowEditor()}
                    <PageTimelineEditor tabState={this.pageTabState} />
                </Splitter>
            ) : (
                this.renderFlowEditor()
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

// the page layout rectangle in the button is 20 times smaller than the page
const PAGE_LAYOUT_ICON_SCALE = 1 / 20;

// Rectangle with the shape and the (scaled) size of the page layout.
function getPageLayoutIcon(pageLayout: PageLayout) {
    const getSize = (size: number) =>
        Math.max(Math.round((size || 0) * PAGE_LAYOUT_ICON_SCALE), 2);

    const width = getSize(pageLayout.width);
    const height = getSize(pageLayout.height);

    return (
        <div className="EezStudio_PageLayoutsToolbar_LayoutRect">
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                <rect
                    x={0.5}
                    y={0.5}
                    width={width - 1}
                    height={height - 1}
                    fill="currentColor"
                    fillOpacity={0.2}
                    stroke="currentColor"
                />
            </svg>
        </div>
    );
}

// Floating toolbar, at the top of the page editor, for selecting the page
// layout shown and edited in the editor.
const PageLayoutsToolbar = observer(
    class PageLayoutsToolbar extends React.Component<{
        pageTabState: PageTabState;
    }> {
        onApplyToAllLayoutsChange = action(
            (event: React.ChangeEvent<HTMLInputElement>) => {
                this.props.pageTabState.applyToAllLayouts =
                    event.currentTarget.checked;
            }
        );

        render() {
            const { pageTabState } = this.props;

            const pageLayouts = getPageLayouts(pageTabState.page);

            return (
                <div className="EezStudio_PageLayoutsToolbar">
                    <div className="btn-group" role="group">
                        {pageLayouts.map(pageLayout => (
                            <ButtonAction
                                key={pageLayout.objID}
                                text={
                                    <>
                                        {getPageLayoutIcon(pageLayout)}
                                        <span>{pageLayout.name}</span>
                                    </>
                                }
                                title={objectToString(pageLayout)}
                                selected={
                                    pageLayout ==
                                    pageTabState.selectedPageLayout
                                }
                                onClick={action(
                                    () =>
                                        (pageTabState.selectedLayoutId =
                                            pageLayout.objID)
                                )}
                            />
                        ))}
                    </div>
                    <div className="EezStudio_PageLayoutsToolbar_Separator" />
                    <label
                        className="form-check form-switch"
                        title="Change the position, size, resizing, style and visibility of the widgets in all layouts and not only in the selected layout"
                    >
                        <input
                            className="form-check-input"
                            type="checkbox"
                            checked={pageTabState.applyToAllLayouts}
                            onChange={this.onApplyToAllLayoutsChange}
                        />
                        <span className="form-check-label">
                            Apply to all layouts
                        </span>
                    </label>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class PageTreeObjectAdapter extends TreeObjectAdapter {
    constructor(private page: Page, private frontFace: boolean) {
        super(page);
    }

    get children() {
        if (this.frontFace) {
            return this.page.components
                .filter(
                    component => component instanceof ProjectEditor.WidgetClass
                )
                .map(child => this.transformer(child));
        }

        return [
            ...this.page.components.map(child => this.transformer(child)),
            ...this.page.connectionLines.map(child => this.transformer(child)),
            ...this.page.componentGroups.map(child => this.transformer(child))
        ];
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PageTabState extends FlowTabState {
    widgetContainerFrontFace: TreeObjectAdapter;
    widgetContainerBackFace: TreeObjectAdapter;

    _transform: Transform = new Transform({
        translate: { x: 0, y: 0 },
        scale: 1
    });

    _timeline: PageTimelineEditorState;

    get timeline() {
        return this._timeline;
    }

    set timeline(value: PageTimelineEditorState) {
        this._timeline = value;
    }

    // Background color used to preview a User Widget over a non-default
    // background (e.g. to check visibility on dark screens).
    previewBackgroundColor: string | undefined = undefined;

    // objID of the page layout shown and edited in the editor
    selectedLayoutId: string | undefined = undefined;

    // if enabled, changes of the layout specific properties are done in
    // all the page layouts and not only in the selected page layout
    applyToAllLayouts: boolean = false;

    constructor(object: IEezObject, transform?: Transform) {
        super(object as Flow);

        makeObservable(this, {
            _transform: observable,
            transform: computed,
            frontFace: computed,
            previewBackgroundColor: observable,
            selectedLayoutId: observable,
            applyToAllLayouts: observable,
            selectedPageLayout: computed
        });

        this.widgetContainerFrontFace = new PageTreeObjectAdapter(
            this.page,
            true
        );

        this.widgetContainerBackFace = new PageTreeObjectAdapter(
            this.page,
            false
        );

        if (transform) {
            this._transform = transform;
        } else {
            this.resetTransform(this.transform);
        }

        this.timeline = new PageTimelineEditorState(this);

        this.loadState();
    }

    get page() {
        return this.flow as Page;
    }

    // if the page has layouts, one of them is always selected
    get selectedPageLayout(): PageLayout | undefined {
        const pageLayouts = getPageLayouts(this.page);
        if (pageLayouts.length == 0) {
            return undefined;
        }

        // page layout of the page shown by the runtime
        const runtime = this.projectStore.runtime;
        if (runtime && runtime.selectedPage == this.page) {
            const pageLayout = pageLayouts.find(
                pageLayout => pageLayout.name == runtime.selectedPageLayoutName
            );
            if (pageLayout) {
                return pageLayout;
            }
        }

        return (
            pageLayouts.find(
                pageLayout => pageLayout.objID == this.selectedLayoutId
            ) ?? pageLayouts[0]
        );
    }

    get isTimelineEditorActive() {
        return this.timeline.isEditorActive;
    }

    get frontFace() {
        return this.isRuntime
            ? (this.projectStore.uiStateStore?.pageRuntimeFrontFace ?? true)
            : this.projectStore.uiStateStore.pageEditorFrontFace;
    }

    set frontFace(frontFace: boolean) {
        runInAction(() => {
            if (this.isRuntime) {
                this.projectStore.uiStateStore.pageRuntimeFrontFace = frontFace;
            } else {
                this.projectStore.uiStateStore.pageEditorFrontFace = frontFace;
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
        if (!this.isRuntime && this.projectStore.uiStateStore.globalFlowZoom) {
            this._transform.scale = this.projectStore.uiStateStore.flowZoom;
        }
        return this._transform;
    }

    set transform(transform: Transform) {
        runInAction(() => {
            this._transform = transform;
            if (
                !this.isRuntime &&
                this.projectStore.uiStateStore.globalFlowZoom
            ) {
                this.projectStore.uiStateStore.flowZoom = transform.scale;
            }
        });
    }

    resetTransform(transform?: Transform) {
        if (!transform) {
            if (this.projectStore.uiStateStore.globalFlowZoom) {
                this.projectStore.uiStateStore.flowZoom = 1;
            }

            transform = this.transform;
        }

        transform.scale = 1;
        transform.translate = {
            x: -this.flow.pageRect.width / 2,
            y: -this.flow.pageRect.height / 2
        };
    }

    loadState() {
        if (this.isRuntime) {
            return;
        }

        const state = this.projectStore.uiStateStore.getObjectUIState(
            this.flow,
            "flow-state"
        );

        if (!state) {
            return;
        }

        if (state.selectionFront) {
            this.widgetContainerFrontFace.loadState(state.selectionFront);
        }

        if (state.selectionBack) {
            this.widgetContainerBackFace.loadState(state.selectionBack);
        }

        if (state.transform && state.transform.translate) {
            this._transform = new Transform({
                translate: {
                    x: state.transform.translate.x ?? 0,
                    y: state.transform.translate.y ?? 0
                },
                scale: this.projectStore.uiStateStore.globalFlowZoom
                    ? this.projectStore.uiStateStore.flowZoom
                    : (state.transform.scale ?? 1)
            });
        }

        if (state.timeline) {
            this.timeline.loadState(state.timeline);
        }

        if (state.selectedLayoutId != undefined) {
            this.selectedLayoutId = state.selectedLayoutId;
        }

        if (state.applyToAllLayouts != undefined) {
            this.applyToAllLayouts = state.applyToAllLayouts;
        }
    }

    saveState() {
        if (this.isRuntime) {
            return;
        }

        const state = {
            selectionFront: this.widgetContainerFrontFace.saveState(),
            selectionBack: this.widgetContainerBackFace.saveState(),
            transform: {
                translate: {
                    x: this.transform.translate.x,
                    y: this.transform.translate.y
                },
                scale: this.transform.scale
            },
            timeline: this.timeline.saveState(),
            selectedLayoutId: this.selectedLayoutId,
            applyToAllLayouts: this.applyToAllLayouts
        };

        this.projectStore.uiStateStore.updateObjectUIState(
            this.flow,
            "flow-state",
            state
        );

        return undefined;
    }
}

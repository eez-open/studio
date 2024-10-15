import React from "react";
import { computed, runInAction, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import { IEezObject } from "project-editor/core/object";
import { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import { FlowEditor } from "project-editor/flow/editor/editor";
import { FlowViewer } from "project-editor/flow/runtime-viewer/viewer";
import { ProjectContext } from "project-editor/project/context";
import type { Page } from "project-editor/features/page/page";
import { Flow } from "project-editor/flow/flow";
import { FlowTabState } from "project-editor/flow/flow-tab-state";
import { Transform } from "project-editor/flow/editor/transform";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import { Splitter } from "eez-studio-ui/splitter";
import { PageTimelineEditorState, PageTimelineEditor } from "./PageTimeline";

////////////////////////////////////////////////////////////////////////////////

export const PageEditor = observer(
    class PageEditor extends EditorComponent {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        get pageTabState() {
            return this.props.editor.state as PageTabState;
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
                    <FlowEditor tabState={this.pageTabState} />
                    <PageTimelineEditor tabState={this.pageTabState} />
                </Splitter>
            ) : (
                <FlowEditor tabState={this.pageTabState} />
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
            ...this.page.connectionLines.map(child => this.transformer(child))
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

    constructor(object: IEezObject, transform?: Transform) {
        super(object as Flow);

        makeObservable(this, {
            _transform: observable,
            transform: computed,
            frontFace: computed
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

    get isTimelineEditorActive() {
        return this.timeline.isEditorActive;
    }

    get frontFace() {
        return this.isRuntime
            ? this.projectStore.uiStateStore?.pageRuntimeFrontFace ?? true
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

        if (state.selection) {
            this.widgetContainer.loadState(state.selection);
        }

        if (state.transform && state.transform.translate) {
            this._transform = new Transform({
                translate: {
                    x: state.transform.translate.x ?? 0,
                    y: state.transform.translate.y ?? 0
                },
                scale: this.projectStore.uiStateStore.globalFlowZoom
                    ? this.projectStore.uiStateStore.flowZoom
                    : state.transform.scale ?? 1
            });
        }

        if (state.timeline) {
            this.timeline.loadState(state.timeline);
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
                    x: this.transform.translate.x,
                    y: this.transform.translate.y
                },
                scale: this.transform.scale
            },
            timeline: this.timeline.saveState()
        };

        this.projectStore.uiStateStore.updateObjectUIState(
            this.flow,
            "flow-state",
            state
        );

        return undefined;
    }
}

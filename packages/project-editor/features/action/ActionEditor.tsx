import React from "react";
import { computed, observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { FlowEditor } from "project-editor/flow/editor/editor";
import { FlowViewer } from "project-editor/flow/runtime-viewer/viewer";
import {
    ITreeObjectAdapter,
    TreeAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";
import { EditorComponent } from "project-editor/project/EditorComponent";
import { Flow, FlowTabState } from "project-editor/flow/flow";
import { Transform } from "project-editor/flow/editor/transform";
import { IEezObject } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ActionEditor extends EditorComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

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

    render() {
        const tabState = this.props.editor.state as ActionFlowTabState;

        if (this.context.runtime) {
            return (
                <div
                    style={{
                        flexGrow: 1,
                        position: "relative",
                        height: "100%"
                    }}
                >
                    <FlowViewer tabState={tabState} />
                </div>
            );
        }

        return <FlowEditor tabState={tabState} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ActionFlowTabState extends FlowTabState {
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

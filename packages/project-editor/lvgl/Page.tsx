import React from "react";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import type { Page } from "project-editor/features/page/page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    LVGLNonActivePageViewerRuntime,
    LVGLPageEditorRuntime,
    LVGLPageRuntime
} from "project-editor/lvgl/page-runtime";

export const LVGLPage = observer(
    class LVGLPage extends React.Component<{
        page: Page;
        flowContext: IFlowContext;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();
        runtime: LVGLPageRuntime;

        componentDidMount() {
            if (this.context.runtime) {
                this.runtime = new LVGLNonActivePageViewerRuntime(
                    this.context,
                    this.props.page,
                    this.context.project.settings.general.displayWidth,
                    this.context.project.settings.general.displayHeight,
                    this.canvasRef.current!.getContext("2d")!
                );
            } else {
                this.runtime = new LVGLPageEditorRuntime(
                    this.props.page,
                    this.canvasRef.current!.getContext("2d")!
                );
            }

            this.runtime.mount();
        }

        componentWillUnmount() {
            this.runtime.unmount();
        }

        render() {
            return (
                <canvas
                    ref={this.canvasRef}
                    width={this.context.project.settings.general.displayWidth}
                    height={this.context.project.settings.general.displayHeight}
                    style={{
                        imageRendering:
                            this.props.flowContext.viewState.transform.scale > 1
                                ? "pixelated"
                                : undefined
                    }}
                ></canvas>
            );
        }
    }
);

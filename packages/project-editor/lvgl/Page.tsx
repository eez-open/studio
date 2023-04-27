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
        runtime: LVGLPageRuntime | undefined;

        createPageRuntime() {
            if (this.context.runtime) {
                this.runtime = new LVGLNonActivePageViewerRuntime(
                    this.context,
                    this.props.page,
                    this.props.page.width,
                    this.props.page.height,
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

        componentDidMount() {
            this.createPageRuntime();
        }

        componentDidUpdate() {
            if (this.runtime) {
                this.runtime.unmount();
                this.runtime = undefined;
            }

            this.createPageRuntime();
        }

        componentWillUnmount() {
            setTimeout(() => {
                if (this.runtime) {
                    this.runtime.unmount();
                }
            });
        }

        render() {
            return (
                <LVGLPageCanvasWithForwardedRef
                    ref={this.canvasRef}
                    width={this.props.page.width}
                    height={this.props.page.height}
                    flowContext={this.props.flowContext}
                ></LVGLPageCanvasWithForwardedRef>
            );
        }
    }
);

interface LVGLPageCanvasProps {
    forwardedRef: React.Ref<HTMLCanvasElement>;
    width: number;
    height: number;
    flowContext: IFlowContext;
}

const LVGLPageCanvas = observer(
    class LVGLPageCanvas extends React.Component<LVGLPageCanvasProps> {
        render() {
            return (
                <canvas
                    ref={this.props.forwardedRef}
                    width={this.props.width}
                    height={this.props.height}
                    style={{
                        imageRendering:
                            this.props.flowContext.viewState.transform.scale > 2
                                ? "pixelated"
                                : "auto"
                    }}
                ></canvas>
            );
        }
    }
);

const LVGLPageCanvasWithForwardedRef = React.forwardRef(
    (
        props: Omit<LVGLPageCanvasProps, "forwardedRef">,
        ref: React.Ref<HTMLCanvasElement>
    ) => {
        return <LVGLPageCanvas {...props} forwardedRef={ref} />;
    }
);

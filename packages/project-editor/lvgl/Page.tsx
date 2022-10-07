import React from "react";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import type { Page } from "project-editor/features/page/page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";

export const LVGLPage = observer(
    class LVGLPage extends React.Component<{
        page: Page;
        flowContext: IFlowContext;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        displayWidth = 800;
        displayHeight = 480;

        canvasRef = React.createRef<HTMLCanvasElement>();
        runtime: LVGLPageRuntime;

        componentDidMount() {
            this.runtime = new LVGLPageRuntime(
                this.props.page,
                this.displayWidth,
                this.displayHeight,
                this.canvasRef.current!.getContext("2d")!
            );
        }

        componentWillUnmount() {
            this.runtime.unmount();
        }

        render() {
            return (
                <canvas
                    ref={this.canvasRef}
                    width={this.displayWidth}
                    height={this.displayHeight}
                    style={{ imageRendering: "pixelated" }}
                ></canvas>
            );
        }
    }
);

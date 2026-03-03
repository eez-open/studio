import React from "react";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import type { Page } from "project-editor/features/page/page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { EezGuiLiteRuntime } from "./page-runtime";

export const EezGuiLitePage = observer(
    class EezGuiLitePage extends React.Component<{
        page: Page;
        flowContext: IFlowContext;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();
        runtime: EezGuiLiteRuntime | undefined;

        createPageRuntime() {
            this.runtime = new EezGuiLiteRuntime(
                this.props.page,
                undefined,
                this.canvasRef.current!.getContext("2d")!
            );

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
                <EezGuiLiteCanvas
                    ref={this.canvasRef}
                    width={this.props.page.width}
                    height={this.props.page.height}
                    flowContext={this.props.flowContext}
                ></EezGuiLiteCanvas>
            );
        }
    }
);

const EezGuiLiteCanvas = observer(
    React.forwardRef(
        (
            props: {
                width: number;
                height: number;
                flowContext: IFlowContext;
            },
            ref: React.Ref<HTMLCanvasElement>
        ) => {
            return (
                <canvas
                    ref={ref}
                    width={props.width}
                    height={props.height}
                    style={{
                        imageRendering: "pixelated"
                    }}
                ></canvas>
            );
        }
    )
);

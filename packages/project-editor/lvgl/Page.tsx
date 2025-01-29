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
import { settingsController } from "home/settings";

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
                    this.props.page,
                    this.props.page.width,
                    this.props.page.height,
                    this.canvasRef.current!.getContext("2d")!
                );
            } else {
                this.runtime = new LVGLPageEditorRuntime(
                    this.props.page,
                    this.canvasRef.current!.getContext("2d")!,
                    this.props.flowContext
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
            this.context.project.settings.general.lvglVersion;
            this.context.project.settings.general.darkTheme;

            return (
                <LVGLPageCanvas
                    ref={this.canvasRef}
                    width={this.props.page.width}
                    height={this.props.page.height}
                    flowContext={this.props.flowContext}
                ></LVGLPageCanvas>
            );
        }
    }
);

const LVGLPageCanvas = observer(
    React.forwardRef(
        (
            props: {
                width: number;
                height: number;
                flowContext: IFlowContext;
            },
            ref: React.Ref<HTMLCanvasElement>
        ) => {
            const style: React.CSSProperties = {
                imageRendering:
                    props.flowContext.viewState.transform.scale > 2
                        ? "pixelated"
                        : "auto"
            };

            if (
                props.flowContext.projectStore.project.settings.general
                    .circularDisplay ||
                props.flowContext.projectStore.project.settings.general
                    .displayBorderRadius != 0
            ) {
                style.borderRadius = props.flowContext.projectStore.project
                    .settings.general.circularDisplay
                    ? Math.min(props.width, props.height)
                    : props.flowContext.projectStore.project.settings.general
                          .displayBorderRadius;

                style.border = `1px solid ${
                    settingsController.isDarkTheme ? "#444" : "#eee"
                }`;
                style.transform = "translate(-1px, -1px)";
            }

            return (
                <canvas
                    ref={ref}
                    width={props.width}
                    height={props.height}
                    style={style}
                ></canvas>
            );
        }
    )
);

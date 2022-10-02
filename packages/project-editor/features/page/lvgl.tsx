import React from "react";
import { observer } from "mobx-react";

import { ProjectContext } from "project-editor/project/context";
import type { Page } from "./page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { IWasmFlowRuntime } from "eez-studio-types";
import { autorun, IReactionDisposer } from "mobx";

const lvgl_flow_runtime_constructor = require("project-editor/flow/runtime/lvgl_runtime.js");

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
        wasmFlowRuntime: IWasmFlowRuntime;
        requestAnimationFrameId: number | undefined;

        pageObj: number | undefined;
        autorRunDispose: IReactionDisposer | undefined;

        tick = () => {
            this.wasmFlowRuntime._mainLoop();

            var buf_addr = this.wasmFlowRuntime._getSyncedBuffer();
            if (buf_addr != 0) {
                const screen = new Uint8ClampedArray(
                    this.wasmFlowRuntime.HEAPU8.subarray(
                        buf_addr,
                        buf_addr + this.displayWidth * this.displayHeight * 4
                    )
                );

                var imgData = new ImageData(
                    screen,
                    this.displayWidth,
                    this.displayHeight
                );

                const ctx = this.canvasRef.current!.getContext("2d")!;

                ctx.putImageData(
                    imgData,
                    0,
                    0,
                    0,
                    0,
                    this.displayWidth,
                    this.displayHeight
                );
            }

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );
        };

        componentDidMount() {
            this.wasmFlowRuntime = lvgl_flow_runtime_constructor(() => {
                this.wasmFlowRuntime._init(0, 0, 0);

                this.requestAnimationFrameId = window.requestAnimationFrame(
                    this.tick
                );

                this.autorRunDispose = autorun(() => {
                    if (this.pageObj != undefined) {
                        this.wasmFlowRuntime._lvglDeleteObject(this.pageObj);
                    }

                    this.pageObj = this.props.page.lvglCreate(
                        this.wasmFlowRuntime,
                        0
                    ).obj;
                });
            });
        }

        componentWillUnmount() {
            if (this.requestAnimationFrameId != undefined) {
                window.cancelAnimationFrame(this.requestAnimationFrameId);
            }

            if (this.autorRunDispose) {
                this.autorRunDispose();
            }

            if (this.pageObj != undefined) {
                this.wasmFlowRuntime._lvglDeleteObject(this.pageObj);
            }
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

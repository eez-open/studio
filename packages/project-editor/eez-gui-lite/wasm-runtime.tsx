import React from "react";
import { observer } from "mobx-react";
import {
    autorun,
    IReactionDisposer,
    runInAction
} from "mobx";

import { ProjectContext } from "project-editor/project/context";
import {
    QueueTask
} from "project-editor/flow/runtime/runtime";
import { EezGuiLiteRuntime } from "project-editor/eez-gui-lite/page-runtime";
import { Widget } from "project-editor/flow/component";

import {
    evalAssignableExpression,
    evalExpression
} from "project-editor/eez-flow-lite/expression";

import { getClassInfo, type ProjectStore } from "project-editor/store";
import {
    SetColorThemeActionComponent,
    ShowPageActionComponent
} from "project-editor/flow/components/actions";
import { Page } from "project-editor/features/page/page";
import { SwitchWidget } from "project-editor/flow/components/widgets/eez-gui";
import type { Theme } from "project-editor/features/style/theme";
import { EezFlowLiteWasmRuntime } from "project-editor/eez-flow-lite/wasm-runtime";

export class EezGuiLiteWasmRuntime extends EezFlowLiteWasmRuntime {
    pageRuntime: EezGuiLiteRuntime;
    selectedTheme: Theme | undefined;

    get pointerEvents() {
        return this.pageRuntime.pointerEvents;
    }

    constructor(public projectStore: ProjectStore) {
        super(projectStore);

        this.pageRuntime = new EezGuiLiteRuntime(this.selectedPage, this);
        this.pageRuntime.mount();
    }

    get displayWidth() {
        return this.pageRuntime.page.width;
    }

    get displayHeight() {
        return this.pageRuntime.page.height;
    }

    renderPage(page: Page) {
        return <WasmCanvas page={page} />;
    }

    executeTaskSpecific(task: QueueTask) {
        const { flowState, connectionLine } = task;

        const component = connectionLine!.targetComponent;

        if (component instanceof ShowPageActionComponent) {
            const page = this.projectStore.project.pages.find(
                page => page.name == component.page
            );

            if (page) {
                runInAction(() => {
                    this.selectedPage = page;
                });

                this.pageRuntime.unmount();
                this.pageRuntime.page = this.selectedPage;
                this.pageRuntime.mount();
            }
        } else if (component instanceof SetColorThemeActionComponent) {
            const themeName = evalExpression(
                flowState.expressionContext,
                component,
                component.theme
            );

            const theme = this.projectStore.project.themes.find(
                theme => theme.name == themeName
            );
            if (theme) {
                runInAction(() => (this.selectedTheme = theme));
                
                this.pageRuntime.unmount();
                this.pageRuntime.mount();
            }
        }

        return true;
    }

    onEvent(page: Page, widget: Widget, eventType: number) {
        const flowState = this.flowStates.find(
            flowState => flowState.flow == page
        );
        if (!flowState) {
            return;
        }

        const classInfo = getClassInfo(widget);
        if (typeof classInfo.widgetEvents == "function") {
            const widgetEvents = classInfo.widgetEvents(widget);

            const eventName = Object.keys(widgetEvents).find(
                eventName => widgetEvents[eventName].code == eventType
            );

            if (eventName) {
                if (
                    eventName == "CLICKED" &&
                    widget instanceof SwitchWidget &&
                    widget.data != undefined
                ) {
                    const variable = evalAssignableExpression(
                        flowState.expressionContext,
                        widget,
                        widget.data
                    );
                    let value = evalExpression(
                        flowState.expressionContext,
                        widget,
                        widget.data
                    );
                    if (typeof value == "boolean") {
                        flowState.dataContext.set(variable.name, !value);
                    }
                }

                const eventHandler = widget.eventHandlers.find(
                    eventHandler => eventHandler.eventName == eventName
                );
                if (eventHandler) {
                    if (eventHandler.handlerType == "flow") {
                        this.addToQueueConnectionLines(
                            flowState,
                            widget,
                            eventName
                        );
                    } else {
                        const action = this.projectStore.project.actions.find(
                            action => action.name == eventHandler.action
                        );
                        if (action) {
                            this.executeAction(action, flowState);
                        }
                    }
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const WasmCanvas = observer(
    class WasmCanvas extends React.Component<{
        page: Page;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();
        autorunDispose: IReactionDisposer;

        get wasmRuntime() {
            return this.context.runtime as EezGuiLiteWasmRuntime;
        }

        sendPointerEvent(event: PointerEvent) {
            if (this.props.page != this.wasmRuntime.pageRuntime.page) {
                return;
            }

            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }
            const wasmRuntime = this.wasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            var bbox = canvas.getBoundingClientRect();

            const left = wasmRuntime.pageRuntime.page.left;
            const top = wasmRuntime.pageRuntime.page.top;
            const width = wasmRuntime.pageRuntime.page.width;
            const height = wasmRuntime.pageRuntime.page.height;

            const x =
                (event.clientX -
                    bbox.left -
                    (wasmRuntime.isDebuggerActive
                        ? 0
                        : left + (wasmRuntime.displayWidth - width) / 2)) *
                (canvas.width / bbox.width);

            const y =
                (event.clientY -
                    bbox.top -
                    (wasmRuntime.isDebuggerActive
                        ? 0
                        : top + (wasmRuntime.displayHeight - height) / 2)) *
                (canvas.height / bbox.height);

            const pressed = event.buttons == 1;

            let lastEvent;
            if (wasmRuntime.pointerEvents.length > 0) {
                lastEvent =
                    wasmRuntime.pointerEvents[
                        wasmRuntime.pointerEvents.length - 1
                    ];
            }

            if (lastEvent && lastEvent.pressed == pressed) {
                lastEvent.x = x;
                lastEvent.y = y;
            } else {
                wasmRuntime.pointerEvents.push({ x, y, pressed });
            }

            event.preventDefault();
            event.stopPropagation();
        }

        onPointerDown = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }

            canvas.focus();

            const wasmRuntime = this.wasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            canvas.setPointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onPointerMove = (event: PointerEvent) => {
            this.sendPointerEvent(event);
        };

        onPointerUp = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }

            canvas.releasePointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onPointerCancel = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }

            canvas.releasePointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        componentDidMount() {
            const canvasElement = this.canvasRef.current;
            if (!canvasElement) {
                return;
            }
            const canvas = canvasElement;

            canvas.addEventListener("pointerdown", this.onPointerDown, true);
            canvas.addEventListener("pointermove", this.onPointerMove, true);
            canvas.addEventListener("pointerup", this.onPointerUp, true);
            canvas.addEventListener(
                "pointercancel",
                this.onPointerCancel,
                true
            );

            canvas.focus();

            this.refreshPage();
        }

        componentWillUnmount() {
            const canvasElement = this.canvasRef.current;
            if (canvasElement) {
                const canvas = canvasElement;

                canvas.removeEventListener(
                    "pointerdown",
                    this.onPointerDown,
                    true
                );
                canvas.removeEventListener(
                    "pointermove",
                    this.onPointerMove,
                    true
                );
                canvas.removeEventListener("pointerup", this.onPointerUp, true);
                canvas.removeEventListener(
                    "pointercancel",
                    this.onPointerCancel,
                    true
                );
            }

            if (this.autorunDispose) {
                this.autorunDispose();
            }
        }

        componentDidUpdate() {
            this.refreshPage();
        }

        refreshPage() {
            if (this.autorunDispose) {
                this.autorunDispose();
            }

            const canvasElement = this.canvasRef.current;
            if (!canvasElement) {
                return;
            }
            const canvas = canvasElement;

            const ctx = canvas.getContext("2d")!;

            this.autorunDispose = autorun(() => {
                if (this.wasmRuntime) {
                    const pageImageData =
                        this.wasmRuntime.pageRuntime.pageImageDataMap.get(
                            this.props.page
                        );
                    if (pageImageData) {
                        this.wasmRuntime.pageRuntime.drawPage(
                            ctx,
                            pageImageData
                        );
                    } else {
                        ctx.clearRect(
                            0,
                            0,
                            this.wasmRuntime.displayWidth,
                            this.wasmRuntime.displayHeight
                        );
                    }
                }
            });
        }

        render() {
            const wasmRuntime = this.wasmRuntime;

            return (
                <canvas
                    tabIndex={0}
                    ref={this.canvasRef}
                    width={wasmRuntime.displayWidth}
                    height={wasmRuntime.displayHeight}
                    style={{
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)"
                    }}
                />
            );
        }
    }
);

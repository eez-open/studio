import React from "react";
import { computed, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Point, Rect } from "eez-studio-shared/geometry";
import { getId } from "project-editor/core/object";

import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import type { Page } from "project-editor/features/page/page";
import type { Action } from "project-editor/features/action/action";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { Component } from "project-editor/flow/component";
import { strokeWidth } from "project-editor/flow/connection-line/ConnectionLineComponent";
import { DragAndDropManager } from "project-editor/core/dd";
import { resizeWidget } from "./resizing-widget-property";
import { getBooleanValue } from "project-editor/flow/helper";

////////////////////////////////////////////////////////////////////////////////

export const ComponentsContainerEnclosure = observer(
    class ComponentsContainerEnclosure extends React.Component<{
        parent: Component | Page | Action;
        components: Component[];
        flowContext: IFlowContext;
        visibleComponent?: Component | null | undefined;
        width?: number;
        height?: number;
        isRTL?: boolean;
    }> {
        render() {
            const { components, flowContext, visibleComponent } = this.props;

            let parentRect: Rect;
            if (
                flowContext.flowState &&
                this.props.parent instanceof ProjectEditor.WidgetClass &&
                this.props.parent.timeline.length > 0
            ) {
                parentRect = this.props.parent.getTimelineRect(
                    flowContext.flowState.timelinePosition
                );
            } else {
                parentRect = this.props.parent.rect;
            }

            const renderComponent = (component: Component, i: number) => {
                let left: number | undefined;
                let top: number | undefined;
                let width: number | undefined;
                let height: number | undefined;

                const parent = this.props.parent;

                let componentRect;
                if (
                    flowContext.flowState &&
                    component instanceof ProjectEditor.WidgetClass &&
                    component.timeline.length > 0
                ) {
                    componentRect = component.getTimelineRect(
                        flowContext.flowState.timelinePosition
                    );
                } else {
                    componentRect = component.rect;
                }

                if (
                    !(parent instanceof ProjectEditor.ActionClass) &&
                    component instanceof ProjectEditor.WidgetClass &&
                    this.props.width != undefined &&
                    this.props.height != undefined &&
                    (this.props.width != parentRect.width ||
                        this.props.height != parentRect.height)
                ) {
                    const rect = resizeWidget(
                        componentRect,
                        {
                            top: parentRect.left,
                            left: parentRect.top,
                            width: parentRect.width,
                            height: parentRect.height
                        },
                        {
                            top: 0,
                            left: 0,
                            width: this.props.width,
                            height: this.props.height
                        },
                        component.resizing
                    );

                    ({ left, top, width, height } = rect);
                }

                if (
                    component instanceof ProjectEditor.WidgetClass &&
                    this.props.isRTL === true &&
                    this.props.width != undefined
                ) {
                    left = left ?? componentRect.left;
                    width = width ?? componentRect.width;

                    left = this.props.width - (left + width);
                }

                return (
                    <ComponentEnclosure
                        key={getId(component)}
                        component={component}
                        flowContext={flowContext}
                        visible={
                            visibleComponent
                                ? visibleComponent == component
                                : visibleComponent === null
                                ? false
                                : true
                        }
                        left={left}
                        top={top}
                        width={width}
                        height={height}
                    />
                );
            };

            if (visibleComponent && flowContext.flowState) {
                return renderComponent(visibleComponent, 0);
            }

            return components.map(renderComponent);
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ComponentEnclosure = observer(
    class ComponentEnclosure extends React.Component<{
        component: Component | Page;
        flowContext: IFlowContext;
        left?: number;
        top?: number;
        width?: number | string;
        height?: number | string;
        visible?: boolean;
    }> {
        elRef = React.createRef<HTMLDivElement>();

        updateComponentTimeout: any;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                listIndex: computed
            });
        }

        get listIndex() {
            if (
                this.props.flowContext.dataContext.has(
                    FLOW_ITERATOR_INDEX_VARIABLE
                )
            ) {
                return this.props.flowContext.dataContext.get(
                    FLOW_ITERATOR_INDEX_VARIABLE
                );
            }
            return 0;
        }

        updateComponentGeometry = () => {
            if (
                this.props.flowContext.editorOptions
                    .disableUpdateComponentGeometry
            ) {
                return;
            }

            if (this.updateComponentTimeout) {
                clearTimeout(this.updateComponentTimeout);
                this.updateComponentTimeout = undefined;
            }

            if (this.elRef.current && this.listIndex == 0) {
                const component = this.props.component;
                if (component instanceof ProjectEditor.PageClass) {
                    return;
                }

                const el = this.elRef.current.closest(".UserWidgetWidget");
                if (el && el != this.elRef.current) {
                    // do not calculate geometry if component is inside UserWidgetWidget
                    return;
                }

                if (this.elRef.current.offsetParent == null) {
                    // do not calculate geometry if element is not visible

                    this.updateComponentTimeout = setTimeout(() => {
                        this.updateComponentTimeout = undefined;
                        this.updateComponentGeometry();
                    });

                    return;
                }

                const geometry = calcComponentGeometry(
                    component,
                    this.elRef.current,
                    this.props.flowContext
                );

                runInAction(() => {
                    component.geometry = geometry;
                });

                return;
            }
        };

        componentDidMount() {
            this.updateComponentGeometry();
        }

        componentDidUpdate() {
            this.updateComponentGeometry();
        }

        componentWillUnmount() {
            if (this.updateComponentTimeout) {
                clearTimeout(this.updateComponentTimeout);
                this.updateComponentTimeout = undefined;
            }
        }

        render() {
            const { component, flowContext, left, top, visible } = this.props;

            // force calling calcComponentGeometry when clientRect changes

            if (!flowContext.projectStore.projectTypeTraits.isFirmware) {
                flowContext.viewState.transform.clientRect.left;
                flowContext.viewState.transform.clientRect.top;
                flowContext.viewState.transform.clientRect.width;
                flowContext.viewState.transform.clientRect.height;
            }

            if (component instanceof ProjectEditor.WidgetClass) {
                if (flowContext.flowState) {
                    if (
                        !getBooleanValue(
                            flowContext,
                            component,
                            "visible",
                            !component.visible
                        )
                    ) {
                        return null;
                    }
                } else {
                    if (component.hiddenInEditor) {
                        return null;
                    }
                }
            }

            // style
            let componentRect: Rect;
            if (
                flowContext.flowState &&
                component instanceof ProjectEditor.WidgetClass &&
                component.timeline.length > 0
            ) {
                componentRect = component.getTimelineRect(
                    flowContext.flowState.timelinePosition
                );
            } else {
                componentRect = component.rect;
            }

            const style: React.CSSProperties = {
                left: left ?? componentRect.left,
                top: top ?? componentRect.top
            };

            if (visible === false) {
                if (this.props.flowContext.flowState) {
                    return null;
                }
            }

            let width;
            let height;
            if (
                this.props.width != undefined &&
                this.props.height != undefined
            ) {
                width = this.props.width;
                height = this.props.height;
            } else {
                if (
                    component instanceof ProjectEditor.LVGLWidgetClass ||
                    !(
                        component.autoSize == "width" ||
                        component.autoSize == "both"
                    )
                ) {
                    width = componentRect.width;
                }

                if (
                    component instanceof ProjectEditor.LVGLWidgetClass ||
                    !(
                        component.autoSize == "height" ||
                        component.autoSize == "both"
                    )
                ) {
                    height = componentRect.height;
                }
            }

            if (width != undefined) {
                style.width = width;
            }

            if (height != undefined) {
                style.height = height;
            }

            component.styleHook(style, flowContext);

            // data-eez-flow-object-id
            let dataFlowObjectId = getId(component);
            if (this.listIndex > 0) {
                dataFlowObjectId = dataFlowObjectId + "-" + this.listIndex;
            }

            // className
            const projectStore = flowContext.projectStore;
            const uiStateStore = projectStore.uiStateStore;
            const runtime = projectStore.runtime;

            let breakpointClass;
            if (component instanceof ProjectEditor.ComponentClass) {
                if (uiStateStore?.isBreakpointAddedForComponent(component)) {
                    if (
                        uiStateStore.isBreakpointEnabledForComponent(component)
                    ) {
                        breakpointClass = "enabled-breakpoint";
                    } else {
                        breakpointClass = "disabled-breakpoint";
                    }
                }
            }

            const componentClassName = component.getClassName(
                this.props.flowContext
            );

            const className = classNames(
                "EezStudio_ComponentEnclosure",
                breakpointClass,
                componentClassName,
                {
                    "eez-flow-editor-capture-pointers":
                        runtime &&
                        !(runtime.isDebuggerActive && runtime.isPaused),
                    "not-visible-in-select-widget": visible == false
                }
            );

            return (
                <>
                    {flowContext.projectStore.projectTypeTraits.isDashboard &&
                        component instanceof ProjectEditor.WidgetClass &&
                        component.styles.map(style => style.render())}

                    <div
                        ref={this.elRef}
                        data-eez-flow-object-id={dataFlowObjectId}
                        className={className}
                        style={style}
                    >
                        {component.render(
                            flowContext,
                            typeof width == "number" ? width : component.width,
                            typeof height == "number"
                                ? height
                                : component.height
                        )}

                        {
                            // component description
                            component instanceof
                                ProjectEditor.ActionComponentClass &&
                                component.description &&
                                flowContext.projectStore.uiStateStore
                                    .showComponentDescriptions &&
                                (flowContext.projectStore.runtime
                                    ? flowContext.projectStore.runtime
                                          .isDebuggerActive &&
                                      !flowContext.frontFace
                                    : true) && (
                                    <div className="EezStudio_ActionComponentDescription">
                                        {component.description}
                                    </div>
                                )
                        }
                    </div>
                </>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ComponentCanvas = observer(
    class ComponentCanvas extends React.Component<{
        component: Page | Component;
        draw: (ctx: CanvasRenderingContext2D) => void;
        width: number;
        height: number;
    }> {
        elRef = React.createRef<HTMLDivElement>();

        canvas: HTMLCanvasElement;

        addCanvasToDOM() {
            if (!this.elRef.current) {
                return;
            }

            if (this.elRef.current.children[0]) {
                this.elRef.current.replaceChild(
                    this.canvas,
                    this.elRef.current.children[0]
                );
            } else {
                this.elRef.current.appendChild(this.canvas);
            }
        }

        componentDidMount() {
            this.addCanvasToDOM();
        }

        componentDidUpdate() {
            this.addCanvasToDOM();
        }

        render() {
            const { draw } = this.props;

            this.canvas = document.createElement("canvas");
            this.canvas.width = this.props.width;
            this.canvas.height = this.props.height;
            this.canvas.style.imageRendering = "pixelated";
            this.canvas.style.display = "block";
            draw(this.canvas.getContext("2d")!);

            return (
                <div
                    ref={this.elRef}
                    style={{
                        width: this.props.width,
                        height: this.props.height
                    }}
                ></div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

interface PortsGeometry {
    [inputName: string]: {
        rect: Rect;
        position: Point;
    };
}

export interface ComponentGeometry {
    left: number;
    top: number;
    width: number;
    height: number;
    inputs: PortsGeometry;
    outputs: PortsGeometry;
}

export function calcComponentGeometry(
    component: Component,
    el: HTMLElement | undefined,
    flowContext: IFlowContext | undefined
): ComponentGeometry {
    const dInput = component instanceof ProjectEditor.WidgetClass ? 2 : 6;
    const dOutput = component instanceof ProjectEditor.WidgetClass ? 0 : 6;

    let rect: Rect;

    if (el && flowContext) {
        const transform = flowContext.viewState.transform;
        rect = transform.clientToPageRect(el.getBoundingClientRect());
    } else {
        rect = {
            left: component.absolutePositionPoint.x,
            top: component.absolutePositionPoint.y,
            width: component.width ?? 1,
            height: component.height ?? 1
        };
    }

    if (!(component.autoSize == "width" || component.autoSize == "both")) {
        rect.width = component.width;
    }

    if (!(component.autoSize == "height" || component.autoSize == "both")) {
        rect.height = component.height;
    }

    const inputs: PortsGeometry = {};
    const outputs: PortsGeometry = {};

    if (component instanceof ProjectEditor.ComponentClass) {
        const transform = flowContext?.viewState.transform;
        if (el && transform) {
            el.querySelectorAll(`[data-connection-input-id]`).forEach(
                inputElement => {
                    const rectPort = transform.clientToPageRect(
                        inputElement.getBoundingClientRect()
                    );
                    inputs[
                        inputElement.getAttribute("data-connection-input-id")!
                    ] = {
                        rect: {
                            left: rectPort.left - rect.left,
                            top: rectPort.top - rect.top,
                            width: rectPort.width,
                            height: rectPort.height
                        },
                        position: {
                            x: rectPort.left - rect.left - dInput,
                            y: rectPort.top - rect.top + rectPort.height / 2
                        }
                    };
                }
            );

            el.querySelectorAll(`[data-connection-output-id]`).forEach(
                outputElement => {
                    const rectPort = transform.clientToPageRect(
                        outputElement.getBoundingClientRect()
                    );
                    outputs[
                        outputElement.getAttribute("data-connection-output-id")!
                    ] = {
                        rect: {
                            left: rectPort.left - rect.left,
                            top: rectPort.top - rect.top,
                            width: rectPort.width,
                            height: rectPort.height
                        },
                        position: {
                            x:
                                rectPort.left -
                                rect.left +
                                rectPort.width +
                                dOutput / 2 +
                                strokeWidth / 2,
                            y: rectPort.top - rect.top + rectPort.height / 2
                        }
                    };
                }
            );
        }

        for (let i = 0; i < component.inputs.length; i++) {
            const inputName = component.inputs[i].name;
            if (!inputs[inputName]) {
                inputs[inputName] = {
                    rect: {
                        left: 0,
                        top: 0,
                        width: rect.width / 2,
                        height: rect.height
                    },
                    position: {
                        x: 0,
                        y: rect.height / 2
                    }
                };
            }
        }

        for (let i = 0; i < component.outputs.length; i++) {
            const outputName = component.outputs[i].name;
            if (!outputs[outputName]) {
                outputs[outputName] = {
                    rect: {
                        left: rect.width / 2,
                        top: 0,
                        width: rect.width / 2,
                        height: rect.height
                    },
                    position: {
                        x: rect.width,
                        y: rect.height / 2
                    }
                };
            }
        }
    }

    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        inputs,
        outputs
    };
}

////////////////////////////////////////////////////////////////////////////////

export const Svg: React.FunctionComponent<{
    children?: React.ReactNode;
    flowContext: IFlowContext;
    defs?: JSX.Element | null;
    className?: string;
    style?: React.CSSProperties;
}> = observer(({ flowContext, defs, className, style, children }) => {
    const transform = flowContext.viewState.transform;
    let svgRect;
    let gTransform;
    if (transform) {
        svgRect = transform.clientToPageRect(transform.clientRect);
        gTransform = `translate(${-svgRect.left} ${-svgRect.top})`;
    }

    return (
        <svg
            className={className}
            style={{
                position: "absolute",
                pointerEvents: "none",
                ...svgRect,
                ...style
            }}
        >
            {defs && <defs>{defs}</defs>}
            <g
                transform={gTransform}
                style={{
                    pointerEvents: !!DragAndDropManager.dragObject
                        ? "none"
                        : "auto"
                }}
            >
                {children}
            </g>
        </svg>
    );
});

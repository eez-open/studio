import React from "react";
import { computed, runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Point, Rect } from "eez-studio-shared/geometry";
import { getId } from "project-editor/core/object";

import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import type { Page } from "project-editor/features/page/page";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { Component } from "project-editor/flow/component";
import { strokeWidth } from "project-editor/flow/editor/ConnectionLineComponent";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ComponentsContainerEnclosure extends React.Component<{
    components: Component[];
    flowContext: IFlowContext;
    visibleComponent?: Component;
}> {
    render() {
        const { components, flowContext, visibleComponent } = this.props;

        return components.map((component, i) => (
            <ComponentEnclosure
                key={getId(component)}
                component={component}
                flowContext={flowContext}
                visible={!visibleComponent || visibleComponent == component}
            />
        ));
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ComponentEnclosure extends React.Component<{
    component: Component | Page;
    flowContext: IFlowContext;
    left?: number;
    top?: number;
    visible?: boolean;
}> {
    elRef = React.createRef<HTMLDivElement>();

    @computed
    get listIndex() {
        if (
            this.props.flowContext.dataContext.has(FLOW_ITERATOR_INDEX_VARIABLE)
        ) {
            return this.props.flowContext.dataContext.get(
                FLOW_ITERATOR_INDEX_VARIABLE
            );
        }
        return 0;
    }

    updateComponentGeometry() {
        if (this.elRef.current && this.listIndex == 0) {
            const el = this.elRef.current.closest(".LayoutViewWidget");
            if (el && el != this.elRef.current) {
                // do not calculate geometry if component is inside LayoutViewWidget
                return;
            }

            if (this.elRef.current.offsetParent == null) {
                // do not calculate geometry if element is not visible
                console.log("offsetParent == null");
                return;
            }

            const geometry = calcComponentGeometry(
                this.props.component,
                this.elRef.current,
                this.props.flowContext
            );

            runInAction(() => {
                this.props.component.geometry = geometry;
            });
        }
    }

    componentDidMount() {
        this.updateComponentGeometry();
    }

    componentDidUpdate() {
        this.updateComponentGeometry();
    }

    render() {
        const { component, flowContext, left, top, visible } = this.props;

        // data-eez-flow-object-id
        let dataFlowObjectId = getId(component);
        if (this.listIndex > 0) {
            dataFlowObjectId = dataFlowObjectId + "-" + this.listIndex;
        }

        // style
        const style: React.CSSProperties = {
            left: left ?? component.left,
            top: top ?? component.top
        };

        if (!(component.autoSize == "width" || component.autoSize == "both")) {
            style.width = component.width;
        }
        if (!(component.autoSize == "height" || component.autoSize == "both")) {
            style.height = component.height;
        }

        component.styleHook(style, flowContext);

        // className
        const DocumentStore = flowContext.DocumentStore;
        const uiStateStore = DocumentStore.uiStateStore;
        const runtime = DocumentStore.runtime;

        let breakpointClass;
        if (component instanceof ProjectEditor.ComponentClass) {
            if (uiStateStore.isBreakpointAddedForComponent(component)) {
                if (uiStateStore.isBreakpointEnabledForComponent(component)) {
                    breakpointClass = "enabled-breakpoint";
                } else {
                    breakpointClass = "disabled-breakpoint";
                }
            }
        }

        const componentClassName = component.getClassName();

        const className = classNames(
            "EezStudio_ComponentEnclosure",
            breakpointClass,
            componentClassName,
            {
                "eez-flow-editor-capture-pointers":
                    runtime && !(runtime.isDebuggerActive && runtime.isPaused)
            }
        );

        if (visible === false) {
            style.opacity = "0.05";
            style.pointerEvents = "none";
            //style.display = "none";
        }

        return (
            <div
                ref={this.elRef}
                data-eez-flow-object-id={dataFlowObjectId}
                className={className}
                style={style}
            >
                {component.render(flowContext)}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ComponentCanvas extends React.Component<{
    component: Page | Component;
    draw: (ctx: CanvasRenderingContext2D) => void;
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
        const { component, draw } = this.props;

        this.canvas = document.createElement("canvas");
        this.canvas.width = component.width;
        this.canvas.height = component.height;
        this.canvas.style.imageRendering = "pixelated";
        this.canvas.style.display = "block";
        draw(this.canvas.getContext("2d")!);

        return (
            <div
                ref={this.elRef}
                style={{ width: component.width, height: component.height }}
            ></div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

interface PortsGeometry {
    [inputName: string]: {
        rect: Rect;
        position: Point;
    };
}

export interface ComponentGeometry {
    width: number;
    height: number;
    inputs: PortsGeometry;
    outputs: PortsGeometry;
}

export function calcComponentGeometry(
    component: Component | Page,
    el: HTMLElement,
    flowContext: IFlowContext
): ComponentGeometry {
    const dInput = component instanceof ProjectEditor.WidgetClass ? 2 : 6;
    const dOutput = component instanceof ProjectEditor.WidgetClass ? 0 : 6;

    const transform = flowContext.viewState.transform;

    const rect = transform.clientToPageRect(el.getBoundingClientRect());

    if (!(component.autoSize == "width" || component.autoSize == "both")) {
        rect.width = component.width;
    }

    if (!(component.autoSize == "height" || component.autoSize == "both")) {
        rect.height = component.height;
    }

    const inputs: PortsGeometry = {};
    const outputs: PortsGeometry = {};

    if (component instanceof ProjectEditor.ComponentClass) {
        el.querySelectorAll(`[data-connection-input-id]`).forEach(
            inputElement => {
                const rectPort = transform.clientToPageRect(
                    inputElement.getBoundingClientRect()
                );
                inputs[inputElement.getAttribute("data-connection-input-id")!] =
                    {
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

    return {
        width: rect.width,
        height: rect.height,
        inputs,
        outputs
    };
}

////////////////////////////////////////////////////////////////////////////////

export const Svg: React.FunctionComponent<{
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
            <g transform={gTransform} style={{ pointerEvents: "auto" }}>
                {children}
            </g>
        </svg>
    );
});

import React from "react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Point, Rect } from "eez-studio-shared/geometry";

import { getId } from "project-editor/core/object";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";

import { Page } from "project-editor/features/page/page";
import { Component } from "project-editor/flow/component";

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

function calcComponentGeometry(
    component: Component | Page,
    el: HTMLElement,
    flowContext: IFlowContext
): ComponentGeometry {
    const transform = flowContext.viewState.transform;

    const rect = transform.clientToPageRect(el.getBoundingClientRect());

    const inputs: PortsGeometry = {};
    const outputs: PortsGeometry = {};

    if (component instanceof Component) {
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
                            x: rectPort.left - rect.left - 1,
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
                        x: rectPort.left - rect.left + rectPort.width + 1,
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

export const ComponentCanvas = observer(
    ({
        component,
        flowContext,
        draw
    }: {
        component: Component;
        flowContext: IFlowContext;
        draw: (ctx: CanvasRenderingContext2D) => void;
    }) => {
        const refDiv = React.useRef<HTMLDivElement>(null);

        let canvas: HTMLCanvasElement;

        React.useEffect(() => {
            if (refDiv.current) {
                if (refDiv.current.children[0]) {
                    refDiv.current.replaceChild(
                        canvas,
                        refDiv.current.children[0]
                    );
                } else {
                    refDiv.current.appendChild(canvas);
                }
            }
        });

        canvas = document.createElement("canvas");
        canvas.width = component.width;
        canvas.height = component.height;
        canvas.style.imageRendering = "pixelated";
        canvas.style.display = "block";
        draw(canvas.getContext("2d")!);

        return (
            <div
                ref={refDiv}
                style={{ width: component.width, height: component.height }}
            ></div>
        );
    }
);

export const ComponentEnclosure = observer(
    ({
        component,
        flowContext,
        left,
        top
    }: {
        component: Component | Page;
        flowContext: IFlowContext;
        left?: number;
        top?: number;
    }) => {
        const elRef = React.useRef<HTMLDivElement>(null);

        React.useEffect(() => {
            const el = elRef.current;
            if (el) {
                const flipCard = el.closest(".flip-card-inner") as HTMLElement;
                if (!flipCard) {
                    const geometry = calcComponentGeometry(
                        component,
                        el,
                        flowContext
                    );
                    geometry.width = Math.round(geometry.width);
                    geometry.height = Math.round(geometry.height);
                    runInAction(() => {
                        component.geometry = geometry;
                    });
                }
            }
        });

        const style: React.CSSProperties = {
            left: left ?? component.left,
            top: top ?? component.top
        };

        if (!component.autoSize) {
            style.width = component.width;
            style.height = component.height;
        }

        const dataFlowObjectId = getId(component);

        style.overflow = "visible";
        component.styleHook(style, flowContext);

        const className = component.getClassName();

        return (
            <div
                data-eez-flow-object-id={dataFlowObjectId}
                ref={elRef}
                className={classNames(
                    "EezStudio_ComponentEnclosure",
                    className,
                    {
                        "eez-flow-editor-capture-pointers":
                            flowContext.document.DocumentStore.RuntimeStore
                                .isRuntimeMode
                    }
                )}
                style={style}
            >
                {component.render(flowContext)}
            </div>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ComponentsContainerEnclosure = observer(
    ({
        components,
        flowContext
    }: {
        components: Component[];
        flowContext: IFlowContext;
    }) => {
        return (
            <>
                {components.map((component, i) => {
                    return (
                        <ComponentEnclosure
                            key={getId(component)}
                            component={component}
                            flowContext={flowContext}
                        />
                    );
                })}
            </>
        );
    }
);

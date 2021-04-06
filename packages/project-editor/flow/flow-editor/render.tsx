import React from "react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { styled } from "eez-studio-ui/styled-components";
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
                        x: -1,
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
                        x: rect.width + 1,
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

const ComponentEnclosureDiv = styled.div`
    display: block;
    position: absolute;

    &.eez-action-component {
        display: flex;
        flex-direction: column;

        background-color: #fffcf7;
        border: 1px solid #fffcf7;
        border-radius: 4px;

        box-shadow: 1px 1px 4px rgba(22, 33, 74, 0.2);

        overflow: hidden;

        .title-enclosure {
            display: flex;
            flex-direction: row;
            align-items: center;

            .title {
                flex-grow: 1;
                padding: 7px 0;
                background-color: #43786d;
                color: white;
                display: flex;
                flex-direction: row;
                align-items: center;
                white-space: nowrap;

                span {
                    padding-left: 4px;
                }

                .title-image {
                    display: flex;

                    svg {
                        vertical-align: baseline;
                        fill: white;
                        height: 16px;
                    }

                    img {
                        margin-right: 5px;
                        width: 48px;
                        object-fit: contain;
                    }
                }

                .title-text {
                    flex-grow: 1;
                    white-space: nowrap;
                }

                [data-connection-output-id] {
                    width: 21px;
                    height: 21px;
                }
            }
        }

        .inputs-outputs {
            display: flex;
            flex-direction: row;

            .inputs,
            .outputs {
                padding: 2px;
                font-size: 90%;
                flex-grow: 1;
            }

            .inputs {
                text-align: left;
            }

            .outputs {
                text-align: right;
            }

            [data-connection-input-id],
            [data-connection-output-id] {
                border: 1px solid #fffcf7;
                padding: 2px 5px;
                margin-bottom: 2px;

                white-space: nowrap;
            }

            [data-connection-output-id] {
                text-align: right;
            }
        }

        .body {
            padding: 4px;
            background-color: white;
            pre {
                margin-bottom: 0;
            }
        }
    }

    &.eez-widget-component {
        .inputs-outputs {
            position: absolute;
            bottom: -32px;
            width: 100%;

            overflow: hidden;
            display: flex;
            flex-direction: row;
            background-color: #fffcf7;
            border: 1px solid #dfdcd7;

            .inputs,
            .outputs {
                padding: 2px;
                font-size: 90%;
                flex-grow: 1;
            }

            .inputs {
                text-align: left;
            }

            .outputs {
                text-align: right;
            }

            [data-connection-input-id],
            [data-connection-output-id] {
                border: 1px solid #fffcf7;
                padding: 2px 5px;
                margin-bottom: 2px;

                white-space: nowrap;
            }

            [data-connection-output-id] {
                text-align: right;
            }
        }
    }
`;

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
                const geometry = calcComponentGeometry(
                    component,
                    el,
                    flowContext
                );
                runInAction(() => {
                    component._geometry = geometry;
                });
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

        let canvasDiv;

        if (component instanceof Component && component.draw) {
            canvas = document.createElement("canvas");
            canvas.width = component.width;
            canvas.height = component.height;
            canvas.style.imageRendering = "pixelated";
            canvas.style.display = "block";
            component.draw!(canvas.getContext("2d")!, flowContext);

            canvasDiv = (
                <div
                    ref={refDiv}
                    style={{ width: component.width, height: component.height }}
                ></div>
            );
        }

        style.overflow = "visible";
        component.styleHook(style, flowContext);

        const className = component.getClassName();

        return (
            <ComponentEnclosureDiv
                data-eez-flow-object-id={dataFlowObjectId}
                ref={elRef}
                className={classNames(className, {
                    "eez-flow-editor-capture-pointers":
                        flowContext.document.DocumentStore.RuntimeStore
                            .isRuntimeMode
                })}
                style={style}
                onClick={
                    component instanceof Component
                        ? component.onClick
                        : undefined
                }
            >
                {canvasDiv}
                {component.render(flowContext)}
            </ComponentEnclosureDiv>
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

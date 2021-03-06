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
                padding: 4px 0;
                background-color: #3fadb5;
                color: #333;
                display: flex;
                flex-direction: row;
                align-items: center;
                white-space: nowrap;

                span {
                    padding-left: 6px;
                }

                span:last-child {
                    padding-right: 6px;
                }

                .title-image {
                    display: flex;

                    svg {
                        vertical-align: baseline;
                        height: 16px;
                    }

                    img {
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

        .content {
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

            .body {
                margin: 4px;
                border: 1px solid ${props => props.theme.borderColor};
                padding: 4px;
                background-color: white;
            }

            pre {
                margin-bottom: 0;
            }
        }

        [data-connection-output-id].error {
            color: red;
        }
    }

    &.eez-widget-component {
        --size: 6px;

        .inputs,
        .outputs {
            position: absolute;
            display: flex;
            flex-direction: column;
            justify-content: center;
            top: 0;
            width: var(--width);
            height: 100%;
        }

        .inputs {
            left: 0;
        }

        .outputs {
            right: 0;
        }

        [data-connection-input-id],
        [data-connection-output-id] {
            background-color: #999;

            margin-bottom: var(--size);

            width: var(--size);
            height: calc(var(--size) * 2);
        }

        [data-connection-input-id] {
            margin-left: calc(var(--size) / -1);
        }

        [data-connection-output-id] {
            margin-right: calc(var(--size) / -1);
        }

        [data-connection-input-id] {
            border-bottom-left-radius: calc(var(--size) * 2 - 2px);
            border-top-left-radius: calc(var(--size) * 2 - 2px);
            border-bottom-right-radius: 2px;
            border-top-right-radius: 2px;
        }

        [data-connection-output-id] {
            border-bottom-left-radius: 2px;
            border-top-left-radius: 2px;
            border-bottom-right-radius: calc(var(--size) * 2 - 2px);
            border-top-right-radius: calc(var(--size) * 2 - 2px);
        }

        [data-connection-input-id]:last-child,
        [data-connection-output-id]:last-child {
            margin-bottom: 0;
        }

        [data-connection-input-id].seq,
        [data-connection-output-id].seq {
            background-color: ${props => props.theme.seqConnectionLineColor};
        }
    }

    &.Button button,
    &.ButtonWidget button {
        width: 100%;
        height: 100%;
    }

    &.Text button,
    &.TextWidget {
        display: flex;
        align-items: center;
    }
`;

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
            <ComponentEnclosureDiv
                data-eez-flow-object-id={dataFlowObjectId}
                ref={elRef}
                className={classNames(className, {
                    "eez-flow-editor-capture-pointers":
                        flowContext.document.DocumentStore.RuntimeStore
                            .isRuntimeMode
                })}
                style={style}
            >
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

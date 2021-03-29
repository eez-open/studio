import React from "react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { styled } from "eez-studio-ui/styled-components";
import { Point, Rect } from "eez-studio-shared/geometry";

import { getId } from "project-editor/core/object";

import type {
    IFlowContext,
    IDataContext
} from "project-editor/flow/flow-interfaces";

import { Page } from "project-editor/features/page/page";
import { Component } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

export const Svg: React.FunctionComponent<{
    designerContext: IFlowContext;
    defs?: JSX.Element | null;
    className?: string;
    style?: React.CSSProperties;
}> = observer(({ designerContext, defs, className, style, children }) => {
    const transform = designerContext.viewState.transform;
    let svgRect;
    let gTransform;
    if (transform) {
        svgRect = transform.clientToPageRect(transform.clientRect);
        gTransform = `translate(${-svgRect.left} ${-svgRect.top})`;
    }

    return (
        <svg
            className={className}
            style={{ position: "absolute", ...svgRect, ...style }}
        >
            {defs && <defs>{defs}</defs>}
            <g transform={gTransform}>{children}</g>
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
    designerContext: IFlowContext
): ComponentGeometry {
    const transform = designerContext.viewState.transform;

    const rect = transform.clientToPageRect(el.getBoundingClientRect());

    const inputs: PortsGeometry = {};
    const outputs: PortsGeometry = {};

    if (component instanceof Component) {
        component.inputProperties.forEach(property => {
            const inputElement = el.querySelector(
                `[data-connection-input-id="${property.name}"]`
            );
            if (inputElement) {
                const rectPort = transform.clientToPageRect(
                    inputElement.getBoundingClientRect()
                );
                inputs[property.name] = {
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
        });

        component.outputProperties.forEach(property => {
            const outputElement = el.querySelector(
                `[data-connection-output-id="${property.name}"]`
            );
            if (outputElement) {
                const rectPort = transform.clientToPageRect(
                    outputElement.getBoundingClientRect()
                );
                outputs[property.name] = {
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
        });
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

    &.eez-action-node {
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
                padding: 4px 7px;
                background-color: #43786d;
                color: white;
                display: flex;
                flex-direction: row;
                align-items: center;
                white-space: nowrap;

                svg {
                    fill: white;
                    margin-right: 5px;
                    height: 14px;
                }

                img {
                    margin-right: 5px;
                    width: 48px;
                    object-fit: contain;
                }
                span {
                    white-space: nowrap;
                }
            }
        }

        .body {
            display: flex;
            flex-direction: row;

            .inports,
            .outports {
                padding: 2px;
                font-size: 90%;
                flex-grow: 1;
            }

            .inports {
                text-align: left;
            }

            .outports {
                text-align: right;
            }

            .eez-connection-input,
            .eez-connection-output {
                border: 1px solid #fffcf7;
                padding: 2px 5px;
                margin-bottom: 2px;

                white-space: nowrap;
            }

            .eez-connection-output {
                text-align: right;
            }
        }
    }
`;

export const ComponentEnclosure = observer(
    ({
        component,
        designerContext,
        dataContext,
        left,
        top
    }: {
        component: Component | Page;
        designerContext: IFlowContext;
        dataContext: IDataContext;
        left?: number;
        top?: number;
    }) => {
        const elRef = React.useRef<HTMLDivElement>(null);

        React.useLayoutEffect(() => {
            if (elRef.current) {
                const geometry = calcComponentGeometry(
                    component,
                    elRef.current,
                    designerContext
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

        const dataDesignerObjectId = designerContext
            ? getId(component)
            : undefined;

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
            component.draw!(
                canvas.getContext("2d")!,
                designerContext,
                dataContext
            );

            canvasDiv = <div ref={refDiv}></div>;
        }

        style.overflow = "visible";
        component.styleHook(style, designerContext);

        const className = component.getClassName();

        return (
            <ComponentEnclosureDiv
                data-designer-object-id={dataDesignerObjectId}
                ref={elRef}
                className={classNames(className, {
                    "eez-flow-editor-capture-pointers":
                        designerContext.document.DocumentStore.RuntimeStore
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
                {component.render(designerContext, dataContext)}
            </ComponentEnclosureDiv>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ComponentsContainerEnclosure = observer(
    ({
        components,
        designerContext,
        dataContext
    }: {
        components: Component[];
        designerContext: IFlowContext;
        dataContext: IDataContext;
    }) => {
        return (
            <>
                {components.map((component, i) => {
                    return (
                        <ComponentEnclosure
                            key={getId(component)}
                            component={component}
                            designerContext={designerContext}
                            dataContext={dataContext}
                        />
                    );
                })}
            </>
        );
    }
);

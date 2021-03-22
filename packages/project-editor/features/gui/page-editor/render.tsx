import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { styled } from "eez-studio-ui/styled-components";

import { getId } from "project-editor/core/object";

import { DataContext } from "project-editor/features/data/data";
import type { IDesignerContext } from "project-editor/features/gui/page-editor/designer-interfaces";

import { Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/widget";
import { runInAction } from "mobx";
import { Point, Rect } from "eez-studio-shared/geometry";

////////////////////////////////////////////////////////////////////////////////

interface PortsGeometry {
    [inputName: string]: {
        rect: Rect;
        position: Point;
    };
}

export interface WidgetGeometry {
    width: number;
    height: number;
    inputs: PortsGeometry;
    outputs: PortsGeometry;
}

function calcWidgetGeometry(
    widget: Widget | Page,
    el: HTMLElement,
    designerContext: IDesignerContext
): WidgetGeometry {
    const transform = designerContext.viewState.transform;

    const rect = transform.clientToPageRect(el.getBoundingClientRect());

    const inputs: PortsGeometry = {};
    const outputs: PortsGeometry = {};

    if (widget instanceof Widget) {
        widget.inputProperties.forEach(property => {
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

        widget.outputProperties.forEach(property => {
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

const WidgetDiv = styled.div`
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
                    height: 12px;
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

            .eez-connection-output:hover {
                color: ${props => props.theme.selectionColor};
                background-color: ${props =>
                    props.theme.selectionBackgroundColor};
            }
        }
    }
`;

export const WidgetComponent = observer(
    ({
        widget,
        dataContext,
        left,
        top,
        designerContext,
        onClick
    }: {
        widget: Widget | Page;
        dataContext: DataContext;
        left?: number;
        top?: number;
        designerContext: IDesignerContext;
        onClick?: () => void;
    }) => {
        const elRef = React.useRef<HTMLDivElement>(null);

        React.useLayoutEffect(() => {
            if (elRef.current) {
                const geometry = calcWidgetGeometry(
                    widget,
                    elRef.current,
                    designerContext
                );
                runInAction(() => {
                    widget._geometry = geometry;
                });
            }
        });

        const style: React.CSSProperties = {
            left: left ?? widget.left,
            top: top ?? widget.top
        };

        if (!widget.autoSize) {
            style.width = widget.width;
            style.height = widget.height;
        }

        const dataDesignerObjectId = designerContext
            ? getId(widget)
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

        if (widget instanceof Widget && widget.draw) {
            canvas = document.createElement("canvas");
            canvas.width = widget.width;
            canvas.height = widget.height;
            canvas.style.imageRendering = "pixelated";
            canvas.style.display = "block";
            widget.draw!(canvas.getContext("2d")!, dataContext);

            canvasDiv = <div ref={refDiv}></div>;
        }

        style.overflow = "visible";
        widget.styleHook(style, designerContext);

        const className = widget.getClassName();

        return (
            <WidgetDiv
                data-designer-object-id={dataDesignerObjectId}
                ref={elRef}
                className={classNames(className, {
                    "eez-page-editor-capture-pointers":
                        designerContext.document.DocumentStore.DebugStore
                            .isActive
                })}
                style={style}
                onClick={widget instanceof Widget ? widget.onClick : undefined}
            >
                {canvasDiv}
                {widget.render(dataContext, designerContext)}
            </WidgetDiv>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

export const WidgetContainerComponent = observer(
    ({
        widgets,
        dataContext,
        designerContext
    }: {
        widgets: Widget[];
        dataContext: DataContext;
        designerContext: IDesignerContext;
    }) => {
        return (
            <>
                {widgets.map((widget, i) => {
                    return (
                        <WidgetComponent
                            key={getId(widget)}
                            widget={widget}
                            dataContext={dataContext}
                            designerContext={designerContext}
                        />
                    );
                })}
            </>
        );
    }
);

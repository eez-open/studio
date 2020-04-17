import React from "react";
import { observer, inject } from "mobx-react";

import { getId } from "project-editor/core/object";

import { DataContext } from "project-editor/features/data/data";
import { IDesignerContext } from "project-editor/features/gui/page-editor/designer-interfaces";

import { Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/widget";

////////////////////////////////////////////////////////////////////////////////

export const WidgetComponent = inject("designerContext")(
    observer(
        ({
            widget,
            dataContext,
            left,
            top,
            designerContext
        }: {
            widget: Widget | Page;
            dataContext: DataContext;
            left?: number;
            top?: number;
            designerContext?: IDesignerContext;
        }) => {
            const style: React.CSSProperties = {
                display: "block",
                position: "absolute",
                left: left != undefined ? left : widget.left,
                top: top != undefined ? top : widget.top,
                width: widget.width,
                height: widget.height
            };

            const dataDesignerObjectId = designerContext ? getId(widget) : undefined;

            const refDiv = React.useRef<HTMLDivElement>(null);

            let canvas: HTMLCanvasElement;

            React.useEffect(() => {
                if (refDiv.current) {
                    if (refDiv.current.children[0]) {
                        refDiv.current.replaceChild(canvas, refDiv.current.children[0]);
                    } else {
                        refDiv.current.appendChild(canvas);
                    }
                }
            });

            if (widget instanceof Widget && widget.draw) {
                canvas = document.createElement("canvas");
                canvas.width = widget.width;
                canvas.height = widget.height;
                canvas.style.imageRendering = "pixelated";
                canvas.style.display = "block";
                widget.draw!(canvas.getContext("2d")!, dataContext);

                return (
                    <div
                        data-designer-object-id={dataDesignerObjectId}
                        style={style}
                        ref={refDiv}
                    ></div>
                );
            }

            try {
                style.overflow = "visible";
                widget.styleHook(style, designerContext);

                return (
                    <div data-designer-object-id={dataDesignerObjectId} style={style}>
                        {widget.render(dataContext, designerContext)}
                    </div>
                );
            } catch (err) {
                console.error(err);
                return (
                    <div
                        data-designer-object-id={dataDesignerObjectId}
                        style={Object.assign(style, {
                            display: "flex",
                            border: "1px dashed red",
                            justifyContent: "center",
                            alignItems: "center",
                            textAlign: "center",
                            color: "red",
                            padding: 10
                        })}
                    >
                        Failed to render widget!
                    </div>
                );
            }
        }
    )
);

////////////////////////////////////////////////////////////////////////////////

export const WidgetContainerComponent = observer(
    ({ widgets, dataContext }: { widgets: Widget[]; dataContext: DataContext }) => {
        return (
            <>
                {widgets.map((widget, i) => {
                    return (
                        <WidgetComponent
                            key={getId(widget)}
                            widget={widget}
                            dataContext={dataContext}
                        />
                    );
                })}
            </>
        );
    }
);

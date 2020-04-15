import React from "react";
import { observer, inject } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

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
            rect,
            designerContext
        }: {
            widget: Widget | Page;
            dataContext: DataContext;
            rect?: Rect;
            designerContext?: IDesignerContext;
        }) => {
            if (!rect) {
                rect = widget;
            }

            const style: React.CSSProperties = {
                display: "block",
                position: "absolute",
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
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
                canvas.style.imageRendering = "pixelated";
                canvas.style.display = "block";
                canvas.width = rect.width;
                canvas.height = rect.height;
                widget.draw!(canvas.getContext("2d")!, rect, dataContext);

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
                        {widget.render(rect, dataContext, designerContext)}
                    </div>
                );
            } catch (err) {
                console.error(err);
                return (
                    <div
                        data-designer-object-id={dataDesignerObjectId}
                        style={{
                            position: "absolute",
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            border: "1px dashed red",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            textAlign: "center",
                            color: "red",
                            padding: 10
                        }}
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

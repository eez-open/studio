import React from "react";
import { observer, inject } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { getId } from "project-editor/core/object";

import { DataContext } from "project-editor/features/data/data";
import { IDesignerContext } from "project-editor/features/gui/page-editor/designer-interfaces";

import { Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/widget";

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class WidgetComponent extends React.Component<{
    widget: Widget | Page;
    dataContext: DataContext;
    rect?: Rect;
    designerContext?: IDesignerContext;
}> {
    render() {
        const { widget, dataContext, designerContext } = this.props;

        function cleanUpValue(value: any) {
            if (value == undefined) {
                return undefined;
            }
            if (typeof value === "string") {
                value = value.trim();
                if (!value) {
                    return undefined;
                }
                const numValue = Number(value);
                if (!isNaN(numValue)) {
                    return numValue;
                }
            }
            return value;
        }

        let rect = this.props.rect;

        let left;
        let top;
        let width;
        let height;
        if (rect) {
            ({ left, top, width, height } = rect);
        } else {
            left = cleanUpValue(widget.left);
            top = cleanUpValue(widget.top);
            width = cleanUpValue(widget.width);
            height = cleanUpValue(widget.height);

            rect = {
                left,
                top,
                width,
                height
            };
        }

        const style: React.CSSProperties = {
            display: "block",
            position: "absolute",
            left,
            top,
            width,
            height
        };

        const dataDesignerObjectId = designerContext ? getId(widget) : undefined;

        if (widget instanceof Widget && widget.draw) {
            style.imageRendering = "pixelated";

            let canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            widget.draw(canvas.getContext("2d")!, rect, dataContext);

            return (
                <img
                    data-designer-object-id={dataDesignerObjectId}
                    style={style}
                    src={canvas.toDataURL()}
                />
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
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class WidgetContainerComponent extends React.Component<{
    containerWidget: Widget | Page;
    widgets: Widget[];
    dataContext: DataContext;
}> {
    render() {
        const { widgets, dataContext } = this.props;

        return widgets.map((widget, i) => {
            return (
                <WidgetComponent key={getId(widget)} widget={widget} dataContext={dataContext} />
            );
        });
    }
}

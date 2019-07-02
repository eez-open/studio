import React from "react";
import { observer, inject } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { IDesignerContext } from "project-editor/features/gui/page-editor/designer-interfaces";

import { Page } from "project-editor/features/gui/page";
import { Widget } from "project-editor/features/gui/widget";

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class WidgetComponent extends React.Component<{
    widget: Widget | Page;
    rect?: Rect;
    designerContext?: IDesignerContext;
}> {
    render() {
        const { widget, designerContext } = this.props;

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

        const dataDesignerObjectId = designerContext ? widget._id : undefined;

        if (widget instanceof Widget) {
            const canvas = widget.draw(rect);
            if (canvas) {
                style.imageRendering = "pixelated";
                return (
                    <img
                        data-designer-object-id={dataDesignerObjectId}
                        style={style}
                        src={canvas.toDataURL()}
                    />
                );
            }
        }

        try {
            style.overflow = "visible";
            widget.styleHook(style, designerContext);

            return (
                <div data-designer-object-id={dataDesignerObjectId} style={style}>
                    {widget.render(rect, designerContext)}
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
}> {
    render() {
        const { widgets } = this.props;

        return widgets.map((widget, i) => {
            return <WidgetComponent key={widget._id} widget={widget} />;
        });
    }
}

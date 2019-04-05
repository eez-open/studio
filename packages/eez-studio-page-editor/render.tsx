import React from "react";
import { observer, inject } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { IDesignerContext } from "eez-studio-designer";

import { getPageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { Widget } from "eez-studio-page-editor/widget";
import { Page } from "eez-studio-page-editor/page";

////////////////////////////////////////////////////////////////////////////////

export function renderRootElement(child: React.ReactNode) {
    return getPageContext().renderRootElement(child);
}

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class WidgetComponent extends React.Component<{
    widget: Widget | Page;
    rect?: Rect;
    dataContext: IDataContext;
    designerContext?: IDesignerContext;
}> {
    render() {
        const { widget, dataContext, designerContext } = this.props;

        const position = (widget.position as any) || "absolute";

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
        let right;
        let top;
        let bottom;
        let width;
        let height;
        if (rect) {
            ({ left, top, width, height } = rect);
        } else {
            left = cleanUpValue(widget.left);
            right = cleanUpValue(widget.right);
            top = cleanUpValue(widget.top);
            bottom = cleanUpValue(widget.bottom);
            width = cleanUpValue(widget.width);
            height = cleanUpValue(widget.height);

            rect = {
                left,
                top,
                width,
                height
            };
        }

        right = cleanUpValue(widget.right);

        const style: React.CSSProperties = {
            display: widget.display || "block",
            position,
            left,
            right,
            top,
            bottom,
            width,
            height
        };

        const dataDesignerObjectId = getPageContext().inEditor ? widget._id : undefined;

        if (widget instanceof Widget) {
            const canvas = widget.draw(rect, dataContext);
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
            const className = widget.getClassNameStr(dataContext);

            style.overflow = "visible";
            widget.styleHook(style);

            return (
                <widget.Div
                    data-designer-object-id={dataDesignerObjectId}
                    className={className}
                    style={style}
                >
                    {widget.render(rect, dataContext, designerContext)}
                </widget.Div>
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
    dataContext: IDataContext;
}> {
    render() {
        const { widgets, dataContext } = this.props;

        return widgets.map((widget, i) => {
            return <WidgetComponent key={widget._id} widget={widget} dataContext={dataContext} />;
        });
    }
}

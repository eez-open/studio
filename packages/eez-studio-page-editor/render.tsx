import React from "react";
import { observer, inject } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { IDesignerContext } from "eez-studio-designer";

import styled from "eez-studio-ui/styled-components";

import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { Widget } from "eez-studio-page-editor/widget";
import { Page } from "eez-studio-page-editor/page";
import { resizeWidget } from "eez-studio-page-editor/resizing-widget-property";

////////////////////////////////////////////////////////////////////////////////

export function renderRootElement(child: React.ReactNode) {
    return PageContext.renderRootElement(child);
}

export function renderBackgroundRect(widget: Widget, rect: Rect) {
    const style = PageContext.findStyleOrGetDefault(widget.style);

    return (
        <div
            style={{
                position: "absolute",
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                backgroundColor: style.backgroundColor
            }}
        />
    );
}

function renderFail(rect: Rect) {
    return (
        <div
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

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
export class WidgetComponent extends React.Component<{
    widget: Widget;
    rect: Rect;
    dataContext: IDataContext;
    designerContext?: IDesignerContext;
}> {
    render() {
        const { widget, rect, dataContext, designerContext } = this.props;

        if (widget.display === false) {
            return null;
        }

        const style: React.CSSProperties = {
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
        };

        const canvas = widget.draw(rect, dataContext);
        if (canvas) {
            style.imageRendering = "pixelated";
            return <img style={style} src={canvas.toDataURL()} />;
        }

        try {
            const node = widget.render(rect, dataContext, designerContext);
            if (node) {
                const className = widget.getClassNameStr(dataContext);

                style.overflow = PageContext.inEditor ? "visible" : "hidden";

                widget.styleHook(style);

                const Div = styled.div`
                    ${widget.css || ""}
                `;
                return (
                    <Div style={style} className={className} {...widget.divAttributes}>
                        {node}
                    </Div>
                );
            }

            return renderBackgroundRect(widget, rect);
        } catch (err) {
            console.error(err);
            return renderFail(rect);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class WidgetContainerComponent extends React.Component<{
    containerWidget: Widget | Page;
    rectContainer: Rect;
    widgets: Widget[];
    dataContext: IDataContext;
}> {
    render() {
        const { containerWidget, rectContainer, widgets, dataContext } = this.props;

        return widgets.map((widget, i) => {
            const rect = resizeWidget(
                widget.rect,
                containerWidget.contentRect,
                rectContainer,
                widget.resizing
            );

            return (
                <WidgetComponent
                    key={widget._id}
                    widget={widget}
                    rect={rect}
                    dataContext={dataContext}
                />
            );
        });
    }
}

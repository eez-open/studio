import React from "react";
import { observer, inject } from "mobx-react";
import styled from "styled-components";

import { Rect } from "eez-studio-shared/geometry";

import { IDesignerContext } from "eez-studio-designer";

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
            let node = widget.render(rect, dataContext, designerContext);
            if (node) {
                const className = widget.getClassNameStr(dataContext);

                //style.overflow = PageContext.inEditor ? "visible" : "hidden";
                style.overflow = "visible";

                widget.styleHook(style);

                if (widget.css) {
                    const Div = styled.div`
                        ${widget.css || ""}
                    `;
                    node = <Div>{node}</Div>;
                }

                return (
                    <div style={style} className={className} {...widget.divAttributes}>
                        {node}
                    </div>
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
export class WidgetComponent2 extends React.Component<{
    widget: Widget;
    rectContainerOriginal: Rect;
    rectContainer: Rect;
    dataContext: IDataContext;
}> {
    render() {
        const { widget, rectContainerOriginal, rectContainer, dataContext } = this.props;

        const rect = resizeWidget(
            widget.rect,
            rectContainerOriginal,
            rectContainer,
            widget.resizing
        );

        return <WidgetComponent widget={widget} rect={rect} dataContext={dataContext} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class WidgetContainerComponent extends React.Component<{
    containerWidget: Widget | Page;
    rectContainer: Rect;
    widgets: Widget[];
    dataContext: IDataContext;
    widgetRects?: Rect[];
}> {
    render() {
        const { containerWidget, rectContainer, widgets, dataContext, widgetRects } = this.props;

        if (widgetRects !== undefined) {
            return widgets.map((widget, i) => {
                return (
                    <WidgetComponent
                        key={widget._id}
                        widget={widget}
                        rect={widgetRects[i]}
                        dataContext={dataContext}
                    />
                );
            });
        } else {
            return widgets.map((widget, i) => {
                return (
                    <WidgetComponent2
                        key={widget._id}
                        widget={widget}
                        rectContainerOriginal={containerWidget.contentRect}
                        rectContainer={rectContainer}
                        dataContext={dataContext}
                    />
                );
            });
        }
    }
}

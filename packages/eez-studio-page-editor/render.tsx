import React from "react";
import { observer, inject } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { IDesignerContext } from "eez-studio-designer";

import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { Widget } from "eez-studio-page-editor/widget";
import { Page } from "eez-studio-page-editor/page";
import { resizeWidget } from "eez-studio-page-editor/resizing-widget-property";

const CONF_SLIDE_TRANSITION = "transform 0.15s ease-out";

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

        const canvas = widget.draw(rect, dataContext);
        if (canvas) {
            return (
                <img
                    style={{
                        position: "absolute",
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        imageRendering: "pixelated"
                    }}
                    src={canvas.toDataURL()}
                />
            );
        }

        try {
            const node = widget.render(rect, dataContext, designerContext);
            if (node) {
                return (
                    <div
                        style={{
                            position: "absolute",
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        }}
                    >
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
export class WidgetContainerComponent extends React.Component<{
    containerWidget: Widget | Page;
    rectContainer: Rect;
    widgets: Widget[];
    dataContext: IDataContext;
    transition?: {
        type: "horizontal" | "vertical";
        index: number;
    };
}> {
    render() {
        const { containerWidget, rectContainer, widgets, dataContext, transition } = this.props;

        let widgetComponents: React.ReactNode = widgets.map((widget, i) => {
            let rect;

            if (transition !== undefined) {
                if (transition.type === "horizontal") {
                    rect = {
                        left: i * rectContainer.width,
                        top: 0,
                        width: rectContainer.width,
                        height: rectContainer.height
                    };
                } else {
                    rect = {
                        left: 0,
                        top: i * rectContainer.height,
                        width: rectContainer.width,
                        height: rectContainer.height
                    };
                }
            } else {
                rect = resizeWidget(
                    widget.rect,
                    containerWidget.contentRect,
                    rectContainer,
                    widget.resizing
                );
            }

            return (
                <WidgetComponent
                    key={widget._id}
                    widget={widget}
                    rect={rect}
                    dataContext={dataContext}
                />
            );
        });

        if (transition !== undefined) {
            const style: React.CSSProperties = {
                position: "absolute",
                left: 0,
                top: 0,
                transition: CONF_SLIDE_TRANSITION
            };

            if (transition.type === "horizontal") {
                style.transform = `translateX(${-transition.index * rectContainer.width}px)`;
            } else {
                style.transform = `translateY(${-transition.index * rectContainer.height}px)`;
            }

            widgetComponents = <div style={style}>{widgetComponents}</div>;
        }

        return (
            <containerWidget.Div
                className={containerWidget.getClassNameStr(dataContext)}
                style={{
                    position: "absolute",
                    overflow: transition !== undefined ? "hidden" : "visible",
                    left: 0,
                    top: 0,
                    width: rectContainer.width,
                    height: rectContainer.height
                }}
            >
                {widgetComponents}
            </containerWidget.Div>
        );
    }
}

import React from "react";

import { Rect } from "eez-studio-shared/geometry";

import { PageContext } from "eez-studio-page-editor/page-context";
import { Widget } from "eez-studio-page-editor/widget";

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

export function renderFail(rect: Rect) {
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

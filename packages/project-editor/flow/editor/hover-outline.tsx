import React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";

import { Rect } from "eez-studio-shared/geometry";

import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { getObjectBoundingRect } from "project-editor/flow/editor/bounding-rects";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";

// Figma-style hover outline: when a row is hovered in the structure tree,
// the corresponding object is outlined on the canvas. The structure tree
// sets hoveredObject; this component (mounted over the flow canvas) draws
// the outline.

export const hoverOutlineState = observable({
    objectAdapter: undefined as TreeObjectAdapter | undefined
});

export const HoverOutline = observer(
    class HoverOutline extends React.Component<{
        context: IFlowContext;
    }> {
        render() {
            const objectAdapter = hoverOutlineState.objectAdapter;
            if (!objectAdapter) {
                return null;
            }

            const viewState = this.props.context.viewState;
            if (!viewState || !viewState.transform) {
                return null;
            }

            let rect: Rect;
            try {
                rect = getObjectBoundingRect(viewState, objectAdapter);
            } catch (err) {
                return null;
            }
            if (!rect) {
                return null;
            }

            const offsetRect = viewState.transform.pageToOffsetRect(rect);
            if (!offsetRect) {
                return null;
            }

            const style: React.CSSProperties = {
                position: "absolute",
                left: offsetRect.left,
                top: offsetRect.top,
                width: offsetRect.width,
                height: offsetRect.height,
                pointerEvents: "none",
                border: `1px solid var(--bs-primary)`,
                borderRadius: "2px"
            };

            return (
                <div
                    className="EezStudio_FlowEditorHoverOutline"
                    style={style}
                />
            );
        }
    }
);

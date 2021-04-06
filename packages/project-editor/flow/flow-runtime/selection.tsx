import React from "react";
import { observer } from "mobx-react";
import { computed } from "mobx";

import {
    BoundingRectBuilder,
    Rect,
    rectExpand
} from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { IMouseHandler } from "project-editor/flow/flow-editor/mouse-handler";
import { getObjectBoundingRect } from "project-editor/flow/flow-editor/bounding-rects";
import { ConnectionLine } from "project-editor/flow/flow";
import { Action } from "project-editor/features/action/action";

////////////////////////////////////////////////////////////////////////////////

const SelectionDiv = styled.div`
    position: absolute;
    cursor: move;

    .EezStudio_FlowRuntimeSelection_BoundingRect {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    .EezStudio_FlowRuntimeSelection_SelectedObject {
        pointer-events: none;
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }
`;

////////////////////////////////////////////////////////////////////////////////

@observer
class SelectedObject extends React.Component<
    {
        className?: string;
        rect?: Rect;
    },
    {}
> {
    render() {
        const { className } = this.props;

        let rect = this.props.rect;
        if (!rect) {
            return null;
        }

        if (
            className === "EezStudio_FlowRuntimeSelection_SelectedObjectsParent"
        ) {
            rect = rectExpand(rect, 2);
        }

        return (
            <div
                className={className}
                style={{
                    position: "absolute",
                    pointerEvents: "none",
                    left: rect.left + "px",
                    top: rect.top + "px",
                    width: rect.width + "px",
                    height: rect.height + "px"
                }}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Selection extends React.Component<
    {
        context: IFlowContext;
        mouseHandler?: IMouseHandler;
    },
    {}
> {
    @computed get selectedObjects() {
        return this.props.context.viewState.selectedObjects.filter(
            selectedObject =>
                !(
                    selectedObject.object instanceof ConnectionLine ||
                    selectedObject.object instanceof Action
                )
        );
    }

    @computed get selectedObjectRects() {
        const viewState = this.props.context.viewState;
        return this.selectedObjects
            .map(selectedObject => getObjectBoundingRect(selectedObject))
            .map(rect => viewState.transform.pageToOffsetRect(rect));
    }

    @computed get selectedObjectsBoundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();
        for (let i = 0; i < this.selectedObjectRects.length; i++) {
            boundingRectBuilder.addRect(this.selectedObjectRects[i]);
        }
        return boundingRectBuilder.getRect();
    }

    render() {
        let selectedObjects = this.selectedObjects;

        const isSelectionVisible = selectedObjects.length > 0;

        let selectedObjectRectsElement;
        let selectedObjectsBoundingRectElement;

        if (isSelectionVisible) {
            // build selectedObjectRectsElement
            const selectedObjectClassName =
                selectedObjects.length > 1
                    ? "EezStudio_FlowRuntimeSelection_SelectedObject"
                    : "EezStudio_FlowRuntimeSelection_BoundingRect";

            selectedObjectRectsElement = selectedObjects.map((object, i) => (
                <SelectedObject
                    key={object.id}
                    className={selectedObjectClassName}
                    rect={
                        i < this.selectedObjectRects.length
                            ? this.selectedObjectRects[i]
                            : undefined
                    }
                />
            ));

            // build selectedObjectsBoundingRectElement
            if (selectedObjects.length > 1) {
                let style: React.CSSProperties = {
                    position: "absolute",
                    left: this.selectedObjectsBoundingRect.left,
                    top: this.selectedObjectsBoundingRect.top,
                    width: this.selectedObjectsBoundingRect.width,
                    height: this.selectedObjectsBoundingRect.height
                };

                selectedObjectsBoundingRectElement = (
                    <div
                        className="EezStudio_FlowRuntimeSelection_BoundingRect"
                        style={style}
                    />
                );
            }
        }

        return (
            <SelectionDiv className="EezStudio_FlowRuntimeSelection">
                {isSelectionVisible && (
                    <React.Fragment>
                        <div className="EezStudio_FlowRuntimeSelection_Draggable">
                            {selectedObjectRectsElement}
                            {selectedObjectsBoundingRectElement}
                        </div>
                    </React.Fragment>
                )}
            </SelectionDiv>
        );
    }
}

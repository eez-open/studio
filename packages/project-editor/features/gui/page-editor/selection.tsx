import React from "react";
import { observer } from "mobx-react";
import { computed } from "mobx";

import {
    BoundingRectBuilder,
    Rect,
    rectExpand
} from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import type {
    IDesignerContext,
    IMouseHandler
} from "project-editor/features/gui/page-editor/designer-interfaces";
import {
    RubberBandSelectionMouseHandler,
    isSelectionMoveable
} from "project-editor/features/gui/page-editor/mouse-handler";
import { getObjectBoundingRect } from "project-editor/features/gui/page-editor/bounding-rects";
import { ConnectionLine } from "project-editor/features/gui/page";
import { ActionComponent } from "project-editor/features/gui/component";

////////////////////////////////////////////////////////////////////////////////

const SelectionDiv = styled.div`
    position: absolute;
    cursor: move;

    .EezStudio_DesignerSelection_BoundingRect {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    .EezStudio_DesignerSelection_SelectedObject {
        pointer-events: none;
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    .EezStudio_DesignerSelection_SelectedObjectsParent {
        pointer-events: none;
        border: 2px dotted magenta;
    }

    .EezStudio_DesignerSelection_ResizeHandle {
        position: absolute;
        background-color: rgba(0, 0, 255, 0.8);
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

        if (className === "EezStudio_DesignerSelection_SelectedObjectsParent") {
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
        context: IDesignerContext;
        mouseHandler?: IMouseHandler;
    },
    {}
> {
    @computed get selectedObjects() {
        return this.props.context.viewState.selectedObjects.filter(
            selectedObject => !(selectedObject.object instanceof ConnectionLine)
        );
    }

    @computed get selectedObjectRects() {
        const viewState = this.props.context.viewState;
        return this.selectedObjects
            .map(selectedObject => getObjectBoundingRect(selectedObject))
            .map(rect => viewState.transform.pageToOffsetRect(rect));
    }

    @computed get selectedObjectsParentRect() {
        const viewState = this.props.context.viewState;
        const selectedObjects = this.selectedObjects;
        if (
            !selectedObjects.every(
                selectedObject =>
                    selectedObject.object instanceof ActionComponent
            )
        ) {
            let parent = this.props.context.document.findObjectParent(
                selectedObjects[0]
            );
            if (parent) {
                let i: number;
                for (i = 1; i < selectedObjects.length; ++i) {
                    if (
                        this.props.context.document.findObjectParent(
                            selectedObjects[i]
                        ) != parent
                    ) {
                        break;
                    }
                }
                if (
                    i === selectedObjects.length &&
                    parent.showSelectedObjectsParent
                ) {
                    return viewState.transform.pageToOffsetRect(
                        getObjectBoundingRect(parent)
                    );
                }
            }
        }
        return undefined;
    }

    @computed get selectedObjectsBoundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();
        for (let i = 0; i < this.selectedObjectRects.length; i++) {
            boundingRectBuilder.addRect(this.selectedObjectRects[i]);
        }
        return boundingRectBuilder.getRect();
    }

    getResizeHandlers(boundingRect: Rect) {
        const resizeHandlers = this.props.context.viewState.getResizeHandlers();
        if (!resizeHandlers || resizeHandlers.length === 0) {
            return null;
        }

        let left = boundingRect.left;
        let width = boundingRect.width;
        let top = boundingRect.top;
        let height = boundingRect.height;

        const B = 8; // HANDLE SIZE
        const A = B / 2;

        if (width < 3 * B) {
            width = 3 * B;
            left -= (width - boundingRect.width) / 2;
        }

        if (height < 3 * B) {
            height = 3 * B;
            top -= (height - boundingRect.height) / 2;
        }

        return resizeHandlers.map(resizeHandler => {
            const x = left + (resizeHandler.x * width) / 100;
            const y = top + (resizeHandler.y * height) / 100;

            const style = {
                left: Math.floor(x - A) + "px",
                top: Math.floor(y - A) + "px",
                width: B + "px",
                height: B + "px",
                cursor: resizeHandler.type
            };

            return (
                <div
                    key={`${resizeHandler.x}-${resizeHandler.y}-${resizeHandler.type}`}
                    className="EezStudio_DesignerSelection_ResizeHandle"
                    style={style}
                    data-column-index={resizeHandler.columnIndex}
                    data-row-index={resizeHandler.rowIndex}
                />
            );
        });
    }

    render() {
        let selectedObjects = this.selectedObjects;

        const isSelectionVisible = selectedObjects.length > 0;

        const isSelectedObjectComponentPaletteItem =
            selectedObjects.length === 1 &&
            selectedObjects[0].id === "ComponentPaletteItem";

        let selectedObjectRectsElement;
        let selectedObjectsBoundingRectElement;
        let resizeHandlersElement;
        let selectedObjectsParentElement;

        if (isSelectionVisible) {
            // build selectedObjectRectsElement
            const selectedObjectClassName =
                selectedObjects.length > 1
                    ? "EezStudio_DesignerSelection_SelectedObject"
                    : "EezStudio_DesignerSelection_BoundingRect";

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
                        className="EezStudio_DesignerSelection_BoundingRect"
                        style={style}
                    />
                );
            }

            // build resizeHandlersElement
            const isActiveRubberBendSelection =
                this.props.mouseHandler &&
                this.props.mouseHandler instanceof
                    RubberBandSelectionMouseHandler &&
                this.props.mouseHandler.rubberBendRect;
            if (!isActiveRubberBendSelection!) {
                resizeHandlersElement = this.getResizeHandlers(
                    this.selectedObjectsBoundingRect
                );
            }

            if (this.selectedObjectsParentRect) {
                selectedObjectsParentElement = (
                    <SelectedObject
                        className="EezStudio_DesignerSelection_SelectedObjectsParent"
                        rect={this.selectedObjectsParentRect}
                    />
                );
            }
        }

        const style: React.CSSProperties = {
            pointerEvents: isSelectedObjectComponentPaletteItem
                ? "none"
                : undefined
        };

        if (!isSelectionMoveable(this.props.context)) {
            style.cursor = "default";
        }

        return (
            <SelectionDiv className="EezStudio_DesignerSelection" style={style}>
                {isSelectionVisible && (
                    <React.Fragment>
                        {selectedObjectsParentElement}
                        <div className="EezStudio_DesignerSelection_Draggable">
                            {selectedObjectRectsElement}
                            {selectedObjectsBoundingRectElement}
                            {resizeHandlersElement}
                        </div>
                    </React.Fragment>
                )}
            </SelectionDiv>
        );
    }
}

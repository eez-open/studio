import React from "react";
import { observer } from "mobx-react";
import { computed } from "mobx";

import { addAlphaToColor } from "eez-studio-shared/color";
import { Rect, rectExpand } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import {
    IBaseObject,
    IDesignerContext,
    IMouseHandler,
    IViewState
} from "eez-studio-designer/designer-interfaces";
import {
    RubberBandSelectionMouseHandler,
    isSelectionMoveable
} from "eez-studio-designer/select-tool";
import {
    getObjectBoundingRect,
    getSelectedObjectsBoundingRect
} from "eez-studio-designer/bounding-rects";

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

    .EezStudio_DesignerSelection_RubberBend {
        position: absolute;
        background-color: ${props => addAlphaToColor(props.theme.selectionBackgroundColor, 0.5)};
        border: 1px solid ${props => props.theme.selectionBackgroundColor};
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
        object: IBaseObject;
        viewState: IViewState;
        className?: string;
    },
    {}
> {
    render() {
        const { object, viewState, className } = this.props;
        let rect = viewState.transform.pageToOffsetRect(getObjectBoundingRect(object, viewState));

        if (className === "EezStudio_DesignerSelection_SelectedObjectsParent") {
            rect = rectExpand(rect, 2);
        }

        return (
            <div
                className={className}
                style={{
                    position: "absolute",
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

    @computed get selectedObjectsBoundingRect() {
        return this.props.context.viewState.transform.pageToOffsetRect(
            getSelectedObjectsBoundingRect(this.props.context.viewState)
        );
    }

    render() {
        let selectedObjects = this.props.context.viewState.selectedObjects;

        const isSelectionVisible =
            selectedObjects.length > 0 &&
            (!this.props.mouseHandler || this.props.mouseHandler.selectionVisible);

        const isSelectedObjectWidgetPaletteItem =
            selectedObjects.length === 1 && selectedObjects[0].id === "WidgetPaletteItem";

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

            selectedObjectRectsElement = selectedObjects.map(object => (
                <SelectedObject
                    className={selectedObjectClassName}
                    key={object.id}
                    object={object}
                    viewState={this.props.context.viewState}
                />
            ));

            // build selectedObjectsBoundingRectElement
            if (selectedObjects.length > 1) {
                let style: React.CSSProperties = {
                    position: "absolute",
                    left: Math.floor(this.selectedObjectsBoundingRect.left) + "px",
                    top: Math.floor(this.selectedObjectsBoundingRect.top) + "px",
                    width: Math.floor(this.selectedObjectsBoundingRect.width) + "px",
                    height: Math.floor(this.selectedObjectsBoundingRect.height) + "px"
                };

                selectedObjectsBoundingRectElement = (
                    <div className="EezStudio_DesignerSelection_BoundingRect" style={style} />
                );
            }

            // build resizeHandlersElement
            const isActiveRubberBendSelection =
                this.props.mouseHandler &&
                this.props.mouseHandler instanceof RubberBandSelectionMouseHandler &&
                this.props.mouseHandler.rubberBendRect;
            if (!isActiveRubberBendSelection!) {
                resizeHandlersElement = this.getResizeHandlers(this.selectedObjectsBoundingRect);
            }

            // build selectedObjectsParentElement;
            const parent = this.props.context.document.findObjectParent(selectedObjects[0]);
            if (parent) {
                let i: number;
                for (i = 1; i < selectedObjects.length; ++i) {
                    if (
                        this.props.context.document.findObjectParent(selectedObjects[i]) != parent
                    ) {
                        break;
                    }
                }
                if (i === selectedObjects.length) {
                    selectedObjectsParentElement = (
                        <SelectedObject
                            className="EezStudio_DesignerSelection_SelectedObjectsParent"
                            object={parent}
                            viewState={this.props.context.viewState}
                        />
                    );
                }
            }
        }

        const style: React.CSSProperties = {
            pointerEvents: isSelectedObjectWidgetPaletteItem ? "none" : undefined
        };

        if (!isSelectionMoveable(this.props.context)) {
            style.cursor = "default";
        }

        return (
            <SelectionDiv className="EezStudio_DesignerSelection" style={style}>
                {isSelectionVisible && (
                    <React.Fragment>
                        {selectedObjectsParentElement}
                        {selectedObjectRectsElement}
                        {selectedObjectsBoundingRectElement}
                        {resizeHandlersElement}
                    </React.Fragment>
                )}
                {this.props.mouseHandler &&
                    this.props.mouseHandler.render &&
                    this.props.mouseHandler.render(this.props.context)}
            </SelectionDiv>
        );
    }
}

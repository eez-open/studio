import React from "react";
import { observer } from "mobx-react";

import { addAlphaToColor } from "eez-studio-shared/color";
import { Rect } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import {
    IBaseObject,
    IDesignerContext,
    IMouseHandler,
    IViewState
} from "eez-studio-designer/designer-interfaces";
import {
    RubberBandSelectionMouseHandler,
    getObjectBoundingRect,
    getSelectedObjectsBoundingRect
} from "eez-studio-designer/select-tool";

////////////////////////////////////////////////////////////////////////////////

const SelectionDiv = styled.div`
    position: absolute;
    left: 0;
    top: 0;
    cursor: move;

    .EezStudio_DesignerSelection_SelectedObject {
        pointer-events: none;
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    .EezStudio_DesignerSelection_BoundingRect {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
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
        const rect = this.props.viewState.transform.modelToOffsetRect(
            getObjectBoundingRect(this.props.object, this.props.viewState)
        );

        return (
            <div
                className={this.props.className}
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
    constructor(props: any) {
        super(props);
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
        let selectedObjectRects;
        let selectedObjectsBoundingRect;
        let resizeHandlers;

        const transform = this.props.context.viewState.transform.clone();

        let selectedObjects = this.props.context.viewState.selectedObjects;

        if (selectedObjects.length > 0) {
            const selectedObjectClassName =
                selectedObjects.length > 1
                    ? "EezStudio_DesignerSelection_SelectedObject"
                    : "EezStudio_DesignerSelection_BoundingRect";

            //
            selectedObjectRects = selectedObjects.map(object => (
                <SelectedObject
                    className={selectedObjectClassName}
                    key={object.id}
                    object={object}
                    viewState={this.props.context.viewState}
                />
            ));

            //
            let boundingRect = transform.modelToOffsetRect(
                getSelectedObjectsBoundingRect(this.props.context.viewState)
            );

            if (selectedObjects.length > 1) {
                let style: React.CSSProperties = {
                    position: "absolute",
                    left: Math.floor(boundingRect.left) + "px",
                    top: Math.floor(boundingRect.top) + "px",
                    width: Math.floor(boundingRect.width) + "px",
                    height: Math.floor(boundingRect.height) + "px"
                };

                selectedObjectsBoundingRect = (
                    <div className="EezStudio_DesignerSelection_BoundingRect" style={style} />
                );
            }

            //
            const isActiveRubberBendSelection =
                this.props.mouseHandler &&
                this.props.mouseHandler instanceof RubberBandSelectionMouseHandler &&
                this.props.mouseHandler.rubberBendRect;

            if (!isActiveRubberBendSelection!) {
                resizeHandlers = this.getResizeHandlers(boundingRect);
            }
        }

        return (
            <SelectionDiv
                className="EezStudio_DesignerSelection"
                style={{
                    left: 0,
                    top: 0,
                    pointerEvents:
                        selectedObjects.length === 1 &&
                        selectedObjects[0].id === "WidgetPaletteItem"
                            ? "none"
                            : undefined
                }}
            >
                {(!this.props.mouseHandler || this.props.mouseHandler.selectionVisible) && (
                    <React.Fragment>
                        {selectedObjectRects}
                        {selectedObjectsBoundingRect}
                        {resizeHandlers}
                    </React.Fragment>
                )}
                {this.props.mouseHandler &&
                    this.props.mouseHandler.render &&
                    this.props.mouseHandler.render(this.props.context)}
            </SelectionDiv>
        );
    }
}

import React from "react";
import { observer } from "mobx-react";

import { addAlphaToColor } from "eez-studio-shared/color";
import { Rect, Transform } from "eez-studio-shared/geometry";

import styled from "eez-studio-ui/styled-components";

import {
    IBaseObject,
    IDesignerContext,
    IMouseHandler
} from "eez-studio-designer/designer-interfaces";
import { RubberBandSelectionMouseHandler } from "eez-studio-designer/select-tool";

@observer
class SelectedObject extends React.Component<
    {
        object: IBaseObject;
        transform: Transform;
        className: string;
    },
    {}
> {
    render() {
        const rects = this.props.object.selectionRects;

        return (
            <React.Fragment>
                {rects.map((rect, i) => {
                    rect = this.props.transform.modelToOffsetRect(rect);
                    let style: React.CSSProperties = {
                        position: "absolute",
                        left: rect.left + "px",
                        top: rect.top + "px",
                        width: rect.width + "px",
                        height: rect.height + "px"
                    };
                    return <div key={i} className={this.props.className} style={style} />;
                })}
            </React.Fragment>
        );
    }
}

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

    .EezStudio_DesignerSelection_Handle {
        position: absolute;
    }

    .EezStudio_DesignerSelection_Handle.Side {
        background-color: rgba(0, 0, 255, 0.5);
    }

    .EezStudio_DesignerSelection_Handle.Corner {
        background-color: rgba(0, 0, 255, 0.8);
    }

    .EezStudio_DesignerSelection_Handle.TopLeft {
        cursor: nw-resize;
    }

    .EezStudio_DesignerSelection_Handle.Top {
        cursor: n-resize;
    }

    .EezStudio_DesignerSelection_Handle.TopRight {
        cursor: ne-resize;
    }

    .EezStudio_DesignerSelection_Handle.Left {
        cursor: w-resize;
    }

    .EezStudio_DesignerSelection_Handle.Right {
        cursor: e-resize;
    }

    .EezStudio_DesignerSelection_Handle.BottomLeft {
        cursor: sw-resize;
    }

    .EezStudio_DesignerSelection_Handle.Bottom {
        cursor: s-resize;
    }

    .EezStudio_DesignerSelection_Handle.BottomRight {
        cursor: se-resize;
    }
`;

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

    render() {
        let selectedObjectRects;
        let selectedObjectsBoundingRect;
        let resizeHandlers;

        const transform = this.props.context.viewState.transform.clone();

        if (this.props.context.viewState.selectedObjects.length > 0) {
            const selectedObjectClassName =
                this.props.context.viewState.selectedObjects.length > 1
                    ? "EezStudio_DesignerSelection_SelectedObject"
                    : "EezStudio_DesignerSelection_BoundingRect";

            //
            selectedObjectRects = this.props.context.viewState.selectedObjects.map(object => (
                <SelectedObject
                    className={selectedObjectClassName}
                    key={object.id}
                    object={object}
                    transform={transform}
                />
            ));

            //
            let boundingRect = transform.modelToOffsetRect(this.props.context.viewState
                .selectedObjectsBoundingRect as Rect);

            if (this.props.context.viewState.selectedObjects.length > 1) {
                let style: React.CSSProperties = {
                    position: "absolute",
                    left: boundingRect.left + "px",
                    top: boundingRect.top + "px",
                    width: boundingRect.width + "px",
                    height: boundingRect.height + "px"
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

            if (
                !isActiveRubberBendSelection! &&
                this.props.context.viewState.isSelectionResizable
            ) {
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

                let hcenter = left + width / 2;
                let right = left + width;

                let vcenter = top + height / 2;
                let bottom = top + height;

                let styleTopLeft: React.CSSProperties = {
                    left: left - A + "px",
                    top: top - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleTop: React.CSSProperties = {
                    left: hcenter - A + "px",
                    top: top - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleTopRight: React.CSSProperties = {
                    left: right - A + "px",
                    top: top - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleLeft: React.CSSProperties = {
                    left: left - A + "px",
                    top: vcenter - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleRight: React.CSSProperties = {
                    left: right - A + "px",
                    top: vcenter - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleBottomLeft: React.CSSProperties = {
                    left: left - A + "px",
                    top: bottom - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleBottom: React.CSSProperties = {
                    left: hcenter - A + "px",
                    top: bottom - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                let styleBottomRight: React.CSSProperties = {
                    left: right - A + "px",
                    top: bottom - A + "px",
                    width: B + "px",
                    height: B + "px"
                };

                resizeHandlers = [
                    <div
                        key="TopLeft"
                        className="EezStudio_DesignerSelection_Handle Corner TopLeft"
                        style={styleTopLeft}
                    />,
                    <div
                        key="Top"
                        className="EezStudio_DesignerSelection_Handle Side Top"
                        style={styleTop}
                    />,
                    <div
                        key="TopRight"
                        className="EezStudio_DesignerSelection_Handle Corner TopRight"
                        style={styleTopRight}
                    />,
                    <div
                        key="Left"
                        className="EezStudio_DesignerSelection_Handle Side Left"
                        style={styleLeft}
                    />,
                    <div
                        key="Right"
                        className="EezStudio_DesignerSelection_Handle Side Right"
                        style={styleRight}
                    />,
                    <div
                        key="BottomLeft"
                        className="EezStudio_DesignerSelection_Handle Corner BottomLeft"
                        style={styleBottomLeft}
                    />,
                    <div
                        key="Bottom"
                        className="EezStudio_DesignerSelection_Handle Side Bottom"
                        style={styleBottom}
                    />,
                    <div
                        key="BottomRight"
                        className="EezStudio_DesignerSelection_Handle Corner BottomRight"
                        style={styleBottomRight}
                    />
                ];
            }
        }

        return (
            <SelectionDiv
                className="EezStudio_DesignerSelection"
                style={{
                    left: 0,
                    top: 0
                }}
            >
                {selectedObjectRects}
                {selectedObjectsBoundingRect}
                {resizeHandlers}
                {this.props.mouseHandler &&
                    this.props.mouseHandler.renderInSelectionLayer &&
                    this.props.mouseHandler.renderInSelectionLayer()}
            </SelectionDiv>
        );
    }
}

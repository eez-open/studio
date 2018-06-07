import * as React from "react";
import { observer } from "mobx-react";

import { Rect, Transform } from "shared/geometry";

import { IBaseObject, IDocument } from "shared/ui/designer/designer-interfaces";

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

@observer
export class Selection extends React.Component<
    {
        document: IDocument;
        transform: Transform;
        rubberBendRect: Rect | undefined;
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
        if (this.props.document.selectedObjects.length > 0) {
            const selectedObjectClassName =
                this.props.document.selectedObjects.length > 1
                    ? "EezStudio_DesignerSelection_SelectedObject"
                    : "EezStudio_DesignerSelection_BoundingRect";

            //
            selectedObjectRects = this.props.document.selectedObjects.map(object => (
                <SelectedObject
                    className={selectedObjectClassName}
                    key={object.id}
                    object={object}
                    transform={this.props.transform}
                />
            ));

            //
            let boundingRect = this.props.transform.modelToOffsetRect(this.props.document
                .selectedObjectsBoundingRect as Rect);

            if (this.props.document.selectedObjects.length > 1) {
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
            if (!this.props.rubberBendRect && this.props.document.selectionResizable) {
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

        //
        let rubberBendRect;
        if (this.props.rubberBendRect) {
            rubberBendRect = (
                <div
                    className="EezStudio_DesignerSelection_RubberBend"
                    style={{
                        left: this.props.rubberBendRect.left,
                        top: this.props.rubberBendRect.top,
                        width: this.props.rubberBendRect.width,
                        height: this.props.rubberBendRect.height
                    }}
                />
            );
        }

        return (
            <div className="EezStudio_DesignerSelection">
                {selectedObjectRects}
                {selectedObjectsBoundingRect}
                {resizeHandlers}
                {rubberBendRect}
            </div>
        );
    }
}

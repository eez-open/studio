import * as React from "react";
import { observer } from "mobx-react";

import { Rect } from "shared/geometry";

import { IObject } from "home/store";

import { IPage } from "home/designer/designer-store";
import { Transform } from "home/designer/transform";

@observer
class SelectedObject extends React.Component<
    {
        object: IObject;
        transform: Transform;
    },
    {}
> {
    render() {
        let rect = this.props.transform.modelToOffsetRect(this.props.object.boundingRect);

        let style: React.CSSProperties = {
            position: "absolute",
            left: rect.left + "px",
            top: rect.top + "px",
            width: rect.width + "px",
            height: rect.height + "px"
        };

        return <div className="EezStudio_Selection_BoundingRect" style={style} />;
    }
}

@observer
export class Selection extends React.Component<
    {
        page: IPage;
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
        if (this.props.page.selectedObjects.length > 0) {
            //
            selectedObjectRects = this.props.page.selectedObjects.map(object => (
                <SelectedObject key={object.id} object={object} transform={this.props.transform} />
            ));

            //
            let boundingRect = this.props.transform.modelToOffsetRect(this.props.page
                .selectedObjectsBoundingRect as Rect);

            if (this.props.page.selectedObjects.length > 1) {
                let style: React.CSSProperties = {
                    position: "absolute",
                    left: boundingRect.left + "px",
                    top: boundingRect.top + "px",
                    width: boundingRect.width + "px",
                    height: boundingRect.height + "px"
                };

                selectedObjectsBoundingRect = (
                    <div className="EezStudio_Selection_BoundingRect" style={style} />
                );
            }

            //
            if (!this.props.rubberBendRect && this.props.page.selectionResizable) {
                let left = boundingRect.left;
                let width = boundingRect.width;
                let top = boundingRect.top;
                let height = boundingRect.height;

                if (width < 64) {
                    width = 64;
                    left -= (width - boundingRect.width) / 2;
                }

                if (height < 64) {
                    height = 64;
                    top -= (height - boundingRect.height) / 2;
                }

                let hcenter = left + width / 2;
                let right = left + width;

                let vcenter = top + height / 2;
                let bottom = top + height;

                const B = 16; // HANDLE SIZE
                const A = B / 2;

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
                        className="EezStudio_Selection_Handle Corner TopLeft"
                        style={styleTopLeft}
                    />,
                    <div
                        key="Top"
                        className="EezStudio_Selection_Handle Side Top"
                        style={styleTop}
                    />,
                    <div
                        key="TopRight"
                        className="EezStudio_Selection_Handle Corner TopRight"
                        style={styleTopRight}
                    />,
                    <div
                        key="Left"
                        className="EezStudio_Selection_Handle Side Left"
                        style={styleLeft}
                    />,
                    <div
                        key="Right"
                        className="EezStudio_Selection_Handle Side Right"
                        style={styleRight}
                    />,
                    <div
                        key="BottomLeft"
                        className="EezStudio_Selection_Handle Corner BottomLeft"
                        style={styleBottomLeft}
                    />,
                    <div
                        key="Bottom"
                        className="EezStudio_Selection_Handle Side Bottom"
                        style={styleBottom}
                    />,
                    <div
                        key="BottomRight"
                        className="EezStudio_Selection_Handle Corner BottomRight"
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
                    className="EezStudio_SelectionRubberBend"
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
            <div className="EezStudio_Selection">
                {selectedObjectRects}
                {selectedObjectsBoundingRect}
                {resizeHandlers}
                {rubberBendRect}
            </div>
        );
    }
}

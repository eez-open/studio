import React from "react";
import { observer } from "mobx-react";
import { computed } from "mobx";

import { Rect, rectExpand } from "eez-studio-shared/geometry";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { IMouseHandler } from "project-editor/flow/flow-editor/mouse-handler";
import { getObjectBoundingRect } from "project-editor/flow/flow-editor/bounding-rects";
import { ConnectionLine, Flow } from "project-editor/flow/flow";

////////////////////////////////////////////////////////////////////////////////

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

        rect = rectExpand(rect, 6);

        return (
            <div
                className={className}
                style={{
                    position: "absolute",
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
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
                    selectedObject.object instanceof Flow ||
                    selectedObject.object instanceof ConnectionLine
                )
        );
    }

    @computed get selectedObjectRects() {
        const viewState = this.props.context.viewState;
        return this.selectedObjects
            .map(selectedObject => getObjectBoundingRect(selectedObject))
            .map(rect => viewState.transform.pageToOffsetRect(rect));
    }

    render() {
        let selectedObjects = this.selectedObjects;

        const isSelectionVisible = selectedObjects.length > 0;

        let selectedObjectRectsElement;

        if (isSelectionVisible) {
            selectedObjectRectsElement = selectedObjects.map((object, i) => (
                <SelectedObject
                    key={object.id}
                    className="EezStudio_FlowRuntimeSelection_SelectedObject"
                    rect={
                        i < this.selectedObjectRects.length
                            ? this.selectedObjectRects[i]
                            : undefined
                    }
                />
            ));
        }

        return (
            <div className="EezStudio_FlowRuntimeSelection">
                {isSelectionVisible && selectedObjectRectsElement}
            </div>
        );
    }
}

import React from "react";
import { observer } from "mobx-react";
import { computed, makeObservable } from "mobx";
import classNames from "classnames";

import { Rect, rectExpand } from "eez-studio-shared/geometry";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { IMouseHandler } from "project-editor/flow/editor/mouse-handler";
import { getObjectBoundingRect } from "project-editor/flow/editor/bounding-rects";
import type { ConnectionLine } from "project-editor/flow/flow";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////

const SelectedObject = observer(
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
);

////////////////////////////////////////////////////////////////////////////////

export const Selection = observer(
    class Selection extends React.Component<
        {
            context: IFlowContext;
            mouseHandler?: IMouseHandler;
        },
        {}
    > {
        constructor(props: {
            context: IFlowContext;
            mouseHandler?: IMouseHandler;
        }) {
            super(props);

            makeObservable(this, {
                selectedObjects: computed,
                selectedObjectRects: computed,
                connectionLine: computed,
                sourceComponent: computed,
                targetComponent: computed
            });
        }

        get selectedObjects() {
            return this.props.context.viewState.selectedObjects.filter(
                selectedObject =>
                    !(
                        selectedObject.object instanceof
                            ProjectEditor.FlowClass ||
                        selectedObject.object instanceof
                            ProjectEditor.ConnectionLineClass
                    )
            );
        }

        get selectedObjectRects() {
            const viewState = this.props.context.viewState;
            return this.selectedObjects
                .map(selectedObject => getObjectBoundingRect(selectedObject))
                .map(rect => viewState.transform.pageToOffsetRect(rect!));
        }

        get connectionLine() {
            const connectionLines =
                this.props.context.viewState.selectedObjects.filter(
                    selectedObject =>
                        selectedObject.object instanceof
                        ProjectEditor.ConnectionLineClass
                );

            if (connectionLines.length == 1) {
                return connectionLines[0].object as ConnectionLine;
            }

            return undefined;
        }

        get sourceComponent() {
            if (this.selectedObjects.length != 2) {
                return undefined;
            }
            const connectionLine = this.connectionLine;
            if (!connectionLine) {
                return undefined;
            }
            if (
                connectionLine.sourceComponent ===
                this.selectedObjects[0].object
            ) {
                return this.selectedObjects[0].object;
            }

            if (
                connectionLine.sourceComponent ===
                this.selectedObjects[1].object
            ) {
                return this.selectedObjects[1].object;
            }
            return undefined;
        }

        get targetComponent() {
            if (this.selectedObjects.length != 2) {
                return undefined;
            }
            const connectionLine = this.connectionLine;
            if (!connectionLine) {
                return undefined;
            }
            if (
                connectionLine.targetComponent ===
                this.selectedObjects[0].object
            ) {
                return this.selectedObjects[0].object;
            }

            if (
                connectionLine.targetComponent ===
                this.selectedObjects[1].object
            ) {
                return this.selectedObjects[1].object;
            }
            return undefined;
        }

        render() {
            let selectedObjects = this.selectedObjects;

            const isSelectionVisible = selectedObjects.length > 0;

            let selectedObjectRectsElement;

            if (isSelectionVisible) {
                selectedObjectRectsElement = selectedObjects.map(
                    (selectedObject, i) => (
                        <SelectedObject
                            key={selectedObject.id}
                            className={classNames(
                                "EezStudio_FlowRuntimeSelection_SelectedObject",
                                {
                                    source:
                                        this.sourceComponent ==
                                            selectedObject.object &&
                                        this.targetComponent,
                                    target:
                                        this.targetComponent ==
                                            selectedObject.object &&
                                        this.sourceComponent
                                }
                            )}
                            rect={
                                i < this.selectedObjectRects.length
                                    ? this.selectedObjectRects[i]
                                    : undefined
                            }
                        />
                    )
                );
            }

            return (
                <div className="EezStudio_FlowRuntimeSelection">
                    {isSelectionVisible && selectedObjectRectsElement}
                </div>
            );
        }
    }
);

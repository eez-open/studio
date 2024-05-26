import React from "react";
import { observer } from "mobx-react";
import { computed, makeObservable, observable, runInAction } from "mobx";
import classNames from "classnames";

import { Rect, rectExpand } from "eez-studio-shared/geometry";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { IMouseHandler } from "project-editor/flow/editor/mouse-handler";
import { getObjectBoundingRect } from "project-editor/flow/editor/bounding-rects";
import { ProjectEditor } from "project-editor/project-editor-interface";

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
                _selectedObjectRects: observable,
                selectedObjects: computed,
                selectedObjectRects: computed
            });
        }

        requestAnimationFrameId: any;

        _selectedObjectRects: Rect[] = [];

        getRects = () => {
            const getSelectedObjectRects = () => {
                const viewState = this.props.context.viewState;
                return this.selectedObjects
                    .map(selectedObject =>
                        getObjectBoundingRect(viewState, selectedObject)
                    )
                    .map(rect => viewState.transform.pageToOffsetRect(rect!));
            };

            function compareRects(r1: Rect | undefined, r2: Rect | undefined) {
                if (!r1) {
                    return r2 != undefined;
                }

                if (!r2) {
                    return true;
                }

                return (
                    r1.left != r2.left ||
                    r1.top != r2.top ||
                    r1.width != r2.width ||
                    r1.height != r2.height
                );
            }

            function compareRectArray(
                arr1: Rect[] | undefined,
                arr2: Rect[] | undefined
            ) {
                if (!arr1) {
                    return arr2 != undefined;
                }

                if (!arr2) {
                    return true;
                }

                if (arr1.length != arr2.length) {
                    return true;
                }

                for (let i = 0; i < arr1.length; i++) {
                    if (compareRects(arr1[i], arr2[i])) {
                        return true;
                    }
                }

                return false;
            }

            const selectedObjectRects = getSelectedObjectRects();

            if (
                compareRectArray(selectedObjectRects, this._selectedObjectRects)
            ) {
                runInAction(() => {
                    this._selectedObjectRects = selectedObjectRects;
                });
            }

            this.requestAnimationFrameId = requestAnimationFrame(this.getRects);
        };

        componentDidMount() {
            this.getRects();
        }

        componentWillUnmount() {
            cancelAnimationFrame(this.requestAnimationFrameId);
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
            return this._selectedObjectRects;
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
                                        this.props.context.viewState
                                            .sourceComponent?.object ==
                                            selectedObject.object &&
                                        this.props.context.viewState
                                            .targetComponent,
                                    target:
                                        this.props.context.viewState
                                            .targetComponent?.object ==
                                            selectedObject.object &&
                                        this.props.context.viewState
                                            .sourceComponent
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

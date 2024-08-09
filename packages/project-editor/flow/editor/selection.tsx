import React from "react";
import { observer } from "mobx-react";
import { computed, makeObservable, observable, runInAction } from "mobx";

import {
    BoundingRectBuilder,
    Rect,
    rectExpand
} from "eez-studio-shared/geometry";

import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { IMouseHandler } from "project-editor/flow/editor/mouse-handler";
import { isSelectionMoveable } from "project-editor/flow/editor/mouse-handler";
import { getObjectBoundingRect } from "project-editor/flow/editor/bounding-rects";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { DragAndDropManager } from "project-editor/core/dd";
import { ProjectContext } from "project-editor/project/context";

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

            if (
                className ===
                "EezStudio_FlowEditorSelection_SelectedObjectsParent"
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
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        selectionNodeRef = React.createRef<HTMLDivElement>();

        requestAnimationFrameId: any;

        _selectedObjectRects: Rect[] = [];
        _selectedObjectsParentRect: Rect | undefined = undefined;

        constructor(props: {
            context: IFlowContext;
            mouseHandler?: IMouseHandler;
        }) {
            super(props);

            makeObservable(this, {
                selectedObjects: computed,
                _selectedObjectRects: observable,
                _selectedObjectsParentRect: observable,
                selectedObjectsBoundingRect: computed
            });
        }

        getRects = () => {
            const getSelectedObjectRects = () => {
                const viewState = this.props.context.viewState;
                return this.selectedObjects
                    .map(selectedObject =>
                        getObjectBoundingRect(viewState, selectedObject)
                    )
                    .map(rect => viewState.transform.pageToOffsetRect(rect!));
            };

            const getSelectedObjectsParentRect = () => {
                const viewState = this.props.context.viewState;
                const selectedObjects = this.selectedObjects;
                if (
                    !selectedObjects.every(
                        selectedObject =>
                            selectedObject.object instanceof
                            ProjectEditor.ActionComponentClass
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
                            const parentRect = getObjectBoundingRect(
                                viewState,
                                parent
                            );
                            if (parentRect) {
                                return viewState.transform.pageToOffsetRect(
                                    parentRect
                                );
                            }
                        }
                    }
                }
                return undefined;
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

                this.showSelection();
            }

            const selectedObjectsParentRect = getSelectedObjectsParentRect();
            if (
                compareRects(
                    selectedObjectsParentRect,
                    this._selectedObjectsParentRect
                )
            ) {
                runInAction(() => {
                    this._selectedObjectsParentRect = selectedObjectsParentRect;
                });

                this.showSelection();
            }

            this.requestAnimationFrameId = requestAnimationFrame(this.getRects);
        };

        componentDidMount() {
            this.getRects();
        }

        componentWillUnmount() {
            cancelAnimationFrame(this.requestAnimationFrameId);
        }

        showSelectionTimeoutId: any;
        showSelection() {
            if (this.context.projectTypeTraits.isDashboard) {
                return;
            }

            if (this.showSelectionTimeoutId) {
                clearTimeout(this.showSelectionTimeoutId);
            }

            this.showSelectionTimeoutId = setTimeout(() => {
                this.showSelectionTimeoutId = undefined;
                if (this.selectionNodeRef.current) {
                    this.selectionNodeRef.current.style.display = "block";
                }
            }, 50);
        }

        get selectedObjects() {
            return this.props.context.viewState.selectedObjects.filter(
                selectedObject =>
                    (!this.props.mouseHandler || selectedObject.isSelectable) &&
                    !(
                        selectedObject.object instanceof
                            ProjectEditor.ConnectionLineClass ||
                        selectedObject.object instanceof
                            ProjectEditor.ActionClass
                    )
            );
        }

        get selectedObjectRects() {
            return this._selectedObjectRects;
        }

        get selectedObjectsParentRect() {
            return this._selectedObjectsParentRect;
        }

        get selectedObjectsBoundingRect() {
            let boundingRectBuilder = new BoundingRectBuilder();
            for (let i = 0; i < this.selectedObjectRects.length; i++) {
                boundingRectBuilder.addRect(this.selectedObjectRects[i]);
            }
            return boundingRectBuilder.getRect();
        }

        getResizeHandlers(boundingRect: Rect) {
            const resizeHandlers =
                this.props.context.viewState.getResizeHandlers();
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
                    left: x - A + "px",
                    top: y - A + "px",
                    width: B + "px",
                    height: B + "px",
                    cursor: resizeHandler.type
                };

                return (
                    <div
                        key={`${resizeHandler.x}-${resizeHandler.y}-${resizeHandler.type}`}
                        className="EezStudio_FlowEditorSelection_ResizeHandle"
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
                selectedObjects[0].object === DragAndDropManager.dragObject;

            let selectedObjectRectsElement;
            let selectedObjectsBoundingRectElement;
            let resizeHandlersElement;
            let selectedObjectsParentElement;

            if (isSelectionVisible) {
                // build selectedObjectRectsElement
                const selectedObjectClassName =
                    selectedObjects.length > 1 ||
                    !selectedObjects[0].isSelectable
                        ? "EezStudio_FlowEditorSelection_SelectedObject"
                        : "EezStudio_FlowEditorSelection_BoundingRect";

                selectedObjectRectsElement = selectedObjects.map(
                    (object, i) => (
                        <SelectedObject
                            key={object.id}
                            className={selectedObjectClassName}
                            rect={
                                i < this.selectedObjectRects.length
                                    ? this.selectedObjectRects[i]
                                    : undefined
                            }
                        />
                    )
                );

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
                            className="EezStudio_FlowEditorSelection_BoundingRect"
                            style={style}
                        />
                    );
                }

                // build resizeHandlersElement
                if (
                    !this.props.mouseHandler &&
                    !selectedObjects.find(
                        selectedObject => !selectedObject.isSelectable
                    )
                ) {
                    resizeHandlersElement = this.getResizeHandlers(
                        this.selectedObjectsBoundingRect
                    );
                }

                // if (this.selectedObjectsParentRect) {
                //     selectedObjectsParentElement = (
                //         <SelectedObject
                //             className="EezStudio_FlowEditorSelection_SelectedObjectsParent"
                //             rect={this.selectedObjectsParentRect}
                //         />
                //     );
                // }
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
                <div className="EezStudio_FlowEditorSelection" style={style}>
                    {isSelectionVisible && (
                        <React.Fragment>
                            {selectedObjectsParentElement}
                            <div
                                className="EezStudio_FlowEditorSelection_Draggable"
                                ref={this.selectionNodeRef}
                            >
                                {selectedObjectRectsElement}
                                {selectedObjectsBoundingRectElement}
                                {resizeHandlersElement}
                            </div>
                        </React.Fragment>
                    )}
                </div>
            );
        }
    }
);

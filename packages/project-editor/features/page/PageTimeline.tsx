import React from "react";
import {
    makeObservable,
    action,
    computed,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { addAlphaToColor } from "eez-studio-shared/color";
import {
    isRectInsideRect,
    Point,
    pointInRect,
    Rect,
    rectClone
} from "eez-studio-shared/geometry";
import { closestBySelector } from "eez-studio-shared/dom";

import { theme } from "eez-studio-ui/theme";
import { SvgLabel } from "eez-studio-ui/svg-label";
import { Draggable } from "eez-studio-ui/draggable";

import { ProjectEditor } from "project-editor/project-editor-interface";

import { getId, getParent, IEezObject } from "project-editor/core/object";
import { TreeAdapter, ITreeRow } from "project-editor/core/objectAdapter";
import { getAncestorOfType, IPanel } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";

import { setupDragScroll } from "project-editor/flow/editor/drag-scroll";
import { IPointerEvent } from "project-editor/flow/editor/mouse-handler";

import type { Widget } from "project-editor/flow/component";
import type { TimelineKeyframe } from "project-editor/flow/timeline";

import type { PageTabState } from "project-editor/features/page/PageEditor";

////////////////////////////////////////////////////////////////////////////////

const TIMELINE_X_OFFSET = 10;
const TIMELINE_HEIGHT = 40;
const ROW_HEIGHT = 20;
const POINT_RADIUS = 4;
const ROW_GAP = 3;
const NEEDLE_WIDTH = 4;
const VISIBILITY_TOLERANCE = 10;

////////////////////////////////////////////////////////////////////////////////

export class PageTimelineEditorState {
    isEditorActive: boolean = false;
    position: number = 0;
    duration: number;
    scrollLeft: number;
    scrollTop: number;
    secondToPx: number = 200;
    selectedKeyframes: TimelineKeyframe[] = [];
    rubberBendRect: Rect | undefined;
    horizontalScrollBarWidth: number;

    constructor(private tabState: PageTabState) {
        this.duration = 60.0;
        this.scrollLeft = 0;
        this.scrollTop = 0;

        makeObservable(this, {
            isEditorActive: observable,
            position: observable,
            duration: observable,
            scrollLeft: observable,
            scrollTop: observable,
            secondToPx: observable,
            selectedKeyframes: observable,
            rubberBendRect: observable,
            horizontalScrollBarWidth: observable,
            timelineHeight: computed,
            timelineWidth: computed
        });
    }

    loadState(state: Partial<PageTimelineEditorState>) {
        if (state.isEditorActive != undefined) {
            this.isEditorActive = state.isEditorActive;
        }

        if (state.position != undefined) {
            this.position = state.position;
        }

        if (state.secondToPx != undefined) {
            this.secondToPx = state.secondToPx;
        }

        if (state.scrollLeft != undefined) {
            this.scrollLeft = state.scrollLeft;
        }
    }

    saveState() {
        return {
            isEditorActive: this.isEditorActive,
            position: this.position,
            secondToPx: this.secondToPx,
            scrollLeft: this.scrollLeft
        };
    }

    get treeAdapter() {
        return new TreeAdapter(
            this.tabState.widgetContainer,
            undefined,
            (object: IEezObject) => {
                return object instanceof ProjectEditor.WidgetClass;
            },
            true
        );
    }

    static getTimelineWidth(duration: number, secondToPx: number) {
        return TIMELINE_X_OFFSET + duration * secondToPx + TIMELINE_X_OFFSET;
    }

    get timelineWidth() {
        return PageTimelineEditorState.getTimelineWidth(
            this.duration,
            this.secondToPx
        );
    }

    get timelineHeight() {
        return this.treeAdapter.allRows.length * ROW_HEIGHT;
    }

    get nextSecondToPx() {
        if (this.secondToPx < 2000) {
            return Math.round(this.secondToPx * 1.2);
        }
        return this.secondToPx;
    }

    get previousSecondToPx() {
        if (this.secondToPx > 50) {
            return Math.round(this.secondToPx / 1.2);
        }
        return this.secondToPx;
    }

    get positionPx() {
        return this.positionToPx(this.position);
    }

    positionToPx(position: number) {
        return TIMELINE_X_OFFSET + position * this.secondToPx;
    }

    pxToPosition(px: number) {
        return (px - TIMELINE_X_OFFSET) / this.secondToPx;
    }

    getKeyframeCircleBoundingRect(
        rowIndex: number,
        keyframe: TimelineKeyframe
    ) {
        const cx = this.positionToPx(keyframe.end);
        const cy = TIMELINE_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

        const x1 = cx - POINT_RADIUS / 2;
        const y1 = cy - POINT_RADIUS / 2;
        const x2 = x1 + POINT_RADIUS;
        const y2 = y1 + POINT_RADIUS;

        return { cx, cy, x1, y1, x2, y2 };
    }

    getRowIndexFromY(y: number) {
        let rowIndex = (y - TIMELINE_HEIGHT) / ROW_HEIGHT;
        if (rowIndex >= 0) {
            rowIndex = Math.floor(rowIndex);
            if (rowIndex < this.treeAdapter.allRows.length) {
                return rowIndex;
            }
        }
        return -1;
    }

    getRowRect(rowIndex: number): Rect {
        return {
            left: TIMELINE_X_OFFSET,
            top: TIMELINE_HEIGHT + rowIndex * ROW_HEIGHT + ROW_GAP / 2,
            width: this.duration * this.secondToPx,
            height: ROW_HEIGHT - ROW_GAP
        };
    }

    getKeyframeRect(rowIndex: number, keyframe: TimelineKeyframe) {
        return {
            left: this.positionToPx(keyframe.start),
            top: TIMELINE_HEIGHT + rowIndex * ROW_HEIGHT + ROW_GAP / 2,
            width: (keyframe.end - keyframe.start) * this.secondToPx,
            height: ROW_HEIGHT - ROW_GAP
        };
    }

    getKeyframeStartPosition(rowIndex: number, keyframe: TimelineKeyframe) {
        return this.positionToPx(keyframe.start);
    }

    getKeyFrameEndPosition(rowIndex: number, keyframe: TimelineKeyframe) {
        return this.positionToPx(keyframe.end);
    }

    isVerticalLineVisible(x: number) {
        if (x < this.scrollLeft - VISIBILITY_TOLERANCE) {
            return false;
        }
        if (
            x >
            this.scrollLeft +
                this.horizontalScrollBarWidth +
                VISIBILITY_TOLERANCE
        ) {
            return false;
        }
        return true;
    }

    getMinDelta(
        keyframes: TimelineKeyframe[],
        mode: "keyframe-start" | "keyframe-end" | "keyframe"
    ) {
        return Math.max(
            ...keyframes.map(keyframe => {
                const widgetTimeline = getParent(
                    keyframe
                ) as TimelineKeyframe[];

                let keyframeIndex = widgetTimeline.indexOf(keyframe);

                if (mode == "keyframe-end") {
                    return keyframe.start - keyframe.end;
                }

                for (
                    keyframeIndex = keyframeIndex - 1;
                    keyframeIndex >= 0;
                    keyframeIndex--
                ) {
                    const previousKeyframe = widgetTimeline[keyframeIndex];

                    if (keyframes.indexOf(previousKeyframe) == -1) {
                        return previousKeyframe.end - keyframe.start;
                    }

                    keyframe = previousKeyframe;
                }

                return 0 - keyframe.start;
            })
        );
    }

    getMaxDelta(
        keyframes: TimelineKeyframe[],
        mode: "keyframe-start" | "keyframe-end" | "keyframe"
    ) {
        return Math.min(
            ...keyframes.map(keyframe => {
                const widgetTimeline = getParent(
                    keyframe
                ) as TimelineKeyframe[];

                let keyframeIndex = widgetTimeline.indexOf(keyframe);

                if (mode == "keyframe-start") {
                    return keyframe.end - keyframe.start;
                }

                for (
                    keyframeIndex = keyframeIndex + 1;
                    keyframeIndex < widgetTimeline.length;
                    keyframeIndex++
                ) {
                    const nextKeyframe = widgetTimeline[keyframeIndex];

                    if (keyframes.indexOf(nextKeyframe) == -1) {
                        return nextKeyframe.start - keyframe.end;
                    }

                    keyframe = nextKeyframe;
                }

                return this.duration - keyframe.end;
            })
        );
    }

    get step() {
        return this.secondToPx > 600 ? 0.01 : 0.1;
    }
}

////////////////////////////////////////////////////////////////////////////////

export const PageTimelineEditor = observer(
    class PageTimelineEditor
        extends React.Component<{
            tabState: PageTabState;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        verticalScrollBarRef = React.createRef<HTMLDivElement>();
        horizontalScrollBarRef = React.createRef<HTMLDivElement>();

        resizeObserver: ResizeObserver;

        constructor(props: any) {
            super(props);
            this.resizeObserver = new ResizeObserver(
                this.resizeObserverCallback
            );
        }

        resizeObserverCallback = () => {
            if (this.horizontalScrollBarRef.current) {
                let rect =
                    this.horizontalScrollBarRef.current.getBoundingClientRect();
                runInAction(() => {
                    this.props.tabState.timeline.horizontalScrollBarWidth =
                        rect.width;
                });
            }
        };

        componentDidMount() {
            if (this.horizontalScrollBarRef.current) {
                this.resizeObserver.observe(
                    this.horizontalScrollBarRef.current
                );
            }

            this.updateHorizontalScoll();

            this.context.navigationStore.mountPanel(this);
        }

        componentWillUnmount() {
            if (this.horizontalScrollBarRef.current) {
                this.resizeObserver.unobserve(
                    this.horizontalScrollBarRef.current
                );
            }

            this.context.navigationStore.unmountPanel(this);
        }

        onVerticalScroll = action(() => {
            if (this.verticalScrollBarRef.current) {
                this.props.tabState.timeline.scrollTop =
                    this.verticalScrollBarRef.current.scrollTop;
            }
        });

        onHorizontalScroll = action(() => {
            if (this.horizontalScrollBarRef.current) {
                this.props.tabState.timeline.scrollLeft =
                    this.horizontalScrollBarRef.current.scrollLeft;
            }
        });

        updateHorizontalScoll = () => {
            if (this.horizontalScrollBarRef.current) {
                this.horizontalScrollBarRef.current.scrollLeft =
                    this.props.tabState.timeline.scrollLeft;
            }
        };

        // interface IPanel implementation
        get selectedObject() {
            return this.props.tabState.selectedObject;
        }
        get selectedObjects() {
            return this.props.tabState.selectedObjects;
        }
        deleteSelection() {
            if (this.props.tabState.timeline.selectedKeyframes.length > 0) {
                this.context.deleteObjects(
                    this.props.tabState.timeline.selectedKeyframes
                );
                runInAction(() => {
                    this.props.tabState.timeline.selectedKeyframes = [];
                    this.props.tabState.selectObjects([]);
                });
            }
        }
        onFocus = () => {
            const navigationStore = this.context.navigationStore;
            navigationStore.setSelectedPanel(this);
        };

        render() {
            return (
                <div
                    className="EezStudio_PageTimelineSplitter"
                    onFocus={this.onFocus}
                    tabIndex={0}
                >
                    <TimelineEditor
                        tabState={this.props.tabState}
                        timelineState={this.props.tabState.timeline}
                        updateHorizontalScoll={this.updateHorizontalScoll}
                    />
                    <div
                        ref={this.verticalScrollBarRef}
                        className="EezStudio_PageTimeline_ScrollBar EezStudio_PageTimeline_VerticalScrollBar"
                        onScroll={this.onVerticalScroll}
                    >
                        <div
                            style={{
                                height: this.props.tabState.timeline
                                    .timelineHeight
                            }}
                        ></div>
                    </div>
                    <div
                        ref={this.horizontalScrollBarRef}
                        className="EezStudio_PageTimeline_ScrollBar EezStudio_PageTimeline_HorizontalScrollBar"
                        onScroll={this.onHorizontalScroll}
                    >
                        <div
                            style={{
                                width: this.props.tabState.timeline
                                    .timelineWidth
                            }}
                        ></div>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

type DragSettings =
    | {
          mode: "none";
          cursor: string;
      }
    | {
          mode: "timeline-position";
          cursor: string;
          startPoint: Point;
      }
    | {
          mode: "rubber-band";
          cursor: string;
          startPoint: Point;
      }
    | {
          mode: "keyframe";
          cursor: string;
          dragStartPosition: number;
          keyframe: TimelineKeyframe;
          keyframeEnd: number;
          ends: number[];
          minDelta: number;
          maxDelta: number;
      }
    | {
          mode: "keyframe-start";
          cursor: string;
          dragStartPosition: number;
          keyframe: TimelineKeyframe;
          keyframeStart: number;
          starts: number[];
          minDelta: number;
          maxDelta: number;
      }
    | {
          mode: "keyframe-end";
          cursor: string;
          dragStartPosition: number;
          keyframe: TimelineKeyframe;
          keyframeEnd: number;
          ends: number[];
          minDelta: number;
          maxDelta: number;
      }
    | {
          mode: "row";
          cursor: string;
          widget: Widget;
      };

const TimelineEditor = observer(
    class TimelineEditor extends React.Component<{
        tabState: PageTabState;
        timelineState: PageTimelineEditorState;
        updateHorizontalScoll: () => void;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        svgRef = React.createRef<SVGSVGElement>();
        draggable = new Draggable(this);

        lastPointerEvent: IPointerEvent | undefined;

        dragSettings: DragSettings = {
            mode: "none",
            cursor: "default"
        };

        dragScrollDispose: (() => void) | undefined;

        deltaY = 0;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                ticks: computed,
                subticks: computed
            });
        }

        componentDidMount() {
            this.draggable.attach(this.svgRef.current);

            this.svgRef.current!.addEventListener(
                "wheel",
                this.onDraggableWheel,
                {
                    passive: false
                }
            );
        }

        componentWillUnmount() {
            this.draggable.attach(null);

            this.svgRef.current!.removeEventListener(
                "wheel",
                this.onDraggableWheel
            );
        }

        snapToTicks(position: number) {
            // snap to subticks
            let minDiff = this.props.timelineState.duration;
            let snapPosition = position;
            for (let subtick of this.subticks) {
                const diff = Math.abs(subtick - position);
                if (diff < minDiff) {
                    minDiff = diff;
                    snapPosition = subtick;
                }
            }

            return snapPosition;
        }

        setTimelinePosition(x: number) {
            let position =
                (this.props.timelineState.scrollLeft + x - TIMELINE_X_OFFSET) /
                this.props.timelineState.secondToPx;
            if (position < 0) {
                position = 0;
            }
            if (position > this.props.timelineState.duration) {
                position = this.props.timelineState.duration;
            }

            let snapPosition = this.snapToTicks(position);

            runInAction(() => {
                this.props.timelineState.position = snapPosition;
            });
        }

        limitScrollLeft(scrollLeft: number) {
            if (scrollLeft < 0) {
                scrollLeft = 0;
            } else {
                const horizontalScrollBarWidth =
                    this.props.timelineState.horizontalScrollBarWidth;

                const timelineWidth = this.props.timelineState.timelineWidth;

                const maxScrollLeft = Math.max(
                    timelineWidth - horizontalScrollBarWidth,
                    0
                );

                if (scrollLeft > maxScrollLeft) {
                    scrollLeft = maxScrollLeft;
                }
            }
            return scrollLeft;
        }

        onDragStart = (e: PointerEvent, x1: number, y1: number) => {
            this.lastPointerEvent = {
                clientX: e.clientX,
                clientY: e.clientY,
                movementX: e.movementX ?? 0,
                movementY: e.movementY ?? 0,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                timeStamp: e.timeStamp
            };

            const dragSettings = hitTest(this.props.timelineState, e, x1, y1);

            if (dragSettings.mode == "timeline-position") {
                // runInAction(() => {
                //     this.props.timelineState.selectedKeyframes = [];
                // });
                // this.props.tabState.selectObjects([]);

                this.setTimelinePosition(dragSettings.startPoint.x);
            }
            if (
                dragSettings.mode == "keyframe" ||
                dragSettings.mode == "keyframe-start" ||
                dragSettings.mode == "keyframe-end"
            ) {
                runInAction(() => {
                    if (e.ctrlKey || e.shiftKey) {
                        const i =
                            this.props.timelineState.selectedKeyframes.indexOf(
                                dragSettings.keyframe
                            );
                        if (i == -1) {
                            this.props.timelineState.selectedKeyframes.push(
                                dragSettings.keyframe
                            );

                            this.props.timelineState.position =
                                dragSettings.keyframe.end;
                        } else {
                            this.props.timelineState.selectedKeyframes.splice(
                                i,
                                1
                            );
                            if (
                                this.props.timelineState.selectedKeyframes
                                    .length > 0
                            ) {
                                this.props.timelineState.position =
                                    this.props.timelineState.selectedKeyframes[
                                        this.props.timelineState
                                            .selectedKeyframes.length - 1
                                    ].end;
                            }
                        }
                    } else {
                        if (
                            this.props.timelineState.selectedKeyframes.indexOf(
                                dragSettings.keyframe
                            ) == -1
                        ) {
                            this.props.timelineState.selectedKeyframes = [
                                dragSettings.keyframe
                            ];

                            this.props.timelineState.position =
                                dragSettings.keyframe.end;
                        }
                    }

                    this.props.tabState.selectObjects(
                        this.props.tabState.timeline.selectedKeyframes.map(
                            keyframe =>
                                getAncestorOfType(
                                    keyframe,
                                    ProjectEditor.WidgetClass.classInfo
                                )!
                        )
                    );
                });

                if (dragSettings.mode == "keyframe-start") {
                    dragSettings.starts =
                        this.props.timelineState.selectedKeyframes.map(
                            keyframe => keyframe.start
                        );
                } else {
                    dragSettings.ends =
                        this.props.timelineState.selectedKeyframes.map(
                            keyframe => keyframe.end
                        );
                }

                dragSettings.minDelta = this.props.timelineState.getMinDelta(
                    this.props.timelineState.selectedKeyframes,
                    dragSettings.mode
                );

                dragSettings.maxDelta = this.props.timelineState.getMaxDelta(
                    this.props.timelineState.selectedKeyframes,
                    dragSettings.mode
                );
            } else if (dragSettings.mode == "rubber-band") {
                runInAction(() => {
                    this.props.timelineState.selectedKeyframes = [];
                    this.props.timelineState.rubberBendRect = {
                        left: dragSettings.startPoint.x,
                        top: dragSettings.startPoint.y,
                        width: 0,
                        height: 0
                    };
                });

                this.props.tabState.selectObjects([]);
            } else if (dragSettings.mode == "row") {
                runInAction(() => {
                    this.props.timelineState.selectedKeyframes = [];
                });
                this.props.tabState.selectObjects([dragSettings.widget]);
            }

            this.dragSettings = dragSettings;

            if (this.svgRef.current) {
                if (dragSettings.cursor == "grab") {
                    this.svgRef.current.style.cursor = "grabbing";
                }
            }

            if (this.dragScrollDispose) {
                this.dragScrollDispose();
                this.dragScrollDispose = undefined;
            }

            this.dragScrollDispose = setupDragScroll(
                this.svgRef.current!,
                () => this.lastPointerEvent,
                (point: Point) => {
                    let scrollLeft =
                        this.props.timelineState.scrollLeft - point.x;

                    scrollLeft = this.limitScrollLeft(scrollLeft);

                    runInAction(() => {
                        this.props.timelineState.scrollLeft = scrollLeft;
                    });

                    this.props.updateHorizontalScoll();
                }
            );
        };

        onDragMove = (e: PointerEvent, x: number, y: number, params: any) => {
            this.lastPointerEvent = {
                clientX: e.clientX,
                clientY: e.clientY,
                movementX: e.movementX ?? 0,
                movementY: e.movementY ?? 0,
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                timeStamp: e.timeStamp
            };

            const rectSvg = this.svgRef.current!.getBoundingClientRect();
            const dragPosition = this.props.timelineState.pxToPosition(
                e.clientX - rectSvg.x + this.props.timelineState.scrollLeft
            );

            const dragSettings = this.dragSettings;

            if (dragSettings.mode == "timeline-position") {
                this.setTimelinePosition(x + dragSettings.startPoint.x);
            } else if (dragSettings.mode == "rubber-band") {
                runInAction(() => {
                    let left;
                    let width;
                    if (x > 0) {
                        left = dragSettings.startPoint.x;
                        width = x;
                    } else {
                        left = dragSettings.startPoint.x + x;
                        width = -x;
                    }

                    let top;
                    let height;
                    if (y > 0) {
                        top = dragSettings.startPoint.y;
                        height = y;
                    } else {
                        top = dragSettings.startPoint.y + y;
                        height = -y;
                    }

                    const rubberBendRect =
                        this.props.timelineState.rubberBendRect!;

                    rubberBendRect.left = left;
                    rubberBendRect.top = top;
                    rubberBendRect.width = width;
                    rubberBendRect.height = height;
                });
            } else if (dragSettings.mode == "keyframe") {
                let delta =
                    this.snapToTicks(
                        dragPosition -
                            dragSettings.dragStartPosition +
                            dragSettings.keyframeEnd
                    ) - dragSettings.keyframeEnd;

                delta = Math.min(delta, dragSettings.maxDelta);
                delta = Math.max(delta, dragSettings.minDelta);

                const newEnds = this.props.timelineState.selectedKeyframes.map(
                    (keyframe, selectedKeyframeIndex) => {
                        const end = dragSettings.ends[selectedKeyframeIndex];
                        const newEnd = end + delta;
                        return roundPosition(newEnd);
                    }
                );

                const newStarts =
                    this.props.timelineState.selectedKeyframes.map(
                        (keyframe, selectedKeyframeIndex) => {
                            const newEnd = newEnds[selectedKeyframeIndex];
                            const duration = keyframe.end - keyframe.start;
                            return roundPosition(newEnd - duration);
                        }
                    );

                if (!this.context.undoManager.combineCommands) {
                    this.context.undoManager.setCombineCommands(true);
                }

                this.props.timelineState.selectedKeyframes.forEach(
                    (keyframe, selectedKeyframeIndex) => {
                        this.context.updateObject(keyframe, {
                            start: newStarts[selectedKeyframeIndex],
                            end: newEnds[selectedKeyframeIndex]
                        });

                        if (keyframe == dragSettings.keyframe) {
                            runInAction(() => {
                                this.props.timelineState.position =
                                    newEnds[selectedKeyframeIndex];
                            });
                        }
                    }
                );
            } else if (dragSettings.mode == "keyframe-start") {
                let delta =
                    this.snapToTicks(
                        dragPosition -
                            dragSettings.dragStartPosition +
                            dragSettings.keyframeStart
                    ) - dragSettings.keyframeStart;

                delta = Math.min(delta, dragSettings.maxDelta);
                delta = Math.max(delta, dragSettings.minDelta);

                const newStarts =
                    this.props.timelineState.selectedKeyframes.map(
                        (keyframe, selectedKeyframeIndex) => {
                            const start =
                                dragSettings.starts[selectedKeyframeIndex];
                            const newStart = start + delta;
                            return roundPosition(newStart);
                        }
                    );

                if (!this.context.undoManager.combineCommands) {
                    this.context.undoManager.setCombineCommands(true);
                }

                this.props.timelineState.selectedKeyframes.forEach(
                    (keyframe, selectedKeyframeIndex) => {
                        this.context.updateObject(keyframe, {
                            start: newStarts[selectedKeyframeIndex]
                        });
                    }
                );
            } else if (dragSettings.mode == "keyframe-end") {
                let delta =
                    this.snapToTicks(
                        dragPosition -
                            dragSettings.dragStartPosition +
                            dragSettings.keyframeEnd
                    ) - dragSettings.keyframeEnd;

                delta = Math.min(delta, dragSettings.maxDelta);
                delta = Math.max(delta, dragSettings.minDelta);

                const newEnds = this.props.timelineState.selectedKeyframes.map(
                    (keyframe, selectedKeyframeIndex) => {
                        const end = dragSettings.ends[selectedKeyframeIndex];
                        const newEnd = end + delta;
                        return roundPosition(newEnd);
                    }
                );

                if (!this.context.undoManager.combineCommands) {
                    this.context.undoManager.setCombineCommands(true);
                }

                this.props.timelineState.selectedKeyframes.forEach(
                    (keyframe, selectedKeyframeIndex) => {
                        this.context.updateObject(keyframe, {
                            end: newEnds[selectedKeyframeIndex]
                        });

                        if (keyframe == dragSettings.keyframe) {
                            runInAction(() => {
                                this.props.timelineState.position =
                                    newEnds[selectedKeyframeIndex];
                            });
                        }
                    }
                );
            }
        };

        onMove = (e: PointerEvent) => {
            const hitTestResult = hitTest(
                this.props.timelineState,
                e,
                e.clientX,
                e.clientY
            );

            if (this.svgRef.current) {
                this.svgRef.current.style.cursor = hitTestResult.cursor;
            }
        };

        onDragEnd = (
            e: PointerEvent | undefined,
            cancel: boolean,
            params: any
        ) => {
            const dragSettings = this.dragSettings;

            if (dragSettings.mode == "rubber-band") {
                const selectedKeyframes: TimelineKeyframe[] = [];

                const timelineState = this.props.timelineState;

                const rubberBendRect = rectClone(timelineState.rubberBendRect!);

                rubberBendRect.left += timelineState.scrollLeft;
                rubberBendRect.top += timelineState.scrollTop;

                timelineState.treeAdapter.allRows.forEach((row, rowIndex) => {
                    const widget = timelineState.treeAdapter.getItemObject(
                        row.item
                    ) as Widget;

                    if (widget.locked || widget.hiddenInEditor) {
                        return;
                    }

                    widget.timeline.forEach(keyframe => {
                        const { x1, y1, x2, y2 } =
                            timelineState.getKeyframeCircleBoundingRect(
                                rowIndex,
                                keyframe
                            );

                        const keyframeRect: Rect = {
                            left: x1,
                            top: y1,
                            width: x2 - x1,
                            height: y2 - y1
                        };

                        if (isRectInsideRect(keyframeRect, rubberBendRect)) {
                            selectedKeyframes.push(keyframe);
                        }
                    });
                });

                runInAction(() => {
                    if (selectedKeyframes.length > 0) {
                        this.props.timelineState.position = Math.max(
                            ...selectedKeyframes.map(keyframe => keyframe.end)
                        );
                    }

                    this.props.timelineState.selectedKeyframes =
                        selectedKeyframes;
                    this.props.timelineState.rubberBendRect = undefined;
                });

                this.props.tabState.selectObjects(
                    this.props.tabState.timeline.selectedKeyframes.map(
                        keyframe =>
                            getAncestorOfType(
                                keyframe,
                                ProjectEditor.WidgetClass.classInfo
                            )!
                    )
                );
            }

            if (this.svgRef.current) {
                this.svgRef.current.style.cursor = dragSettings.cursor;
            }

            this.dragSettings = { mode: "none", cursor: "default" };

            if (this.context.undoManager.combineCommands) {
                this.context.undoManager.setCombineCommands(false);
            }

            if (this.dragScrollDispose) {
                this.dragScrollDispose();
                this.dragScrollDispose = undefined;
            }
        };

        onDraggableWheel = (event: WheelEvent) => {
            if (event.buttons === 4) {
                // do nothing if mouse wheel is pressed, i.e. pan will be activated in onMouseDown
                return;
            }

            if (event.ctrlKey) {
                this.deltaY += event.deltaY;
                if (Math.abs(this.deltaY) > 10) {
                    let secondToPx: number;

                    if (this.deltaY < 0) {
                        secondToPx = this.props.timelineState.nextSecondToPx;
                    } else {
                        secondToPx =
                            this.props.timelineState.previousSecondToPx;
                    }

                    this.deltaY = 0;

                    const rect = this.svgRef.current!.getBoundingClientRect();

                    let scrollLeft =
                        ((this.props.timelineState.scrollLeft +
                            event.clientX -
                            rect.x) *
                            secondToPx) /
                            this.props.timelineState.secondToPx -
                        (event.clientX - rect.x);

                    scrollLeft = this.limitScrollLeft(scrollLeft);

                    runInAction(() => {
                        this.props.timelineState.scrollLeft = scrollLeft;
                        this.props.timelineState.secondToPx = secondToPx;
                    });

                    this.props.updateHorizontalScoll();
                }
            } else {
                let scrollLeft =
                    this.props.timelineState.scrollLeft + event.deltaY;
                scrollLeft = this.limitScrollLeft(scrollLeft);
                runInAction(() => {
                    this.props.timelineState.scrollLeft = scrollLeft;
                });
                this.props.updateHorizontalScoll();
            }
        };

        genTicks(delta: number) {
            const ticks = [];
            for (
                let i = 0;
                i <= Math.floor(this.props.timelineState.duration / delta);
                i++
            ) {
                ticks.push(roundPosition(i * delta));
            }
            return ticks;
        }

        get ticks() {
            if (this.props.timelineState.step == 0.01) {
                return this.genTicks(0.1);
            }
            return this.genTicks(1);
        }

        get subticks() {
            if (this.props.timelineState.step == 0.01) {
                return this.genTicks(0.01);
            }
            return this.genTicks(0.1);
        }

        render() {
            const { timelineState } = this.props;

            return (
                <svg
                    ref={this.svgRef}
                    className="EezStudio_PageTimeline_Timeline"
                >
                    <Rows timelineState={timelineState} />

                    <Timeline
                        timelineState={timelineState}
                        ticks={this.ticks}
                        subticks={this.subticks}
                    />

                    {timelineState.rubberBendRect && (
                        <rect
                            className="EezStudio_PageTimeline_RubberBendRect"
                            x={timelineState.rubberBendRect.left}
                            y={timelineState.rubberBendRect.top}
                            width={timelineState.rubberBendRect.width}
                            height={timelineState.rubberBendRect.height}
                            fill={addAlphaToColor(
                                theme().selectionBackgroundColor,
                                0.5
                            )}
                            stroke={theme().selectionBackgroundColor}
                        />
                    )}
                </svg>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Timeline = observer(
    ({
        timelineState,
        ticks,
        subticks
    }: {
        timelineState: PageTimelineEditorState;
        ticks: number[];
        subticks: number[];
    }) => {
        return (
            <g
                transform={`translate(${-timelineState.scrollLeft}, 0)`}
                style={{ shapeRendering: "crispEdges" }}
            >
                <rect
                    className="EezStudio_PageTimeline_Timeline_Area"
                    x={0}
                    y={0}
                    width={
                        TIMELINE_X_OFFSET +
                        timelineState.duration * timelineState.secondToPx
                    }
                    height={TIMELINE_HEIGHT}
                />

                {subticks
                    .filter(x =>
                        timelineState.isVerticalLineVisible(
                            timelineState.positionToPx(x)
                        )
                    )
                    .map(x => (
                        <g key={x}>
                            <line
                                className="EezStudio_PageTimeline_Subtick"
                                x1={timelineState.positionToPx(x)}
                                y1={(3 * TIMELINE_HEIGHT) / 4}
                                x2={timelineState.positionToPx(x)}
                                y2={TIMELINE_HEIGHT}
                            />
                        </g>
                    ))}

                {ticks
                    .filter(x =>
                        timelineState.isVerticalLineVisible(
                            timelineState.positionToPx(x)
                        )
                    )
                    .map(x => (
                        <g key={x}>
                            <line
                                className="EezStudio_PageTimeline_Tick"
                                x1={timelineState.positionToPx(x)}
                                y1={TIMELINE_HEIGHT / 2}
                                x2={timelineState.positionToPx(x)}
                                y2={TIMELINE_HEIGHT}
                            />
                            {Math.abs(x - timelineState.position) > 1e-4 && (
                                <text
                                    className="EezStudio_PageTimeline_TickText"
                                    x={timelineState.positionToPx(x)}
                                    y={0}
                                    textAnchor="middle"
                                    alignmentBaseline="hanging"
                                >
                                    {x}
                                </text>
                            )}
                        </g>
                    ))}

                <rect
                    className="EezStudio_PageTimeline_Needle"
                    x={timelineState.positionPx - NEEDLE_WIDTH / 2}
                    y={0}
                    width={NEEDLE_WIDTH}
                    height={TIMELINE_HEIGHT / 2}
                />

                <line
                    className="EezStudio_PageTimeline_Needle"
                    x1={timelineState.positionPx}
                    y1={0}
                    x2={timelineState.positionPx}
                    y2={TIMELINE_HEIGHT}
                />

                <line
                    className="EezStudio_PageTimeline_Needle"
                    x1={timelineState.positionPx}
                    y1={TIMELINE_HEIGHT}
                    x2={timelineState.positionPx}
                    y2={
                        TIMELINE_HEIGHT +
                        timelineState.treeAdapter.allRows.length * ROW_HEIGHT
                    }
                />

                <SvgLabel
                    text={timelineState.position + " s"}
                    textClassName="EezStudio_PageTimeline_Needle"
                    rectClassName="EezStudio_PageTimeline_Needle_TextBackground"
                    x={timelineState.positionPx + 4}
                    y={-3}
                    horizontalAlignment="left"
                    verticalAlignment="top"
                    border={{
                        size: 0,
                        radius: 0
                    }}
                    padding={{
                        left: 4,
                        top: 0,
                        right: 4,
                        bottom: 0
                    }}
                />
            </g>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const Rows = observer(
    ({ timelineState }: { timelineState: PageTimelineEditorState }) => {
        return (
            <g
                transform={`translate(${-timelineState.scrollLeft}, ${-timelineState.scrollTop})`}
            >
                {timelineState.treeAdapter.allRows.map((row, rowIndex) => (
                    <Row
                        key={rowIndex}
                        timelineState={timelineState}
                        row={row}
                        rowIndex={rowIndex}
                    />
                ))}

                {timelineState.treeAdapter.allRows.map((row, rowIndex) => {
                    const widget = timelineState.treeAdapter.getItemObject(
                        row.item
                    ) as Widget;

                    return (
                        <g
                            key={timelineState.treeAdapter.getItemId(row.item)}
                            style={{
                                opacity:
                                    widget.hiddenInEditor || widget.locked
                                        ? 0.1
                                        : 1.0
                            }}
                        >
                            {widget.timeline.map(keyframe => {
                                const { cx, cy, x1, y1, x2, y2 } =
                                    timelineState.getKeyframeCircleBoundingRect(
                                        rowIndex,
                                        keyframe
                                    );

                                return (
                                    <g key={getId(keyframe)}>
                                        <circle
                                            className="EezStudio_PageTimeline_Keyframe_Point"
                                            cx={cx}
                                            cy={cy}
                                            r={POINT_RADIUS}
                                        ></circle>

                                        {timelineState.selectedKeyframes.indexOf(
                                            keyframe
                                        ) != -1 &&
                                            keyframe.start == keyframe.end && (
                                                <rect
                                                    className="EezStudio_PageTimeline_Keyframe_Selection"
                                                    x={x1 - 2}
                                                    y={y1 - 2}
                                                    width={x2 - x1 + 4}
                                                    height={y2 - y1 + 4}
                                                ></rect>
                                            )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
            </g>
        );
    }
);

const Row = observer(
    ({
        timelineState,
        row,
        rowIndex
    }: {
        timelineState: PageTimelineEditorState;
        row: ITreeRow;
        rowIndex: number;
    }) => {
        const widget = timelineState.treeAdapter.getItemObject(
            row.item
        ) as Widget;

        const rowRect = timelineState.getRowRect(rowIndex);

        return (
            <g
                key={timelineState.treeAdapter.getItemId(row.item)}
                style={{
                    opacity: widget.hiddenInEditor || widget.locked ? 0.1 : 1.0
                }}
            >
                <rect
                    className={classNames("EezStudio_PageTimeline_Row", {
                        selected: timelineState.treeAdapter.isSelected(row.item)
                    })}
                    x={rowRect.left}
                    y={rowRect.top}
                    width={rowRect.width}
                    height={rowRect.height}
                    style={{ shapeRendering: "crispEdges" }}
                ></rect>

                {widget.timeline
                    .filter(keyframe => keyframe.start < keyframe.end)
                    .map(keyframe => (
                        <Keyframe
                            key={getId(keyframe)}
                            timelineState={timelineState}
                            rowIndex={rowIndex}
                            keyframe={keyframe}
                        />
                    ))}
            </g>
        );
    }
);

const Keyframe = observer(
    ({
        timelineState,
        rowIndex,
        keyframe
    }: {
        timelineState: PageTimelineEditorState;
        rowIndex: number;
        keyframe: TimelineKeyframe;
    }) => {
        const keyframeRect = timelineState.getKeyframeRect(rowIndex, keyframe);

        const x1 = keyframeRect.left;
        const x2 = keyframeRect.left + keyframeRect.width;
        const y1 = keyframeRect.top;
        const y2 = keyframeRect.top + keyframeRect.height;

        const KEYFRAME_MAX_OFFSET = 8;

        const offset = Math.min(x2 - x1, KEYFRAME_MAX_OFFSET);

        const path =
            `M${x1},${(y1 + y2) / 2} ` +
            `L${x1 + offset},${y1} ` +
            `L${x2},${y1} ` +
            `L${x2},${y2} ` +
            `L${x1 + offset},${y2} ` +
            `L${x1},${(y1 + y2) / 2}`;

        // const path =
        //     `M${x1},${y2} ` +
        //     `L${x2},${y1} ` +
        //     `L${x2},${y2} ` +
        //     `L${x1},${y2}`;

        return (
            <g>
                <path
                    className="EezStudio_PageTimeline_Keyframe"
                    d={path}
                ></path>
                {timelineState.selectedKeyframes.indexOf(keyframe) != -1 && (
                    <rect
                        className="EezStudio_PageTimeline_Keyframe_Selection"
                        x={x1 - 1}
                        y={y1 - 1}
                        width={x2 - x1 + 2}
                        height={y2 - y1 + 2}
                    ></rect>
                )}
            </g>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

function hitTest(
    timelineState: PageTimelineEditorState,
    e: PointerEvent,
    x: number,
    y: number
): DragSettings {
    const svg: SVGSVGElement = closestBySelector(e.target, "svg");
    if (!svg) {
        return {
            mode: "none",
            cursor: "default"
        };
    }

    const rectSvg = svg.getBoundingClientRect();

    x -= rectSvg.x;
    y -= rectSvg.y;

    const startPoint = {
        x,
        y
    };

    if (y < TIMELINE_HEIGHT) {
        x += timelineState.scrollLeft;

        return {
            mode: "timeline-position",
            startPoint,
            cursor:
                Math.abs(timelineState.positionPx - x) < 8
                    ? "ew-resize"
                    : "default"
        };
    }

    x += timelineState.scrollLeft;
    y += timelineState.scrollTop;

    const point = { x, y };

    const dragStartPosition = timelineState.pxToPosition(x);

    let rowIndex = timelineState.getRowIndexFromY(y);

    if (rowIndex != -1) {
        const widget = timelineState.treeAdapter.getItemObject(
            timelineState.treeAdapter.allRows[rowIndex].item
        ) as Widget;

        if (!widget.locked && !widget.hiddenInEditor) {
            for (
                let keyframeIndex = 0;
                keyframeIndex < widget.timeline.length;
                keyframeIndex++
            ) {
                const keyframe = widget.timeline[keyframeIndex];

                if (timelineState.selectedKeyframes.indexOf(keyframe) != -1) {
                    const hitTestResult = rowHitTest(
                        point,
                        rowIndex,
                        keyframe,
                        timelineState,
                        dragStartPosition
                    );
                    if (hitTestResult) {
                        return hitTestResult;
                    }
                }
            }

            for (
                let keyframeIndex = 0;
                keyframeIndex < widget.timeline.length;
                keyframeIndex++
            ) {
                const keyframe = widget.timeline[keyframeIndex];

                if (timelineState.selectedKeyframes.indexOf(keyframe) == -1) {
                    const hitTestResult = rowHitTest(
                        point,
                        rowIndex,
                        keyframe,
                        timelineState,
                        dragStartPosition
                    );
                    if (hitTestResult) {
                        return hitTestResult;
                    }
                }
            }

            return {
                mode: "row",
                cursor: "default",
                widget
            };
        }
    }

    return {
        mode: "rubber-band",
        cursor: "default",
        startPoint
    };
}

function rowHitTest(
    point: Point,
    rowIndex: number,
    keyframe: TimelineKeyframe,
    timelineState: PageTimelineEditorState,
    dragStartPosition: number
): DragSettings | undefined {
    const rect1 = timelineState.getKeyframeRect(rowIndex, keyframe);

    const rect2 = timelineState.getKeyframeCircleBoundingRect(
        rowIndex,
        keyframe
    );

    if (
        pointInRect(point, rect1) ||
        pointInRect(point, {
            left: rect2.x1,
            top: rect2.y1,
            width: rect2.x2 - rect2.x1,
            height: rect2.y2 - rect2.y1
        })
    ) {
        return {
            mode: "keyframe",
            cursor: "grab",
            dragStartPosition,
            keyframe,
            keyframeEnd: keyframe.end,
            ends: [],
            minDelta: 0,
            maxDelta: 0
        };
    }

    const D = 20;

    if (
        pointInRect(point, {
            left: rect1.left - D,
            top: rect1.top,
            width: D,
            height: rect1.height
        }) ||
        pointInRect(point, {
            left: rect2.x1 - D,
            top: rect2.y1,
            width: D,
            height: rect2.y2 - rect2.y1
        })
    ) {
        return {
            mode: "keyframe-start",
            cursor: "ew-resize",
            dragStartPosition,
            keyframe,
            keyframeStart: keyframe.start,
            starts: [],
            minDelta: 0,
            maxDelta: 0
        };
    }

    if (
        pointInRect(point, {
            left: rect1.left + rect1.width,
            top: rect1.top,
            width: D,
            height: rect1.height
        }) ||
        pointInRect(point, {
            left: rect2.x2,
            top: rect2.y1,
            width: D,
            height: rect2.y2 - rect2.y1
        })
    ) {
        return {
            mode: "keyframe-end",
            cursor: "ew-resize",
            dragStartPosition,
            keyframe,
            keyframeEnd: keyframe.end,
            ends: [],
            minDelta: 0,
            maxDelta: 0
        };
    }

    return undefined;
}

function roundPosition(position: number) {
    return Math.round(position * 100) / 100;
}

import React from "react";
import {
    makeObservable,
    action,
    computed,
    observable,
    autorun,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import { Splitter } from "eez-studio-ui/splitter";

import { ProjectEditor } from "project-editor/project-editor-interface";

import { getId, IEezObject } from "project-editor/core/object";
import {
    TreeAdapter,
    ITreeAdapter,
    TreeObjectAdapter,
    TreeObjectAdapterChildren,
    ITreeRow
} from "project-editor/core/objectAdapter";

import type { PageTabState } from "project-editor/features/page/PageEditor";
import { createTransformer } from "mobx-utils";
import type { Widget, TimelineKeyframe } from "project-editor/flow/component";
import { Draggable } from "eez-studio-ui/draggable";
import { closestBySelector } from "eez-studio-shared/dom";
import {
    getObjectFromStringPath,
    getObjectPathAsString,
    IPanel
} from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { isRectInsideRect, Rect } from "eez-studio-shared/geometry";
import { addAlphaToColor } from "eez-studio-shared/color";
import { theme } from "eez-studio-ui/theme";
import { SvgLabel } from "eez-studio-ui/svg-label";

////////////////////////////////////////////////////////////////////////////////

const OUTLINE_LEVEL_MARGIN = 20;

const TIMELINE_X_OFFSET = 10;
const TIMELINE_HEIGHT = 40;
const ROW_HEIGHT = 20;
const POINT_RADIUS = 4;
const ROW_GAP = 3;
const NEEDLE_WIDTH = 4;

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

    constructor(private tabState: PageTabState) {
        this.duration = 10.0;
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
    }

    saveState() {
        return {
            isEditorActive: this.isEditorActive,
            position: this.position,
            secondToPx: this.secondToPx
        };
    }

    get treeAdapter(): ITreeAdapter {
        return new TreeAdapter(new PageTreeObjectAdapter(this.tabState));
    }

    get timelineWidth() {
        return this.duration * this.secondToPx;
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
}

class PageTreeObjectAdapter extends TreeObjectAdapter {
    constructor(private tabState: PageTabState) {
        super(
            tabState.page,
            createTransformer((object: IEezObject) => {
                return new TreeObjectAdapter(object, this.transformer, true);
            }),
            true
        );
    }

    get children(): TreeObjectAdapterChildren {
        return this.tabState.page.components
            .filter(component => component instanceof ProjectEditor.WidgetClass)
            .map(child => this.transformer(child));
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

        // interface IPanel implementation
        get selectedObject() {
            return this.props.tabState.timeline.selectedKeyframes.length > 0
                ? this.props.tabState.timeline.selectedKeyframes[0]
                : undefined;
        }
        get selectedObjects() {
            return this.props.tabState.timeline.selectedKeyframes;
        }
        cutSelection() {}
        copySelection() {}
        pasteSelection() {}
        deleteSelection() {
            if (this.props.tabState.timeline.selectedKeyframes.length > 0) {
                this.context.deleteObjects(
                    this.props.tabState.timeline.selectedKeyframes
                );
                runInAction(() => {
                    this.props.tabState.timeline.selectedKeyframes = [];
                });
            }
        }
        onFocus = () => {
            const navigationStore = this.context.navigationStore;
            navigationStore.setSelectedPanel(this);
        };

        render() {
            return (
                <Splitter
                    type="horizontal"
                    sizes="25%|75%"
                    persistId="project-editor/page/timeline-splitter"
                    className="EezStudio_PageTimelineSplitter"
                    splitterSize={5}
                    onFocus={this.onFocus}
                    tabIndex={0}
                >
                    <Outline timelineState={this.props.tabState.timeline} />
                    <>
                        <TimelineEditor
                            timelineState={this.props.tabState.timeline}
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
                    </>
                </Splitter>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Outline = observer(
    class Outline extends React.Component<{
        timelineState: PageTimelineEditorState;
    }> {
        divRef = React.createRef<HTMLDivElement>();
        dispose: any;

        componentDidMount() {
            this.dispose = autorun(() => {
                const scrollTop = this.props.timelineState.scrollTop;
                if (this.divRef.current) {
                    this.divRef.current.scrollTop = scrollTop;
                }
            });
        }

        componentWillUnmount() {
            this.dispose();
        }

        render() {
            const { timelineState } = this.props;
            return (
                <div
                    ref={this.divRef}
                    className="EezStudio_PageTimeline_Outline"
                >
                    <div>
                        {timelineState.treeAdapter.allRows.map(row => (
                            <div
                                key={timelineState.treeAdapter.getItemId(
                                    row.item
                                )}
                                className="EezStudio_PageTimeline_Outline_Item"
                                style={{
                                    paddingLeft:
                                        row.level * OUTLINE_LEVEL_MARGIN
                                }}
                            >
                                {timelineState.treeAdapter.itemToString(
                                    row.item
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const TimelineEditor = observer(
    class TimelineEditor extends React.Component<{
        timelineState: PageTimelineEditorState;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        svgRef = React.createRef<SVGSVGElement>();
        draggable = new Draggable(this);
        dragStart = { x: 0, y: 0 };
        dragMode: "none" | "timeline-position" | "rubber-bend";
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

            runInAction(() => {
                this.props.timelineState.position = snapPosition;
            });
        }

        onDragStart = (e: PointerEvent, x: number, y: number) => {
            const rect = this.svgRef.current!.getBoundingClientRect();

            x -= rect.x;
            y -= rect.y;

            if (y < TIMELINE_HEIGHT) {
                runInAction(() => {
                    this.props.timelineState.selectedKeyframes = [];
                });

                this.setTimelinePosition(x);
                this.dragMode = "timeline-position";
            } else {
                const keyframe = (() => {
                    const keyframeElement: HTMLElement = closestBySelector(
                        e.target,
                        "[data-timeline-keyframe-object-path]"
                    );
                    if (!keyframeElement) {
                        return undefined;
                    }

                    const objectPath = keyframeElement.getAttribute(
                        "data-timeline-keyframe-object-path"
                    );
                    if (!objectPath) {
                        return undefined;
                    }

                    return getObjectFromStringPath(
                        this.context.project,
                        objectPath
                    ) as TimelineKeyframe | undefined;
                })();

                if (keyframe) {
                    runInAction(() => {
                        if (e.ctrlKey || e.shiftKey) {
                            const i =
                                this.props.timelineState.selectedKeyframes.indexOf(
                                    keyframe
                                );
                            if (i == -1) {
                                this.props.timelineState.selectedKeyframes.push(
                                    keyframe
                                );

                                this.props.timelineState.position =
                                    keyframe.end;
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
                                    keyframe
                                ) == -1
                            ) {
                                this.props.timelineState.selectedKeyframes = [
                                    keyframe
                                ];

                                this.props.timelineState.position =
                                    keyframe.end;
                            }
                        }
                    });
                    this.dragMode = "none";
                } else {
                    runInAction(() => {
                        this.props.timelineState.selectedKeyframes = [];
                        this.props.timelineState.rubberBendRect = {
                            left: x,
                            top: y,
                            width: 0,
                            height: 0
                        };
                    });
                    this.dragMode = "rubber-bend";
                }
            }

            this.dragStart.x = x;
            this.dragStart.y = y;
        };

        onDragMove = (e: PointerEvent, x: number, y: number, params: any) => {
            if (this.dragMode == "timeline-position") {
                this.setTimelinePosition(x + this.dragStart.x);
            } else if (this.dragMode == "rubber-bend") {
                runInAction(() => {
                    let left;
                    let width;
                    if (x > 0) {
                        left = this.dragStart.x;
                        width = x;
                    } else {
                        left = this.dragStart.x + x;
                        width = -x;
                    }

                    let top;
                    let height;
                    if (y > 0) {
                        top = this.dragStart.y;
                        height = y;
                    } else {
                        top = this.dragStart.y + y;
                        height = -y;
                    }

                    const rubberBendRect =
                        this.props.timelineState.rubberBendRect!;

                    rubberBendRect.left = left;
                    rubberBendRect.top = top;
                    rubberBendRect.width = width;
                    rubberBendRect.height = height;
                });
            }
        };

        onDragEnd = (
            e: PointerEvent | undefined,
            cancel: boolean,
            params: any
        ) => {
            if (this.dragMode == "rubber-bend") {
                const selectedKeyframes: TimelineKeyframe[] = [];

                const timelineState = this.props.timelineState;

                const rubberBendRect = timelineState.rubberBendRect!;

                timelineState.treeAdapter.allRows.forEach((row, rowIndex) => {
                    const widget = timelineState.treeAdapter.getItemObject(
                        row.item
                    ) as Widget;

                    widget.timeline.forEach(keyframe => {
                        const { x1, y1, x2, y2 } = getTimelineCircleRect(
                            timelineState,
                            keyframe,
                            rowIndex
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
                    this.props.timelineState.selectedKeyframes =
                        selectedKeyframes;
                    this.props.timelineState.rubberBendRect = undefined;
                });
            }

            this.dragMode = "none";
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

                    runInAction(() => {
                        this.props.timelineState.secondToPx = secondToPx;
                    });
                }
            }
        };

        genTicks(delta: number) {
            const ticks = [];
            for (
                let i = 0;
                i <= Math.floor(this.props.timelineState.duration / delta);
                i++
            ) {
                ticks.push(i * delta);
            }
            return ticks;
        }

        get ticks() {
            if (this.props.timelineState.secondToPx > 600) {
                return this.genTicks(0.1);
            }
            return this.genTicks(1);
        }

        get subticks() {
            if (this.props.timelineState.secondToPx > 600) {
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
                            className="EezStudio_PageTimeline_Timeline_RubberBendRect"
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
                    className="EezStudio_PageTimeline_Timeline_Timeline_Area"
                    x={0}
                    y={0}
                    width={
                        TIMELINE_X_OFFSET +
                        timelineState.duration * timelineState.secondToPx
                    }
                    height={TIMELINE_HEIGHT}
                />

                {subticks.map(x => (
                    <g key={x}>
                        <line
                            className="EezStudio_PageTimeline_Timeline_Timeline_Subtick"
                            x1={
                                TIMELINE_X_OFFSET + x * timelineState.secondToPx
                            }
                            y1={(3 * TIMELINE_HEIGHT) / 4}
                            x2={
                                TIMELINE_X_OFFSET + x * timelineState.secondToPx
                            }
                            y2={TIMELINE_HEIGHT}
                        />
                    </g>
                ))}

                {ticks.map(x => (
                    <g key={x}>
                        <line
                            className="EezStudio_PageTimeline_Timeline_Timeline_Tick"
                            x1={
                                TIMELINE_X_OFFSET + x * timelineState.secondToPx
                            }
                            y1={TIMELINE_HEIGHT / 2}
                            x2={
                                TIMELINE_X_OFFSET + x * timelineState.secondToPx
                            }
                            y2={TIMELINE_HEIGHT}
                        />
                        {Math.abs(x - timelineState.position) > 1e-4 && (
                            <text
                                className="EezStudio_PageTimeline_Timeline_Timeline_TickText"
                                x={
                                    TIMELINE_X_OFFSET +
                                    x * timelineState.secondToPx
                                }
                                y={0}
                                textAnchor="middle"
                                alignmentBaseline="hanging"
                            >
                                {Math.round(x * 1000) / 1000}
                            </text>
                        )}
                    </g>
                ))}

                <rect
                    className="EezStudio_PageTimeline_Timeline_Timeline_Needle"
                    x={
                        TIMELINE_X_OFFSET +
                        timelineState.position * timelineState.secondToPx -
                        NEEDLE_WIDTH / 2
                    }
                    y={0}
                    width={NEEDLE_WIDTH}
                    height={TIMELINE_HEIGHT / 2}
                    style={{ cursor: "ew-resize" }}
                />

                <line
                    className="EezStudio_PageTimeline_Timeline_Timeline_Needle"
                    x1={
                        TIMELINE_X_OFFSET +
                        timelineState.position * timelineState.secondToPx
                    }
                    y1={0}
                    x2={
                        TIMELINE_X_OFFSET +
                        timelineState.position * timelineState.secondToPx
                    }
                    y2={TIMELINE_HEIGHT}
                    style={{ cursor: "ew-resize" }}
                />

                <line
                    className="EezStudio_PageTimeline_Timeline_Timeline_Needle"
                    x1={
                        TIMELINE_X_OFFSET +
                        timelineState.position * timelineState.secondToPx
                    }
                    y1={TIMELINE_HEIGHT}
                    x2={
                        TIMELINE_X_OFFSET +
                        timelineState.position * timelineState.secondToPx
                    }
                    y2={
                        TIMELINE_HEIGHT +
                        timelineState.treeAdapter.allRows.length * ROW_HEIGHT
                    }
                />

                <SvgLabel
                    text={(
                        Math.round(timelineState.position * 1000) / 1000
                    ).toString()}
                    textClassName="EezStudio_PageTimeline_Timeline_Timeline_Needle"
                    rectClassName="EezStudio_PageTimeline_Timeline_Timeline_Needle_TextBackground"
                    x={
                        TIMELINE_X_OFFSET +
                        timelineState.position * timelineState.secondToPx +
                        4
                    }
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
                        <g key={timelineState.treeAdapter.getItemId(row.item)}>
                            {widget.timeline.map((keyframe, i) => {
                                const { cx, cy, x1, y1, x2, y2 } =
                                    getTimelineCircleRect(
                                        timelineState,
                                        keyframe,
                                        rowIndex
                                    );

                                return (
                                    <g
                                        key={getId(keyframe)}
                                        data-timeline-keyframe-object-path={getObjectPathAsString(
                                            keyframe
                                        )}
                                    >
                                        <circle
                                            data-timeline-keyframe-object-path={getObjectPathAsString(
                                                keyframe
                                            )}
                                            className="EezStudio_PageTimeline_Timeline_Point"
                                            cx={cx}
                                            cy={cy}
                                            r={POINT_RADIUS}
                                        ></circle>

                                        {timelineState.selectedKeyframes.indexOf(
                                            keyframe
                                        ) != -1 &&
                                            keyframe.start == keyframe.end && (
                                                <rect
                                                    className="EezStudio_PageTimeline_Timeline_KeyframeSelection"
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

        return (
            <g key={timelineState.treeAdapter.getItemId(row.item)}>
                <rect
                    className="EezStudio_PageTimeline_Timeline_Row"
                    x={TIMELINE_X_OFFSET}
                    y={TIMELINE_HEIGHT + rowIndex * ROW_HEIGHT + ROW_GAP / 2}
                    width={timelineState.duration * timelineState.secondToPx}
                    height={ROW_HEIGHT - ROW_GAP}
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
        const x1 =
            TIMELINE_X_OFFSET + keyframe.start * timelineState.secondToPx;

        const x2 = TIMELINE_X_OFFSET + keyframe.end * timelineState.secondToPx;

        const y1 = TIMELINE_HEIGHT + rowIndex * ROW_HEIGHT + ROW_GAP / 2;

        const y2 = y1 + ROW_HEIGHT - ROW_GAP;

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
            <g
                data-timeline-keyframe-object-path={getObjectPathAsString(
                    keyframe
                )}
            >
                <path
                    className="EezStudio_PageTimeline_Timeline_Keyframe"
                    d={path}
                ></path>
                {timelineState.selectedKeyframes.indexOf(keyframe) != -1 && (
                    <rect
                        className="EezStudio_PageTimeline_Timeline_KeyframeSelection"
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

function getTimelineCircleRect(
    timelineState: PageTimelineEditorState,
    keyframe: TimelineKeyframe,
    rowIndex: number
) {
    const cx = TIMELINE_X_OFFSET + keyframe.end * timelineState.secondToPx;

    const cy = TIMELINE_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

    const x1 = cx - POINT_RADIUS / 2;
    const y1 = cy - POINT_RADIUS / 2;
    const x2 = x1 + POINT_RADIUS;
    const y2 = y1 + POINT_RADIUS;

    return { cx, cy, x1, y1, x2, y2 };
}

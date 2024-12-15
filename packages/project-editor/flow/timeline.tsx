import React, { Fragment } from "react";
import {
    observable,
    computed,
    makeObservable,
    action,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import {
    VALIDATION_MESSAGE_RANGE_INCLUSIVE,
    VALIDATION_MESSAGE_RANGE_INCLUSIVE_WITHOUT_MAX,
    VALIDATION_MESSAGE_REQUIRED
} from "eez-studio-shared/validation";
import { humanize } from "eez-studio-shared/string";
import { easingFunctions } from "eez-studio-shared/easing-functions";
import { Icon } from "eez-studio-ui/icon";
import { Button } from "eez-studio-ui/button";
import {
    Point,
    pointDistance,
    Rect,
    splitCurveAt
} from "eez-studio-shared/geometry";

import {
    EezObject,
    ClassInfo,
    PropertyType,
    PropertyProps,
    registerClass,
    getObjectPropertyDisplayName,
    getId
} from "project-editor/core/object";
import {
    getAncestorOfType,
    updateObject,
    createObject,
    getProjectStore,
    getClassInfo
} from "project-editor/store";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { ProjectContext } from "project-editor/project/context";

import type { Component, Widget } from "project-editor/flow/component";

import type { PageTabState } from "project-editor/features/page/PageEditor";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { DataBuffer } from "project-editor/build/data-buffer";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import type { Page } from "project-editor/features/page/page";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { EditorFlowContext } from "project-editor/flow/editor/context";
import { Svg } from "project-editor/flow/editor/render";
import {
    opa_property_info,
    transform_angle_property_info,
    transform_zoom_property_info
} from "project-editor/lvgl/style-catalog";
import { getStylePropDefaultValue } from "project-editor/lvgl/style-helper";
import {
    IPointerEvent,
    MouseHandlerWithSnapLines
} from "project-editor/flow/editor/mouse-handler";
import { addAlphaToColor } from "eez-studio-shared/color";
import { visitObjects } from "project-editor/core/search";
import { evalConstantExpression } from "./expression";

////////////////////////////////////////////////////////////////////////////////

export type EasingFunction = keyof typeof easingFunctions;

export type TimelineKeyframeProperty =
    | "left"
    | "top"
    | "width"
    | "height"
    | "scale"
    | "scaleX"
    | "scaleY"
    | "rotate"
    | "opacity";

export type TimelineKeyframePropertyValue<T> = {
    enabled: boolean;
    value: T | undefined;
    easingFunction: EasingFunction;
};

export class TimelineKeyframe extends EezObject {
    start: number;
    end: number;

    left: TimelineKeyframePropertyValue<number>;
    top: TimelineKeyframePropertyValue<number>;
    width: TimelineKeyframePropertyValue<number>;
    height: TimelineKeyframePropertyValue<number>;

    scale: TimelineKeyframePropertyValue<number>;
    scaleX: TimelineKeyframePropertyValue<number>;
    scaleY: TimelineKeyframePropertyValue<number>;
    rotate: TimelineKeyframePropertyValue<number>;

    opacity: TimelineKeyframePropertyValue<number>;

    controlPoints: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "start",
                type: PropertyType.Number
            },
            {
                name: "end",
                type: PropertyType.Number
            },
            {
                name: "left",
                type: PropertyType.Any
            },
            {
                name: "top",
                type: PropertyType.Any
            },
            {
                name: "width",
                type: PropertyType.Any
            },
            {
                name: "height",
                type: PropertyType.Any
            },
            {
                name: "scale",
                type: PropertyType.Any
            },
            {
                name: "scaleX",
                type: PropertyType.Any
            },
            {
                name: "scaleY",
                type: PropertyType.Any
            },
            {
                name: "rotate",
                type: PropertyType.Any
            },
            {
                name: "opacity",
                type: PropertyType.Any
            },
            {
                name: "controlPoints",
                type: PropertyType.String
            }
        ],
        label: (keyframe: TimelineKeyframe) => {
            const { start, end } = keyframe;

            const values = TimelineKeyframe.classInfo.properties
                .map(propertyInfo => ({
                    propertyInfo,
                    value: (keyframe as any)[
                        propertyInfo.name
                    ] as TimelineKeyframePropertyValue<number>
                }))
                .filter(
                    x =>
                        x.propertyInfo.type == PropertyType.Any &&
                        x.value != undefined &&
                        x.value.enabled
                )
                .map(x => {
                    let label = getObjectPropertyDisplayName(
                        keyframe,
                        x.propertyInfo
                    );

                    if (x.value.easingFunction == "linear") {
                        return `${label} to ${x.value.value}`;
                    } else {
                        return `${label} to ${x.value.value}/${x.value.easingFunction}`;
                    }
                })
                .join(", ");

            if (start == end) {
                return `At ${end} s set ` + values;
            }
            return `From ${start} s to ${end} s animate ` + values;
        },
        beforeLoadHook: (
            keyframe: TimelineKeyframe,
            jsKeyframe: Partial<TimelineKeyframe>
        ) => {
            for (const propertyName of [
                "left" as const,
                "top" as const,
                "width" as const,
                "height" as const,
                "rotate" as const,
                "opacity" as const
            ]) {
                const value = (jsKeyframe as any)[propertyName];
                if (value == undefined || typeof value == "number") {
                    jsKeyframe[propertyName] = {
                        enabled: value != undefined,
                        value,
                        easingFunction: "linear"
                    };
                }
            }

            if (jsKeyframe.scale == undefined) {
                jsKeyframe.scale = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
            }

            if (jsKeyframe.scaleX == undefined) {
                jsKeyframe.scaleX = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
            }

            if (jsKeyframe.scaleY == undefined) {
                jsKeyframe.scaleY = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
            }

            if (jsKeyframe.rotate == undefined) {
                jsKeyframe.rotate = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
            }
        }
    };

    constructor() {
        super();

        makeObservable(this, {
            controlPointsArray: computed
        });
    }

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            start: observable,
            end: observable,
            left: observable,
            top: observable,
            width: observable,
            height: observable,
            scale: observable,
            scaleX: observable,
            scaleY: observable,
            rotate: observable,
            opacity: observable,
            controlPoints: observable
        });
    }

    get controlPointsArray() {
        if (!this.left.enabled || !this.top.enabled) {
            return [];
        }

        let array = (this.controlPoints || "")
            .split(",")
            .join("")
            .split("(")
            .join("")
            .split(")")
            .join("")
            .split(" ")
            .map(num => Number.parseFloat(num))
            .filter(num => !isNaN(num))
            .map(num => Math.round(num));

        if (array.length > 4) {
            array = array.slice(0, 4);
        } else if (array.length == 3) {
            array = array.slice(0, 2);
        } else if (array.length < 2) {
            array = [];
        }

        return array;
    }

    build(dataBuffer: DataBuffer) {
        // start
        dataBuffer.writeFloat(this.start);

        // end
        dataBuffer.writeFloat(this.end);

        // enabledProperties
        const WIDGET_TIMELINE_PROPERTY_X = 1 << 0;
        const WIDGET_TIMELINE_PROPERTY_Y = 1 << 1;
        const WIDGET_TIMELINE_PROPERTY_WIDTH = 1 << 2;
        const WIDGET_TIMELINE_PROPERTY_HEIGHT = 1 << 3;
        const WIDGET_TIMELINE_PROPERTY_OPACITY = 1 << 4;
        const WIDGET_TIMELINE_PROPERTY_CP1 = 1 << 5;
        const WIDGET_TIMELINE_PROPERTY_CP2 = 1 << 6;

        const controlPointsArray = this.controlPointsArray;

        let enabledProperties = 0;

        if (this.left.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_X;
        }
        if (this.top.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_Y;
        }
        if (this.width.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_WIDTH;
        }
        if (this.height.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_HEIGHT;
        }
        if (this.opacity.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_OPACITY;
        }
        if (this.controlPointsArray.length == 2) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_CP1;
        }
        if (this.controlPointsArray.length == 4) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_CP2;
        }

        dataBuffer.writeUint32(enabledProperties);

        // x
        dataBuffer.writeInt16(this.left.enabled ? this.left.value! : 0);

        // y
        dataBuffer.writeInt16(this.top.enabled ? this.top.value! : 0);

        // width
        dataBuffer.writeInt16(this.width.enabled ? this.width.value! : 0);

        // height
        dataBuffer.writeInt16(this.height.enabled ? this.height.value! : 0);

        // opacity
        dataBuffer.writeFloat(this.opacity.enabled ? this.opacity.value! : 0);

        // xEasingFunc
        dataBuffer.writeUint8(
            this.left.enabled
                ? getEasingFunctionCode(this.left.easingFunction)
                : 0
        );

        // yEasingFunc
        dataBuffer.writeUint8(
            this.top.enabled
                ? getEasingFunctionCode(this.top.easingFunction)
                : 0
        );

        // widthEasingFunc
        dataBuffer.writeUint8(
            this.width.enabled
                ? getEasingFunctionCode(this.width.easingFunction)
                : 0
        );

        // heightEasingFunc
        dataBuffer.writeUint8(
            this.height.enabled
                ? getEasingFunctionCode(this.height.easingFunction)
                : 0
        );

        // opacityEasingFunc
        dataBuffer.writeUint8(
            this.opacity.enabled
                ? getEasingFunctionCode(this.opacity.easingFunction)
                : 0
        );

        // reserved1
        dataBuffer.writeUint8(0);

        // reserved2
        dataBuffer.writeUint16(0);

        // cp1x
        dataBuffer.writeInt16(
            this.controlPointsArray.length == 2 ||
                this.controlPointsArray.length == 4
                ? controlPointsArray[0]
                : 0
        );

        // cp1y
        dataBuffer.writeInt16(
            this.controlPointsArray.length == 2 ||
                this.controlPointsArray.length == 4
                ? controlPointsArray[1]
                : 0
        );

        // cp2x
        dataBuffer.writeInt16(
            this.controlPointsArray.length == 4 ? controlPointsArray[2] : 0
        );

        // cp2y
        dataBuffer.writeInt16(
            this.controlPointsArray.length == 4 ? controlPointsArray[3] : 0
        );
    }

    lvglCreate(runtime: LVGLPageRuntime, obj: number, flowState: number) {
        // enabledProperties
        const WIDGET_TIMELINE_PROPERTY_X = 1 << 0;
        const WIDGET_TIMELINE_PROPERTY_Y = 1 << 1;
        const WIDGET_TIMELINE_PROPERTY_WIDTH = 1 << 2;
        const WIDGET_TIMELINE_PROPERTY_HEIGHT = 1 << 3;
        const WIDGET_TIMELINE_PROPERTY_OPACITY = 1 << 4;
        const WIDGET_TIMELINE_PROPERTY_SCALE = 1 << 5;
        const WIDGET_TIMELINE_PROPERTY_ROTATE = 1 << 6;
        const WIDGET_TIMELINE_PROPERTY_CP1 = 1 << 7;
        const WIDGET_TIMELINE_PROPERTY_CP2 = 1 << 8;

        const controlPointsArray = this.controlPointsArray;

        let enabledProperties = 0;
        if (this.left.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_X;
        }
        if (this.top.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_Y;
        }
        if (this.width.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_WIDTH;
        }
        if (this.height.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_HEIGHT;
        }
        if (this.opacity.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_OPACITY;
        }
        if (this.scale.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_SCALE;
        }
        if (this.rotate.enabled) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_ROTATE;
        }
        if (this.controlPointsArray.length == 2) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_CP1;
        }
        if (this.controlPointsArray.length == 4) {
            enabledProperties |= WIDGET_TIMELINE_PROPERTY_CP2;
        }

        runtime.wasm._lvglAddTimelineKeyframe(
            obj,
            flowState,
            this.start,
            this.end,
            enabledProperties,

            this.left.enabled ? this.left.value! : 0,
            this.left.enabled
                ? getEasingFunctionCode(this.left.easingFunction)
                : 0,

            this.top.enabled ? this.top.value! : 0,
            this.top.enabled
                ? getEasingFunctionCode(this.top.easingFunction)
                : 0,

            this.width.enabled ? this.width.value! : 0,
            this.width.enabled
                ? getEasingFunctionCode(this.width.easingFunction)
                : 0,

            this.height.enabled ? this.height.value! : 0,
            this.height.enabled
                ? getEasingFunctionCode(this.height.easingFunction)
                : 0,

            this.opacity.enabled ? this.opacity.value! : 0,
            this.opacity.enabled
                ? getEasingFunctionCode(this.opacity.easingFunction)
                : 0,

            this.scale.enabled ? this.scale.value! : 0,
            this.scale.enabled
                ? getEasingFunctionCode(this.scale.easingFunction)
                : 0,

            this.rotate.enabled ? this.rotate.value! : 0,
            this.rotate.enabled
                ? getEasingFunctionCode(this.rotate.easingFunction)
                : 0,

            this.controlPointsArray.length == 2 ||
                this.controlPointsArray.length == 4
                ? controlPointsArray[0]
                : 0,
            this.controlPointsArray.length == 2 ||
                this.controlPointsArray.length == 4
                ? controlPointsArray[1]
                : 0,
            this.controlPointsArray.length == 4 ? controlPointsArray[2] : 0,
            this.controlPointsArray.length == 4 ? controlPointsArray[3] : 0
        );
    }
}

registerClass("TimelineKeyframe", TimelineKeyframe);

////////////////////////////////////////////////////////////////////////////////

const TimelineKeyframePropertyName = observer(
    class TimelineKeyframePropertyName extends React.Component<{
        propertyName: string;
        value: any;
        onChange: (value: boolean) => any;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        inputRef = React.createRef<HTMLInputElement>();

        updateIndeterminate() {
            if (this.inputRef.current) {
                this.inputRef.current.indeterminate =
                    this.props.value == undefined;
            }
        }

        componentDidMount() {
            this.updateIndeterminate();
        }

        componentDidUpdate() {
            this.updateIndeterminate();
        }

        render() {
            return (
                <td>
                    <label>
                        <input
                            ref={this.inputRef}
                            type="checkbox"
                            className="form-check-input"
                            checked={this.props.value ? true : false}
                            onChange={e =>
                                this.props.onChange(e.target.checked)
                            }
                        ></input>{" "}
                        {humanize(this.props.propertyName)}
                    </label>
                </td>
            );
        }
    }
);

interface NumberInputProps {
    value: any;
    onChange: (value: number) => any;
    min: number | undefined;
    max: number | undefined;
    readOnly: boolean;
}

const NumberInput = observer(
    class NumberInput extends React.Component<NumberInputProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        value: string;
        numValue: number;
        error: string | undefined;

        constructor(props: NumberInputProps) {
            super(props);

            this.value = (this.props.value ?? "").toString();
            this.numValue = this.props.value;

            makeObservable(this, {
                value: observable,
                error: observable
            });
        }

        componentDidUpdate() {
            if (this.props.value != this.numValue) {
                runInAction(() => {
                    this.value = (this.props.value ?? "").toString();
                    this.numValue = this.props.value;
                    this.error = undefined;
                });
            }
        }

        onChange = action((e: React.ChangeEvent<HTMLInputElement>) => {
            this.value = e.target.value;

            if (!this.value) {
                this.error = VALIDATION_MESSAGE_REQUIRED;
                return;
            }

            let value = parseFloat(this.value);
            if (isNaN(value)) {
                this.error = "Not a number";
                e.target.setCustomValidity("Not a number");
                return;
            }

            if (this.props.min != undefined) {
                if (this.props.max != undefined) {
                    if (value < this.props.min || value > this.props.max) {
                        this.error = VALIDATION_MESSAGE_RANGE_INCLUSIVE.replace(
                            "${min}",
                            this.props.min.toString()
                        ).replace("${max}", this.props.max.toString());
                        return;
                    }
                } else {
                    if (value < this.props.min) {
                        this.error =
                            VALIDATION_MESSAGE_RANGE_INCLUSIVE_WITHOUT_MAX.replace(
                                "${min}",
                                this.props.min.toString()
                            );
                        return;
                    }
                }
            }

            this.error = undefined;

            this.numValue = value;

            this.props.onChange(value);
        });

        onKeyDown = (event: React.KeyboardEvent) => {
            if (event.keyCode === 13) {
                try {
                    const newValue = evalConstantExpression(
                        this.context.project,
                        this.value
                    );
                    if (
                        typeof newValue.value == "number" &&
                        !isNaN(newValue.value) &&
                        newValue.value.toString() !== this.value.toString()
                    ) {
                        this.props.onChange(newValue.value);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };

        render() {
            return (
                <>
                    <input
                        className="form-control"
                        type="text"
                        value={this.value}
                        onChange={this.onChange}
                        onKeyDown={this.onKeyDown}
                        readOnly={this.props.readOnly}
                        disabled={this.props.readOnly}
                    ></input>
                    {this.error && <div className="error">{this.error}</div>}
                </>
            );
        }
    }
);

export const TimelineKeyframePropertyUI = observer(
    class TimelineKeyframePropertyUI extends React.Component<PropertyProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                widgets: computed,
                timeline: computed,
                keyframes: computed
            });
        }

        get widgets() {
            return this.props.objects as Widget[];
        }

        get timeline() {
            return getTimelineEditorState(this.props.objects[0] as Widget)!;
        }

        get keyframes() {
            return this.widgets.map(widget => {
                for (const keyframe of widget.timeline) {
                    if (keyframe.end == this.timeline.position) {
                        return keyframe;
                    }
                }
                return undefined;
            });
        }

        onInsertKeyframes = () => {
            this.context.undoManager.setCombineCommands(true);

            this.widgets.forEach(widget => {
                const position = this.timeline.position;

                const newKeyframe = createObject<TimelineKeyframe>(
                    this.context,
                    {},
                    TimelineKeyframe
                );

                newKeyframe.start = position;
                newKeyframe.end = position;

                newKeyframe.left = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.top = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.width = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.height = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };

                newKeyframe.scale = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.scaleX = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.scaleY = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.rotate = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };
                newKeyframe.opacity = {
                    enabled: false,
                    value: undefined,
                    easingFunction: "linear"
                };

                for (let i = 0; i < widget.timeline.length; i++) {
                    const keyframe = widget.timeline[i];

                    if (position <= keyframe.start) {
                        newKeyframe.start =
                            i == 0 ? 0 : widget.timeline[i - 1].end;
                        this.context.insertObjectBefore(keyframe, newKeyframe);
                        return;
                    }

                    if (position < keyframe.end) {
                        newKeyframe.start = keyframe.start;

                        if (keyframe.left.enabled && keyframe.top.enabled) {
                            const widgetTimelinePath = new WidgetTimelinePath(
                                widget
                            );
                            const path = widgetTimelinePath.path;
                            const curve = path.find(
                                curve => curve.keyframe == keyframe
                            );
                            if (curve) {
                                const t =
                                    (position - keyframe.start) /
                                    (keyframe.end - keyframe.start);

                                if (curve.curvePoints.length == 4) {
                                    const [p1, p2, p3, p4] = curve.curvePoints;

                                    const { x: xOffset, y: yOffset } =
                                        widgetTimelinePath.offsetToCenter;

                                    const result = splitCurveAt(
                                        t,
                                        p1.x - xOffset,
                                        p1.y - yOffset,
                                        p2.x - xOffset,
                                        p2.y - yOffset,
                                        p3.x - xOffset,
                                        p3.y - yOffset,
                                        p4.x - xOffset,
                                        p4.y - yOffset
                                    );

                                    for (let i = 0; i < result.length; i++) {
                                        result[i] = Math.round(result[i]);
                                    }

                                    // const p11 = { x: result[0], y: result[1] };
                                    const p21 = { x: result[2], y: result[3] };
                                    const p31 = { x: result[4], y: result[5] };
                                    const p41 = { x: result[6], y: result[7] };

                                    // const p12 = { x: result[6], y: result[7] };
                                    const p22 = { x: result[8], y: result[9] };
                                    const p32 = {
                                        x: result[10],
                                        y: result[11]
                                    };
                                    // const p42 = {
                                    //     x: result[12],
                                    //     y: result[13]
                                    // };

                                    newKeyframe.left.enabled = true;
                                    newKeyframe.left.value = p41.x;

                                    newKeyframe.top.enabled = true;
                                    newKeyframe.top.value = p41.y;

                                    newKeyframe.controlPoints = `(${p21.x}, ${p21.y}) (${p31.x}, ${p31.y})`;

                                    this.context.updateObject(keyframe, {
                                        controlPoints: `(${p22.x}, ${p22.y}) (${p32.x}, ${p32.y})`
                                    });
                                } else if (curve.curvePoints.length == 3) {
                                    const [p1, p2, p3] = curve.curvePoints;

                                    const { x: xOffset, y: yOffset } =
                                        widgetTimelinePath.offsetToCenter;

                                    const result = splitCurveAt(
                                        t,
                                        p1.x - xOffset,
                                        p1.y - yOffset,
                                        p2.x - xOffset,
                                        p2.y - yOffset,
                                        p3.x - xOffset,
                                        p3.y - yOffset
                                    );

                                    for (let i = 0; i < result.length; i++) {
                                        result[i] = Math.round(result[i]);
                                    }

                                    // const p11 = { x: result[0], y: result[1] };
                                    const p21 = { x: result[2], y: result[3] };
                                    const p41 = { x: result[4], y: result[5] };

                                    // const p12 = { x: result[4], y: result[5] };
                                    const p22 = { x: result[6], y: result[7] };
                                    // const p42 = {
                                    //     x: result[8],
                                    //     y: result[9]
                                    // };

                                    newKeyframe.left.enabled = true;
                                    newKeyframe.left.value = p41.x;

                                    newKeyframe.top.enabled = true;
                                    newKeyframe.top.value = p41.y;

                                    newKeyframe.controlPoints = `(${p21.x}, ${p21.y})`;

                                    this.context.updateObject(keyframe, {
                                        controlPoints: `(${p22.x}, ${p22.y})`
                                    });
                                } else {
                                    const [p1, p2] = curve.curvePoints;

                                    const { x: xOffset, y: yOffset } =
                                        widgetTimelinePath.offsetToCenter;

                                    p1.x -= xOffset;
                                    p1.y -= yOffset;
                                    p2.x -= xOffset;
                                    p2.y -= yOffset;

                                    newKeyframe.left.enabled = true;
                                    newKeyframe.left.value = Math.round(
                                        p1.x + t * (p2.x - p1.x)
                                    );

                                    newKeyframe.top.enabled = true;
                                    newKeyframe.top.value = Math.round(
                                        p1.y + t * (p2.y - p1.y)
                                    );
                                }
                            }
                        }

                        this.context.updateObject(keyframe, {
                            start: position
                        });

                        this.context.insertObjectBefore(keyframe, newKeyframe);

                        return;
                    }

                    if (position == keyframe.end) {
                        return;
                    }
                }

                newKeyframe.start =
                    widget.timeline.length == 0
                        ? 0
                        : widget.timeline[widget.timeline.length - 1].end;

                this.context.addObject(widget.timeline, newKeyframe);
            });

            this.context.undoManager.setCombineCommands(false);
        };

        onDeleteKeyframes = () => {
            this.context.deleteObjects(
                this.keyframes.filter(
                    keyframe => keyframe != undefined
                ) as TimelineKeyframe[]
            );
        };

        getValue<T>(
            get: (keyframe: TimelineKeyframe) => T | undefined
        ): T | undefined {
            return getKeyframesValue(this.keyframes, get);
        }

        setValue<T>(
            propertyName:
                | TimelineKeyframeProperty
                | "start"
                | "end"
                | "controlPoints",
            get: (keyframe: TimelineKeyframe) => T
        ) {
            this.context.undoManager.setCombineCommands(true);

            for (let i = 0; i < this.keyframes.length; i++) {
                const keyframe = this.keyframes[i];
                if (keyframe == undefined) {
                    continue;
                }

                updateObject(keyframe, {
                    [propertyName]: get(keyframe)
                });
            }

            this.context.undoManager.setCombineCommands(false);
        }

        getStart() {
            return this.getValue<number>(keyframe => keyframe.start);
        }

        setStart(value: number) {
            this.setValue<number>("start", () => value);
        }

        getEnd() {
            return this.getValue<number>(keyframe => keyframe.end!);
        }

        setEnd(value: number) {
            const oldValue = this.getEnd();
            this.setValue<number>("end", () => value);
            if (oldValue == this.timeline.position) {
                runInAction(() => (this.timeline.position = value));
            }
        }

        getDuration() {
            const start = this.getStart();
            const end = this.getEnd();
            if (start != undefined && end != undefined) {
                return Math.round((end - start) * 100) / 100 + " s";
            }
            return undefined;
        }

        isPropertyEnabled(propertyName: TimelineKeyframeProperty) {
            return this.getValue<boolean>(
                keyframe => keyframe[propertyName].enabled
            );
        }

        enableProperty(
            propertyName: TimelineKeyframeProperty,
            enabled: boolean
        ) {
            this.context.undoManager.setCombineCommands(true);

            for (let i = 0; i < this.keyframes.length; i++) {
                const keyframe = this.keyframes[i];
                if (keyframe == undefined) {
                    continue;
                }

                const propertyValue = keyframe[propertyName];
                const keyframePropertyEnabled = propertyValue.enabled;

                if (keyframePropertyEnabled != enabled) {
                    if (enabled) {
                        updateObject(keyframe, {
                            [propertyName]: {
                                enabled: true,
                                value:
                                    propertyValue.value != undefined
                                        ? propertyValue.value
                                        : getTimelineProperty(
                                              this.widgets[i],
                                              this.timeline.position,
                                              propertyName
                                          ),
                                easingFunction:
                                    propertyValue.easingFunction ?? "linear"
                            }
                        });
                    } else {
                        updateObject(keyframe, {
                            [propertyName]: {
                                enabled: false,
                                value: propertyValue.value,
                                easingFunction: propertyValue.easingFunction
                            }
                        });
                    }
                }
            }

            this.context.undoManager.setCombineCommands(false);
        }

        getPropertyValue(propertyName: TimelineKeyframeProperty) {
            return getKeyframesPropertyValue(this.keyframes, propertyName);
        }

        getFromPropertyValue(propertyName: TimelineKeyframeProperty) {
            return getKeyframesFromPropertyValue(this.keyframes, propertyName);
        }

        setPropertyValue(
            propertyName: TimelineKeyframeProperty,
            value: number
        ) {
            this.setValue<TimelineKeyframePropertyValue<number>>(
                propertyName,
                keyframe => ({
                    enabled: true,
                    value,
                    easingFunction: keyframe[propertyName].easingFunction
                })
            );
        }

        getPropertyEasingFunction(propertyName: TimelineKeyframeProperty) {
            return this.getValue<EasingFunction>(keyframe => {
                const propertyValue = keyframe[propertyName];
                return propertyValue.enabled
                    ? propertyValue.easingFunction
                    : undefined;
            });
        }

        setPropertyEasingFunction(
            propertyName: TimelineKeyframeProperty,
            value: EasingFunction
        ) {
            this.setValue<TimelineKeyframePropertyValue<number>>(
                propertyName,
                keyframe => ({
                    enabled: true,
                    value: keyframe[propertyName].value,
                    easingFunction: value
                })
            );
        }

        renderProperty(
            propertyName: TimelineKeyframeProperty,
            min?: number,
            max?: number,
            round?: number
        ) {
            const propertyEnabled = this.isPropertyEnabled(propertyName);
            const propertyEasingFunction =
                this.getPropertyEasingFunction(propertyName);
            return (
                <tr>
                    <TimelineKeyframePropertyName
                        propertyName={propertyName}
                        value={propertyEnabled}
                        onChange={checked =>
                            this.enableProperty(propertyName, checked)
                        }
                    />
                    <td>
                        {propertyEnabled && (
                            <NumberInput
                                value={this.getFromPropertyValue(propertyName)}
                                onChange={value => {}}
                                min={min}
                                max={max}
                                readOnly={true}
                            />
                        )}
                    </td>
                    <td>
                        {propertyEnabled && (
                            <NumberInput
                                value={this.getPropertyValue(propertyName)}
                                onChange={value =>
                                    this.setPropertyValue(propertyName, value)
                                }
                                min={min}
                                max={max}
                                readOnly={false}
                            />
                        )}
                    </td>
                    <td>
                        {propertyEnabled && (
                            <select
                                className="form-select"
                                value={propertyEasingFunction}
                                onChange={e =>
                                    this.setPropertyEasingFunction(
                                        propertyName,
                                        e.target.value as EasingFunction
                                    )
                                }
                            >
                                {Object.keys(easingFunctions).map(key => (
                                    <option key={key} id={key}>
                                        {key}
                                    </option>
                                ))}
                            </select>
                        )}
                    </td>
                </tr>
            );
        }

        setControlPoints(array: number[]) {
            const controlPoints =
                array.length == 4
                    ? `(${array[0]}, ${array[1]}) (${array[2]}, ${array[3]})`
                    : array.length == 2
                    ? `(${array[0]}, ${array[1]})`
                    : "";
            this.setValue("controlPoints", keyframe => controlPoints);
        }

        renderControlPoint(keyframe: TimelineKeyframe, index: number) {
            const controlPointsArray = keyframe.controlPointsArray;

            let hasCheckbox: boolean;
            let checkboxEnabled: boolean;
            let x = 0;
            let y = 0;
            if (index == 0) {
                if (controlPointsArray.length == 2) {
                    hasCheckbox = true;
                    checkboxEnabled = true;
                    x = controlPointsArray[0];
                    y = controlPointsArray[1];
                } else if (controlPointsArray.length == 4) {
                    hasCheckbox = false;
                    checkboxEnabled = true;
                    x = controlPointsArray[0];
                    y = controlPointsArray[1];
                } else {
                    hasCheckbox = true;
                    checkboxEnabled = false;
                }
            } else {
                hasCheckbox = true;
                if (controlPointsArray.length == 4) {
                    checkboxEnabled = true;
                    x = controlPointsArray[2];
                    y = controlPointsArray[3];
                } else {
                    checkboxEnabled = false;
                }
            }

            const label = `Control pt ${index + 1}`;

            return (
                <tr>
                    <td>
                        <label>
                            <input
                                type="checkbox"
                                className="form-check-input"
                                checked={checkboxEnabled}
                                onChange={e => {
                                    if (e.target.checked) {
                                        const from = {
                                            x:
                                                getKeyframesFromPropertyValue(
                                                    [keyframe],
                                                    "left"
                                                ) || 0,
                                            y:
                                                getKeyframesFromPropertyValue(
                                                    [keyframe],
                                                    "top"
                                                ) || 0
                                        };

                                        const to = {
                                            x:
                                                (keyframe.left.enabled
                                                    ? keyframe.left.value
                                                    : getKeyframesFromPropertyValue(
                                                          [keyframe],
                                                          "left"
                                                      )) || 0,
                                            y:
                                                (keyframe.top.enabled
                                                    ? keyframe.top.value
                                                    : getKeyframesFromPropertyValue(
                                                          [keyframe],
                                                          "top"
                                                      )) || 0
                                        };

                                        const cp1 = [from.x + 20, from.y - 20];

                                        const cp2 = [to.x - 20, to.y + 20];

                                        if (index == 0) {
                                            this.setControlPoints(cp1);
                                        } else {
                                            if (
                                                controlPointsArray.length == 2
                                            ) {
                                                this.setControlPoints([
                                                    ...controlPointsArray,
                                                    ...cp2
                                                ]);
                                            } else {
                                                this.setControlPoints([
                                                    ...cp1,
                                                    ...cp2
                                                ]);
                                            }
                                        }
                                    } else {
                                        if (index == 0) {
                                            this.setControlPoints([]);
                                        } else {
                                            this.setControlPoints(
                                                controlPointsArray.slice(0, 2)
                                            );
                                        }
                                    }
                                }}
                                readOnly={!hasCheckbox}
                                disabled={!hasCheckbox}
                            ></input>{" "}
                            {label}
                        </label>
                    </td>
                    <td>
                        {checkboxEnabled && (
                            <NumberInput
                                value={x}
                                onChange={value => {
                                    const newControlPointsArray =
                                        controlPointsArray.slice();
                                    newControlPointsArray[index == 0 ? 0 : 2] =
                                        value;
                                    this.setControlPoints(
                                        newControlPointsArray
                                    );
                                }}
                                min={undefined}
                                max={undefined}
                                readOnly={false}
                            />
                        )}
                    </td>
                    <td>
                        {checkboxEnabled && (
                            <NumberInput
                                value={y}
                                onChange={value => {
                                    const newControlPointsArray =
                                        controlPointsArray.slice();
                                    newControlPointsArray[index == 0 ? 1 : 3] =
                                        value;
                                    this.setControlPoints(
                                        newControlPointsArray
                                    );
                                }}
                                min={undefined}
                                max={undefined}
                                readOnly={false}
                            />
                        )}
                    </td>
                    <td />
                </tr>
            );
        }

        renderProperties() {
            const start = this.getStart();
            const end = this.getEnd();
            const keyframes = this.keyframes.filter(
                keyframe => keyframe != undefined
            ) as TimelineKeyframe[];

            return (
                <table>
                    <tbody>
                        <tr>
                            <td className="duration-heading"></td>
                            <td className="duration-heading">Start</td>
                            <td className="duration-heading">End</td>
                            <td className="duration-heading">Duration</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td>
                                <NumberInput
                                    value={start ?? ""}
                                    onChange={value => this.setStart(value)}
                                    min={
                                        start
                                            ? start +
                                              this.timeline.getMinDelta(
                                                  keyframes,
                                                  "keyframe-start"
                                              )
                                            : undefined
                                    }
                                    max={
                                        start
                                            ? start +
                                              this.timeline.getMaxDelta(
                                                  keyframes,
                                                  "keyframe-start"
                                              )
                                            : undefined
                                    }
                                    readOnly={start == undefined}
                                />
                            </td>
                            <td>
                                <NumberInput
                                    value={end ?? ""}
                                    onChange={value => this.setEnd(value)}
                                    min={
                                        end
                                            ? end +
                                              this.timeline.getMinDelta(
                                                  keyframes,
                                                  "keyframe-end"
                                              )
                                            : undefined
                                    }
                                    max={
                                        end
                                            ? end +
                                              this.timeline.getMaxDelta(
                                                  keyframes,
                                                  "keyframe-end"
                                              )
                                            : undefined
                                    }
                                    readOnly={end == undefined}
                                />
                            </td>
                            <td style={{ paddingLeft: 14 }}>
                                {this.getDuration()}
                            </td>
                        </tr>
                        <tr>
                            <td className="property-heading">Property</td>
                            <td className="property-heading">From Value</td>
                            <td className="property-heading">To Value</td>
                            <td className="property-heading">
                                Easing{" "}
                                <a>
                                    <Icon
                                        icon="material:info"
                                        title="Open easing functions help page in the system browser"
                                        style={{ cursor: "pointer" }}
                                        onClick={async () => {
                                            const { shell } = await import(
                                                "electron"
                                            );
                                            shell.openExternal(
                                                "https://easings.net"
                                            );
                                        }}
                                    />
                                </a>
                            </td>
                        </tr>

                        {this.renderProperty("left")}
                        {this.renderProperty("top")}

                        {this.renderProperty("width")}
                        {this.renderProperty("height")}

                        {this.context.projectTypeTraits.isLVGL &&
                            this.renderProperty("scale", 0)}

                        {this.context.projectTypeTraits.isDashboard &&
                            this.renderProperty("scaleX", 0)}
                        {this.context.projectTypeTraits.isDashboard &&
                            this.renderProperty("scaleY", 0)}

                        {this.context.projectTypeTraits.isDashboard &&
                            this.renderProperty("rotate", -360, 360)}
                        {this.context.projectTypeTraits.isLVGL &&
                            this.renderProperty("rotate", -3600, 3600)}

                        {this.renderProperty("opacity", 0, 1)}

                        {this.keyframes.length == 1 &&
                            this.keyframes[0] != undefined &&
                            this.keyframes[0].left.enabled &&
                            this.keyframes[0].top.enabled && (
                                <>
                                    <tr>
                                        <td></td>
                                        <td className="property-heading">X</td>
                                        <td className="property-heading">Y</td>
                                        <td></td>
                                    </tr>
                                    {this.renderControlPoint(
                                        this.keyframes[0]!,
                                        0
                                    )}
                                    {this.renderControlPoint(
                                        this.keyframes[0]!,
                                        1
                                    )}
                                </>
                            )}
                    </tbody>
                </table>
            );
        }

        render() {
            const keyframes = this.keyframes.filter(
                keyframe => keyframe != undefined
            ) as TimelineKeyframe[];

            return (
                <div className="EezStudio_TimelineKeyframe_PropertyUI">
                    {keyframes.length > 0 &&
                        /*<PropertyGrid objects={keyframes} />*/
                        this.renderProperties()}
                    {keyframes.length > 0 && (
                        <div
                            style={{
                                marginBottom: 10
                            }}
                        >
                            <Button
                                color="primary"
                                size="small"
                                onClick={this.onDeleteKeyframes}
                            >
                                {keyframes.length > 1
                                    ? "Delete Keyframes"
                                    : "Delete Keyframe"}
                            </Button>
                        </div>
                    )}
                    {keyframes.length < this.keyframes.length && (
                        <div
                            style={{
                                marginBottom: 10
                            }}
                        >
                            <Button
                                color="primary"
                                size="small"
                                onClick={this.onInsertKeyframes}
                            >
                                {this.keyframes.length > 1
                                    ? "Insert Keyframes"
                                    : "Insert Keyframe"}
                            </Button>
                        </div>
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class WidgetTimelinePath {
    constructor(public widget: Widget) {
        makeObservable(this, {
            pageTabState: computed,
            isWidgetSelected: computed,
            timeline: computed,
            timelinePosition: computed,
            offsetToCenter: computed,
            path: computed
        });
    }

    get pageTabState() {
        const page = getAncestorOfType<Page>(
            this.widget,
            ProjectEditor.PageClass.classInfo
        )!;
        const projectStore = getProjectStore(page);

        const editor = projectStore.editorsStore.getEditorByObject(page);
        if (editor) {
            if (editor.object instanceof ProjectEditor.PageClass) {
                return editor.state as PageTabState;
            }
        }

        return undefined;
    }

    get isWidgetSelected() {
        return this.pageTabState
            ? this.pageTabState.selectedObjects.indexOf(this.widget) != -1
            : false;
    }

    get timeline() {
        if (!this.pageTabState) {
            return undefined;
        }
        return this.pageTabState.timeline.isEditorActive
            ? this.pageTabState.timeline
            : undefined;
    }

    get timelinePosition() {
        return this.timeline?.position ?? 0;
    }

    get offsetToCenter() {
        let timeLineRect = this.widget.getTimelineRect(this.timelinePosition);

        let x;
        let y;

        if (this.widget instanceof ProjectEditor.LVGLWidgetClass) {
            // For the LVGL widget, the relative position changes when the timeline position changes.
            // const relativePosition = this.widget.relativePosition;
            // x =
            //     relativePosition.left -
            //     timeLineRect.left +
            //     timeLineRect.width / 2;
            // y =
            //     relativePosition.top -
            //     timeLineRect.top +
            //     timeLineRect.height / 2;

            x = timeLineRect.width / 2;
            y = timeLineRect.height / 2;
        } else {
            x = timeLineRect.width / 2;
            y = timeLineRect.height / 2;
        }

        const parent = ProjectEditor.getWidgetParent(this.widget);
        if (parent instanceof ProjectEditor.PageClass) {
            x += parent.left;
            y += parent.top;
        } else {
            x += parent.absolutePositionPoint.x;
            y += parent.absolutePositionPoint.y;
        }

        return { x, y };
    }

    getKeyframeCurvePoints(keyframe: TimelineKeyframe) {
        const controlPointsArray = keyframe.controlPointsArray;

        const keyframes = [keyframe];

        const leftFrom = getKeyframesFromPropertyValue(keyframes, "left");
        if (leftFrom == undefined) {
            return [];
        }

        const leftTo = getKeyframesPropertyValue(keyframes, "left");
        if (leftTo == undefined) {
            return [];
        }

        const topFrom = getKeyframesFromPropertyValue(keyframes, "top");
        if (topFrom == undefined) {
            return [];
        }

        const topTo = getKeyframesPropertyValue(keyframes, "top");
        if (topTo == undefined) {
            return [];
        }

        const offset = this.offsetToCenter;

        const pFrom = {
            x: offset.x + leftFrom,
            y: offset.y + topFrom
        };
        const pTo = {
            x: offset.x + leftTo,
            y: offset.y + topTo
        };

        if (controlPointsArray.length == 4) {
            const p1 = pFrom;

            const p2 = {
                x: offset.x + controlPointsArray[0],
                y: offset.y + controlPointsArray[1]
            };

            const p3 = {
                x: offset.x + controlPointsArray[2],
                y: offset.y + controlPointsArray[3]
            };

            const p4 = pTo;

            return [p1, p2, p3, p4];
        } else if (controlPointsArray.length == 2) {
            const p1 = pFrom;

            const p2 = {
                x: offset.x + controlPointsArray[0],
                y: offset.y + controlPointsArray[1]
            };

            const p3 = pTo;

            return [p1, p2, p3];
        } else {
            const p1 = pFrom;
            const p2 = pTo;

            return [p1, p2];
        }
    }

    getEditorHandleProps(keyframe: TimelineKeyframe) {
        return {
            from:
                this.widget.timeline.indexOf(keyframe) == 0
                    ? {
                          className: WidgetTimelinePathEditorHandler.CLASS_NAME,
                          [WidgetTimelinePathEditorHandler.DATA_ATTR_NAME]: `${this.widget.objID}/${keyframe.objID}/from`
                      }
                    : undefined,
            cp1: {
                className: WidgetTimelinePathEditorHandler.CLASS_NAME,
                [WidgetTimelinePathEditorHandler.DATA_ATTR_NAME]: `${this.widget.objID}/${keyframe.objID}/cp1`
            },
            cp2: {
                className: WidgetTimelinePathEditorHandler.CLASS_NAME,
                [WidgetTimelinePathEditorHandler.DATA_ATTR_NAME]: `${this.widget.objID}/${keyframe.objID}/cp2`
            },
            to: {
                className: WidgetTimelinePathEditorHandler.CLASS_NAME,
                [WidgetTimelinePathEditorHandler.DATA_ATTR_NAME]: `${this.widget.objID}/${keyframe.objID}/to`
            }
        };
    }

    get path() {
        return this.widget.timeline
            .map(keyframe => ({
                keyframe,
                curvePoints: this.getKeyframeCurvePoints(keyframe),
                editorHandleProps: this.getEditorHandleProps(keyframe),
                selected:
                    this.timeline?.selectedKeyframes.indexOf(keyframe) != -1,
                widgetSelected: this.isWidgetSelected
            }))
            .filter(pathCurve => pathCurve.curvePoints.length > 0);
    }
}

export class WidgetTimelinePathEditorHandler extends MouseHandlerWithSnapLines {
    static CLASS_NAME = "widget-timeline-path-editor-handle";
    static DATA_ATTR_NAME = "data-handle-id";

    cursor: string = "grabbing";

    widgetTimelinePath: WidgetTimelinePath;

    widgetRectAtStart: Rect;

    keyframe: TimelineKeyframe;
    fromAtStart: Point;
    toAtStart: Point;
    cp1AtStart: Point | undefined;
    cp2AtStart: Point | undefined;

    keyframePrev: TimelineKeyframe;
    toPrevAtStart: Point | undefined;
    cp1PrevAtStart: Point | undefined;
    cp2PrevAtStart: Point | undefined;

    keyframeNext: TimelineKeyframe;
    toNextAtStart: Point | undefined;
    cp1NextAtStart: Point | undefined;
    cp2NextAtStart: Point | undefined;

    handleId: string;

    constructor(private editorHandleId: string) {
        super();
    }

    down(context: IFlowContext, event: IPointerEvent) {
        const [widgetObjId, keyframeObjId, handleId] =
            this.editorHandleId.split("/");

        this.widgetTimelinePath = new WidgetTimelinePath(
            context.projectStore.project._objectsMap.get(widgetObjId) as Widget
        );

        this.keyframe = context.projectStore.project._objectsMap.get(
            keyframeObjId
        ) as TimelineKeyframe;

        if (handleId == "from" || handleId == "to") {
            runInAction(() => {
                this.widgetTimelinePath.timeline!.position =
                    handleId == "from" ? 0 : this.keyframe.end;
                this.widgetTimelinePath.timeline!.selectedKeyframes = [
                    this.keyframe
                ];
            });

            context.viewState.selectObjects([
                context.document.findObjectById(
                    getId(this.widgetTimelinePath.widget)
                )!
            ]);
        }

        super.down(context, event);

        this.handleId = handleId as string;

        const classInfo = getClassInfo(this.widgetTimelinePath.widget);
        this.widgetRectAtStart = classInfo.getRect!(
            this.widgetTimelinePath.widget
        );

        this.fromAtStart = {
            x: this.widgetTimelinePath.widget.left,
            y: this.widgetTimelinePath.widget.top
        };

        this.toAtStart = {
            x: this.keyframe.left.value!,
            y: this.keyframe.top.value!
        };

        const controlPointsArray = this.keyframe.controlPointsArray;

        if (controlPointsArray.length == 2 || controlPointsArray.length == 4) {
            this.cp1AtStart = {
                x: controlPointsArray[0],
                y: controlPointsArray[1]
            };
        }

        if (controlPointsArray.length == 4) {
            this.cp2AtStart = {
                x: controlPointsArray[2],
                y: controlPointsArray[3]
            };
        }

        const curveIndex = this.widgetTimelinePath.path.findIndex(
            pathCurve => pathCurve.keyframe == this.keyframe
        );

        if (curveIndex > 0) {
            this.keyframePrev =
                this.widgetTimelinePath.path[curveIndex - 1].keyframe;

            this.toPrevAtStart = {
                x: this.keyframePrev.left.value!,
                y: this.keyframePrev.top.value!
            };

            const controlPointsArray = this.keyframePrev.controlPointsArray;

            if (
                controlPointsArray.length == 2 ||
                controlPointsArray.length == 4
            ) {
                this.cp1PrevAtStart = {
                    x: controlPointsArray[0],
                    y: controlPointsArray[1]
                };
            }

            if (controlPointsArray.length == 4) {
                this.cp2PrevAtStart = {
                    x: controlPointsArray[2],
                    y: controlPointsArray[3]
                };
            }
        }

        if (curveIndex < this.widgetTimelinePath.path.length - 1) {
            this.keyframeNext =
                this.widgetTimelinePath.path[curveIndex + 1].keyframe;

            this.toNextAtStart = {
                x: this.keyframeNext.left.value!,
                y: this.keyframeNext.top.value!
            };

            const controlPointsArray = this.keyframeNext.controlPointsArray;

            if (
                controlPointsArray.length == 2 ||
                controlPointsArray.length == 4
            ) {
                this.cp1NextAtStart = {
                    x: controlPointsArray[0],
                    y: controlPointsArray[1]
                };
            }

            if (controlPointsArray.length == 4) {
                this.cp2NextAtStart = {
                    x: controlPointsArray[2],
                    y: controlPointsArray[3]
                };
            }
        }

        context.projectStore.undoManager.setCombineCommands(true);
    }

    move(context: IFlowContext, event: IPointerEvent) {
        super.move(context, event);

        let dx = Math.round(this.modelDistance.x);
        let dy = Math.round(this.modelDistance.y);

        if (this.handleId == "from") {
            this.snapLines.enabled =
                this.widgetTimelinePath.timelinePosition == this.keyframe.start;

            const { left, top } = this.snapLines.dragSnap(
                this.widgetRectAtStart.left + dx,
                this.widgetRectAtStart.top + dy,
                this.widgetRectAtStart.width,
                this.widgetRectAtStart.height
            );

            dx += left - (this.widgetRectAtStart.left + dx);
            dy += top - (this.widgetRectAtStart.top + dy);

            context.projectStore.updateObject(this.widgetTimelinePath.widget, {
                left: this.fromAtStart.x + dx,
                top: this.fromAtStart.y + dy
            });

            if (!event.shiftKey) {
                if (this.cp1AtStart && this.cp2AtStart) {
                    context.projectStore.updateObject(this.keyframe, {
                        controlPoints: `(${this.cp1AtStart.x + dx}, ${
                            this.cp1AtStart.y + dy
                        }) (${this.cp2AtStart.x}, ${this.cp2AtStart.y})`
                    });
                } else if (this.cp1AtStart) {
                    context.projectStore.updateObject(this.keyframe, {
                        controlPoints: `(${this.cp1AtStart.x + dx}, ${
                            this.cp1AtStart.y + dy
                        })`
                    });
                }
            }
        } else if (this.handleId == "to") {
            this.snapLines.enabled =
                this.widgetTimelinePath.timelinePosition == this.keyframe.end;

            const { left, top } = this.snapLines.dragSnap(
                this.widgetRectAtStart.left + dx,
                this.widgetRectAtStart.top + dy,
                this.widgetRectAtStart.width,
                this.widgetRectAtStart.height
            );

            dx += left - (this.widgetRectAtStart.left + dx);
            dy += top - (this.widgetRectAtStart.top + dy);

            context.projectStore.updateObject(this.keyframe, {
                left: Object.assign({}, this.keyframe.left, {
                    value: this.toAtStart.x + dx
                }),
                top: Object.assign({}, this.keyframe.top, {
                    value: this.toAtStart.y + dy
                })
            });

            if (!event.shiftKey) {
                if (this.cp1AtStart && this.cp2AtStart) {
                    context.projectStore.updateObject(this.keyframe, {
                        controlPoints: `(${this.cp1AtStart.x}, ${
                            this.cp1AtStart.y
                        }) (${this.cp2AtStart.x + dx}, ${
                            this.cp2AtStart.y + dy
                        })`
                    });
                }

                if (this.cp1NextAtStart && this.cp2NextAtStart) {
                    context.projectStore.updateObject(this.keyframeNext, {
                        controlPoints: `(${this.cp1NextAtStart.x + dx}, ${
                            this.cp1NextAtStart.y + dy
                        }) (${this.cp2NextAtStart.x}, ${this.cp2NextAtStart.y})`
                    });
                } else if (this.cp1NextAtStart) {
                    context.projectStore.updateObject(this.keyframeNext, {
                        controlPoints: `(${this.cp1NextAtStart.x + dx}, ${
                            this.cp1NextAtStart.y + dy
                        })`
                    });
                }
            }
        } else if (this.handleId == "cp1") {
            if (this.cp2AtStart) {
                context.projectStore.updateObject(this.keyframe, {
                    controlPoints: `(${this.cp1AtStart!.x + dx}, ${
                        this.cp1AtStart!.y + dy
                    }) (${this.cp2AtStart.x}, ${this.cp2AtStart.y})`
                });
            } else {
                context.projectStore.updateObject(this.keyframe, {
                    controlPoints: `(${this.cp1AtStart!.x + dx}, ${
                        this.cp1AtStart!.y + dy
                    })`
                });
            }

            if (!event.shiftKey) {
                if (this.cp2PrevAtStart) {
                    const p1 = {
                        x: this.cp1AtStart!.x + dx,
                        y: this.cp1AtStart!.y + dy
                    };
                    const p = this.toPrevAtStart!;
                    const p2 = this.cp2PrevAtStart;

                    const d1 = pointDistance(p, p1);
                    const d2 = pointDistance(p, p2);

                    const cp2Prev = {
                        x: p.x + (-(p1.x - p.x) / d1) * d2,
                        y: p.y + (-(p1.y - p.y) / d1) * d2
                    };

                    context.projectStore.updateObject(this.keyframePrev, {
                        controlPoints: `(${this.cp1PrevAtStart!.x}, ${
                            this.cp1PrevAtStart!.y
                        }) (${cp2Prev.x}, ${cp2Prev.y})`
                    });
                }
            }
        } else if (this.handleId == "cp2") {
            context.projectStore.updateObject(this.keyframe, {
                controlPoints: `(${this.cp1AtStart!.x}, ${
                    this.cp1AtStart!.y
                }) (${this.cp2AtStart!.x + dx}, ${this.cp2AtStart!.y + dy})`
            });

            if (!event.shiftKey) {
                if (this.cp1NextAtStart) {
                    const p1 = {
                        x: this.cp2AtStart!.x + dx,
                        y: this.cp2AtStart!.y + dy
                    };
                    const p = this.toAtStart!;
                    const p2 = this.cp1NextAtStart;

                    const d1 = pointDistance(p, p1);
                    const d2 = pointDistance(p, p2);

                    const cp1Next = {
                        x: p.x + (-(p1.x - p.x) / d1) * d2,
                        y: p.y + (-(p1.y - p.y) / d1) * d2
                    };

                    if (this.cp2NextAtStart) {
                        context.projectStore.updateObject(this.keyframeNext, {
                            controlPoints: `(${cp1Next.x}, ${cp1Next.y}) (${this.cp2NextAtStart.x}, ${this.cp2NextAtStart.y})`
                        });
                    } else {
                        context.projectStore.updateObject(this.keyframeNext, {
                            controlPoints: `(${cp1Next.x}, ${cp1Next.y})`
                        });
                    }
                }
            }
        }
    }

    up(context: IFlowContext, cancel: boolean) {
        super.up(context, cancel);
        context.projectStore.undoManager.setCombineCommands(false);
    }
}

////////////////////////////////////////////////////////////////////////////////

export const TimelinePathEditor = observer(
    ({ flowContext }: { flowContext: EditorFlowContext }) => {
        const timeline = flowContext.tabState.timeline;
        if (!timeline || !timeline.isEditorActive) {
            return null;
        }

        const widgets: Component[] = [];
        for (const component of visitObjects(flowContext.flow)) {
            if (component instanceof ProjectEditor.WidgetClass) {
                widgets.push(component);
            }
        }

        const widgetTimelinePaths = widgets
            .map(object =>
                object instanceof ProjectEditor.WidgetClass
                    ? new WidgetTimelinePath(object)
                    : undefined
            )
            .filter(
                widgetTimelinePath =>
                    widgetTimelinePath &&
                    widgetTimelinePath.path.length > 0 &&
                    !widgetTimelinePath.widget.hiddenInEditor
            ) as WidgetTimelinePath[];

        if (widgetTimelinePaths.length == 0) {
            return null;
        }

        return (
            <Svg flowContext={flowContext}>
                {widgetTimelinePaths.map(widgetTimelinePath => (
                    <Fragment key={widgetTimelinePath.widget.objID}>
                        <WidgetTimelinePathCurves
                            widgetTimelinePath={widgetTimelinePath}
                        ></WidgetTimelinePathCurves>
                        <WidgetTimelinePathHandles
                            widgetTimelinePath={widgetTimelinePath}
                        ></WidgetTimelinePathHandles>
                    </Fragment>
                ))}
            </Svg>
        );
    }
);

const WidgetTimelinePathCurves = observer(
    (props: { widgetTimelinePath: WidgetTimelinePath }) => {
        const CURVE_STROKE_WIDTH_SELECTED = 2;
        const CURVE_STROKE_WIDTH = 1;
        const CURVE_COLOR_SELECTED = "#337bb7";
        const CURVE_COLOR_WIDGET_SELECTED = addAlphaToColor(
            CURVE_COLOR_SELECTED,
            0.9
        );
        const CURVE_COLOR = addAlphaToColor(CURVE_COLOR_SELECTED, 0.3);

        const LINE_TO_CONTROL_POINT_STROKE_WIDTH = 0.5;
        const LINE_TO_CONTROL_POINT_COLOR_SELECTED = "#337bb7";
        const LINE_TO_CONTROL_POINT_COLOR = addAlphaToColor(
            LINE_TO_CONTROL_POINT_COLOR_SELECTED,
            0.5
        );

        return (
            <>
                {props.widgetTimelinePath.path.map(
                    ({ widgetSelected, selected, keyframe, curvePoints }) => {
                        if (curvePoints.length == 4) {
                            const [p1, p2, p3, p4] = curvePoints;

                            return (
                                <Fragment key={keyframe.objID}>
                                    <path
                                        d={`M ${p1.x} ${p1.y} C ${p2.x} ${p2.y} ${p3.x} ${p3.y} ${p4.x} ${p4.y}`}
                                        strokeWidth={
                                            selected
                                                ? CURVE_STROKE_WIDTH_SELECTED
                                                : CURVE_STROKE_WIDTH
                                        }
                                        stroke={
                                            selected
                                                ? CURVE_COLOR_SELECTED
                                                : widgetSelected
                                                ? CURVE_COLOR_WIDGET_SELECTED
                                                : CURVE_COLOR
                                        }
                                        fill="none"
                                        strokeLinecap="round"
                                        markerEnd="url(#timelineAnimationCurveEndMarker)"
                                    />
                                    <path
                                        d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                                        strokeWidth={
                                            LINE_TO_CONTROL_POINT_STROKE_WIDTH
                                        }
                                        stroke={
                                            selected
                                                ? LINE_TO_CONTROL_POINT_COLOR_SELECTED
                                                : LINE_TO_CONTROL_POINT_COLOR
                                        }
                                        fill="none"
                                    />
                                    <path
                                        d={`M ${p4.x} ${p4.y} L ${p3.x} ${p3.y}`}
                                        strokeWidth={
                                            LINE_TO_CONTROL_POINT_STROKE_WIDTH
                                        }
                                        stroke={
                                            selected
                                                ? LINE_TO_CONTROL_POINT_COLOR_SELECTED
                                                : LINE_TO_CONTROL_POINT_COLOR
                                        }
                                        fill="none"
                                    />
                                </Fragment>
                            );
                        } else if (curvePoints.length == 3) {
                            const [p1, p2, p3] = curvePoints;

                            return (
                                <Fragment key={keyframe.objID}>
                                    <path
                                        d={`M ${p1.x} ${p1.y} Q ${p2.x} ${p2.y} ${p3.x} ${p3.y}`}
                                        strokeWidth={
                                            selected
                                                ? CURVE_STROKE_WIDTH_SELECTED
                                                : CURVE_STROKE_WIDTH
                                        }
                                        stroke={
                                            selected
                                                ? CURVE_COLOR_SELECTED
                                                : widgetSelected
                                                ? CURVE_COLOR_WIDGET_SELECTED
                                                : CURVE_COLOR
                                        }
                                        fill="none"
                                        strokeLinecap="round"
                                        markerEnd="url(#timelineAnimationCurveEndMarker)"
                                    />
                                    <path
                                        d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                                        strokeWidth={
                                            LINE_TO_CONTROL_POINT_STROKE_WIDTH
                                        }
                                        stroke={
                                            selected
                                                ? LINE_TO_CONTROL_POINT_COLOR_SELECTED
                                                : LINE_TO_CONTROL_POINT_COLOR
                                        }
                                        fill="none"
                                    />
                                </Fragment>
                            );
                        } else {
                            const [p1, p2] = curvePoints;
                            return (
                                <Fragment key={keyframe.objID}>
                                    <path
                                        d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
                                        strokeWidth={
                                            selected
                                                ? CURVE_STROKE_WIDTH_SELECTED
                                                : CURVE_STROKE_WIDTH
                                        }
                                        stroke={
                                            selected
                                                ? CURVE_COLOR_SELECTED
                                                : widgetSelected
                                                ? CURVE_COLOR_WIDGET_SELECTED
                                                : CURVE_COLOR
                                        }
                                        fill="none"
                                        strokeLinecap="round"
                                        markerEnd="url(#timelineAnimationCurveEndMarker)"
                                    />
                                </Fragment>
                            );
                        }
                    }
                )}
            </>
        );
    }
);

const WidgetTimelinePathHandles = observer(
    (props: { widgetTimelinePath: WidgetTimelinePath }) => {
        const CONTROL_POINT_HANDLE_STROKE_COLOR = "#337bb7";
        const CONTROL_POINT_HANDLE_STROKE_WIDTH = 1.5;
        const CONTROL_POINT_HANDLE_FILL_COLOR = "white";
        const CONTROL_POINT_HANDLE_FILL_COLOR_SELECTED = "#337bb7";
        const CONTROL_POINT_RADIUS = 5;

        const FROM_POINT_HANDLE_STROKE_WIDTH = 1.5;
        const FROM_POINT_HANDLE_STROKE_COLOR = "#d0d0d0";
        const FROM_POINT_HANDLE_FILL_COLOR = "white";
        const FROM_POINT_RADIUS = 5;

        const TO_POINT_HANDLE_STROKE_WIDTH = 1.5;
        const TO_POINT_HANDLE_STROKE_COLOR = "#ff8c00";
        const TO_POINT_HANDLE_FILL_COLOR = "white";
        const TO_POINT_HANDLE_FILL_COLOR_SELECTED = "#ff8c00";
        const TO_POINT_RADIUS = 5;

        return (
            <>
                {props.widgetTimelinePath.path.map(
                    ({
                        keyframe,
                        curvePoints,
                        editorHandleProps,
                        selected
                    }) => {
                        if (curvePoints.length == 4) {
                            const [p1, p2, p3, p4] = curvePoints;
                            const R = CONTROL_POINT_RADIUS;
                            return (
                                <Fragment key={keyframe.objID}>
                                    {editorHandleProps.from && (
                                        <circle
                                            cx={p1.x}
                                            cy={p1.y}
                                            r={FROM_POINT_RADIUS}
                                            stroke={
                                                FROM_POINT_HANDLE_STROKE_COLOR
                                            }
                                            strokeWidth={
                                                FROM_POINT_HANDLE_STROKE_WIDTH
                                            }
                                            fill={FROM_POINT_HANDLE_FILL_COLOR}
                                            style={{ cursor: "grab" }}
                                            {...editorHandleProps.from}
                                        />
                                    )}
                                    <circle
                                        cx={p4.x}
                                        cy={p4.y}
                                        r={TO_POINT_RADIUS}
                                        stroke={TO_POINT_HANDLE_STROKE_COLOR}
                                        strokeWidth={
                                            TO_POINT_HANDLE_STROKE_WIDTH
                                        }
                                        fill={
                                            selected
                                                ? TO_POINT_HANDLE_FILL_COLOR_SELECTED
                                                : TO_POINT_HANDLE_FILL_COLOR
                                        }
                                        style={{ cursor: "grab" }}
                                        {...editorHandleProps.to}
                                    />
                                    <path
                                        d={`M ${p2.x} ${
                                            p2.y - 5
                                        } l ${R} ${R} l -${R} 5 l -${R} -${R} Z`}
                                        stroke={
                                            CONTROL_POINT_HANDLE_STROKE_COLOR
                                        }
                                        strokeWidth={
                                            CONTROL_POINT_HANDLE_STROKE_WIDTH
                                        }
                                        fill={
                                            selected
                                                ? CONTROL_POINT_HANDLE_FILL_COLOR_SELECTED
                                                : CONTROL_POINT_HANDLE_FILL_COLOR
                                        }
                                        style={{ cursor: "grab" }}
                                        {...editorHandleProps.cp1}
                                    />
                                    <path
                                        d={`M ${p3.x} ${
                                            p3.y - 5
                                        } l ${R} ${R} l -${R} 5 l -${R} -${R} Z`}
                                        stroke={
                                            CONTROL_POINT_HANDLE_STROKE_COLOR
                                        }
                                        strokeWidth={
                                            CONTROL_POINT_HANDLE_STROKE_WIDTH
                                        }
                                        fill={
                                            selected
                                                ? CONTROL_POINT_HANDLE_FILL_COLOR_SELECTED
                                                : CONTROL_POINT_HANDLE_FILL_COLOR
                                        }
                                        style={{ cursor: "grab" }}
                                        {...editorHandleProps.cp2}
                                    />
                                </Fragment>
                            );
                        } else if (curvePoints.length == 3) {
                            const [p1, p2, p3] = curvePoints;
                            const R = CONTROL_POINT_RADIUS;
                            return (
                                <Fragment key={keyframe.objID}>
                                    {editorHandleProps.from && (
                                        <circle
                                            cx={p1.x}
                                            cy={p1.y}
                                            r={FROM_POINT_RADIUS}
                                            stroke={
                                                FROM_POINT_HANDLE_STROKE_COLOR
                                            }
                                            strokeWidth={
                                                FROM_POINT_HANDLE_STROKE_WIDTH
                                            }
                                            fill={FROM_POINT_HANDLE_FILL_COLOR}
                                            style={{ cursor: "grab" }}
                                            {...editorHandleProps.from}
                                        />
                                    )}
                                    <circle
                                        cx={p3.x}
                                        cy={p3.y}
                                        r={TO_POINT_RADIUS}
                                        stroke={TO_POINT_HANDLE_STROKE_COLOR}
                                        strokeWidth={
                                            TO_POINT_HANDLE_STROKE_WIDTH
                                        }
                                        fill={
                                            selected
                                                ? TO_POINT_HANDLE_FILL_COLOR_SELECTED
                                                : TO_POINT_HANDLE_FILL_COLOR
                                        }
                                        style={{ cursor: "grab" }}
                                        {...editorHandleProps.to}
                                    />
                                    <path
                                        d={`M ${p2.x} ${
                                            p2.y - 5
                                        } l ${R} ${R} l -${R} 5 l -${R} -${R} Z`}
                                        stroke={
                                            CONTROL_POINT_HANDLE_STROKE_COLOR
                                        }
                                        strokeWidth={
                                            CONTROL_POINT_HANDLE_STROKE_WIDTH
                                        }
                                        fill={
                                            selected
                                                ? CONTROL_POINT_HANDLE_FILL_COLOR_SELECTED
                                                : CONTROL_POINT_HANDLE_FILL_COLOR
                                        }
                                        style={{ cursor: "grab" }}
                                        {...editorHandleProps.cp1}
                                    />
                                </Fragment>
                            );
                        } else {
                            const [p1, p2] = curvePoints;
                            return (
                                <Fragment key={keyframe.objID}>
                                    {editorHandleProps.from && (
                                        <circle
                                            cx={p1.x}
                                            cy={p1.y}
                                            r={FROM_POINT_RADIUS}
                                            stroke={
                                                FROM_POINT_HANDLE_STROKE_COLOR
                                            }
                                            strokeWidth={
                                                FROM_POINT_HANDLE_STROKE_WIDTH
                                            }
                                            fill={FROM_POINT_HANDLE_FILL_COLOR}
                                            style={{ cursor: "grab" }}
                                            {...editorHandleProps.from}
                                        />
                                    )}
                                    <circle
                                        cx={p2.x}
                                        cy={p2.y}
                                        r={TO_POINT_RADIUS}
                                        stroke={TO_POINT_HANDLE_STROKE_COLOR}
                                        strokeWidth={
                                            TO_POINT_HANDLE_STROKE_WIDTH
                                        }
                                        fill={
                                            selected
                                                ? TO_POINT_HANDLE_FILL_COLOR_SELECTED
                                                : TO_POINT_HANDLE_FILL_COLOR
                                        }
                                        style={{ cursor: "grab" }}
                                        {...editorHandleProps.to}
                                    />
                                </Fragment>
                            );
                        }
                    }
                )}
            </>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

export function getEasingFunctionCode(easingFunction: EasingFunction) {
    const EASING_FUNC_LINEAR = 0;
    const EASING_FUNC_IN_QUAD = 1;
    const EASING_FUNC_OUT_QUAD = 2;
    const EASING_FUNC_IN_OUT_QUAD = 3;
    const EASING_FUNC_IN_CUBIC = 4;
    const EASING_FUNC_OUT_CUBIC = 5;
    const EASING_FUNC_IN_OUT_CUBIC = 6;
    const EASING_FUNC_IN__QUART = 7;
    const EASING_FUNC_OUT_QUART = 8;
    const EASING_FUNC_IN_OUT_QUART = 9;
    const EASING_FUNC_IN_QUINT = 10;
    const EASING_FUNC_OUT_QUINT = 11;
    const EASING_FUNC_IN_OUT_QUINT = 12;
    const EASING_FUNC_IN_SINE = 13;
    const EASING_FUNC_OUT_SINE = 14;
    const EASING_FUNC_IN_OUT_SINE = 15;
    const EASING_FUNC_IN_EXPO = 16;
    const EASING_FUNC_OUT_EXPO = 17;
    const EASING_FUNC_IN_OUT_EXPO = 18;
    const EASING_FUNC_IN_CIRC = 19;
    const EASING_FUNC_OUT_CIRC = 20;
    const EASING_FUNC_IN_OUT_CIRC = 21;
    const EASING_FUNC_IN_BACK = 22;
    const EASING_FUNC_OUT_BACK = 23;
    const EASING_FUNC_IN_OUT_BACK = 24;
    const EASING_FUNC_IN_ELASTIC = 25;
    const EASING_FUNC_OUT_ELASTIC = 26;
    const EASING_FUNC_IN_OUT_ELASTIC = 27;
    const EASING_FUNC_IN_BOUNCE = 28;
    const EASING_FUNC_OUT_BOUNCE = 29;
    const EASING_FUNC_IN_OUT_BOUNCE = 30;

    const toCode = {
        linear: EASING_FUNC_LINEAR,
        easeInQuad: EASING_FUNC_IN_QUAD,
        easeOutQuad: EASING_FUNC_OUT_QUAD,
        easeInOutQuad: EASING_FUNC_IN_OUT_QUAD,
        easeInCubic: EASING_FUNC_IN_CUBIC,
        easeOutCubic: EASING_FUNC_OUT_CUBIC,
        easeInOutCubic: EASING_FUNC_IN_OUT_CUBIC,
        easeInQuart: EASING_FUNC_IN__QUART,
        easeOutQuart: EASING_FUNC_OUT_QUART,
        easeInOutQuart: EASING_FUNC_IN_OUT_QUART,
        easeInQuint: EASING_FUNC_IN_QUINT,
        easeOutQuint: EASING_FUNC_OUT_QUINT,
        easeInOutQuint: EASING_FUNC_IN_OUT_QUINT,
        easeInSine: EASING_FUNC_IN_SINE,
        easeOutSine: EASING_FUNC_OUT_SINE,
        easeInOutSine: EASING_FUNC_IN_OUT_SINE,
        easeInExpo: EASING_FUNC_IN_EXPO,
        easeOutExpo: EASING_FUNC_OUT_EXPO,
        easeInOutExpo: EASING_FUNC_IN_OUT_EXPO,
        easeInCirc: EASING_FUNC_IN_CIRC,
        easeOutCirc: EASING_FUNC_OUT_CIRC,
        easeInOutCirc: EASING_FUNC_IN_OUT_CIRC,
        easeInBack: EASING_FUNC_IN_BACK,
        easeOutBack: EASING_FUNC_OUT_BACK,
        easeInOutBack: EASING_FUNC_IN_OUT_BACK,
        easeInElastic: EASING_FUNC_IN_ELASTIC,
        easeOutElastic: EASING_FUNC_OUT_ELASTIC,
        easeInOutElastic: EASING_FUNC_IN_OUT_ELASTIC,
        easeInBounce: EASING_FUNC_IN_BOUNCE,
        easeOutBounce: EASING_FUNC_OUT_BOUNCE,
        easeInOutBounce: EASING_FUNC_IN_OUT_BOUNCE
    };

    return toCode[easingFunction] ?? EASING_FUNC_LINEAR;
}

export function getTimelineEditorState(component: Component) {
    if (component instanceof ProjectEditor.WidgetClass) {
        const projectStore = getProjectStore(component);
        const editor = projectStore.editorsStore.activeEditor;
        if (editor) {
            if (editor.object instanceof ProjectEditor.PageClass) {
                const pageTabState = editor.state as PageTabState;
                if (pageTabState.timeline.isEditorActive) {
                    return pageTabState.timeline;
                }
            }
        }
    }
    return undefined;
}

export function isTimelineEditorActive(component: Component) {
    return getTimelineEditorState(component) != undefined;
}

export function isTimelineEditorActiveOrActionComponent(component: Component) {
    return (
        getTimelineEditorState(component) != undefined ||
        component instanceof ProjectEditor.ActionComponentClass
    );
}

export function setWidgetRectInTimelineEditor(
    widget: Widget,
    value: Partial<Rect>
) {
    const projectStore = getProjectStore(widget);
    const timelineEditorState = getTimelineEditorState(widget)!;
    const time = timelineEditorState.position;

    const props: Partial<Rect> = {};

    props.left = value.left ?? widget.rect.left;
    props.top = value.top ?? widget.rect.top;
    if (!(widget.autoSize == "width" || widget.autoSize == "both")) {
        props.width = value.width ?? widget.rect.width;
    }
    if (!(widget.autoSize == "height" || widget.autoSize == "both")) {
        props.height = value.height ?? widget.rect.height;
    }

    const newKeyframe = createObject<TimelineKeyframe>(
        projectStore,
        {},
        TimelineKeyframe
    );

    newKeyframe.start = time;
    newKeyframe.end = time;

    newKeyframe.left = {
        enabled: true,
        value: props.left,
        easingFunction: "linear"
    };

    newKeyframe.top = {
        enabled: true,
        value: props.top,
        easingFunction: "linear"
    };

    newKeyframe.width = {
        enabled: props.width != undefined,
        value: props.width,
        easingFunction: "linear"
    };

    newKeyframe.height = {
        enabled: props.height != undefined,
        value: props.height,
        easingFunction: "linear"
    };

    newKeyframe.scaleX = {
        enabled: false,
        value: undefined,
        easingFunction: "linear"
    };
    newKeyframe.scaleY = {
        enabled: false,
        value: undefined,
        easingFunction: "linear"
    };
    newKeyframe.rotate = {
        enabled: false,
        value: undefined,
        easingFunction: "linear"
    };
    newKeyframe.opacity = {
        enabled: false,
        value: undefined,
        easingFunction: "linear"
    };

    for (let i = 0; i < widget.timeline.length; i++) {
        const keyframe = widget.timeline[i];

        if (time == keyframe.end) {
            const changes: {
                [key: string]: TimelineKeyframePropertyValue<number>;
            } = {};

            if (
                keyframe.left.enabled ||
                newKeyframe.left.value != widget.left
            ) {
                changes.left = {
                    enabled: true,
                    value: newKeyframe.left.value,
                    easingFunction: keyframe.left.enabled
                        ? keyframe.left.easingFunction
                        : "linear"
                };
            }

            if (keyframe.top.enabled || newKeyframe.top.value != widget.top) {
                changes.top = {
                    enabled: true,
                    value: newKeyframe.top.value,
                    easingFunction: keyframe.top.enabled
                        ? keyframe.top.easingFunction
                        : "linear"
                };
            }

            if (
                keyframe.width.enabled ||
                newKeyframe.width.value != widget.width
            ) {
                changes.width = {
                    enabled: newKeyframe.width.enabled,
                    value: newKeyframe.width.value,
                    easingFunction: keyframe.width.enabled
                        ? keyframe.width.easingFunction
                        : "linear"
                };
            }

            if (
                keyframe.height.enabled ||
                newKeyframe.height.value != widget.height
            ) {
                changes.height = {
                    enabled: newKeyframe.height.enabled,
                    value: newKeyframe.height.value,
                    easingFunction: keyframe.height.enabled
                        ? keyframe.height.easingFunction
                        : "linear"
                };
            }

            projectStore.updateObject(keyframe, changes);

            return;
        }

        if (time > keyframe.start && time < keyframe.end) {
            newKeyframe.start = keyframe.start;

            newKeyframe.left.easingFunction = keyframe.left.enabled
                ? keyframe.left.easingFunction
                : "linear";
            newKeyframe.top.easingFunction = keyframe.top.enabled
                ? keyframe.top.easingFunction
                : "linear";
            newKeyframe.width.easingFunction = keyframe.width.enabled
                ? keyframe.width.easingFunction
                : "linear";
            newKeyframe.height.easingFunction = keyframe.height.enabled
                ? keyframe.height.easingFunction
                : "linear";

            newKeyframe.scaleX = Object.assign({}, keyframe.scaleX);
            newKeyframe.scaleY = Object.assign({}, keyframe.scaleY);
            newKeyframe.rotate = Object.assign({}, keyframe.rotate);
            newKeyframe.opacity = Object.assign({}, keyframe.opacity);

            const combineCommands = projectStore.undoManager.combineCommands;

            if (!combineCommands) {
                projectStore.undoManager.setCombineCommands(true);
            }

            projectStore.updateObject(keyframe, {
                start: time
            });

            projectStore.insertObjectBefore(keyframe, newKeyframe);

            if (!combineCommands) {
                projectStore.undoManager.setCombineCommands(false);
            }

            return;
        }

        if (time <= keyframe.start) {
            projectStore.insertObjectBefore(keyframe, newKeyframe);

            return;
        }
    }

    projectStore.addObject(widget.timeline, newKeyframe);

    return;
}

export function getTimelineRect(
    widget: Widget,
    timelinePosition: number
): Rect {
    const project = ProjectEditor.getProject(widget);

    const roundValues =
        project.projectTypeTraits.isFirmware &&
        project.projectTypeTraits.hasFlowSupport;

    let left = widget.left;
    let top = widget.top;
    let width = widget.width ?? 0;
    let height = widget.height ?? 0;

    for (const keyframe of widget.timeline) {
        if (timelinePosition < keyframe.start) {
            continue;
        }

        if (
            timelinePosition >= keyframe.start &&
            timelinePosition <= keyframe.end
        ) {
            const controlPoints = keyframe.controlPointsArray;

            const t =
                keyframe.start == keyframe.end
                    ? 1
                    : (timelinePosition - keyframe.start) /
                      (keyframe.end - keyframe.start);

            if (keyframe.left.enabled) {
                const t2 = easingFunctions[keyframe.left.easingFunction](t);

                if (controlPoints.length == 4) {
                    const p1 = left;
                    const p2 = controlPoints[0];
                    const p3 = controlPoints[2];
                    const p4 = keyframe.left.value!;
                    left =
                        (1 - t2) * (1 - t2) * (1 - t2) * p1 +
                        3 * (1 - t2) * (1 - t2) * t2 * p2 +
                        3 * (1 - t2) * t2 * t2 * p3 +
                        t2 * t2 * t2 * p4;
                } else if (controlPoints.length == 2) {
                    const p1 = left;
                    const p2 = controlPoints[0];
                    const p3 = keyframe.left.value!;
                    left =
                        (1 - t2) * (1 - t2) * p1 +
                        2 * (1 - t2) * t2 * p2 +
                        t2 * t2 * p3;
                } else {
                    const p1 = left;
                    const p2 = keyframe.left.value!;
                    left = (1 - t2) * p1 + t2 * p2;
                }

                if (roundValues) {
                    left = Math.floor(left);
                }
            }

            if (keyframe.width.enabled) {
                width +=
                    easingFunctions[keyframe.width.easingFunction](t) *
                    (keyframe.width.value! - width);

                if (roundValues) {
                    width = Math.floor(width);
                }
            }

            if (keyframe.top.enabled) {
                const t2 = easingFunctions[keyframe.top.easingFunction](t);

                if (controlPoints.length == 4) {
                    const p1 = top;
                    const p2 = controlPoints[1];
                    const p3 = controlPoints[3];
                    const p4 = keyframe.top.value!;
                    top =
                        (1 - t2) * (1 - t2) * (1 - t2) * p1 +
                        3 * (1 - t2) * (1 - t2) * t2 * p2 +
                        3 * (1 - t2) * t2 * t2 * p3 +
                        t2 * t2 * t2 * p4;
                } else if (controlPoints.length == 2) {
                    const p1 = top;
                    const p2 = controlPoints[1];
                    const p3 = keyframe.top.value!;
                    top =
                        (1 - t2) * (1 - t2) * p1 +
                        2 * (1 - t2) * t2 * p2 +
                        t2 * t2 * p3;
                } else {
                    const p1 = top;
                    const p2 = keyframe.top.value!;
                    top = (1 - t2) * p1 + t2 * p2;
                }

                if (roundValues) {
                    top = Math.floor(top);
                }
            }

            if (keyframe.height.enabled) {
                height +=
                    easingFunctions[keyframe.height.easingFunction](t) *
                    (keyframe.height.value! - height);

                if (roundValues) {
                    height = Math.floor(height);
                }
            }

            break;
        }

        if (keyframe.left.enabled) {
            left = keyframe.left.value!;
        }
        if (keyframe.top.enabled) {
            top = keyframe.top.value!;
        }
        if (keyframe.width.enabled) {
            width = keyframe.width.value!;
        }
        if (keyframe.height.enabled) {
            height = keyframe.height.value!;
        }
    }

    return {
        left,
        top,
        width,
        height
    };
}

export function getTimelineProperty(
    widget: Widget,
    timelinePosition: number,
    propertyName: TimelineKeyframeProperty
) {
    let value: number;

    if (
        propertyName == "left" ||
        propertyName == "top" ||
        propertyName == "width" ||
        propertyName == "height"
    ) {
        value = widget[propertyName] ?? 0;
    } else {
        if (widget instanceof ProjectEditor.LVGLWidgetClass) {
            const page = getAncestorOfType(
                widget,
                ProjectEditor.PageClass.classInfo
            ) as Page;

            let stylePropertyInfo;

            if (propertyName == "scale") {
                stylePropertyInfo = transform_zoom_property_info;
            } else if (propertyName == "rotate") {
                stylePropertyInfo = transform_angle_property_info;
            } else {
                stylePropertyInfo = opa_property_info;
            }

            value = widget.localStyles.getPropertyValue(
                stylePropertyInfo,
                "MAIN",
                "DEFAULT"
            );
            if (value == undefined) {
                value = getStylePropDefaultValue(
                    page._lvglRuntime,
                    widget._lvglObj,
                    "MAIN",
                    "DEFAULT",
                    stylePropertyInfo
                ) as number;
            }

            if (propertyName == "opacity") {
                value /= 255;
            }
        } else {
            if (propertyName == "scaleX" || propertyName == "scaleY") {
                value = 1;
            } else if (propertyName == "rotate") {
                value = 0;
            } else {
                // propertyName == "opacity"
                value = 1;
            }
        }
    }

    for (const keyframe of widget.timeline) {
        if (timelinePosition < keyframe.start) {
            continue;
        }

        const keyframeValue = keyframe[propertyName];

        if (
            timelinePosition >= keyframe.start &&
            timelinePosition <= keyframe.end
        ) {
            if (keyframeValue.enabled) {
                const t =
                    keyframe.start == keyframe.end
                        ? 1
                        : (timelinePosition - keyframe.start) /
                          (keyframe.end - keyframe.start);

                value +=
                    easingFunctions[keyframeValue.easingFunction](t) *
                    (keyframeValue.value! - value);
            }

            break;
        }

        if (keyframeValue.enabled) {
            value = keyframeValue.value!;
        }
    }

    return value;
}

function getKeyframesValue<T>(
    keyframes: (TimelineKeyframe | undefined)[],
    get: (keyframe: TimelineKeyframe) => T | undefined
): T | undefined {
    let value: T | undefined;

    for (const keyframe of keyframes) {
        if (keyframe == undefined) {
            continue;
        }

        const keyframeValue = get(keyframe);

        if (value === undefined) {
            value = keyframeValue;
        } else {
            if (keyframeValue != value) {
                return undefined;
            }
        }
    }

    return value;
}

export function getKeyframesPropertyValue(
    keyframes: (TimelineKeyframe | undefined)[],
    propertyName: TimelineKeyframeProperty
) {
    return getKeyframesValue<number>(keyframes, keyframe => {
        const propertyValue = keyframe[propertyName];
        return propertyValue.enabled ? propertyValue.value : undefined;
    });
}

export function getKeyframesFromPropertyValue(
    keyframes: (TimelineKeyframe | undefined)[],
    propertyName: TimelineKeyframeProperty
) {
    return getKeyframesValue<number>(keyframes, keyframe => {
        const widget: Widget = getAncestorOfType(
            keyframe,
            ProjectEditor.WidgetClass.classInfo
        )!;

        let fromValue;

        const keyframeIndex = widget.timeline.indexOf(keyframe);
        if (keyframeIndex > 0) {
            fromValue = getTimelineProperty(
                widget,
                widget.timeline[keyframeIndex - 1].end,
                propertyName
            );
        } else {
            fromValue = getTimelineProperty(
                widget,
                keyframe.start - 1e-9,
                propertyName
            );
        }

        return Math.round(fromValue * 100) / 100;
    });
}

export function timelineStyleHook(
    widget: Widget,
    style: React.CSSProperties,
    flowContext: IFlowContext
) {
    if (flowContext.projectStore.projectTypeTraits.isLVGL) {
        return;
    }

    let timelinePosition: number | undefined;

    if (flowContext.flowState) {
        timelinePosition = flowContext.flowState.timelinePosition;
    } else {
        const editor = flowContext.projectStore.editorsStore.getEditorByObject(
            flowContext.document.flow.object
        );
        if (editor && editor.object instanceof ProjectEditor.PageClass) {
            const pageTabState = editor.state as PageTabState;
            if (pageTabState.timeline.isEditorActive) {
                timelinePosition = pageTabState.timeline.position;
            }
        }
    }

    if (timelinePosition != undefined) {
        let opacity = getTimelineProperty(widget, timelinePosition, "opacity");
        if (opacity != undefined) {
            style.opacity = opacity;
        }

        let transform: string | undefined;

        let scaleX = getTimelineProperty(widget, timelinePosition, "scaleX");
        let scaleY = getTimelineProperty(widget, timelinePosition, "scaleY");
        if (scaleX != undefined || scaleY != undefined) {
            transform =
                (transform ? transform + " " : "") +
                `scale(${scaleX ?? 1}, ${scaleY ?? 1})`;
        }

        let rotate = getTimelineProperty(widget, timelinePosition, "rotate");
        if (rotate != undefined) {
            if (transform == undefined) {
                transform = "";
            } else {
                transform += " ";
            }
            transform =
                (transform ? transform + " " : "") + `rotate(${rotate}deg)`;
        }

        style.transform = transform;
    }
}

export function lvglBuildPageTimeline(build: LVGLBuild, page: Page) {
    interface KeyframeProperty {
        name: keyof TimelineKeyframe;
        lvglName: string;
        lvglStylePropName: string;
        lvglFromValue?: (value: string) => string;
        lvglAnimStep?: (
            keyframe: TimelineKeyframe,
            defaultSourceCode: string
        ) => void;
        lvglToValue?: (value: string) => string;
    }

    const KEYFRAME_PROPERTIES: KeyframeProperty[] = [
        {
            name: "left",
            lvglName: "x",
            lvglStylePropName: "X",
            lvglAnimStep: (
                keyframe: TimelineKeyframe,
                defaultSourceCode: string
            ) => {
                build.line(`// x`);
                build.line("{");
                build.indent();

                build.line(
                    `float t2 = eez_${keyframe.left.easingFunction}(t);`
                );

                const controlPointsArray = keyframe.controlPointsArray;

                if (controlPointsArray.length == 4) {
                    build.line(
                        `x_value = (1 - t2) * (1 - t2) * (1 - t2) * x_value + 3 * (1 - t2) * (1 - t2) * t2 * ${
                            controlPointsArray[0]
                        } + 3 * (1 - t2) * t2 * t2 * ${
                            controlPointsArray[2]
                        } + t2 * t2 * t2 * ${keyframe.left.value!};`
                    );
                } else if (controlPointsArray.length == 2) {
                    build.line(
                        `x_value = (1 - t2) * (1 - t2) * x_value + 2 * (1 - t2) * t2 * ${
                            controlPointsArray[0]
                        } + t2 * t2 * ${keyframe.left.value!};`
                    );
                } else {
                    build.line(
                        `x_value = (1 - t2) * x_value + t2 * ${keyframe.left
                            .value!};`
                    );
                }

                build.unindent();
                build.line("}");
            }
        },
        {
            name: "top",
            lvglName: "y",
            lvglStylePropName: "Y",
            lvglAnimStep: (
                keyframe: TimelineKeyframe,
                defaultSourceCode: string
            ) => {
                build.line(`// y`);
                build.line("{");
                build.indent();

                build.line(`float t2 = eez_${keyframe.top.easingFunction}(t);`);

                const controlPointsArray = keyframe.controlPointsArray;

                if (controlPointsArray.length == 4) {
                    build.line(
                        `y_value = (1 - t2) * (1 - t2) * (1 - t2) * y_value + 3 * (1 - t2) * (1 - t2) * t2 * ${
                            controlPointsArray[1]
                        } + 3 * (1 - t2) * t2 * t2 * ${
                            controlPointsArray[3]
                        } + t2 * t2 * t2 * ${keyframe.top.value!};`
                    );
                } else if (controlPointsArray.length == 2) {
                    build.line(
                        `y_value = (1 - t2) * (1 - t2) * y_value + 2 * (1 - t2) * t2 * ${
                            controlPointsArray[1]
                        } + t2 * t2 * ${keyframe.top.value!};`
                    );
                } else {
                    build.line(
                        `y_value = (1 - t2) * y_value + t2 * ${keyframe.top
                            .value!};`
                    );
                }

                build.unindent();
                build.line("}");
            }
        },
        {
            name: "width",
            lvglName: "width",
            lvglStylePropName: "WIDTH"
        },
        {
            name: "height",
            lvglName: "height",
            lvglStylePropName: "HEIGHT"
        },
        {
            name: "opacity",
            lvglName: "opacity",
            lvglStylePropName: "OPA",
            lvglFromValue: (value: string) => `${value} / 255.0f`,
            lvglToValue: (value: string) => `${value} * 255.0f`
        },
        {
            name: "scale",
            lvglName: "scale",
            lvglStylePropName:
                build.project.settings.general.lvglVersion == "9.0"
                    ? "TRANSFORM_SCALE_X"
                    : "TRANSFORM_ZOOM"
        },
        {
            name: "rotate",
            lvglName: "rotate",
            lvglStylePropName:
                build.project.settings.general.lvglVersion == "9.0"
                    ? "TRANSFORM_ROTATION"
                    : "TRANSFORM_ANGLE",
            lvglFromValue: (value: string) => value,
            lvglToValue: (value: string) => value
        }
    ];

    function getWidgetPropertyNamesInTimeline(lvglWidget: LVGLWidget) {
        const propertyNames = new Set<string>();
        if (lvglWidget.timeline.length > 0) {
            for (const keyframe of lvglWidget.timeline) {
                for (const keyframeProperty of KEYFRAME_PROPERTIES) {
                    if (
                        (
                            keyframe[
                                keyframeProperty.name
                            ] as TimelineKeyframePropertyValue<number>
                        ).enabled
                    ) {
                        propertyNames.add(keyframeProperty.lvglName);
                    }
                }
            }
        }
        return propertyNames;
    }

    function lvglFromValue(keyframeProperty: KeyframeProperty, value: string) {
        if (keyframeProperty.lvglFromValue) {
            return keyframeProperty.lvglFromValue(value);
        }
        return value;
    }

    function lvglAnimStep(
        keyframe: TimelineKeyframe,
        keyframeProperty: KeyframeProperty,
        defaultSourceCode: string
    ) {
        if (keyframeProperty.lvglAnimStep) {
            keyframeProperty.lvglAnimStep(keyframe, defaultSourceCode);
        } else {
            build.line(`// ${keyframeProperty.lvglName}`);
            build.line(defaultSourceCode);
        }
    }

    function lvglToValue(keyframeProperty: KeyframeProperty, value: string) {
        if (keyframeProperty.lvglToValue) {
            return keyframeProperty.lvglToValue(value);
        }
        return value;
    }

    const hasTimeline = page._lvglWidgets.find(
        lvglWidget => lvglWidget.timeline.length > 0
    );

    if (hasTimeline) {
        build.line(`{`);
        {
            build.indent();

            build.line(
                `float timeline_position = getTimelinePosition(flowState);`
            );

            //
            //
            build.line("");
            build.line(`static struct {`);
            {
                build.indent();
                build.line("float last_timeline_position;");

                for (const lvglWidget of page._lvglWidgets) {
                    for (const propertyName of getWidgetPropertyNamesInTimeline(
                        lvglWidget
                    )) {
                        build.line(
                            `int32_t obj_${build.getLvglObjectIdentifierInSourceCode(
                                lvglWidget
                            )}_${propertyName}_init_value;`
                        );
                    }
                }

                build.unindent();
            }
            build.line(`} anim_state = { -1 };`);

            //
            //
            build.line("");
            build.line(`if (anim_state.last_timeline_position == -1) {`);
            {
                build.indent();

                build.line(`anim_state.last_timeline_position = 0;`);

                for (const lvglWidget of page._lvglWidgets) {
                    for (const propertyName of getWidgetPropertyNamesInTimeline(
                        lvglWidget
                    )) {
                        const keyframeProperty = KEYFRAME_PROPERTIES.find(
                            keyframeProperty =>
                                keyframeProperty.lvglName == propertyName
                        )!;

                        build.line(
                            `anim_state.obj_${build.getLvglObjectIdentifierInSourceCode(
                                lvglWidget
                            )}_${propertyName}_init_value = ${lvglFromValue(
                                keyframeProperty,
                                `lv_obj_get_style_prop(${build.getLvglObjectAccessor(
                                    lvglWidget
                                )}, LV_PART_MAIN, LV_STYLE_${
                                    keyframeProperty.lvglStylePropName
                                }).num`
                            )};`
                        );
                    }
                }

                build.unindent();
            }
            build.line(`}`);

            //
            //
            build.line("");
            build.line(
                `if (timeline_position != anim_state.last_timeline_position) {`
            );
            {
                build.indent();

                build.line(
                    `anim_state.last_timeline_position = timeline_position;`
                );

                build.line("");

                for (const lvglWidget of page._lvglWidgets) {
                    if (lvglWidget.timeline.length > 0) {
                        build.line(`{`);
                        {
                            build.indent();
                            build.line(
                                `lv_obj_t *obj = ${build.getLvglObjectAccessor(
                                    lvglWidget
                                )};`
                            );

                            const propertyNames =
                                getWidgetPropertyNamesInTimeline(lvglWidget);

                            //
                            //
                            build.line("");
                            for (const propertyName of propertyNames) {
                                build.line(
                                    `float ${propertyName}_value = anim_state.obj_${build.getLvglObjectIdentifierInSourceCode(
                                        lvglWidget
                                    )}_${propertyName}_init_value;`
                                );
                            }

                            //
                            //
                            build.line("");
                            build.line("while (1) {");
                            {
                                build.indent();

                                //
                                //
                                for (
                                    let keyframeIndex = 0;
                                    keyframeIndex < lvglWidget.timeline.length;
                                    keyframeIndex++
                                ) {
                                    const keyframe =
                                        lvglWidget.timeline[keyframeIndex];

                                    build.line(
                                        `// keyframe #${keyframeIndex + 1}`
                                    );

                                    if (
                                        keyframeIndex == 0 ||
                                        lvglWidget.timeline[keyframeIndex - 1]
                                            .end < keyframe.start
                                    ) {
                                        build.line(
                                            `if (timeline_position < ${keyframe.start}) {`
                                        );
                                        {
                                            build.indent();
                                            build.line("break;");
                                            build.unindent();
                                            build.line("}");
                                        }
                                    }

                                    if (keyframe.start < keyframe.end) {
                                        build.line(
                                            `if (timeline_position >= ${keyframe.start} && timeline_position < ${keyframe.end}) {`
                                        );
                                        {
                                            build.indent();

                                            build.line(
                                                `float t = ${
                                                    keyframe.start ==
                                                    keyframe.end
                                                        ? "1"
                                                        : `(timeline_position - ${
                                                              keyframe.start
                                                          }) / ${
                                                              keyframe.end -
                                                              keyframe.start
                                                          }`
                                                };`
                                            );

                                            for (const keyframeProperty of KEYFRAME_PROPERTIES) {
                                                if (
                                                    (
                                                        keyframe[
                                                            keyframeProperty
                                                                .name
                                                        ] as TimelineKeyframePropertyValue<number>
                                                    ).enabled
                                                ) {
                                                    lvglAnimStep(
                                                        keyframe,
                                                        keyframeProperty,
                                                        `${
                                                            keyframeProperty.lvglName
                                                        }_value += eez_${
                                                            (
                                                                keyframe[
                                                                    keyframeProperty
                                                                        .name
                                                                ] as TimelineKeyframePropertyValue<number>
                                                            ).easingFunction
                                                        }(t) * (${
                                                            (
                                                                keyframe[
                                                                    keyframeProperty
                                                                        .name
                                                                ] as TimelineKeyframePropertyValue<number>
                                                            ).value
                                                        } - ${
                                                            keyframeProperty.lvglName
                                                        }_value);`
                                                    );
                                                }
                                            }

                                            build.line("break;");
                                            build.unindent();
                                        }
                                        build.line("}");
                                    }

                                    for (const keyframeProperty of KEYFRAME_PROPERTIES) {
                                        if (
                                            (
                                                keyframe[
                                                    keyframeProperty.name
                                                ] as TimelineKeyframePropertyValue<number>
                                            ).enabled
                                        ) {
                                            build.line(
                                                `${
                                                    keyframeProperty.lvglName
                                                }_value = ${
                                                    (
                                                        keyframe[
                                                            keyframeProperty
                                                                .name
                                                        ] as TimelineKeyframePropertyValue<number>
                                                    ).value
                                                };`
                                            );
                                        }
                                    }

                                    build.line("");
                                }

                                //
                                //
                                build.line("break;");
                                build.unindent();
                            }
                            build.line("}");

                            //
                            //
                            build.line("");
                            build.line("lv_style_value_t value;");

                            for (const propertyName of propertyNames) {
                                const keyframeProperty =
                                    KEYFRAME_PROPERTIES.find(
                                        keyframeProperty =>
                                            keyframeProperty.lvglName ==
                                            propertyName
                                    )!;
                                build.line("");
                                build.line(
                                    `value.num = (int32_t)roundf(${lvglToValue(
                                        keyframeProperty,
                                        `${keyframeProperty.lvglName}_value`
                                    )});`
                                );
                                build.line(
                                    `lv_obj_set_local_style_prop(obj, LV_STYLE_${keyframeProperty.lvglStylePropName}, value, LV_PART_MAIN);`
                                );

                                if (
                                    keyframeProperty.lvglStylePropName ==
                                    "TRANSFORM_SCALE_X"
                                ) {
                                    build.line(
                                        `lv_obj_set_local_style_prop(obj, LV_STYLE_TRANSFORM_SCALE_Y, value, LV_PART_MAIN);`
                                    );
                                }
                            }

                            build.unindent();
                        }
                        build.line(`}`);
                    }
                }

                build.unindent();
            }
            build.line(`}`);
            build.unindent();
        }
        build.line(`}`);
    }
}

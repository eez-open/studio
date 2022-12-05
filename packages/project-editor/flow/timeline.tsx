import React from "react";
import {
    observable,
    computed,
    makeObservable,
    action,
    runInAction
} from "mobx";

import { _each, _find, _range } from "eez-studio-shared/algorithm";
import {
    VALIDATION_MESSAGE_RANGE_INCLUSIVE,
    VALIDATION_MESSAGE_RANGE_INCLUSIVE_WITHOUT_MAX,
    VALIDATION_MESSAGE_REQUIRED
} from "eez-studio-shared/validation";
import { humanize } from "eez-studio-shared/string";
import { Icon } from "eez-studio-ui/icon";
import { Rect } from "eez-studio-shared/geometry";

import {
    EezObject,
    ClassInfo,
    PropertyType,
    PropertyProps,
    registerClass,
    getObjectPropertyDisplayName
} from "project-editor/core/object";
import {
    getAncestorOfType,
    updateObject,
    createObject,
    getProjectEditorStore
} from "project-editor/store";

import { ProjectEditor } from "project-editor/project-editor-interface";
import { observer } from "mobx-react";
import { ProjectContext } from "project-editor/project/context";
import { BootstrapButton } from "project-editor/ui-components/BootstrapButton";
import { easingFunctions } from "project-editor/flow/easing-functions";

import type { Component, Widget } from "project-editor/flow/component";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";

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
            opacity: observable
        });
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
                    var mexp = require("math-expression-evaluator");
                    const newValue = mexp.eval(this.value);
                    if (
                        newValue !== undefined &&
                        !isNaN(newValue) &&
                        newValue !== this.value
                    ) {
                        this.props.onChange(newValue);
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
                        this.context.insertObjectBefore(keyframe, newKeyframe);
                        return;
                    }

                    if (position < keyframe.end) {
                        newKeyframe.start = keyframe.start;

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
            let value: T | undefined;

            for (const keyframe of this.keyframes) {
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

        setValue<T>(
            propertyName: TimelineKeyframeProperty | "start" | "end",
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
            return this.getValue<number>(keyframe => {
                const propertyValue = keyframe[propertyName];
                return propertyValue.enabled ? propertyValue.value : undefined;
            });
        }

        getFromPropertyValue(propertyName: TimelineKeyframeProperty) {
            return this.getValue<number>(keyframe => {
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
                    <td style={{ paddingLeft: 20 }}>
                        {propertyEnabled &&
                            this.getFromPropertyValue(propertyName)}
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
                            <td style={{ paddingLeft: 20 }}>
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
                            <BootstrapButton
                                color="primary"
                                size="small"
                                onClick={this.onDeleteKeyframes}
                            >
                                {keyframes.length > 1
                                    ? "Delete Keyframes"
                                    : "Delete Keyframe"}
                            </BootstrapButton>
                        </div>
                    )}
                    {keyframes.length < this.keyframes.length && (
                        <div
                            style={{
                                marginBottom: 10
                            }}
                        >
                            <BootstrapButton
                                color="primary"
                                size="small"
                                onClick={this.onInsertKeyframes}
                            >
                                {this.keyframes.length > 1
                                    ? "Insert Keyframes"
                                    : "Insert Keyframe"}
                            </BootstrapButton>
                        </div>
                    )}
                </div>
            );
        }
    }
);

export function getTimelineEditorState(component: Component) {
    if (component instanceof ProjectEditor.WidgetClass) {
        const projectEditorStore = getProjectEditorStore(component);
        const editor = projectEditorStore.editorsStore.activeEditor;
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
    const projectEditorStore = getProjectEditorStore(widget);
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
        projectEditorStore,
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
            projectEditorStore.updateObject(keyframe, {
                left: {
                    enabled: true,
                    value: newKeyframe.left.value,
                    easingFunction: keyframe.left.enabled
                        ? keyframe.left.easingFunction
                        : "linear"
                },

                top: {
                    enabled: true,
                    value: newKeyframe.top.value,
                    easingFunction: keyframe.top.enabled
                        ? keyframe.top.easingFunction
                        : "linear"
                },

                width: {
                    enabled: newKeyframe.width.enabled,
                    value: newKeyframe.width.value,
                    easingFunction: keyframe.width.enabled
                        ? keyframe.width.easingFunction
                        : "linear"
                },

                height: {
                    enabled: newKeyframe.height.enabled,
                    value: newKeyframe.height.value,
                    easingFunction: keyframe.height.enabled
                        ? keyframe.height.easingFunction
                        : "linear"
                }
            });

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

            const combineCommands =
                projectEditorStore.undoManager.combineCommands;

            if (!combineCommands) {
                projectEditorStore.undoManager.setCombineCommands(true);
            }

            projectEditorStore.updateObject(keyframe, {
                start: time
            });

            projectEditorStore.insertObjectBefore(keyframe, newKeyframe);

            if (!combineCommands) {
                projectEditorStore.undoManager.setCombineCommands(false);
            }

            return;
        }

        if (time <= keyframe.start) {
            projectEditorStore.insertObjectBefore(keyframe, newKeyframe);

            return;
        }
    }

    projectEditorStore.addObject(widget.timeline, newKeyframe);

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

    if (!project.projectTypeTraits.isLVGL) {
        for (const keyframe of widget.timeline) {
            if (timelinePosition < keyframe.start) {
                continue;
            }

            if (
                timelinePosition >= keyframe.start &&
                timelinePosition <= keyframe.end
            ) {
                const t =
                    keyframe.start == keyframe.end
                        ? 1
                        : (timelinePosition - keyframe.start) /
                          (keyframe.end - keyframe.start);

                if (keyframe.left.enabled) {
                    const savedLeft = left;
                    left +=
                        easingFunctions[keyframe.left.easingFunction](t) *
                        (keyframe.left.value! - left);
                    if (roundValues) {
                        left = Math.floor(left);
                    }
                    if (keyframe.width.enabled) {
                        let right = savedLeft + width;
                        right +=
                            easingFunctions[keyframe.width.easingFunction](t) *
                            (keyframe.left.value! +
                                keyframe.width.value! -
                                right);
                        if (roundValues) {
                            right = Math.floor(right);
                        }
                        width = right - left;
                    }
                } else if (keyframe.width.enabled) {
                    width +=
                        easingFunctions[keyframe.width.easingFunction](t) *
                        (keyframe.width.value! - width);
                }

                if (keyframe.top.enabled) {
                    const savedTop = top;
                    top +=
                        easingFunctions[keyframe.top.easingFunction](t) *
                        (keyframe.top.value! - top);
                    if (roundValues) {
                        top = Math.floor(top);
                    }
                    if (keyframe.height.enabled) {
                        let bottom = savedTop + height;
                        bottom +=
                            easingFunctions[keyframe.height.easingFunction](t) *
                            (keyframe.top.value! +
                                keyframe.height.value! -
                                bottom);
                        if (roundValues) {
                            bottom = Math.floor(bottom);
                        }
                        height = bottom - top;
                    }
                } else if (keyframe.height.enabled) {
                    height +=
                        easingFunctions[keyframe.height.easingFunction](t) *
                        (keyframe.height.value! - height);
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
    } else if (propertyName == "scaleX" || propertyName == "scaleY") {
        value = 1;
    } else if (propertyName == "rotate") {
        value = 0;
    } else {
        // propertyName == "opacity"
        value = 1;
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

export function timelineStyleHook(
    widget: Widget,
    style: React.CSSProperties,
    flowContext: IFlowContext
) {
    if (flowContext.projectEditorStore.projectTypeTraits.isLVGL) {
        return;
    }

    let timelinePosition: number | undefined;

    if (flowContext.flowState) {
        timelinePosition = flowContext.flowState.timelinePosition;
    } else {
        const editor = flowContext.projectEditorStore.editorsStore.activeEditor;
        if (editor) {
            if (editor.object instanceof ProjectEditor.PageClass) {
                const pageTabState = editor.state as PageTabState;
                if (pageTabState.timeline.isEditorActive) {
                    timelinePosition = pageTabState.timeline.position;
                }
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

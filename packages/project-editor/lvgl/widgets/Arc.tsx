import React from "react";
import { observable, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { IMessage, MessageType, PropertyProps, PropertyType, makeDerivedClassInfo } from "project-editor/core/object";
import { getChildOfObject, Message } from "project-editor/store";

import { ProjectType } from "project-editor/project/project";

import { specificGroup } from "project-editor/ui-components/PropertyGrid/groups";

import { ARC_MODES } from "project-editor/lvgl/lvgl-constants";

import { LVGLWidget } from "./internal";
import {
    LVGLPropertyType,
    makeLvglExpressionProperty
} from "../expression-property";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";

////////////////////////////////////////////////////////////////////////////////

const ShowNoteAboutUseAngle = observer(
    class ShowNoteAboutUseAngle extends React.Component<PropertyProps> {
        render() {
            return (
                <div style={{ fontSize: 11 }}>
                    Make the arc non-adjustable: set the opacity (in Miscellaneous style section) of the knob to 0 and make the arc non-clickable (uncheck "Clickable" flag).
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class LVGLArcWidget extends LVGLWidget {
    useAngle: boolean;

    rangeMin: number | string;
    rangeMinType: LVGLPropertyType;

    rangeMax: number | string;
    rangeMaxType: LVGLPropertyType;

    value: number | string;
    valueType: LVGLPropertyType;
    previewValue: string;

    mode: keyof typeof ARC_MODES;

    startAngle: number | string;
    startAngleType: LVGLPropertyType;
    previewStartAngle: string;

    endAngle: number | string;
    endAngleType: LVGLPropertyType;
    previewEndAngle: string;

    bgStartAngle: number | string;
    bgStartAngleType: LVGLPropertyType;
    previewBgStartAngle: string;

    bgEndAngle: number | string;
    bgEndAngleType: LVGLPropertyType;
    previewBgEndAngle: string;

    rotation: number | string;
    rotationType: LVGLPropertyType;
    previewRotation: string;

    static classInfo = makeDerivedClassInfo(LVGLWidget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.LVGL,

        componentPaletteGroupName: "!1Basic",

        properties: [
            ...makeLvglExpressionProperty(
                "rangeMin",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLArcWidget) =>
                        widget.useAngle
                }
            ),
            ...makeLvglExpressionProperty(
                "rangeMax",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLArcWidget) =>
                        widget.useAngle
                }
            ),
            ...makeLvglExpressionProperty(
                "value",
                "integer",
                "assignable",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLArcWidget) =>
                        widget.useAngle
                }
            ),
            {
                name: "previewValue",
                type: PropertyType.String,
                disabled: (widget: LVGLArcWidget) => {
                    return widget.valueType == "literal";
                },
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLArcWidget) => widget.useAngle
            },
            {
                name: "mode",
                type: PropertyType.Enum,
                enumItems: Object.keys(ARC_MODES).map(id => ({
                    id,
                    label: id
                })),
                enumDisallowUndefined: true,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLArcWidget) => widget.useAngle
            },
            ...makeLvglExpressionProperty(
                "bgStartAngle",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "previewBgStartAngle",
                type: PropertyType.String,
                disabled: (widget: LVGLArcWidget) => {
                    return widget.bgStartAngleType == "literal";
                },
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "bgEndAngle",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "previewBgEndAngle",
                type: PropertyType.String,
                disabled: (widget: LVGLArcWidget) => {
                    return widget.bgEndAngleType == "literal";
                },
                propertyGridGroup: specificGroup
            },
            ...makeLvglExpressionProperty(
                "rotation",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup
                }
            ),
            {
                name: "previewRotation",
                type: PropertyType.String,
                disabled: (widget: LVGLArcWidget) => {
                    return widget.rotationType == "literal";
                },
                propertyGridGroup: specificGroup
            },
            {
                name: "useAngle",
                displayName: "Use start/end angle",
                type: PropertyType.Boolean,
                checkboxStyleSwitch: true,
                propertyGridGroup: specificGroup
            },
            {
                name: "showNoteAboutUseAngle",
                type: PropertyType.Any,
                computed: true,
                skipSearch: true,
                propertyGridFullRowComponent: ShowNoteAboutUseAngle,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLArcWidget) => !widget.useAngle
            },
            ...makeLvglExpressionProperty(
                "startAngle",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLArcWidget) =>
                        !widget.useAngle
                }
            ),
            {
                name: "previewStartAngle",
                type: PropertyType.String,
                disabled: (widget: LVGLArcWidget) => {
                    return widget.startAngleType == "literal";
                },
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLArcWidget) => !widget.useAngle
            },
            ...makeLvglExpressionProperty(
                "endAngle",
                "integer",
                "input",
                ["literal", "expression"],
                {
                    propertyGridGroup: specificGroup,
                    hideInPropertyGrid: (widget: LVGLArcWidget) =>
                        !widget.useAngle
                }
            ),
            {
                name: "previewEndAngle",
                type: PropertyType.String,
                disabled: (widget: LVGLArcWidget) => {
                    return widget.endAngleType == "literal";
                },
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (widget: LVGLArcWidget) => !widget.useAngle
            }
        ],

        defaultValue: {
            left: 0,
            top: 0,
            width: 150,
            height: 150,
            clickableFlag: true,

            useAngle: false,

            rangeMin: 0,
            rangeMinType: "literal",

            rangeMax: 100,
            rangeMaxType: "literal",

            value: 25,
            valueType: "literal",
            previewValue: "25",

            mode: "NORMAL",

            startAngle: 135,
            startAngleType: "literal",
            previewStartAngle: "135",

            endAngle: 45,
            endAngleType: "literal",
            previewEndAngle: "45",

            bgStartAngle: 135,
            bgStartAngleType: "literal",
            previewBgStartAngle: "135",

            bgEndAngle: 45,
            bgEndAngleType: "literal",
            previewBgEndAngle: "45",

            rotation: 0,
            rotationType: "literal",
            previewRotation: "0"
        },

        beforeLoadHook: (
            object: LVGLArcWidget,
            jsObject: Partial<LVGLArcWidget>
        ) => {
            if (jsObject.rangeMinType == undefined) {
                jsObject.rangeMinType = "literal";
            }

            if (jsObject.rangeMaxType == undefined) {
                jsObject.rangeMaxType = "literal";
            }

            if (jsObject.useAngle == undefined) {
                jsObject.useAngle = false;
            }

            if (jsObject.bgStartAngleType == undefined) {
                jsObject.bgStartAngleType = "literal";
            }

            if (jsObject.bgEndAngleType == undefined) {
                jsObject.bgEndAngleType = "literal";
            }

            if (jsObject.rotationType == undefined) {
                jsObject.rotationType = "literal";
            }
        },

        icon: (
            <svg
                viewBox="0 0 100 100"
                stroke="currentColor"
                fill="currentColor"
            >
                <path
                    transform="matrix(0.284019, 0.365203, -0.365202, 0.284019, 52.485165, -170.485977)"
                    d="M 428.885 388.909 A 98.905 98.905 0 1 1 449.648 246.739 L 429.979 262.257 A 73.851 73.851 0 1 0 414.475 368.413 Z"
                ></path>
                <path
                    d="M 65.922 86.406 C 58.202 78.686 58.202 66.17 65.922 58.449 C 73.642 50.73 86.158 50.73 93.878 58.449 C 101.598 66.17 101.598 78.686 93.878 86.406 C 86.158 94.125 73.642 94.125 65.922 86.406 Z M 86.957 79.485 C 90.855 75.585 90.855 69.268 86.957 65.37 C 83.06 61.471 76.74 61.471 72.843 65.37 C 68.945 69.268 68.945 75.585 72.843 79.485 C 76.74 83.382 83.06 83.382 86.957 79.485 Z"
                    style={{ strokeWidth: 1.98 }}
                    transform="matrix(0.613904, 0.789381, -0.789381, 0.613904, 88.021956, -35.107547)"
                ></path>
            </svg>
        ),

        check: (widget: LVGLArcWidget, messages: IMessage[]) => {
            if (widget.rangeMinType == "literal") {
                if (
                    widget.rangeMin == undefined ||
                    widget.rangeMin == null ||
                    !Number.isInteger(Number(widget.rangeMin))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Range min must be an integer`,
                            getChildOfObject(widget, "rangeMin")
                        )
                    );
                }
            }

            if (widget.rangeMaxType == "literal") {
                if (
                    widget.rangeMax == undefined ||
                    widget.rangeMax == null ||
                    !Number.isInteger(Number(widget.rangeMax))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Range max must be an integer`,
                            getChildOfObject(widget, "rangeMax")
                        )
                    );
                }
            }

            if (widget.valueType == "literal") {
                if (
                    widget.value == undefined ||
                    widget.value == null ||
                    !Number.isInteger(Number(widget.value))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Value must be an integer`,
                            getChildOfObject(widget, "value")
                        )
                    );
                }
            }

            if (widget.bgStartAngleType == "literal") {
                if (
                    widget.bgStartAngle == undefined ||
                    widget.bgStartAngle == null ||
                    !Number.isInteger(Number(widget.bgStartAngle))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Bg start angle must be an integer`,
                            getChildOfObject(widget, "bgStartAngle")
                        )
                    );
                }
            }

            if (widget.bgEndAngleType == "literal") {
                if (
                    widget.bgEndAngle == undefined ||
                    widget.bgEndAngle == null ||
                    !Number.isInteger(Number(widget.bgEndAngle))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Bg end angle must be an integer`,
                            getChildOfObject(widget, "bgEndAngle")
                        )
                    );
                }
            }

            if (widget.rotationType == "literal") {
                if (
                    widget.rotation == undefined ||
                    widget.rotation == null ||
                    !Number.isInteger(Number(widget.rotation))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Rotation must be an integer`,
                            getChildOfObject(widget, "rotation")
                        )
                    );
                }
            }

            if (widget.startAngleType == "literal") {
                if (
                    widget.startAngle == undefined ||
                    widget.startAngle == null ||
                    !Number.isInteger(Number(widget.startAngle))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `Start angle must be an integer`,
                            getChildOfObject(widget, "startAngle")
                        )
                    );
                }
            }

            if (widget.endAngleType == "literal") {
                if (
                    widget.endAngle == undefined ||
                    widget.endAngle == null ||
                    !Number.isInteger(Number(widget.endAngle))
                ) {
                    messages.push(
                        new Message(
                            MessageType.ERROR,
                            `End angle must be an integer`,
                            getChildOfObject(widget, "endAngle")
                        )
                    );
                }
            }
        },

        lvgl: {
            parts: ["MAIN", "INDICATOR", "KNOB"],
            defaultFlags:
                "CLICKABLE|CLICK_FOCUSABLE|GESTURE_BUBBLE|PRESS_LOCK|SCROLL_ELASTIC|SCROLL_MOMENTUM|SCROLL_WITH_ARROW|SNAPPABLE",

            oldInitFlags: "PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE",
            oldDefaultFlags:
                "CLICKABLE|PRESS_LOCK|CLICK_FOCUSABLE|GESTURE_BUBBLE|SNAPPABLE"
        }
    });

    override makeEditable() {
        super.makeEditable();

        makeObservable(this, {
            useAngle: observable,
            rangeMin: observable,
            rangeMinType: observable,
            rangeMax: observable,
            rangeMaxType: observable,
            value: observable,
            valueType: observable,
            previewValue: observable,
            mode: observable,
            startAngle: observable,
            startAngleType: observable,
            previewStartAngle: observable,
            endAngle: observable,
            endAngleType: observable,
            previewEndAngle: observable,
            bgStartAngle: observable,
            bgStartAngleType: observable,
            previewBgStartAngle: observable,
            bgEndAngle: observable,
            bgEndAngleType: observable,
            previewBgEndAngle: observable,
            rotation: observable,
            rotationType: observable,
            previewRotation: observable
        });
    }

    override toLVGLCode(code: LVGLCode) {
        code.createObject("lv_arc_create");

        if (!this.useAngle) {
            if (
                this.rangeMinType == "literal" &&
                this.rangeMaxType == "literal"
            ) {
                if (this.rangeMin != 0 || this.rangeMax != 100) {
                    code.callObjectFunction(
                        "lv_arc_set_range",
                        this.rangeMin,
                        this.rangeMax
                    );
                }
            } else if (this.rangeMinType == "literal") {
                code.callObjectFunction("lv_arc_set_range", this.rangeMin, 100);
            } else if (this.rangeMaxType == "literal") {
                code.callObjectFunction("lv_arc_set_range", 0, this.rangeMax);
            }

            if (this.rangeMinType == "expression") {
                code.addToTick("rangeMin", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.rangeMin as string,
                        "Failed to evaluate Range min in Arc widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_arc_get_min_value"
                    );

                    code.ifNotEqual(new_val, cur_val, () => {
                        const min = code.assign("int16_t", "min", new_val);

                        const max = code.callObjectFunctionWithAssignment(
                            "int16_t",
                            "max",
                            "lv_arc_get_max_value"
                        );

                        code.ifLess(min, max, () => {
                            code.callObjectFunction(
                                "lv_arc_set_range",
                                min,
                                max
                            );
                        });
                    });
                });
            }

            if (this.rangeMaxType == "expression") {
                code.addToTick("rangeMax", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.rangeMax as string,
                        "Failed to evaluate Range max in Arc widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_arc_get_max_value"
                    );

                    code.ifNotEqual(new_val, cur_val, () => {
                        const min = code.callObjectFunctionWithAssignment(
                            "int16_t",
                            "min",
                            "lv_arc_get_min_value"
                        );

                        const max = code.assign("int16_t", "max", new_val);

                        code.ifLess(min, max, () => {
                            code.callObjectFunction(
                                "lv_arc_set_range",
                                min,
                                max
                            );
                        });
                    });
                });
            }

            if (this.valueType == "literal") {
                code.callObjectFunction("lv_arc_set_value", this.value);
            } else {
                if (code.pageRuntime && code.pageRuntime.isEditor) {
                    const previewValue = Number.parseInt(this.previewValue);
                    if (!isNaN(previewValue)) {
                        code.callObjectFunction(
                            "lv_arc_set_value",
                            previewValue
                        );
                    }
                }

                code.addToTick("value", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.value as string,
                        "Failed to evaluate Value in Arc widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_arc_get_value"
                    );

                    code.ifNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();

                        code.callObjectFunction("lv_arc_set_value", new_val);

                        code.tickChangeEnd();
                    });
                });

                code.addEventHandler(
                    "VALUE_CHANGED",
                    (event, tick_value_change_obj) => {
                        const ta = code.callFreeFunctionWithAssignment(
                            "lv_obj_t *",
                            "ta",
                            code.lv_event_get_target,
                            event
                        );

                        code.ifNotEqual(tick_value_change_obj, ta, () => {
                            const value = code.callFreeFunctionWithAssignment(
                                "int32_t",
                                "value",
                                "lv_arc_get_value",
                                ta
                            );

                            code.assignIntegerProperty(
                                "value",
                                this.value as string,
                                value,
                                "Failed to assign Value in Arc widget"
                            );
                        });
                    }
                );
            }

            if (this.mode != "NORMAL") {
                code.callObjectFunction(
                    "lv_arc_set_mode",
                    code.constant(`LV_ARC_MODE_${this.mode}`)
                );
            }
        } else {
            if (this.startAngleType == "literal") {
                code.callObjectFunction(
                    "lv_arc_set_start_angle",
                    this.startAngle
                );
            } else {
                if (code.pageRuntime && code.pageRuntime.isEditor) {
                    const previewStartAngle = Number.parseInt(
                        this.previewStartAngle
                    );
                    if (!isNaN(previewStartAngle)) {
                        code.callObjectFunction(
                            "lv_arc_set_start_angle",
                            previewStartAngle
                        );
                    }
                }

                code.addToTick("startAngle", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.startAngle as string,
                        "Failed to evaluate Start angle in Arc widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_arc_get_angle_start"
                    );

                    code.ifNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();

                        code.callObjectFunction(
                            "lv_arc_set_start_angle",
                            new_val
                        );

                        code.tickChangeEnd();
                    });
                });
            }

            if (this.endAngleType == "literal") {
                code.callObjectFunction("lv_arc_set_end_angle", this.endAngle);
            } else {
                if (code.pageRuntime && code.pageRuntime.isEditor) {
                    const previewEndAngle = Number.parseInt(
                        this.previewEndAngle
                    );
                    if (!isNaN(previewEndAngle)) {
                        code.callObjectFunction(
                            "lv_arc_set_end_angle",
                            previewEndAngle
                        );
                    }
                }

                code.addToTick("endAngle", () => {
                    const new_val = code.evalIntegerProperty(
                        "int32_t",
                        "new_val",
                        this.endAngle as string,
                        "Failed to evaluate End angle in Arc widget"
                    );

                    const cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_arc_get_angle_end"
                    );

                    code.ifNotEqual(new_val, cur_val, () => {
                        code.tickChangeStart();

                        code.callObjectFunction(
                            "lv_arc_set_end_angle",
                            new_val
                        );

                        code.tickChangeEnd();
                    });
                });
            }
        }

        if (this.bgStartAngleType == "literal") {
            if (this.bgStartAngle != 135) {
                code.callObjectFunction(
                    "lv_arc_set_bg_start_angle",
                    this.bgStartAngle
                );
            }
        } else {
            if (code.pageRuntime && code.pageRuntime.isEditor) {
                const previewBgStartAngle = Number.parseInt(
                    this.previewBgStartAngle
                );
                if (!isNaN(previewBgStartAngle)) {
                    code.callObjectFunction(
                        "lv_arc_set_bg_start_angle",
                        previewBgStartAngle
                    );
                }
            }

            code.addToTick("bgStartAngle", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.bgStartAngle as string,
                    "Failed to evaluate Bg start angle in Arc widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_arc_get_bg_angle_start"
                );

                code.ifNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction(
                        "lv_arc_set_bg_start_angle",
                        new_val
                    );

                    code.tickChangeEnd();
                });
            });
        }

        if (this.bgEndAngleType == "literal") {
            if (this.bgEndAngle != 45) {
                code.callObjectFunction(
                    "lv_arc_set_bg_end_angle",
                    this.bgEndAngle
                );
            }
        } else {
            if (code.pageRuntime && code.pageRuntime.isEditor) {
                const previewBgEndAngle = Number.parseInt(
                    this.previewBgEndAngle
                );
                if (!isNaN(previewBgEndAngle)) {
                    code.callObjectFunction(
                        "lv_arc_set_bg_end_angle",
                        previewBgEndAngle
                    );
                }
            }

            code.addToTick("bgEndAngle", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.bgEndAngle as string,
                    "Failed to evaluate Bg end angle in Arc widget"
                );

                const cur_val = code.callObjectFunctionWithAssignment(
                    "int32_t",
                    "cur_val",
                    "lv_arc_get_bg_angle_end"
                );

                code.ifNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction("lv_arc_set_bg_end_angle", new_val);

                    code.tickChangeEnd();
                });
            });
        }

        if (this.rotationType == "literal") {
            if (this.rotation != 0) {
                code.callObjectFunction("lv_arc_set_rotation", this.rotation);
            }
        } else {
            if (code.pageRuntime && code.pageRuntime.isEditor) {
                const previewRotation = Number.parseInt(this.previewRotation);
                if (!isNaN(previewRotation)) {
                    code.callObjectFunction(
                        "lv_arc_set_rotation",
                        previewRotation
                    );
                }
            }

            code.addToTick("rotation", () => {
                const new_val = code.evalIntegerProperty(
                    "int32_t",
                    "new_val",
                    this.rotation as string,
                    "Failed to evaluate Rotation in Arc widget"
                );

                let cur_val;
                if (code.isV9) {
                    cur_val = code.callObjectFunctionWithAssignment(
                        "int32_t",
                        "cur_val",
                        "lv_arc_get_rotation"
                    );
                } else {
                    if (code.lvglBuild) {
                        cur_val = "cur_val";
                        code.lvglBuild.line(
                            `int32_t cur_val = ((lv_arc_t *)${code.objectAccessor})->rotation;`
                        );
                    } else {
                        cur_val = code.callObjectFunctionWithAssignment(
                            "int32_t",
                            "cur_val",
                            "lvglArcGetRotation"
                        );
                    }
                }

                code.ifNotEqual(new_val, cur_val, () => {
                    code.tickChangeStart();

                    code.callObjectFunction("lv_arc_set_rotation", new_val);

                    code.tickChangeEnd();
                });
            });
        }
    }
}

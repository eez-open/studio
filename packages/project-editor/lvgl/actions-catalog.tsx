import React from "react";
import { IActionPropertyDefinition, registerAction } from "./actions";
import {
    LV_OBJ_FLAG_ENUM_NAME,
    LV_SCR_LOAD_ANIM_ENUM_NAME,
    LV_STATE_ENUM_NAME
} from "./lvgl-constants";
import { registerLvglEnum } from "./widgets";
import { RightArrow } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "changeScreen",
    properties: [
        {
            name: "screen",
            type: "screen"
        },
        {
            name: "fadeMode",
            type: `enum:${LV_SCR_LOAD_ANIM_ENUM_NAME}`
        },
        {
            name: "speed",
            type: "integer"
        },
        {
            name: "delay",
            type: "integer"
        }
    ],
    defaults: {
        fadeMode: "FADE_IN",
        speed: 200,
        delay: 0
    },
    label: (
        [screen, fadeMode, speed, delay],
        [_1, _2, speedLabel, delayLabel]
    ) => (
        <>
            {screen} {fadeMode} <i>{speedLabel}</i>={speed} <i>{delayLabel}</i>=
            {delay}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "changeToPreviousScreen",
    properties: [
        {
            name: "fadeMode",
            type: `enum:${LV_SCR_LOAD_ANIM_ENUM_NAME}`
        },
        {
            name: "speed",
            type: "integer"
        },
        {
            name: "delay",
            type: "integer"
        }
    ],
    defaults: {
        fadeMode: "FADE_IN",
        speed: 200,
        delay: 0
    },
    label: ([fadeMode, speed, delay], [_, speedLabel, delayLabel]) => (
        <>
            {fadeMode} <i>{speedLabel}</i>={speed} <i>{delayLabel}</i>={delay}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetX",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "x",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, x]) => (
        <>
            {object} {x}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetY",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "y",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, y]) => (
        <>
            {object} {y}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetWidth",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "width",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object} {width}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetHeight",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "height",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, height]) => (
        <>
            {object} {height}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetStyleOpa",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "opacity",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, opacity]) => (
        <>
            {object} {opacity}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objAddStyle",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "style",
            type: "style"
        }
    ],
    defaults: {},
    label: ([object, style]) => (
        <>
            {object} {style}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objRemoveStyle",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "style",
            type: "style"
        }
    ],
    defaults: {},
    label: ([object, style]) => (
        <>
            {object} {style}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetFlagHidden",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "hidden",
            type: "boolean"
        }
    ],
    defaults: {
        hidden: true
    },
    label: ([object, hidden]) => (
        <>
            {object} {hidden}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objAddFlag",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "flag",
            type: `enum:${LV_OBJ_FLAG_ENUM_NAME}`
        }
    ],
    defaults: {
        flag: "HIDDEN"
    },
    label: ([object, flag]) => (
        <>
            {object} {flag}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objClearFlag",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "flag",
            type: `enum:${LV_OBJ_FLAG_ENUM_NAME}`
        }
    ],
    defaults: {
        flag: "HIDDEN"
    },
    label: ([object, flag]) => (
        <>
            {object} {flag}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objHasFlag",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "flag",
            type: `enum:${LV_OBJ_FLAG_ENUM_NAME}`
        },
        {
            name: "result",
            type: `boolean`,
            isAssignable: true
        }
    ],
    defaults: {
        flag: "HIDDEN"
    },
    label: ([object, flag, result]) => (
        <>
            {object} {flag}
            <RightArrow />
            {result}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetStateChecked",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "checked",
            type: "boolean"
        }
    ],
    defaults: {
        checked: true
    },
    label: ([object, checked]) => (
        <>
            {object} {checked}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetStateDisabled",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "disabled",
            type: "boolean"
        }
    ],
    defaults: {
        disabled: true
    },
    label: ([object, disabled]) => (
        <>
            {object} {disabled}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objAddState",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "state",
            type: `enum:${LV_STATE_ENUM_NAME}`
        }
    ],
    defaults: {
        state: "CHECKED"
    },
    label: ([object, state]) => (
        <>
            {object} {state}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objClearState",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "state",
            type: `enum:${LV_STATE_ENUM_NAME}`
        }
    ],
    defaults: {
        state: "CHECKED"
    },
    label: ([object, state]) => (
        <>
            {object} {state}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objHasState",
    properties: [
        {
            name: "object",
            type: "widget"
        },
        {
            name: "state",
            type: `enum:${LV_STATE_ENUM_NAME}`
        },
        {
            name: "result",
            type: `boolean`,
            isAssignable: true
        }
    ],
    defaults: {
        flag: "HIDDEN"
    },
    label: ([object, state, result]) => (
        <>
            {object} {state}
            <RightArrow />
            {result}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "arcSetValue",
    properties: [
        {
            name: "object",
            type: "widget:Arc"
        },
        {
            name: "value",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, value]) => (
        <>
            {object} {value}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "barSetValue",
    properties: [
        {
            name: "object",
            type: "widget:Bar"
        },
        {
            name: "value",
            type: "integer"
        },
        {
            name: "animated",
            type: "boolean"
        }
    ],
    defaults: {
        animated: true
    },
    label: ([object, value, animated], [_1, _2, animatedLabel]) => (
        <>
            {object} {value} <i>{animatedLabel}</i>={animated}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "dropdownSetSelected",
    properties: [
        {
            name: "object",
            type: "widget:Dropdown"
        },
        {
            name: "selected",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, selected]) => (
        <>
            {object} {selected}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "imageSetSrc",
    properties: [
        {
            name: "object",
            type: "widget:Image"
        },
        {
            name: "src",
            type: "image"
        }
    ],
    defaults: {},
    label: ([object, src]) => (
        <>
            {object} {src}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "imageSetAngle",
    properties: [
        {
            name: "object",
            type: "widget:Image"
        },
        {
            name: "angle",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, angle]) => (
        <>
            {object} {angle}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "imageSetZoom",
    properties: [
        {
            name: "object",
            type: "widget:Image"
        },
        {
            name: "zoom",
            type: "integer"
        }
    ],
    defaults: {},
    label: ([object, zoom]) => (
        <>
            {object} {zoom}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "labelSetText",
    properties: [
        {
            name: "object",
            type: "widget:Label"
        },
        {
            name: "text",
            type: "string"
        }
    ],
    defaults: {},
    label: ([object, text]) => (
        <>
            {object} {text}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "rollerSetSelected",
    properties: [
        {
            name: "object",
            type: "widget:Roller"
        },
        {
            name: "selected",
            type: "integer"
        },
        {
            name: "animated",
            type: "boolean"
        }
    ],
    defaults: {
        animated: true
    },
    label: ([object, selected, animated], [_1, _2, animatedLabel]) => (
        <>
            {object} {selected} <i>{animatedLabel}</i>={animated}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "sliderSetValue",
    properties: [
        {
            name: "object",
            type: "widget:Slider"
        },
        {
            name: "value",
            type: "integer"
        },
        {
            name: "animated",
            type: "boolean"
        }
    ],
    defaults: {},
    label: ([object, value, animated], [_1, _2, animatedLabel]) => (
        <>
            {object} {value} <i>{animatedLabel}</i>={animated}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "keyboardSetTextarea",
    properties: [
        {
            name: "object",
            type: "widget:Keyboard"
        },
        {
            name: "textarea",
            type: "widget:Textarea"
        }
    ],
    defaults: {},
    label: ([object, textarea]) => (
        <>
            {object} {textarea}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusObj",
    properties: [
        {
            name: "object",
            type: "widget"
        }
    ],
    defaults: {},
    label: ([object]) => <>{object}</>
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusNext",
    properties: [
        {
            name: "group",
            type: "group"
        }
    ],
    defaults: {},
    label: ([group]) => <>{group}</>
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusPrev",
    properties: [
        {
            name: "group",
            type: "group"
        }
    ],
    defaults: {},
    label: ([group]) => <>{group}</>
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupGetFocused",
    properties: [
        {
            name: "group",
            type: "group"
        },
        {
            name: "result",
            type: "widget",
            isAssignable: true
        }
    ],
    defaults: {
        enabled: true
    },
    label: ([object, result]) => (
        <>
            {object}
            <RightArrow />
            {result}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusFreeze",
    properties: [
        {
            name: "group",
            type: "group"
        },
        {
            name: "enabled",
            type: "boolean"
        }
    ],
    defaults: {
        enabled: true
    },
    label: ([group, enabled]) => (
        <>
            {group} {enabled}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupSetWrap",
    properties: [
        {
            name: "group",
            type: "group"
        },
        {
            name: "enabled",
            type: "boolean"
        }
    ],
    defaults: {
        enabled: false
    },
    label: ([group, enabled]) => (
        <>
            {group} {enabled}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupSetEditing",
    properties: [
        {
            name: "group",
            type: "group"
        },
        {
            name: "enabled",
            type: "boolean"
        }
    ],
    defaults: {
        enabled: true
    },
    label: ([group, enabled]) => (
        <>
            {group} {enabled}
        </>
    )
});

////////////////////////////////////////////////////////////////////////////////

const LV_ANIM_PATH_ENUM_NAME = "LV_ANIM_PATH";

registerLvglEnum(LV_ANIM_PATH_ENUM_NAME, {
    LINEAR: 0,
    EASE_IN: 1,
    EASE_OUT: 2,
    EASE_IN_OUT: 3,
    OVERSHOOT: 4,
    BOUNCE: 5
});

const ANIM_PROPERTIES: IActionPropertyDefinition[] = [
    {
        name: "object",
        type: "widget"
    },
    {
        name: "start",
        type: "integer"
    },
    {
        name: "end",
        type: "integer"
    },
    {
        name: "delay",
        type: "integer"
    },
    {
        name: "time",
        type: "integer"
    },
    {
        name: "relative",
        type: "boolean"
    },
    {
        name: "instant",
        type: "boolean"
    },
    {
        name: "path",
        type: `enum:${LV_ANIM_PATH_ENUM_NAME}`
    }
];

const ANIM_DEFAULTS = {
    start: 0,
    end: 100,
    delay: 0,
    time: 1000,
    relative: true,
    instant: false,
    path: "LINEAR"
};

const animLabel = (
    [object, start, end, delay, time, relative, instant, path]: string[],
    [
        _1,
        startLabel,
        endLabel,
        delayLabel,
        timeLabel,
        relativeLabel,
        instantLabel,
        _2
    ]: string[]
) => (
    <>
        {object} <i>{startLabel}</i>={start} <i>{endLabel}</i>={end}{" "}
        <i>{delayLabel}</i>={delay} <i>{timeLabel}</i>={time}
        {relative == "ON" ? " RELATIVE" : ""}
        {instant == "ON" ? " INSTANT" : ""} {path}
    </>
);

registerAction({
    name: "animX",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

registerAction({
    name: "animY",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

registerAction({
    name: "animWidth",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

registerAction({
    name: "animHeight",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

registerAction({
    name: "animOpacity",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

registerAction({
    name: "animImageZoom",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

registerAction({
    name: "animImageAngle",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel
});

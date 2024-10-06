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
            type: "screen",
            helpText: "The screen to change to"
        },
        {
            name: "fadeMode",
            type: `enum:${LV_SCR_LOAD_ANIM_ENUM_NAME}`,
            helpText:
                "Selection of animation when moving from the previous page to a new page"
        },
        {
            name: "speed",
            type: "integer",
            helpText: "Animation duration in milliseconds"
        },
        {
            name: "delay",
            type: "integer",
            helpText: "Delay in milliseconds before the animation starts."
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
    ),
    helpText: "Change the screen to the specified screen"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "changeToPreviousScreen",
    properties: [
        {
            name: "fadeMode",
            type: `enum:${LV_SCR_LOAD_ANIM_ENUM_NAME}`,
            helpText:
                "Selection of animation when moving from the previous page to a new page"
        },
        {
            name: "speed",
            type: "integer",
            helpText: "Animation duration in milliseconds"
        },
        {
            name: "delay",
            type: "integer",
            helpText: "Delay in milliseconds before the animation starts."
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
    ),
    helpText: "Change to the previous screen"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetX",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the x coordinate"
        },
        {
            name: "x",
            type: "integer",
            helpText: "The x coordinate to set"
        }
    ],
    defaults: {},
    label: ([object, x]) => (
        <>
            {object} {x}
        </>
    ),
    helpText: "Set the x coordinate of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objGetX",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to get the x coordinate"
        },
        {
            name: "result",
            type: "integer",
            isAssignable: true,
            helpText: "The variable to store the x coordinate"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object}
            <RightArrow />
            {width}
        </>
    ),
    helpText: "Get the x coordinate of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetY",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the y coordinate"
        },
        {
            name: "y",
            type: "integer",
            helpText: "The y coordinate to set"
        }
    ],
    defaults: {},
    label: ([object, y]) => (
        <>
            {object} {y}
        </>
    ),
    helpText: "Set the y coordinate of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objGetY",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to get the y coordinate"
        },
        {
            name: "result",
            type: "integer",
            isAssignable: true,
            helpText: "The variable to store the y coordinate"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object}
            <RightArrow />
            {width}
        </>
    ),
    helpText: "Get the y coordinate of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetWidth",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the width"
        },
        {
            name: "width",
            type: "integer",
            helpText: "The width to set"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object} {width}
        </>
    ),
    helpText: "Set the width of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objGetWidth",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to get the width"
        },
        {
            name: "result",
            type: "integer",
            isAssignable: true,
            helpText: "The variable to store the width"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object}
            <RightArrow />
            {width}
        </>
    ),
    helpText: "Get the width of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetHeight",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the height"
        },
        {
            name: "height",
            type: "integer",
            helpText: "The height to set"
        }
    ],
    defaults: {},
    label: ([object, height]) => (
        <>
            {object} {height}
        </>
    ),
    helpText: "Set the height of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objGetHeight",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to get the height"
        },
        {
            name: "result",
            type: "integer",
            isAssignable: true,
            helpText: "The variable to store the height"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object}
            <RightArrow />
            {width}
        </>
    ),
    helpText: "Get the height of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetStyleOpa",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the opacity"
        },
        {
            name: "opacity",
            type: "integer",
            helpText: "The opacity to set (0-255)"
        }
    ],
    defaults: {},
    label: ([object, opacity]) => (
        <>
            {object} {opacity}
        </>
    ),
    helpText: "Set the opacity of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objGetStyleOpa",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to get the opacity"
        },
        {
            name: "result",
            type: "integer",
            isAssignable: true,
            helpText: "The variable to store the opacity"
        }
    ],
    defaults: {},
    label: ([object, width]) => (
        <>
            {object}
            <RightArrow />
            {width}
        </>
    ),
    helpText: "Get the opacity of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objAddStyle",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to add the style"
        },
        {
            name: "style",
            type: "style",
            helpText: "The style to add"
        }
    ],
    defaults: {},
    label: ([object, style]) => (
        <>
            {object} {style}
        </>
    ),
    helpText: "Add a style to the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objRemoveStyle",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to remove the style"
        },
        {
            name: "style",
            type: "style",
            helpText: "The style to remove"
        }
    ],
    defaults: {},
    label: ([object, style]) => (
        <>
            {object} {style}
        </>
    ),
    helpText: "Remove a style from the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetFlagHidden",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the hidden flag"
        },
        {
            name: "hidden",
            type: "boolean",
            helpText: "The hidden flag value"
        }
    ],
    defaults: {
        hidden: true
    },
    label: ([object, hidden]) => (
        <>
            {object} {hidden}
        </>
    ),
    helpText: "Set the hidden flag of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objAddFlag",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to add the flag"
        },
        {
            name: "flag",
            type: `enum:${LV_OBJ_FLAG_ENUM_NAME}`,
            helpText: "The flag to add"
        }
    ],
    defaults: {
        flag: "HIDDEN"
    },
    label: ([object, flag]) => (
        <>
            {object} {flag}
        </>
    ),
    helpText: "Add a flag to the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objClearFlag",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to clear the flag"
        },
        {
            name: "flag",
            type: `enum:${LV_OBJ_FLAG_ENUM_NAME}`,
            helpText: "The flag to clear"
        }
    ],
    defaults: {
        flag: "HIDDEN"
    },
    label: ([object, flag]) => (
        <>
            {object} {flag}
        </>
    ),
    helpText: "Clear a flag from the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objHasFlag",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to check the flag"
        },
        {
            name: "flag",
            type: `enum:${LV_OBJ_FLAG_ENUM_NAME}`,
            helpText: "The flag to check"
        },
        {
            name: "result",
            type: `boolean`,
            isAssignable: true,
            helpText: "The variable to store the result"
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
    ),
    helpText: "Check if the object has the specified flag"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetStateChecked",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the checked state"
        },
        {
            name: "checked",
            type: "boolean",
            helpText: "The checked state to set"
        }
    ],
    defaults: {
        checked: true
    },
    label: ([object, checked]) => (
        <>
            {object} {checked}
        </>
    ),
    helpText: "Set the checked state of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objSetStateDisabled",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to set the disabled state"
        },
        {
            name: "disabled",
            type: "boolean",
            helpText: "The disabled state to set"
        }
    ],
    defaults: {
        disabled: true
    },
    label: ([object, disabled]) => (
        <>
            {object} {disabled}
        </>
    ),
    helpText: "Set the disabled state of the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objAddState",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to add the state"
        },
        {
            name: "state",
            type: `enum:${LV_STATE_ENUM_NAME}`,
            helpText: "The state to add"
        }
    ],
    defaults: {
        state: "CHECKED"
    },
    label: ([object, state]) => (
        <>
            {object} {state}
        </>
    ),
    helpText: "Add a state to the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objClearState",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to clear the state"
        },
        {
            name: "state",
            type: `enum:${LV_STATE_ENUM_NAME}`,
            helpText: "The state to clear"
        }
    ],
    defaults: {
        state: "CHECKED"
    },
    label: ([object, state]) => (
        <>
            {object} {state}
        </>
    ),
    helpText: "Clear a state from the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "objHasState",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to check the state"
        },
        {
            name: "state",
            type: `enum:${LV_STATE_ENUM_NAME}`,
            helpText: "The state to check"
        },
        {
            name: "result",
            type: `boolean`,
            isAssignable: true,
            helpText: "The variable to store the result"
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
    ),
    helpText: "Check if the object has the specified state"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "arcSetValue",
    properties: [
        {
            name: "object",
            type: "widget:Arc",
            helpText: "The arc to set the value"
        },
        {
            name: "value",
            type: "integer",
            helpText: "The value to set"
        }
    ],
    defaults: {},
    label: ([object, value]) => (
        <>
            {object} {value}
        </>
    ),
    helpText: "Set the value of the arc"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "barSetValue",
    properties: [
        {
            name: "object",
            type: "widget:Bar",
            helpText: "The bar to set the value"
        },
        {
            name: "value",
            type: "integer",
            helpText: "The value to set (0-100)"
        },
        {
            name: "animated",
            type: "boolean",
            helpText: "Use animation when setting the value"
        }
    ],
    defaults: {
        animated: true
    },
    label: ([object, value, animated], [_1, _2, animatedLabel]) => (
        <>
            {object} {value} <i>{animatedLabel}</i>={animated}
        </>
    ),
    helpText: "Set the value of the bar"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "dropdownSetSelected",
    properties: [
        {
            name: "object",
            type: "widget:Dropdown",
            helpText: "The dropdown to set the selected item"
        },
        {
            name: "selected",
            type: "integer",
            helpText: "The index of the selected item"
        }
    ],
    defaults: {},
    label: ([object, selected]) => (
        <>
            {object} {selected}
        </>
    ),
    helpText: "Set the selected item of the dropdown"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "imageSetSrc",
    properties: [
        {
            name: "object",
            type: "widget:Image",
            helpText: "The image to set the source"
        },
        {
            name: "src",
            type: "image",
            helpText: "The source image to set given as a string"
        }
    ],
    defaults: {},
    label: ([object, src]) => (
        <>
            {object} {src}
        </>
    ),
    helpText: "Set the source image of the image"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "imageSetAngle",
    properties: [
        {
            name: "object",
            type: "widget:Image",
            helpText: "The image to set the angle"
        },
        {
            name: "angle",
            type: "integer",
            helpText:
                "The angle to set. Angle has 0.1 degree precision, so for 45.8° set 458."
        }
    ],
    defaults: {},
    label: ([object, angle]) => (
        <>
            {object} {angle}
        </>
    ),
    helpText: "Set the angle of the image"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "imageSetZoom",
    properties: [
        {
            name: "object",
            type: "widget:Image",
            helpText: "The image to set the zoom"
        },
        {
            name: "zoom",
            type: "integer",
            helpText:
                "The zoom to set. Set factor to 256 to disable zooming. A larger value enlarges the images (e.g. 512 double size), a smaller value shrinks it (e.g. 128 half size)."
        }
    ],
    defaults: {},
    label: ([object, zoom]) => (
        <>
            {object} {zoom}
        </>
    ),
    helpText: "Set the zoom of the image"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "labelSetText",
    properties: [
        {
            name: "object",
            type: "widget:Label",
            helpText: "The label to set the text"
        },
        {
            name: "text",
            type: "string",
            helpText: "The text to set"
        }
    ],
    defaults: {},
    label: ([object, text]) => (
        <>
            {object} {text}
        </>
    ),
    helpText: "Set the text of the label"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "rollerSetSelected",
    properties: [
        {
            name: "object",
            type: "widget:Roller",
            helpText: "The roller to set the selected item"
        },
        {
            name: "selected",
            type: "integer",
            helpText: "The index of the selected item"
        },
        {
            name: "animated",
            type: "boolean",
            helpText: "Use animation when setting the selected item"
        }
    ],
    defaults: {
        animated: true
    },
    label: ([object, selected, animated], [_1, _2, animatedLabel]) => (
        <>
            {object} {selected} <i>{animatedLabel}</i>={animated}
        </>
    ),
    helpText: "Set the selected item of the roller"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "sliderSetValue",
    properties: [
        {
            name: "object",
            type: "widget:Slider",
            helpText: "The slider to set the value"
        },
        {
            name: "value",
            type: "integer",
            helpText: "The value to set"
        },
        {
            name: "animated",
            type: "boolean",
            helpText: "Use animation when setting the value"
        }
    ],
    defaults: {},
    label: ([object, value, animated], [_1, _2, animatedLabel]) => (
        <>
            {object} {value} <i>{animatedLabel}</i>={animated}
        </>
    ),
    helpText: "Set the value of the slider"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "keyboardSetTextarea",
    properties: [
        {
            name: "object",
            type: "widget:Keyboard",
            helpText: "The keyboard to set the textarea"
        },
        {
            name: "textarea",
            type: "widget:Textarea",
            helpText: "The textarea to set"
        }
    ],
    defaults: {},
    label: ([object, textarea]) => (
        <>
            {object} {textarea}
        </>
    ),
    helpText: "Set the textarea for the keyboard"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusObj",
    properties: [
        {
            name: "object",
            type: "widget",
            helpText: "The object to focus"
        }
    ],
    defaults: {},
    label: ([object]) => <>{object}</>,
    helpText: "Focus the object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusNext",
    properties: [
        {
            name: "group",
            type: "group",
            helpText: "The group to focus the next object"
        }
    ],
    defaults: {},
    label: ([group]) => <>{group}</>,
    helpText: "Focus the next object in the group"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusPrev",
    properties: [
        {
            name: "group",
            type: "group",
            helpText: "The group to focus the previous object"
        }
    ],
    defaults: {},
    label: ([group]) => <>{group}</>,
    helpText: "Focus the previous object in the group"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupGetFocused",
    properties: [
        {
            name: "group",
            type: "group",
            helpText: "The group to get the focused object"
        },
        {
            name: "result",
            type: "widget",
            isAssignable: true,
            helpText: "The variable to store the focused object"
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
    ),
    helpText: "Get the focused object in the group"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupFocusFreeze",
    properties: [
        {
            name: "group",
            type: "group",
            helpText: "The group to freeze/unfreeze the focus"
        },
        {
            name: "enabled",
            type: "boolean",
            helpText: "true: freeze, false: release freezing (normal mode)"
        }
    ],
    defaults: {
        enabled: true
    },
    label: ([group, enabled]) => (
        <>
            {group} {enabled}
        </>
    ),
    helpText: "Do not let to change the focus from the current object"
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupSetWrap",
    properties: [
        {
            name: "group",
            type: "group",
            helpText: "The group to set the wrap"
        },
        {
            name: "enabled",
            type: "boolean",
            helpText: "true: wrap, false: no wrap"
        }
    ],
    defaults: {
        enabled: false
    },
    label: ([group, enabled]) => (
        <>
            {group} {enabled}
        </>
    ),
    helpText:
        "Set whether focus next/prev will allow wrapping from first->last or last->first object."
});

////////////////////////////////////////////////////////////////////////////////

registerAction({
    name: "groupSetEditing",
    properties: [
        {
            name: "group",
            type: "group",
            helpText: "The group to set the editing mode"
        },
        {
            name: "enabled",
            type: "boolean",
            helpText: "true: edit mode, false: navigate mode"
        }
    ],
    defaults: {
        enabled: true
    },
    label: ([group, enabled]) => (
        <>
            {group} {enabled}
        </>
    ),
    helpText: "Manually set the current mode (edit or navigate)."
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
        type: "widget",
        helpText: "The object to animate"
    },
    {
        name: "start",
        type: "integer",
        helpText: "The start value of the animation"
    },
    {
        name: "end",
        type: "integer",
        helpText: "The end value of the animation"
    },
    {
        name: "delay",
        type: "integer",
        helpText: "Delay in milliseconds before the animation starts"
    },
    {
        name: "time",
        type: "integer",
        helpText: "Animation duration in milliseconds"
    },
    {
        name: "relative",
        type: "boolean",
        helpText:
            "Determines whether `Start` and `End` values are relative to the current value or are absolute values."
    },
    {
        name: "instant",
        type: "boolean",
        helpText:
            "If checked apply the start value immediately, otherwise apply the start value after a delay when the animation really starts"
    },
    {
        name: "path",
        type: `enum:${LV_ANIM_PATH_ENUM_NAME}`,
        helpText: "The animation path"
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
    label: animLabel,
    helpText: "Animate the x coordinate of the object"
});

registerAction({
    name: "animY",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel,
    helpText: "Animate the y coordinate of the object"
});

registerAction({
    name: "animWidth",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel,
    helpText: "Animate the width of the object"
});

registerAction({
    name: "animHeight",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel,
    helpText: "Animate the height of the object"
});

registerAction({
    name: "animOpacity",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel,
    helpText: "Animate the opacity of the object"
});

registerAction({
    name: "animImageZoom",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel,
    helpText: "Animate the zoom of the image"
});

registerAction({
    name: "animImageAngle",
    properties: ANIM_PROPERTIES,
    defaults: ANIM_DEFAULTS,
    label: animLabel,
    helpText: "Animate the angle of the image"
});

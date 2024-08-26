import { isArray } from "eez-studio-shared/util";

import {
    EezObject,
    IEezObject,
    PropertyInfo,
    PropertyType
} from "project-editor/core/object";

import { ProjectStore } from "project-editor/store";

import {
    LVGLStylePropCode,
    LVGL_STYLE_PROP_CODES,
    LV_FLEX_ALIGN_CENTER,
    LV_FLEX_ALIGN_END,
    LV_FLEX_ALIGN_SPACE_AROUND,
    LV_FLEX_ALIGN_SPACE_BETWEEN,
    LV_FLEX_ALIGN_SPACE_EVENLY,
    LV_FLEX_ALIGN_START,
    LV_FLEX_FLOW_COLUMN,
    LV_FLEX_FLOW_COLUMN_REVERSE,
    LV_FLEX_FLOW_COLUMN_WRAP,
    LV_FLEX_FLOW_COLUMN_WRAP_REVERSE,
    LV_FLEX_FLOW_ROW,
    LV_FLEX_FLOW_ROW_REVERSE,
    LV_FLEX_FLOW_ROW_WRAP,
    LV_FLEX_FLOW_ROW_WRAP_REVERSE,
    LV_LAYOUT_FLEX,
    LV_LAYOUT_NONE
} from "project-editor/lvgl/lvgl-constants";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export const BUILT_IN_FONTS = [
    "MONTSERRAT_8",
    "MONTSERRAT_10",
    "MONTSERRAT_12",
    "MONTSERRAT_14",
    "MONTSERRAT_16",
    "MONTSERRAT_18",
    "MONTSERRAT_20",
    "MONTSERRAT_22",
    "MONTSERRAT_24",
    "MONTSERRAT_26",
    "MONTSERRAT_28",
    "MONTSERRAT_30",
    "MONTSERRAT_32",
    "MONTSERRAT_34",
    "MONTSERRAT_36",
    "MONTSERRAT_38",
    "MONTSERRAT_40",
    "MONTSERRAT_42",
    "MONTSERRAT_44",
    "MONTSERRAT_46",
    "MONTSERRAT_48"
];

////////////////////////////////////////////////////////////////////////////////

interface LVGLStyleProp {
    code: LVGLStylePropCode;
    description: string;
    defaultValue: string;
    inherited: boolean;
    layout: boolean;
    extDraw: boolean;
    valueRead?: (value: number) => string;
    valueToNum?: (value: string) => number;
    valueBuild?: (value: string) => string;
}

export type LVGLPropertyInfo = PropertyInfo & {
    lvglStyleProp: LVGLStyleProp;
};

export class PropertyValueHolder extends EezObject {
    [propertyName: string]: any;
    constructor(
        public projectStore: ProjectStore,
        propertyName: string,
        propertyValue: any
    ) {
        super();
        this[propertyName] = propertyValue;
    }
}

////////////////////////////////////////////////////////////////////////////////

function makeEnumPropertyInfo(
    name: string,
    displayName: string,
    lvglStyleProp: LVGLStyleProp,
    enumItemToCodeOrStringArray: { [key: string]: number } | string[],
    buildPrefix: string
): LVGLPropertyInfo {
    let enumItemToCode: { [key: string]: number };
    if (isArray(enumItemToCodeOrStringArray)) {
        enumItemToCode = {};
        for (let i = 0; i < enumItemToCodeOrStringArray.length; i++) {
            enumItemToCode[enumItemToCodeOrStringArray[i]] = i;
        }
    } else {
        enumItemToCode = enumItemToCodeOrStringArray;
    }

    const codeToEnumItem: { [code: string]: string } = {};

    Object.keys(enumItemToCode).forEach(
        enumItem =>
            (codeToEnumItem[enumItemToCode[enumItem].toString()] = enumItem)
    );

    return {
        name,
        displayName,
        type: PropertyType.Enum,
        enumItems: Object.keys(enumItemToCode).map(id => ({
            id,
            label: id
        })),
        enumDisallowUndefined: true,
        lvglStyleProp: Object.assign(lvglStyleProp, {
            buildPrefix,
            enumItemToCodeOrStringArray,
            valueRead: (value: number) => codeToEnumItem[value.toString()],
            valueToNum: (value: string) => enumItemToCode[value.toString()],
            valueBuild: (value: string) => buildPrefix + value
        })
    };
}

////////////////////////////////////////////////////////////////////////////////

//
// POSITION AND SIZE
//

const width_property_info: LVGLPropertyInfo = {
    name: "width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_WIDTH,
        description:
            "Sets the width of object. Pixel, percentage and LV_SIZE_CONTENT values can be used. Percentage values are relative to the width of the parent's content area.",
        defaultValue: "Widget dependent",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const height_property_info: LVGLPropertyInfo = {
    name: "height",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_HEIGHT,
        description:
            "Sets the height of object. Pixel, percentage and LV_SIZE_CONTENT can be used. Percentage values are relative to the height of the parent's content area.",
        defaultValue: "Widget dependent",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const min_width_property_info: LVGLPropertyInfo = {
    name: "min_width",
    displayName: "Min. width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MIN_WIDTH,
        description:
            "Sets a minimal width. Pixel and percentage values can be used. Percentage values are relative to the width of the parent's content area.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const max_width_property_info: LVGLPropertyInfo = {
    name: "max_width",
    displayName: "Max. width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MAX_WIDTH,
        description:
            "Sets a maximal width. Pixel and percentage values can be used. Percentage values are relative to the width of the parent's content area.",
        defaultValue: "LV_COORD_MAX",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const min_height_property_info: LVGLPropertyInfo = {
    name: "min_height",
    displayName: "Min. height",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MIN_HEIGHT,
        description:
            "Sets a minimal height. Pixel and percentage values can be used. Percentage values are relative to the width of the parent's content area.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const max_height_property_info: LVGLPropertyInfo = {
    name: "max_height",
    displayName: "Max. height",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MAX_HEIGHT,
        description:
            "Sets a maximal height. Pixel and percentage values can be used. Percentage values are relative to the height of the parent's content area.",
        defaultValue: "LV_COORD_MAX",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const length_property_info: LVGLPropertyInfo = {
    name: "length",
    displayName: "Length",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LENGTH,
        description: "",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const x_property_info: LVGLPropertyInfo = {
    name: "x",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_X,
        description:
            "Set the X coordinate of the object considering the set align. Pixel and percentage values can be used. Percentage values are relative to the width of the parent's content area.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const y_property_info: LVGLPropertyInfo = {
    name: "y",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_Y,
        description:
            "Set the Y coordinate of the object considering the set align. Pixel and percentage values can be used. Percentage values are relative to the height of the parent's content area.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const align_property_info = makeEnumPropertyInfo(
    "align",
    "Align",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ALIGN,
        description:
            "Set the alignment which tells from which point of the parent the X and Y coordinates should be interpreted. The possible values are: LV_ALIGN_DEFAULT, LV_ALIGN_TOP_LEFT/MID/RIGHT, LV_ALIGN_BOTTOM_LEFT/MID/RIGHT, LV_ALIGN_LEFT/RIGHT_MID, LV_ALIGN_CENTER. LV_ALIGN_DEFAULT means LV_ALIGN_TOP_LEFT with LTR base direction and LV_ALIGN_TOP_RIGHT with RTL base direction.",
        defaultValue: "LV_ALIGN_DEFAULT",
        inherited: false,
        layout: true,
        extDraw: false
    },
    [
        "DEFAULT",
        "TOP_LEFT",
        "TOP_MID",
        "TOP_RIGHT",
        "BOTTOM_LEFT",
        "BOTTOM_MID",
        "BOTTOM_RIGHT",
        "LEFT_MID",
        "RIGHT_MID",
        "CENTER",

        "OUT_TOP_LEFT",
        "OUT_TOP_MID",
        "OUT_TOP_RIGHT",
        "OUT_BOTTOM_LEFT",
        "OUT_BOTTOM_MID",
        "OUT_BOTTOM_RIGHT",
        "OUT_LEFT_TOP",
        "OUT_LEFT_MID",
        "OUT_LEFT_BOTTOM",
        "OUT_RIGHT_TOP",
        "OUT_RIGHT_MID",
        "OUT_RIGHT_BOTTOM"
    ],
    "LV_ALIGN_"
);

const transform_width_property_info: LVGLPropertyInfo = {
    name: "transform_width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_WIDTH,
        description:
            "Make the object wider on both sides with this value. Pixel and percentage (with lv_pct(x)) values can be used. Percentage values are relative to the object's width.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};

const transform_height_property_info: LVGLPropertyInfo = {
    name: "transform_height",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_HEIGHT,
        description:
            "Make the object higher on both sides with this value. Pixel and percentage (with lv_pct(x)) values can be used. Percentage values are relative to the object's height.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};

const translate_x_property_info: LVGLPropertyInfo = {
    name: "translate_x",
    displayName: "Translate X",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSLATE_X,
        description:
            "Move the object with this value in X direction. Applied after layouts, aligns and other positioning. Pixel and percentage (with lv_pct(x)) values can be used. Percentage values are relative to the object's width.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const translate_y_property_info: LVGLPropertyInfo = {
    name: "translate_y",
    displayName: "Translate Y",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSLATE_Y,
        description:
            "Move the object with this value in Y direction. Applied after layouts, aligns and other positioning. Pixel and percentage (with lv_pct(x)) values can be used. Percentage values are relative to the object's height.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

export const transform_zoom_property_info: LVGLPropertyInfo = {
    name: "transform_zoom",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_ZOOM,
        description:
            "Zoom an objects. The value 256 (or LV_IMG_ZOOM_NONE) means normal size, 128 half size, 512 double size, and so on",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

export const transform_scale_x_property_info: LVGLPropertyInfo = {
    name: "transform_scale_x",
    displayName: "Transform scale X",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_SCALE_X,
        description:
            "Zoom an object horizontally. The value 256 (or LV_IMG_ZOOM_NONE) means normal size, 128 half size, 512 double size, and so on",
        defaultValue: "1",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

export const transform_scale_y_property_info: LVGLPropertyInfo = {
    name: "transform_scale_y",
    displayName: "Transform scale Y",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_SCALE_Y,
        description:
            "Zoom an object vertically. The value 256 (or LV_IMG_ZOOM_NONE) means normal size, 128 half size, 512 double size, and so on",
        defaultValue: "1",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

export const transform_angle_property_info: LVGLPropertyInfo = {
    name: "transform_angle",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_ANGLE,
        description:
            "Rotate an objects. The value is interpreted in 0.1 degree units. E.g. 450 means 45 deg.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

export const transform_rotation_property_info: LVGLPropertyInfo = {
    name: "transform_rotation",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_ROTATION,
        description:
            "Rotate an objects. The value is interpreted in 0.1 degree units. E.g. 450 means 45 deg.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

const transform_pivot_x_property_info: LVGLPropertyInfo = {
    name: "transform_pivot_x",
    displayName: "Transform pivot X",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_PIVOT_X,
        description:
            "Set the pivot point's X coordinate for transformations. Relative to the object's top left corner'",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const transform_pivot_y_property_info: LVGLPropertyInfo = {
    name: "transform_pivot_y",
    displayName: "Transform pivot Y",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_PIVOT_Y,
        description:
            "Set the pivot point's Y coordinate for transformations. Relative to the object's top left corner'",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

const transform_skew_x_property_info: LVGLPropertyInfo = {
    name: "transform_skew_x",
    displayName: "Transform skew X",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_SKEW_X,
        description: "",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const transform_skew_y_property_info: LVGLPropertyInfo = {
    name: "transform_skew_y",
    displayName: "Transform skew Y",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSFORM_SKEW_Y,
        description: "",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

//
// LAYOUT
//

const layout_property_info = makeEnumPropertyInfo(
    "layout",
    "Layout",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LAYOUT,
        description:
            "Set the layout if the object. The children will be repositioned and resized according to the policies set for the layout. For the possible values see the documentation of the layouts.",
        defaultValue: "LV_FLEX_FLOW_ROW",
        inherited: false,
        layout: true,
        extDraw: false
    },
    {
        NONE: LV_LAYOUT_NONE, // No layout
        FLEX: LV_LAYOUT_FLEX // Use flex layout
    },
    "LV_LAYOUT_"
);

const flex_flow_property_info = makeEnumPropertyInfo(
    "flex_flow",
    "Flex flow",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_FLEX_FLOW,
        description: "Determines a type of Flex layout used",
        defaultValue: "LV_FLEX_FLOW_ROW",
        inherited: false,
        layout: true,
        extDraw: false
    },
    {
        ROW: LV_FLEX_FLOW_ROW, // Place the children in a row without wrapping
        COLUMN: LV_FLEX_FLOW_COLUMN, // Place the children in a column without wrapping
        ROW_WRAP: LV_FLEX_FLOW_ROW_WRAP, // Place the children in a row with wrapping
        ROW_REVERSE: LV_FLEX_FLOW_ROW_REVERSE, // Place the children in a column with wrapping
        ROW_WRAP_REVERSE: LV_FLEX_FLOW_ROW_WRAP_REVERSE, // Place the children in a row without wrapping but in reversed order
        COLUMN_WRAP: LV_FLEX_FLOW_COLUMN_WRAP, // Place the children in a column without wrapping but in reversed order
        COLUMN_REVERSE: LV_FLEX_FLOW_COLUMN_REVERSE, // Place the children in a row with wrapping but in reversed order
        COLUMN_WRAP_REVERSE: LV_FLEX_FLOW_COLUMN_WRAP_REVERSE // Place the children in a column with wrapping but in reversed order
    },
    "LV_FLEX_FLOW_"
);

const flex_main_place_property_info = makeEnumPropertyInfo(
    "flex_main_place",
    "Flex main place",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_FLEX_MAIN_PLACE,
        description:
            "Determines how to distribute the items in their track on the main axis.",
        defaultValue: "LV_FLEX_ALIGN_START",
        inherited: false,
        layout: true,
        extDraw: false
    },
    {
        START: LV_FLEX_ALIGN_START, // means left on a horizontally and top vertically (default)
        END: LV_FLEX_ALIGN_END, // means right on a horizontally and bottom vertically
        CENTER: LV_FLEX_ALIGN_CENTER, // simply center
        SPACE_EVENLY: LV_FLEX_ALIGN_SPACE_EVENLY, // items are distributed so that the spacing between any two items (and the space to the edges) is equal. Does not apply to track_cross_place.
        SPACE_AROUND: LV_FLEX_ALIGN_SPACE_AROUND, // items are evenly distributed in the track with equal space around them. Note that visually the spaces aren't equal, since all the items have equal space on both sides. The first item will have one unit of space against the container edge, but two units of space between the next item because that next item has its own spacing that applies. Not applies to track_cross_place.
        SPACE_BETWEEN: LV_FLEX_ALIGN_SPACE_BETWEEN // items are evenly distributed in the track: first item is on the start line, last item on the end line. Not applies to track_cross_place.
    },
    "LV_FLEX_ALIGN_"
);

const flex_cross_place_property_info = makeEnumPropertyInfo(
    "flex_cross_place",
    "Flex cross place",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_FLEX_CROSS_PLACE,
        description:
            "Determines how to distribute the items in their track on the cross axis.",
        defaultValue: "LV_FLEX_ALIGN_START",
        inherited: false,
        layout: true,
        extDraw: false
    },
    {
        START: LV_FLEX_ALIGN_START, // means left on a horizontally and top vertically (default)
        END: LV_FLEX_ALIGN_END, // means right on a horizontally and bottom vertically
        CENTER: LV_FLEX_ALIGN_CENTER // simply center
    },
    "LV_FLEX_ALIGN_"
);

const flex_track_place_property_info = makeEnumPropertyInfo(
    "flex_track_place",
    "Flex track place",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_FLEX_TRACK_PLACE,
        description: "Determines how to distribute the tracks",
        defaultValue: "LV_FLEX_ALIGN_START",
        inherited: false,
        layout: true,
        extDraw: false
    },
    {
        START: LV_FLEX_ALIGN_START, // means left on a horizontally and top vertically (default)
        END: LV_FLEX_ALIGN_END, // means right on a horizontally and bottom vertically
        CENTER: LV_FLEX_ALIGN_CENTER, // simply center
        SPACE_EVENLY: LV_FLEX_ALIGN_SPACE_EVENLY, // items are distributed so that the spacing between any two items (and the space to the edges) is equal. Does not apply to track_cross_place.
        SPACE_AROUND: LV_FLEX_ALIGN_SPACE_AROUND, // items are evenly distributed in the track with equal space around them. Note that visually the spaces aren't equal, since all the items have equal space on both sides. The first item will have one unit of space against the container edge, but two units of space between the next item because that next item has its own spacing that applies. Not applies to track_cross_place.
        SPACE_BETWEEN: LV_FLEX_ALIGN_SPACE_BETWEEN // items are evenly distributed in the track: first item is on the start line, last item on the end line. Not applies to track_cross_place.
    },
    "LV_FLEX_ALIGN_"
);

const flex_grow_property_info: LVGLPropertyInfo = {
    name: "flex_grow",
    displayName: "Flex grow",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_FLEX_GROW,
        description:
            "Flex grow can be used to make one or more children fill the available space on the track. When more children have grow parameters, the available space will be distributed proportionally to the grow values.",
        defaultValue: "1",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

//
// PADDING
//

export const pad_top_property_info: LVGLPropertyInfo = {
    name: "pad_top",
    displayName: "Top",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_PAD_TOP,
        description:
            "Sets the padding on the top. It makes the content area smaller in this direction.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
export const pad_bottom_property_info: LVGLPropertyInfo = {
    name: "pad_bottom",
    displayName: "Bottom",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_PAD_BOTTOM,
        description:
            "Sets the padding on the bottom. It makes the content area smaller in this direction.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
export const pad_left_property_info: LVGLPropertyInfo = {
    name: "pad_left",
    displayName: "Left",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_PAD_LEFT,
        description:
            "Sets the padding on the left. It makes the content area smaller in this direction.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
export const pad_right_property_info: LVGLPropertyInfo = {
    name: "pad_right",
    displayName: "Right",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_PAD_RIGHT,
        description:
            "Sets the padding on the right. It makes the content area smaller in this direction.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const pad_row_property_info: LVGLPropertyInfo = {
    name: "pad_row",
    displayName: "Row",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_PAD_ROW,
        description: "Sets the padding between the rows. Used by the layouts.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const pad_column_property_info: LVGLPropertyInfo = {
    name: "pad_column",
    displayName: "Column",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_PAD_COLUMN,
        description:
            "Sets the padding between the columns. Used by the layouts.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

//
// MARGIN
//
const margin_top_property_info: LVGLPropertyInfo = {
    name: "margin_top",
    displayName: "Top",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MARGIN_TOP,
        description:
            "Sets the margin on the top. The object will keep this space from its siblings in layouts.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const margin_bottom_property_info: LVGLPropertyInfo = {
    name: "margin_bottom",
    displayName: "Bottom",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MARGIN_BOTTOM,
        description:
            "Sets the margin on the bottom. The object will keep this space from its siblings in layouts.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const margin_left_property_info: LVGLPropertyInfo = {
    name: "margin_left",
    displayName: "Left",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MARGIN_LEFT,
        description:
            "Sets the margin on the left. The object will keep this space from its siblings in layouts.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const margin_right_property_info: LVGLPropertyInfo = {
    name: "margin_right",
    displayName: "Right",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_MARGIN_RIGHT,
        description:
            "Sets the margin on the right. The object will keep this space from its siblings in layouts.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};

//
// BACKGROUND
//

const bg_color_property_info: LVGLPropertyInfo = {
    name: "bg_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_COLOR,
        description: "Set the background color of the object.",
        defaultValue: "0xffffff",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
export const bg_opa_property_info: LVGLPropertyInfo = {
    name: "bg_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_OPA,
        description:
            "Set the opacity of the background. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_TRANSP",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_grad_color_property_info: LVGLPropertyInfo = {
    name: "bg_grad_color",
    displayName: "Grad. color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_GRAD_COLOR,
        description:
            "Set the gradient color of the background. Used only if grad_dir is not LV_GRAD_DIR_NONE",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_grad_dir_property_info = makeEnumPropertyInfo(
    "bg_grad_dir",
    "Grad. direction",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_GRAD_DIR,
        description:
            "Set the direction of the gradient of the background. The possible values are LV_GRAD_DIR_NONE/HOR/VER.",
        defaultValue: "LV_GRAD_DIR_NONE",
        inherited: false,
        layout: false,
        extDraw: false
    },
    [
        "NONE", // No gradient (the `grad_color` property is ignored)
        "VER", // Vertical (top to bottom) gradient
        "HOR" // Horizontal (left to right) gradient
    ],
    "LV_GRAD_DIR_"
);
const bg_main_stop_property_info: LVGLPropertyInfo = {
    name: "bg_main_stop",
    displayName: "Main stop",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_MAIN_STOP,
        description:
            "Set the point from which the background color should start for gradients. 0 means to top/left side, 255 the bottom/right side, 128 the center, and so on",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_grad_stop_property_info: LVGLPropertyInfo = {
    name: "bg_grad_stop",
    displayName: "Gradient stop",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_GRAD_STOP,
        description:
            "Set the point from which the background's gradient color should start. 0 means to top/left side, 255 the bottom/right side, 128 the center, and so on",
        defaultValue: "255",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_main_opa_property_info: LVGLPropertyInfo = {
    name: "bg_main_opa",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_MAIN_OPA,
        description: "",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_grad_opa_property_info: LVGLPropertyInfo = {
    name: "bg_grad_opa",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_GRAD_OPA,
        description: "",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_grad_property_info: LVGLPropertyInfo = {
    name: "bg_grad",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_GRAD,
        description:
            "Set the gradient definition. The pointed instance must exist while the object is alive. NULL to disable. It wraps BG_GRAD_COLOR, BG_GRAD_DIR, BG_MAIN_STOP and BG_GRAD_STOP into one descriptor and allows creating gradients with more colors too.",
        defaultValue: "NULL",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_dither_mode_property_info = makeEnumPropertyInfo(
    "bg_dither_mode",
    "Dither mode",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_DITHER_MODE,
        description:
            "Set the dithering mode of the gradient of the background. The possible values are LV_DITHER_NONE/ORDERED/ERR_DIFF.",
        defaultValue: "LV_DITHER_NONE",
        inherited: false,
        layout: false,
        extDraw: false
    },
    [
        "NONE", // No dithering, colors are just quantized to the output resolution
        "ORDERED", // Ordered dithering. Faster to compute and use less memory but lower quality
        "ERR_DIFF" // Error diffusion mode. Slower to compute and use more memory but give highest dither quality
    ],
    "LV_DITHER_"
);
const bg_img_src_property_info: LVGLPropertyInfo = {
    name: "bg_img_src",
    displayName: "Image source",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "bitmaps",
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_IMG_SRC,
        description:
            "Set a background image. Can be a pointer to lv_img_dsc_t, a path to a file or an LV_SYMBOL_...",
        defaultValue: "NULL",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const bg_img_opa_property_info: LVGLPropertyInfo = {
    name: "bg_img_opa",
    displayName: "Image opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_IMG_OPA,
        description:
            "Set the opacity of the background image. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_img_recolor_property_info: LVGLPropertyInfo = {
    name: "bg_img_recolor",
    displayName: "Image recolor",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_IMG_RECOLOR,
        description: "Set a color to mix to the background image.",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_img_recolor_opa_property_info: LVGLPropertyInfo = {
    name: "bg_img_recolor_opa",
    displayName: "Image recolor opa.",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_IMG_RECOLOR_OPA,
        description:
            "Set the intensity of background image recoloring. Value 0, LV_OPA_0 or LV_OPA_TRANSP means no mixing, 255, LV_OPA_100 or LV_OPA_COVER means full recoloring, other values or LV_OPA_10, LV_OPA_20, etc are interpreted proportionally.",
        defaultValue: "LV_OPA_TRANSP",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const bg_img_tiled_property_info: LVGLPropertyInfo = {
    name: "bg_img_tiled",
    displayName: "Image tiled",
    type: PropertyType.Boolean,
    checkboxStyleSwitch: true,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BG_IMG_TILED,
        description:
            "If enabled the background image will be tiled. The possible values are true or false.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

//
// BORDER
//

const border_color_property_info: LVGLPropertyInfo = {
    name: "border_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BORDER_COLOR,
        description: "Set the color of the border",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const border_opa_property_info: LVGLPropertyInfo = {
    name: "border_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BORDER_OPA,
        description:
            "Set the opacity of the border. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
export const border_width_property_info: LVGLPropertyInfo = {
    name: "border_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BORDER_WIDTH,
        description:
            "Set hte width of the border. Only pixel values can be used.",
        defaultValue: "0",
        inherited: false,
        layout: true,
        extDraw: false
    }
};
const border_side_property_info = makeEnumPropertyInfo(
    "border_side",
    "Side",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BORDER_SIDE,
        description:
            "Set only which side(s) the border should be drawn. The possible values are LV_BORDER_SIDE_NONE/TOP/BOTTOM/LEFT/RIGHT/INTERNAL. OR-ed values can be used as well, e.g. LV_BORDER_SIDE_TOP | LV_BORDER_SIDE_LEFT.",
        defaultValue: "LV_BORDER_SIDE_NONE",
        inherited: false,
        layout: false,
        extDraw: false
    },
    {
        NONE: 0x00,
        BOTTOM: 0x01,
        TOP: 0x02,
        LEFT: 0x04,
        RIGHT: 0x08,
        FULL: 0x0f,
        INTERNAL: 0x10 // FOR matrix-like objects (e.g. Button matrix)
    },
    "LV_BORDER_SIDE_"
);
const border_post_property_info: LVGLPropertyInfo = {
    name: "border_post",
    displayName: "Post",
    type: PropertyType.Boolean,
    checkboxStyleSwitch: true,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BORDER_POST,
        description:
            "Sets whether the border should be drawn before or after the children are drawn. true: after children, false: before children",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

//
// OUTLINE
//

const outline_width_property_info: LVGLPropertyInfo = {
    name: "outline_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_OUTLINE_WIDTH,
        description: "Set the width of the outline in pixels.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const outline_color_property_info: LVGLPropertyInfo = {
    name: "outline_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_OUTLINE_COLOR,
        description: "Set the color of the outline.",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const outline_opa_property_info: LVGLPropertyInfo = {
    name: "outline_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_OUTLINE_OPA,
        description:
            "Set the opacity of the outline. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const outline_pad_property_info: LVGLPropertyInfo = {
    name: "outline_pad",
    displayName: "Padding",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_OUTLINE_PAD,
        description:
            "Set the padding of the outline, i.e. the gap between object and the outline.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};

//
// SHADOW
//

const shadow_width_property_info: LVGLPropertyInfo = {
    name: "shadow_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_SHADOW_WIDTH,
        description:
            "Set the width of the shadow in pixels. The value should be >= 0.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const shadow_ofs_x_property_info: LVGLPropertyInfo = {
    name: "shadow_ofs_x",
    displayName: "X offset",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_SHADOW_OFS_X,
        description: "Set an offset on the shadow in pixels in X direction.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const shadow_ofs_y_property_info: LVGLPropertyInfo = {
    name: "shadow_ofs_y",
    displayName: "Y offset",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_SHADOW_OFS_Y,
        description: "Set an offset on the shadow in pixels in Y direction.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const shadow_spread_property_info: LVGLPropertyInfo = {
    name: "shadow_spread",
    displayName: "Spread",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_SHADOW_SPREAD,
        description:
            "Make the shadow calculation to use a larger or smaller rectangle as base. The value can be in pixel to make the area larger/smaller",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const shadow_color_property_info: LVGLPropertyInfo = {
    name: "shadow_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_SHADOW_COLOR,
        description: "Set the color of the shadow",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const shadow_opa_property_info: LVGLPropertyInfo = {
    name: "shadow_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_SHADOW_OPA,
        description:
            "Set the opacity of the shadow. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: true
    }
};

//
// IMAGE
//

const img_opa_property_info: LVGLPropertyInfo = {
    name: "img_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_IMG_OPA,
        description:
            "Set the opacity of an image. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const img_recolor_property_info: LVGLPropertyInfo = {
    name: "img_recolor",
    displayName: "Recolor",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_IMG_RECOLOR,
        description: "Set color to mix to the image.",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const img_recolor_opa_property_info: LVGLPropertyInfo = {
    name: "img_recolor_opa",
    displayName: "Recolor opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_IMG_RECOLOR_OPA,
        description:
            "Set the intensity of the color mixing. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

//
// LINE
//

const line_width_property_info: LVGLPropertyInfo = {
    name: "line_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LINE_WIDTH,
        description: "Set the width of the lines in pixel.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const line_dash_width_property_info: LVGLPropertyInfo = {
    name: "line_dash_width",
    displayName: "Dash width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LINE_DASH_WIDTH,
        description:
            "Set the width of dashes in pixel. Note that dash works only on horizontal and vertical lines",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const line_dash_gap_property_info: LVGLPropertyInfo = {
    name: "line_dash_gap",
    displayName: "Dash gap",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LINE_DASH_GAP,
        description:
            "Set the gap between dashes in pixel. Note that dash works only on horizontal and vertical lines",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const line_rounded_property_info: LVGLPropertyInfo = {
    name: "line_rounded",
    displayName: "Rounded",
    type: PropertyType.Boolean,
    checkboxStyleSwitch: true,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LINE_ROUNDED,
        description:
            "Make the end points of the lines rounded. true: rounded, false: perpendicular line ending",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const line_color_property_info: LVGLPropertyInfo = {
    name: "line_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LINE_COLOR,
        description: "Set the color fo the lines.",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const line_opa_property_info: LVGLPropertyInfo = {
    name: "line_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_LINE_OPA,
        description: "Set the opacity of the lines.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

//
// ARC
//

const arc_width_property_info: LVGLPropertyInfo = {
    name: "arc_width",
    displayName: "Width",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ARC_WIDTH,
        description: "Set the width (thickness) of the arcs in pixel.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: true
    }
};
const arc_rounded_property_info: LVGLPropertyInfo = {
    name: "arc_rounded",
    displayName: "Rounded",
    type: PropertyType.Boolean,
    checkboxStyleSwitch: true,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ARC_ROUNDED,
        description:
            "Make the end points of the arcs rounded. true: rounded, false: perpendicular line ending",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const arc_color_property_info: LVGLPropertyInfo = {
    name: "arc_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ARC_COLOR,
        description: "Set the color of the arc.",
        defaultValue: "0x000000",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const arc_opa_property_info: LVGLPropertyInfo = {
    name: "arc_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ARC_OPA,
        description: "Set the opacity of the arcs.",
        defaultValue: "LV_OPA_COVER",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const arc_img_src_property_info: LVGLPropertyInfo = {
    name: "arc_img_src",
    displayName: "Image source",
    type: PropertyType.ObjectReference,
    referencedObjectCollectionPath: "bitmaps",
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ARC_IMG_SRC,
        description:
            "Set an image from which the arc will be masked out. It's useful to display complex effects on the arcs. Can be a pointer to lv_img_dsc_t or a path to a file",
        defaultValue: "NULL",
        inherited: false,
        layout: false,
        extDraw: false
    }
};

//
// TEXT
//

const text_color_property_info: LVGLPropertyInfo = {
    name: "text_color",
    displayName: "Color",
    type: PropertyType.ThemedColor,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_COLOR,
        description: "Sets the color of the text.",
        defaultValue: "0x000000",
        inherited: true,
        layout: false,
        extDraw: false
    }
};
const text_opa_property_info: LVGLPropertyInfo = {
    name: "text_opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_OPA,
        description:
            "Set the opacity of the text. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: true,
        layout: false,
        extDraw: false
    }
};
export const text_font_property_info: LVGLPropertyInfo = {
    name: "text_font",
    displayName: "Font",
    type: PropertyType.Enum,
    referencedObjectCollectionPath: "fonts",
    enumItems: (propertyValueHolder: PropertyValueHolder) => {
        return [
            ...propertyValueHolder.projectStore.project.fonts.map(font => ({
                id: font.name,
                label: font.name
            })),
            ...BUILT_IN_FONTS.map(id => ({ id, label: id }))
        ];
    },
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_FONT,
        description: "Set the font of the text (a pointer lv_font_t *).",
        defaultValue: "LV_FONT_DEFAULT",
        inherited: true,
        layout: true,
        extDraw: false
    }
};
const text_letter_space_property_info: LVGLPropertyInfo = {
    name: "text_letter_space",
    displayName: "Letter space",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_LETTER_SPACE,
        description: "Set the letter space in pixels",
        defaultValue: "0",
        inherited: true,
        layout: true,
        extDraw: false
    }
};
const text_line_space_property_info: LVGLPropertyInfo = {
    name: "text_line_space",
    displayName: "Line space",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_LINE_SPACE,
        description: "Set the line space in pixels.",
        defaultValue: "0",
        inherited: true,
        layout: true,
        extDraw: false
    }
};
const text_decor_property_info = makeEnumPropertyInfo(
    "text_decor",
    "Decoration",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_DECOR,
        description:
            "Set decoration for the text. The possible values are LV_TEXT_DECOR_NONE/UNDERLINE/STRIKETHROUGH. OR-ed values can be used as well.",
        defaultValue: "LV_TEXT_DECOR_NONE",
        inherited: true,
        layout: false,
        extDraw: false
    },
    ["NONE", "UNDERLINE", "STRIKETHROUGH"],
    "LV_TEXT_DECOR_"
);
const text_align_property_info = makeEnumPropertyInfo(
    "text_align",
    "Align",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TEXT_ALIGN,
        description:
            "Set how to align the lines of the text. Note that it doesn't align the object itself, only the lines inside the object. The possible values are LV_TEXT_ALIGN_LEFT/CENTER/RIGHT/AUTO. LV_TEXT_ALIGN_AUTO detect the text base direction and uses left or right alignment accordingly",
        defaultValue: "LV_TEXT_ALIGN_AUTO",
        inherited: true,
        layout: true,
        extDraw: false
    },
    ["AUTO", "LEFT", "CENTER", "RIGHT"],
    "LV_TEXT_ALIGN_"
);

//
// MISCELLANEOUS
//

export const radius_property_info: LVGLPropertyInfo = {
    name: "radius",
    displayName: "Radius",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_RADIUS,
        description:
            "Set the radius on every corner. The value is interpreted in pixel (>= 0) or LV_RADIUS_CIRCLE for max. radius",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const clip_corner_property_info: LVGLPropertyInfo = {
    name: "clip_corner",
    displayName: "Clip corner",
    type: PropertyType.Boolean,
    checkboxStyleSwitch: true,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_CLIP_CORNER,
        description:
            "Enable to clip the overflowed content on the rounded corner. Can be true or false.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
export const opa_property_info: LVGLPropertyInfo = {
    name: "opa",
    displayName: "Opacity",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_OPA,
        description:
            "Scale down all opacity values of the object by this factor. Value 0, LV_OPA_0 or LV_OPA_TRANSP means fully transparent, 255, LV_OPA_100 or LV_OPA_COVER means fully covering, other values or LV_OPA_10, LV_OPA_20, etc means semi transparency.",
        defaultValue: "LV_OPA_COVER",
        inherited: true,
        layout: false,
        extDraw: false
    }
};
const color_filter_dsc_property_info: LVGLPropertyInfo = {
    name: "color_filter_dsc",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_COLOR_FILTER_DSC,
        description: "Mix a color to all colors of the object.",
        defaultValue: "NULL",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const color_filter_opa_property_info: LVGLPropertyInfo = {
    name: "color_filter_opa",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_COLOR_FILTER_OPA,
        description: "The intensity of mixing of color filter.",
        defaultValue: "LV_OPA_TRANSP",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const anim_property_info: LVGLPropertyInfo = {
    name: "anim",
    type: PropertyType.Any,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ANIM,
        description:
            "The animation template for the object's animation. Should be a pointer to lv_anim_t. The animation parameters are widget specific, e.g. animation time could be the E.g. blink time of the cursor on the text area or scroll time of a roller. See the widgets' documentation to learn more.",
        defaultValue: "NULL",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const anim_time_property_info: LVGLPropertyInfo = {
    name: "anim_time",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ANIM_TIME,
        description:
            "The animation time in milliseconds. Its meaning is widget specific. E.g. blink time of the cursor on the text area or scroll time of a roller. See the widgets' documentation to learn more.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const anim_duration_property_info: LVGLPropertyInfo = {
    name: "anim_duration",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ANIM_DURATION,
        description: "",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const anim_speed_property_info: LVGLPropertyInfo = {
    name: "anim_speed",
    type: PropertyType.Number,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_ANIM_SPEED,
        description:
            "The animation speed in pixel/sec. Its meaning is widget specific. E.g. scroll speed of label. See the widgets' documentation to learn more.",
        defaultValue: "0",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const transition_property_info: LVGLPropertyInfo = {
    name: "transition",
    type: PropertyType.Any,
    lvglStyleProp: {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_TRANSITION,
        description:
            "An initialized lv_style_transition_dsc_t to describe a transition.",
        defaultValue: "NULL",
        inherited: false,
        layout: false,
        extDraw: false
    }
};
const blend_mode_property_info = makeEnumPropertyInfo(
    "blend_mode",
    "Blend mode",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BLEND_MODE,
        description:
            "Describes how to blend the colors to the background. The possible values are LV_BLEND_MODE_NORMAL/ADDITIVE/SUBTRACTIVE/MULTIPLY",
        defaultValue: "LV_BLEND_MODE_NORMAL",
        inherited: false,
        layout: false,
        extDraw: false
    },
    [
        "NORMAL", // Simply mix according to the opacity value
        "ADDITIVE", // Add the respective color channels
        "SUBTRACTIVE", // Subtract the foreground from the background
        "MULTIPLY", // Multiply the foreground and background
        "REPLACE" // Replace background with foreground in the area
    ],
    "LV_BLEND_MODE_"
);
const base_dir_property_info = makeEnumPropertyInfo(
    "base_dir",
    "Base direction",
    {
        code: LVGL_STYLE_PROP_CODES.LV_STYLE_BASE_DIR,
        description:
            "Set the base direction of the object. The possible values are LV_BIDI_DIR_LTR/RTL/AUTO.",
        defaultValue: "LV_BASE_DIR_AUTO",
        inherited: true,
        layout: true,
        extDraw: false
    },
    ["LTR", "RTL", "AUTO"],
    "LV_BASE_DIR_"
);

////////////////////////////////////////////////////////////////////////////////

export interface LVGLPropertiesGroup {
    groupName: string;
    groupDescription: string;
    properties: LVGLPropertyInfo[];
}

export const lvglProperties: LVGLPropertiesGroup[] = [
    {
        groupName: "POSITION AND SIZE",
        groupDescription:
            "Properties related to size, position, alignment and layout of the objects.",
        properties: [
            align_property_info,
            //width_property_info,
            //height_property_info,

            length_property_info,

            min_width_property_info,
            max_width_property_info,
            min_height_property_info,
            max_height_property_info,

            //x_property_info,
            //y_property_info,

            transform_width_property_info,
            transform_height_property_info,
            translate_x_property_info,
            translate_y_property_info,

            transform_zoom_property_info,
            transform_scale_x_property_info,
            transform_scale_y_property_info,

            transform_angle_property_info,
            transform_rotation_property_info,

            transform_pivot_x_property_info,
            transform_pivot_y_property_info,

            transform_skew_x_property_info,
            transform_skew_y_property_info
        ]
    },

    {
        groupName: "LAYOUT",
        groupDescription: "Properties to describe layout.",
        properties: [
            layout_property_info,
            flex_flow_property_info,
            flex_main_place_property_info,
            flex_cross_place_property_info,
            flex_track_place_property_info,
            flex_grow_property_info
        ]
    },

    {
        groupName: "PADDING",
        groupDescription:
            "Properties to describe spacing between the parent's sides and the children and among the children. Very similar to the padding properties in HTML.",
        properties: [
            pad_top_property_info,
            pad_bottom_property_info,
            pad_left_property_info,
            pad_right_property_info,
            pad_row_property_info,
            pad_column_property_info
        ]
    },

    {
        groupName: "MARGIN",
        groupDescription:
            "Properties to describe spacing around an object. Very similar to the margin properties in HTML.",
        properties: [
            margin_top_property_info,
            margin_bottom_property_info,
            margin_left_property_info,
            margin_right_property_info
        ]
    },

    {
        groupName: "BACKGROUND",
        groupDescription:
            "Properties to describe the background color and image of the objects.",
        properties: [
            bg_color_property_info,
            bg_opa_property_info,

            bg_grad_dir_property_info,
            bg_grad_color_property_info,
            bg_grad_stop_property_info,
            bg_main_stop_property_info,

            bg_main_opa_property_info,
            bg_grad_opa_property_info,
            //bg_grad_property_info,
            bg_dither_mode_property_info,

            bg_img_src_property_info,
            bg_img_opa_property_info,
            bg_img_recolor_property_info,
            bg_img_recolor_opa_property_info,

            bg_img_tiled_property_info
        ]
    },

    {
        groupName: "BORDER",
        groupDescription: "Properties to describe the borders",
        properties: [
            border_color_property_info,
            border_opa_property_info,
            border_width_property_info,
            border_side_property_info,
            border_post_property_info
        ]
    },

    {
        groupName: "OUTLINE",
        groupDescription:
            "Properties to describe the outline. It's like a border but drawn outside of the rectangles.",
        properties: [
            outline_width_property_info,
            outline_color_property_info,
            outline_opa_property_info,
            outline_pad_property_info
        ]
    },

    {
        groupName: "SHADOW",
        groupDescription:
            "Properties to describe the shadow drawn under the rectangles.",
        properties: [
            shadow_width_property_info,
            shadow_ofs_x_property_info,
            shadow_ofs_y_property_info,
            shadow_spread_property_info,
            shadow_color_property_info,
            shadow_opa_property_info
        ]
    },

    {
        groupName: "IMAGE",
        groupDescription: "Properties to describe the images",
        properties: [
            img_opa_property_info,
            img_recolor_property_info,
            img_recolor_opa_property_info
        ]
    },

    {
        groupName: "LINE",
        groupDescription: "Properties to describe line-like objects",
        properties: [
            line_width_property_info,
            line_dash_width_property_info,
            line_dash_gap_property_info,
            line_rounded_property_info,
            line_color_property_info,
            line_opa_property_info
        ]
    },

    {
        groupName: "ARC",
        groupDescription: "TODO",
        properties: [
            arc_width_property_info,
            arc_rounded_property_info,
            arc_color_property_info,
            arc_opa_property_info,
            arc_img_src_property_info
        ]
    },

    {
        groupName: "TEXT",
        groupDescription:
            "Properties to describe the properties of text. All these properties are inherited.",
        properties: [
            text_color_property_info,
            text_opa_property_info,
            text_font_property_info,
            text_letter_space_property_info,
            text_line_space_property_info,
            text_decor_property_info,
            text_align_property_info
        ]
    },

    {
        groupName: "MISCELLANEOUS",
        groupDescription: "Mixed properties for various purposes.",
        properties: [
            radius_property_info,
            clip_corner_property_info,
            opa_property_info,
            //color_filter_dsc_property_info,
            //color_filter_opa_property_info,
            //anim_property_info,
            //anim_time_property_info,
            //anim_speed_property_info,
            //transition_property_info,
            blend_mode_property_info,
            base_dir_property_info,

            anim_time_property_info,
            anim_duration_property_info,
            anim_speed_property_info
        ]
    }
];

export const unusedProperties = [
    width_property_info,
    height_property_info,
    x_property_info,
    y_property_info,

    bg_grad_property_info,

    color_filter_dsc_property_info,
    color_filter_opa_property_info,
    anim_property_info,
    transition_property_info
];

export const lvglPropertiesMap = new Map<string, LVGLPropertyInfo>();
lvglProperties.forEach(propertyGroup =>
    propertyGroup.properties.forEach(property => {
        if (lvglPropertiesMap.get(property.name)) {
            console.error("UNEXPECTED!", property.name);
        }
        lvglPropertiesMap.set(property.name, property);
    })
);

export function isLvglStylePropertySupported(
    object: IEezObject,
    propertyInfo: LVGLPropertyInfo
) {
    const lvglVersion =
        ProjectEditor.getProject(object).settings.general.lvglVersion;
    return propertyInfo.lvglStyleProp.code[lvglVersion] != undefined;
}

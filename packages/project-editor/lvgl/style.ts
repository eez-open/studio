import { makeObservable, observable } from "mobx";
import {
    ClassInfo,
    EezObject,
    PropertyInfo,
    PropertyType,
    registerClass
} from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

type LVGLPropertyValue = unknown;

//
// SIZE AND POSITION
//

const width_property_info: PropertyInfo = {
    name: "width",
    type: PropertyType.LVGLStyleProperty
};
const min_width_property_info: PropertyInfo = {
    name: "min_width",
    type: PropertyType.LVGLStyleProperty
};
const max_width_property_info: PropertyInfo = {
    name: "max_width",
    type: PropertyType.LVGLStyleProperty
};
const height_property_info: PropertyInfo = {
    name: "height",
    type: PropertyType.LVGLStyleProperty
};
const min_height_property_info: PropertyInfo = {
    name: "min_height",
    type: PropertyType.LVGLStyleProperty
};
const max_height_property_info: PropertyInfo = {
    name: "max_height",
    type: PropertyType.LVGLStyleProperty
};
const x_property_info: PropertyInfo = {
    name: "x",
    type: PropertyType.LVGLStyleProperty
};
const y_property_info: PropertyInfo = {
    name: "y",
    type: PropertyType.LVGLStyleProperty
};
const align_property_info: PropertyInfo = {
    name: "align",
    type: PropertyType.LVGLStyleProperty
};
const transform_width_property_info: PropertyInfo = {
    name: "transform_width",
    type: PropertyType.LVGLStyleProperty
};
const transform_height_property_info: PropertyInfo = {
    name: "transform_height",
    type: PropertyType.LVGLStyleProperty
};
const translate_x_property_info: PropertyInfo = {
    name: "translate_x",
    type: PropertyType.LVGLStyleProperty
};
const translate_y_property_info: PropertyInfo = {
    name: "translate_y",
    type: PropertyType.LVGLStyleProperty
};
const transform_zoom_property_info: PropertyInfo = {
    name: "transform_zoom",
    type: PropertyType.LVGLStyleProperty
};
const transform_angle_property_info: PropertyInfo = {
    name: "transform_angle",
    type: PropertyType.LVGLStyleProperty
};
const transform_pivot_x_property_info: PropertyInfo = {
    name: "transform_pivot_x",
    type: PropertyType.LVGLStyleProperty
};
const transform_pivot_y_property_info: PropertyInfo = {
    name: "transform_pivot_y",
    type: PropertyType.LVGLStyleProperty
};

//
// PADDING
//

const pad_top_property_info: PropertyInfo = {
    name: "pad_top",
    type: PropertyType.LVGLStyleProperty
};
const pad_bottom_property_info: PropertyInfo = {
    name: "pad_bottom",
    type: PropertyType.LVGLStyleProperty
};
const pad_left_property_info: PropertyInfo = {
    name: "pad_left",
    type: PropertyType.LVGLStyleProperty
};
const pad_right_property_info: PropertyInfo = {
    name: "pad_right",
    type: PropertyType.LVGLStyleProperty
};
const pad_row_property_info: PropertyInfo = {
    name: "pad_row",
    type: PropertyType.LVGLStyleProperty
};
const pad_column_property_info: PropertyInfo = {
    name: "pad_column",
    type: PropertyType.LVGLStyleProperty
};

//
// BACKGROUND
//

const bg_color_property_info: PropertyInfo = {
    name: "bg_color",
    type: PropertyType.LVGLStyleProperty
};
const bg_opa_property_info: PropertyInfo = {
    name: "bg_opa",
    type: PropertyType.LVGLStyleProperty
};
const bg_grad_color_property_info: PropertyInfo = {
    name: "bg_grad_color",
    type: PropertyType.LVGLStyleProperty
};
const bg_grad_dir_property_info: PropertyInfo = {
    name: "bg_grad_dir",
    type: PropertyType.LVGLStyleProperty
};
const bg_main_stop_property_info: PropertyInfo = {
    name: "bg_main_stop",
    type: PropertyType.LVGLStyleProperty
};
const bg_grad_stop_property_info: PropertyInfo = {
    name: "bg_grad_stop",
    type: PropertyType.LVGLStyleProperty
};
const bg_grad_property_info: PropertyInfo = {
    name: "bg_grad",
    type: PropertyType.LVGLStyleProperty
};
const bg_dither_mode_property_info: PropertyInfo = {
    name: "bg_dither_mode",
    type: PropertyType.LVGLStyleProperty
};
const bg_img_src_property_info: PropertyInfo = {
    name: "bg_img_src",
    type: PropertyType.LVGLStyleProperty
};
const bg_img_opa_property_info: PropertyInfo = {
    name: "bg_img_opa",
    type: PropertyType.LVGLStyleProperty
};
const bg_img_recolor_property_info: PropertyInfo = {
    name: "bg_img_recolor",
    type: PropertyType.LVGLStyleProperty
};
const bg_img_recolor_opa_property_info: PropertyInfo = {
    name: "bg_img_recolor_opa",
    type: PropertyType.LVGLStyleProperty
};
const bg_img_tiled_property_info: PropertyInfo = {
    name: "bg_img_tiled",
    type: PropertyType.LVGLStyleProperty
};

//
// BORDER
//

const border_color_property_info: PropertyInfo = {
    name: "border_color",
    type: PropertyType.LVGLStyleProperty
};
const border_opa_property_info: PropertyInfo = {
    name: "border_opa",
    type: PropertyType.LVGLStyleProperty
};
const border_width_property_info: PropertyInfo = {
    name: "border_width",
    type: PropertyType.LVGLStyleProperty
};
const border_side_property_info: PropertyInfo = {
    name: "border_side",
    type: PropertyType.LVGLStyleProperty
};
const border_post_property_info: PropertyInfo = {
    name: "border_post",
    type: PropertyType.LVGLStyleProperty
};

//
// OUTLINE
//

const outline_width_property_info: PropertyInfo = {
    name: "outline_width",
    type: PropertyType.LVGLStyleProperty
};
const outline_color_property_info: PropertyInfo = {
    name: "outline_color",
    type: PropertyType.LVGLStyleProperty
};
const outline_opa_property_info: PropertyInfo = {
    name: "outline_opa",
    type: PropertyType.LVGLStyleProperty
};
const outline_pad_property_info: PropertyInfo = {
    name: "outline_pad",
    type: PropertyType.LVGLStyleProperty
};

//
// SHADOW
//

const shadow_width_property_info: PropertyInfo = {
    name: "shadow_width",
    type: PropertyType.LVGLStyleProperty
};
const shadow_ofs_x_property_info: PropertyInfo = {
    name: "shadow_ofs_x",
    type: PropertyType.LVGLStyleProperty
};
const shadow_ofs_y_property_info: PropertyInfo = {
    name: "shadow_ofs_y",
    type: PropertyType.LVGLStyleProperty
};
const shadow_spread_property_info: PropertyInfo = {
    name: "shadow_spread",
    type: PropertyType.LVGLStyleProperty
};
const shadow_color_property_info: PropertyInfo = {
    name: "shadow_color",
    type: PropertyType.LVGLStyleProperty
};
const shadow_opa_property_info: PropertyInfo = {
    name: "shadow_opa",
    type: PropertyType.LVGLStyleProperty
};

//
// IMAGE
//

const img_opa_property_info: PropertyInfo = {
    name: "img_opa",
    type: PropertyType.LVGLStyleProperty
};
const img_recolor_property_info: PropertyInfo = {
    name: "img_recolor",
    type: PropertyType.LVGLStyleProperty
};
const img_recolor_opa_property_info: PropertyInfo = {
    name: "img_recolor_opa",
    type: PropertyType.LVGLStyleProperty
};

//
// LINE
//

const line_width_property_info: PropertyInfo = {
    name: "line_width",
    type: PropertyType.LVGLStyleProperty
};
const line_dash_width_property_info: PropertyInfo = {
    name: "line_dash_width",
    type: PropertyType.LVGLStyleProperty
};
const line_dash_gap_property_info: PropertyInfo = {
    name: "line_dash_gap",
    type: PropertyType.LVGLStyleProperty
};
const line_rounded_property_info: PropertyInfo = {
    name: "line_rounded",
    type: PropertyType.LVGLStyleProperty
};
const line_color_property_info: PropertyInfo = {
    name: "line_color",
    type: PropertyType.LVGLStyleProperty
};
const line_opa_property_info: PropertyInfo = {
    name: "line_opa",
    type: PropertyType.LVGLStyleProperty
};

//
// ARC
//

const arc_width_property_info: PropertyInfo = {
    name: "arc_width",
    type: PropertyType.LVGLStyleProperty
};
const arc_rounded_property_info: PropertyInfo = {
    name: "arc_rounded",
    type: PropertyType.LVGLStyleProperty
};
const arc_color_property_info: PropertyInfo = {
    name: "arc_color",
    type: PropertyType.LVGLStyleProperty
};
const arc_opa_property_info: PropertyInfo = {
    name: "arc_opa",
    type: PropertyType.LVGLStyleProperty
};
const arc_img_src_property_info: PropertyInfo = {
    name: "arc_img_src",
    type: PropertyType.LVGLStyleProperty
};

//
// TEXT
//

const text_color_property_info: PropertyInfo = {
    name: "text_color",
    type: PropertyType.LVGLStyleProperty
};
const text_opa_property_info: PropertyInfo = {
    name: "text_opa",
    type: PropertyType.LVGLStyleProperty
};
const text_font_property_info: PropertyInfo = {
    name: "text_font",
    type: PropertyType.LVGLStyleProperty
};
const text_letter_space_property_info: PropertyInfo = {
    name: "text_letter_space",
    type: PropertyType.LVGLStyleProperty
};
const text_line_space_property_info: PropertyInfo = {
    name: "text_line_space",
    type: PropertyType.LVGLStyleProperty
};
const text_decor_property_info: PropertyInfo = {
    name: "text_decor",
    type: PropertyType.LVGLStyleProperty
};
const text_align_property_info: PropertyInfo = {
    name: "text_align",
    type: PropertyType.LVGLStyleProperty
};

//
// MISCELLANEOUS
//

const radius_property_info: PropertyInfo = {
    name: "radius",
    type: PropertyType.LVGLStyleProperty
};
const clip_corner_property_info: PropertyInfo = {
    name: "clip_corner",
    type: PropertyType.LVGLStyleProperty
};
const opa_property_info: PropertyInfo = {
    name: "opa",
    type: PropertyType.LVGLStyleProperty
};
const color_filter_dsc_property_info: PropertyInfo = {
    name: "color_filter_dsc",
    type: PropertyType.LVGLStyleProperty
};
const color_filter_opa_property_info: PropertyInfo = {
    name: "color_filter_opa",
    type: PropertyType.LVGLStyleProperty
};
const anim_property_info: PropertyInfo = {
    name: "anim",
    type: PropertyType.LVGLStyleProperty
};
const anim_time_property_info: PropertyInfo = {
    name: "anim_time",
    type: PropertyType.LVGLStyleProperty
};
const anim_speed_property_info: PropertyInfo = {
    name: "anim_speed",
    type: PropertyType.LVGLStyleProperty
};
const transition_property_info: PropertyInfo = {
    name: "transition",
    type: PropertyType.LVGLStyleProperty
};
const blend_mode_property_info: PropertyInfo = {
    name: "blend_mode",
    type: PropertyType.LVGLStyleProperty
};
const layout_property_info: PropertyInfo = {
    name: "layout",
    type: PropertyType.LVGLStyleProperty
};
const base_dir_property_info: PropertyInfo = {
    name: "base_dir",
    type: PropertyType.LVGLStyleProperty
};

export class LVGLStyleProperties extends EezObject {
    // SIZE AND POSITION
    width_property_info?: LVGLPropertyValue;
    min_width_property_info?: LVGLPropertyValue;
    max_width_property_info?: LVGLPropertyValue;
    height_property_info?: LVGLPropertyValue;
    min_height_property_info?: LVGLPropertyValue;
    max_height_property_info?: LVGLPropertyValue;
    x_property_info?: LVGLPropertyValue;
    y_property_info?: LVGLPropertyValue;
    align_property_info?: LVGLPropertyValue;
    transform_width_property_info?: LVGLPropertyValue;
    transform_height_property_info?: LVGLPropertyValue;
    translate_x_property_info?: LVGLPropertyValue;
    translate_y_property_info?: LVGLPropertyValue;
    transform_zoom_property_info?: LVGLPropertyValue;
    transform_angle_property_info?: LVGLPropertyValue;
    transform_pivot_x_property_info?: LVGLPropertyValue;
    transform_pivot_y_property_info?: LVGLPropertyValue;

    // PADDING
    pad_top_property_info?: LVGLPropertyValue;
    pad_bottom_property_info?: LVGLPropertyValue;
    pad_left_property_info?: LVGLPropertyValue;
    pad_right_property_info?: LVGLPropertyValue;
    pad_row_property_info?: LVGLPropertyValue;
    pad_column_property_info?: LVGLPropertyValue;

    // BACKGROUND
    bg_color_property_info?: LVGLPropertyValue;
    bg_opa_property_info?: LVGLPropertyValue;
    bg_grad_color_property_info?: LVGLPropertyValue;
    bg_grad_dir_property_info?: LVGLPropertyValue;
    bg_main_stop_property_info?: LVGLPropertyValue;
    bg_grad_stop_property_info?: LVGLPropertyValue;
    bg_grad_property_info?: LVGLPropertyValue;
    bg_dither_mode_property_info?: LVGLPropertyValue;
    bg_img_src_property_info?: LVGLPropertyValue;
    bg_img_opa_property_info?: LVGLPropertyValue;
    bg_img_recolor_property_info?: LVGLPropertyValue;
    bg_img_recolor_opa_property_info?: LVGLPropertyValue;
    bg_img_tiled_property_info?: LVGLPropertyValue;

    // BORDER
    border_color_property_info?: LVGLPropertyValue;
    border_opa_property_info?: LVGLPropertyValue;
    border_width_property_info?: LVGLPropertyValue;
    border_side_property_info?: LVGLPropertyValue;
    border_post_property_info?: LVGLPropertyValue;

    // OUTLINE
    outline_width_property_info?: LVGLPropertyValue;
    outline_color_property_info?: LVGLPropertyValue;
    outline_opa_property_info?: LVGLPropertyValue;
    outline_pad_property_info?: LVGLPropertyValue;

    // SHADOW
    shadow_width_property_info?: LVGLPropertyValue;
    shadow_ofs_x_property_info?: LVGLPropertyValue;
    shadow_ofs_y_property_info?: LVGLPropertyValue;
    shadow_spread_property_info?: LVGLPropertyValue;
    shadow_color_property_info?: LVGLPropertyValue;
    shadow_opa_property_info?: LVGLPropertyValue;

    // IMAGE
    img_opa_property_info?: LVGLPropertyValue;
    img_recolor_property_info?: LVGLPropertyValue;
    img_recolor_opa_property_info?: LVGLPropertyValue;

    // LINE
    line_width_property_info?: LVGLPropertyValue;
    line_dash_width_property_info?: LVGLPropertyValue;
    line_dash_gap_property_info?: LVGLPropertyValue;
    line_rounded_property_info?: LVGLPropertyValue;
    line_color_property_info?: LVGLPropertyValue;
    line_opa_property_info?: LVGLPropertyValue;

    // ARC
    arc_width_property_info?: LVGLPropertyValue;
    arc_rounded_property_info?: LVGLPropertyValue;
    arc_color_property_info?: LVGLPropertyValue;
    arc_opa_property_info?: LVGLPropertyValue;
    arc_img_src_property_info?: LVGLPropertyValue;

    // TEXT
    text_color_property_info?: LVGLPropertyValue;
    text_opa_property_info?: LVGLPropertyValue;
    text_font_property_info?: LVGLPropertyValue;
    text_letter_space_property_info?: LVGLPropertyValue;
    text_line_space_property_info?: LVGLPropertyValue;
    text_decor_property_info?: LVGLPropertyValue;
    text_align_property_info?: LVGLPropertyValue;

    // MISCELLANEOUS
    radius_property_info?: LVGLPropertyValue;
    clip_corner_property_info?: LVGLPropertyValue;
    opa_property_info?: LVGLPropertyValue;
    color_filter_dsc_property_info?: LVGLPropertyValue;
    color_filter_opa_property_info?: LVGLPropertyValue;
    anim_property_info?: LVGLPropertyValue;
    anim_time_property_info?: LVGLPropertyValue;
    anim_speed_property_info?: LVGLPropertyValue;
    transition_property_info?: LVGLPropertyValue;
    blend_mode_property_info?: LVGLPropertyValue;
    layout_property_info?: LVGLPropertyValue;
    base_dir_property_info?: LVGLPropertyValue;

    static classInfo: ClassInfo = {
        properties: [
            // SIZE AND POSITION
            width_property_info,
            min_width_property_info,
            max_width_property_info,
            height_property_info,
            min_height_property_info,
            max_height_property_info,
            x_property_info,
            y_property_info,
            align_property_info,
            transform_width_property_info,
            transform_height_property_info,
            translate_x_property_info,
            translate_y_property_info,
            transform_zoom_property_info,
            transform_angle_property_info,
            transform_pivot_x_property_info,
            transform_pivot_y_property_info,

            // PADDING
            pad_top_property_info,
            pad_bottom_property_info,
            pad_left_property_info,
            pad_right_property_info,
            pad_row_property_info,
            pad_column_property_info,

            // BACKGROUND
            bg_color_property_info,
            bg_opa_property_info,
            bg_grad_color_property_info,
            bg_grad_dir_property_info,
            bg_main_stop_property_info,
            bg_grad_stop_property_info,
            bg_grad_property_info,
            bg_dither_mode_property_info,
            bg_img_src_property_info,
            bg_img_opa_property_info,
            bg_img_recolor_property_info,
            bg_img_recolor_opa_property_info,
            bg_img_tiled_property_info,

            // BORDER
            border_color_property_info,
            border_opa_property_info,
            border_width_property_info,
            border_side_property_info,
            border_post_property_info,

            // OUTLINE
            outline_width_property_info,
            outline_color_property_info,
            outline_opa_property_info,
            outline_pad_property_info,

            // SHADOW
            shadow_width_property_info,
            shadow_ofs_x_property_info,
            shadow_ofs_y_property_info,
            shadow_spread_property_info,
            shadow_color_property_info,
            shadow_opa_property_info,

            // IMAGE
            img_opa_property_info,
            img_recolor_property_info,
            img_recolor_opa_property_info,

            // LINE
            line_width_property_info,
            line_dash_width_property_info,
            line_dash_gap_property_info,
            line_rounded_property_info,
            line_color_property_info,
            line_opa_property_info,

            // ARC
            arc_width_property_info,
            arc_rounded_property_info,
            arc_color_property_info,
            arc_opa_property_info,
            arc_img_src_property_info,

            // TEXT
            text_color_property_info,
            text_opa_property_info,
            text_font_property_info,
            text_letter_space_property_info,
            text_line_space_property_info,
            text_decor_property_info,
            text_align_property_info,

            // MISCELLANEOUS
            radius_property_info,
            clip_corner_property_info,
            opa_property_info,
            color_filter_dsc_property_info,
            color_filter_opa_property_info,
            anim_property_info,
            anim_time_property_info,
            anim_speed_property_info,
            transition_property_info,
            blend_mode_property_info,
            layout_property_info,
            base_dir_property_info
        ],
        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            // SIZE AND POSITION
            width_property_info: observable,
            min_width_property_info: observable,
            max_width_property_info: observable,
            height_property_info: observable,
            min_height_property_info: observable,
            max_height_property_info: observable,
            x_property_info: observable,
            y_property_info: observable,
            align_property_info: observable,
            transform_width_property_info: observable,
            transform_height_property_info: observable,
            translate_x_property_info: observable,
            translate_y_property_info: observable,
            transform_zoom_property_info: observable,
            transform_angle_property_info: observable,
            transform_pivot_x_property_info: observable,
            transform_pivot_y_property_info: observable,

            // PADDING
            pad_top_property_info: observable,
            pad_bottom_property_info: observable,
            pad_left_property_info: observable,
            pad_right_property_info: observable,
            pad_row_property_info: observable,
            pad_column_property_info: observable,

            // BACKGROUND
            bg_color_property_info: observable,
            bg_opa_property_info: observable,
            bg_grad_color_property_info: observable,
            bg_grad_dir_property_info: observable,
            bg_main_stop_property_info: observable,
            bg_grad_stop_property_info: observable,
            bg_grad_property_info: observable,
            bg_dither_mode_property_info: observable,
            bg_img_src_property_info: observable,
            bg_img_opa_property_info: observable,
            bg_img_recolor_property_info: observable,
            bg_img_recolor_opa_property_info: observable,
            bg_img_tiled_property_info: observable,

            // BORDER
            border_color_property_info: observable,
            border_opa_property_info: observable,
            border_width_property_info: observable,
            border_side_property_info: observable,
            border_post_property_info: observable,

            // OUTLINE
            outline_width_property_info: observable,
            outline_color_property_info: observable,
            outline_opa_property_info: observable,
            outline_pad_property_info: observable,

            // SHADOW
            shadow_width_property_info: observable,
            shadow_ofs_x_property_info: observable,
            shadow_ofs_y_property_info: observable,
            shadow_spread_property_info: observable,
            shadow_color_property_info: observable,
            shadow_opa_property_info: observable,

            // IMAGE
            img_opa_property_info: observable,
            img_recolor_property_info: observable,
            img_recolor_opa_property_info: observable,

            // LINE
            line_width_property_info: observable,
            line_dash_width_property_info: observable,
            line_dash_gap_property_info: observable,
            line_rounded_property_info: observable,
            line_color_property_info: observable,
            line_opa_property_info: observable,

            // ARC
            arc_width_property_info: observable,
            arc_rounded_property_info: observable,
            arc_color_property_info: observable,
            arc_opa_property_info: observable,
            arc_img_src_property_info: observable,

            // TEXT
            text_color_property_info: observable,
            text_opa_property_info: observable,
            text_font_property_info: observable,
            text_letter_space_property_info: observable,
            text_line_space_property_info: observable,
            text_decor_property_info: observable,
            text_align_property_info: observable,

            // MISCELLANEOUS
            radius_property_info: observable,
            clip_corner_property_info: observable,
            opa_property_info: observable,
            color_filter_dsc_property_info: observable,
            color_filter_opa_property_info: observable,
            anim_property_info: observable,
            anim_time_property_info: observable,
            anim_speed_property_info: observable,
            transition_property_info: observable,
            blend_mode_property_info: observable,
            layout_property_info: observable,
            base_dir_property_info: observable
        });
    }
}

registerClass("LVGLStyleProperties", LVGLStyleProperties);

////////////////////////////////////////////////////////////////////////////////

export class LVGLStyleDefinition extends EezObject {
    source: "local" | "global" | "rule";
    selector?: unknown; // if not rule
    styleProperties?: LVGLStyleProperties; // if local
    styleRef?: string; // if global
    ruleRef?: string; // if rule

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "styleProperties",
                type: PropertyType.Object,
                typeClass: LVGLStyleProperties,
                propertyGridCollapsable: true,
                enumerable: false,
                isOptional: true
            }
        ],
        defaultValue: {}
    };

    constructor() {
        super();

        makeObservable(this, {
            source: observable,
            selector: observable,
            styleProperties: observable,
            styleRef: observable,
            ruleRef: observable
        });
    }
}

registerClass("LVGLStyleDefinition", LVGLStyleDefinition);

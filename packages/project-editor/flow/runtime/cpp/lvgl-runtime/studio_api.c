#include <stdlib.h>
#include <stdio.h>
#include <emscripten.h>

#include "lvgl/lvgl.h"

#define EM_PORT_API(rettype) rettype EMSCRIPTEN_KEEPALIVE

EM_PORT_API(lv_obj_t *) lvglCreateContainer(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    if (parentObj == 0) {
        lv_scr_load(obj);
    }
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateLabel(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, char *text, lv_label_long_mode_t long_mode, bool recolor) {
    lv_obj_t *obj = lv_label_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_label_set_long_mode(obj, long_mode);
    lv_label_set_text(obj, text);
    lv_label_set_recolor(obj, recolor);
    free(text);
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateButton(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_btn_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreatePanel(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateImage(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, const void *img_src, lv_coord_t pivotX, lv_coord_t pivotY, uint16_t zoom, int16_t angle) {
    lv_obj_t *obj = lv_img_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    if (img_src != 0) {
        lv_img_set_src(obj, img_src);
    }
    lv_img_set_pivot(obj, pivotX, pivotY);
    lv_img_set_zoom(obj, zoom);
    lv_img_set_angle(obj, angle);
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(void) lvglSetImageSrc(lv_obj_t *obj, const void *img_src) {
    if (img_src != 0) {
        lv_img_set_src(obj, img_src);
    }
    lv_obj_update_layout(obj);
}

EM_PORT_API(lv_obj_t *) lvglCreateSlider(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, int32_t min, int32_t max, lv_slider_mode_t mode, int32_t value, int32_t value_left) {
    lv_obj_t *obj = lv_slider_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_slider_set_range(obj, min, max);
    lv_slider_set_mode(obj, mode);
    lv_slider_set_value(obj, value, LV_ANIM_OFF);
    if (lv_slider_get_mode(obj) == LV_SLIDER_MODE_RANGE) {
        lv_slider_set_left_value(obj, value_left, LV_ANIM_OFF);
    }
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateRoller(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, char *options, lv_roller_mode_t mode) {
    lv_obj_t *obj = lv_roller_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_roller_set_options(obj, options, mode);
    free(options);
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateSwitch(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_switch_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    return obj;
}

EM_PORT_API(void) lvglDeleteObject(lv_obj_t *obj) {
    lv_obj_del(obj);
}

EM_PORT_API(void) lvglObjAddFlag(lv_obj_t *obj, lv_obj_flag_t f) {
    lv_obj_add_flag(obj, f);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjClearFlag(lv_obj_t *obj, lv_obj_flag_t f) {
    lv_obj_clear_flag(obj, f);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjAddState(lv_obj_t *obj, lv_obj_flag_t s) {
    lv_obj_add_state(obj, s);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjClearState(lv_obj_t *obj, lv_obj_flag_t s) {
    lv_obj_clear_state(obj, s);
    lv_obj_update_layout(obj);
}

EM_PORT_API(uint32_t) lvglObjGetStylePropColor(lv_obj_t *obj, lv_part_t part, lv_style_prop_t prop) {
    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);
    return value.color.full;
}

EM_PORT_API(int32_t) lvglObjGetStylePropNum(lv_obj_t *obj, lv_part_t part, lv_style_prop_t prop) {
    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);
    return value.num;
}

EM_PORT_API(void) lvglObjSetLocalStylePropColor(lv_obj_t *obj, lv_style_prop_t prop, uint32_t color, lv_style_selector_t selector) {
    lv_style_value_t value;
    value.color = lv_color_hex(color);
    lv_obj_set_local_style_prop(obj, prop, value, selector);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjSetLocalStylePropNum(lv_obj_t *obj, lv_style_prop_t prop, int32_t num, lv_style_selector_t selector) {
    lv_style_value_t value;
    value.num = num;
    lv_obj_set_local_style_prop(obj, prop, value, selector);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjSetLocalStylePropPtr(lv_obj_t *obj, lv_style_prop_t prop, const void *ptr, lv_style_selector_t selector) {
    lv_style_value_t value;
    value.ptr = ptr;
    lv_obj_set_local_style_prop(obj, prop, value, selector);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjSetLocalStylePropBuiltInFont(lv_obj_t *obj, lv_style_prop_t prop, int font_index, lv_style_selector_t selector) {
    static const lv_font_t *BUILT_IN_FONTS[] = {
        &lv_font_montserrat_8,
        &lv_font_montserrat_10,
        &lv_font_montserrat_12,
        &lv_font_montserrat_14,
        &lv_font_montserrat_16,
        &lv_font_montserrat_18,
        &lv_font_montserrat_20,
        &lv_font_montserrat_22,
        &lv_font_montserrat_24,
        &lv_font_montserrat_26,
        &lv_font_montserrat_28,
        &lv_font_montserrat_30,
        &lv_font_montserrat_32,
        &lv_font_montserrat_34,
        &lv_font_montserrat_36,
        &lv_font_montserrat_38,
        &lv_font_montserrat_40,
        &lv_font_montserrat_42,
        &lv_font_montserrat_44,
        &lv_font_montserrat_46,
        &lv_font_montserrat_48
    };
    lv_style_value_t value;
    value.ptr = BUILT_IN_FONTS[font_index];
    lv_obj_set_local_style_prop(obj, prop, value, selector);
    lv_obj_update_layout(obj);
}

EM_PORT_API(int16_t) lvglGetObjRelX(lv_obj_t *obj) {
    lv_obj_t *parent = lv_obj_get_parent(obj);
    if (parent) {
        return obj->coords.x1 - parent->coords.x1;
    }
    return obj->coords.x1;
}

EM_PORT_API(int16_t) lvglGetObjRelY(lv_obj_t *obj) {
    lv_obj_t *parent = lv_obj_get_parent(obj);
    if (parent) {
        return obj->coords.y1 - parent->coords.y1;
    }
    return obj->coords.y1;
}

EM_PORT_API(int16_t) lvglGetObjWidth(lv_obj_t *obj) {

    return lv_obj_get_width(obj);
}

EM_PORT_API(int16_t) lvglGetObjHeight(lv_obj_t *obj) {
    return lv_obj_get_height(obj);
}

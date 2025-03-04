#include <stdlib.h>
#include <stdio.h>
#include <emscripten.h>

#include "lvgl/lvgl.h"

#include <eez/core/os.h>

#include "flow.h"

EM_PORT_API(lv_obj_t *) lvglCreateScreen(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateUserWidget(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);

    lv_style_value_t value;
    value.num = 0;
    lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_LEFT, value, LV_PART_MAIN);
    lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_TOP, value, LV_PART_MAIN);
    lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_RIGHT, value, LV_PART_MAIN);
    lv_obj_set_local_style_prop(obj, LV_STYLE_PAD_BOTTOM, value, LV_PART_MAIN);
    lv_obj_set_local_style_prop(obj, LV_STYLE_BG_OPA, value, LV_PART_MAIN);
    lv_obj_set_local_style_prop(obj, LV_STYLE_BORDER_WIDTH, value, LV_PART_MAIN);

    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

static lv_obj_t *current_screen = 0;

EM_PORT_API(void) lvglScreenLoad(unsigned page_index, lv_obj_t *obj) {
#if LVGL_VERSION_MAJOR >= 9
    lv_screen_load_anim(obj, (lv_scr_load_anim_t)screenLoad_animType, screenLoad_speed, screenLoad_delay, false);
#else
    lv_scr_load_anim(obj, (lv_scr_load_anim_t)screenLoad_animType, screenLoad_speed, screenLoad_delay, false);
#endif

    current_screen = obj;
    screenLoad_animType = 0;
    screenLoad_speed = 0;
    screenLoad_delay = 0;
    if (page_index != -1) {
        flowOnPageLoadedStudio(page_index);
    }
}

EM_PORT_API(void) lvglDeleteObject(lv_obj_t *obj) {
#if LVGL_VERSION_MAJOR >= 9
    if (obj == lv_screen_active()) {
#else
    if (obj == lv_scr_act()) {
#endif
        printf("delete current screen called, set fallback screen\n");
        static lv_obj_t *fallback_screen = 0;
        if (!fallback_screen) {
            fallback_screen = lv_obj_create(0);
        }
#if LVGL_VERSION_MAJOR >= 9
        lv_screen_load(fallback_screen);
#else
        lv_scr_load(fallback_screen);
#endif
        current_screen = fallback_screen;
    }
    lv_obj_del(obj);
}

EM_PORT_API(void) lvglDeleteObjectIndex(int32_t index) {
    deleteObjectIndex(index);
}

EM_PORT_API(void) lvglDeletePageFlowState(int32_t screenIndex) {
    deletePageFlowState(screenIndex);
}

EM_PORT_API(void) lvglObjAddFlag(lv_obj_t *obj, lv_obj_flag_t f) {
    lv_obj_add_flag(obj, f);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjClearFlag(lv_obj_t *obj, lv_obj_flag_t f) {
    lv_obj_clear_flag(obj, f);
    lv_obj_update_layout(obj);
}

EM_PORT_API(bool) lvglObjHasFlag(lv_obj_t *obj, lv_obj_flag_t f) {
    return lv_obj_has_flag(obj, f);
}

EM_PORT_API(void) lvglObjAddState(lv_obj_t *obj, lv_obj_flag_t s) {
    lv_obj_add_state(obj, s);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjClearState(lv_obj_t *obj, lv_obj_flag_t s) {
    lv_obj_clear_state(obj, s);
    lv_obj_update_layout(obj);
}

EM_PORT_API(uint32_t) lvglObjGetStylePropColor(lv_obj_t *obj, lv_part_t part, lv_state_t state, lv_style_prop_t prop) {
    lv_state_t saved_state = lv_obj_get_state(obj);
    lv_obj_clear_state(obj, saved_state);
    lv_obj_add_state(obj, state);

    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);

    lv_obj_clear_state(obj, state);
    lv_obj_add_state(obj, saved_state);

#if LVGL_VERSION_MAJOR >= 9
    return (value.color.red << 16) | (value.color.green << 8) | value.color.blue;
#else
    return value.color.full;
#endif
}

EM_PORT_API(int32_t) lvglObjGetStylePropNum(lv_obj_t *obj, lv_part_t part, lv_state_t state, lv_style_prop_t prop) {
    lv_state_t saved_state = lv_obj_get_state(obj);
    lv_obj_clear_state(obj, saved_state);
    lv_obj_add_state(obj, state);

    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);

    lv_obj_clear_state(obj, state);
    lv_obj_add_state(obj, saved_state);

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

EM_PORT_API(int32_t) lvglObjGetStylePropBuiltInFont(lv_obj_t *obj, lv_part_t part, lv_state_t state, lv_style_prop_t prop) {
    lv_state_t saved_state = lv_obj_get_state(obj);
    lv_obj_clear_state(obj, saved_state);
    lv_obj_add_state(obj, state);

    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);

    lv_obj_clear_state(obj, state);
    lv_obj_add_state(obj, saved_state);

    for (uint32_t fontIndex = 0; fontIndex < sizeof(BUILT_IN_FONTS) / sizeof(lv_font_t *); fontIndex++) {
        if (value.ptr == BUILT_IN_FONTS[fontIndex]) {
            return (int32_t)fontIndex;
        }
    }

    return -1;
}

EM_PORT_API(const void *) lvglObjGetStylePropFontAddr(lv_obj_t *obj, lv_part_t part, lv_state_t state, lv_style_prop_t prop) {
    lv_state_t saved_state = lv_obj_get_state(obj);
    lv_obj_clear_state(obj, saved_state);
    lv_obj_add_state(obj, state);

    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);

    lv_obj_clear_state(obj, state);
    lv_obj_add_state(obj, saved_state);

    return value.ptr;
}

EM_PORT_API(void) lvglObjSetLocalStylePropBuiltInFont(lv_obj_t *obj, lv_style_prop_t prop, int font_index, lv_style_selector_t selector) {
    lv_style_value_t value;
    value.ptr = BUILT_IN_FONTS[font_index];
    lv_obj_set_local_style_prop(obj, prop, value, selector);
    lv_obj_update_layout(obj);
}

EM_PORT_API(lv_style_t *) lvglStyleCreate() {
#if LVGL_VERSION_MAJOR >= 9
    lv_style_t *style = (lv_style_t *)lv_malloc(sizeof(lv_style_t));
#else
    lv_style_t *style = (lv_style_t *)lv_mem_alloc(sizeof(lv_style_t));
#endif
    lv_style_init(style);
    return style;
}

EM_PORT_API(void) lvglStyleSetPropColor(lv_style_t *obj, lv_style_prop_t prop, uint32_t color) {
    lv_style_value_t value;
    value.color = lv_color_hex(color);
    lv_style_set_prop(obj, prop, value);
}

EM_PORT_API(void) lvglSetStylePropBuiltInFont(lv_style_t *obj, lv_style_prop_t prop, int font_index) {
    lv_style_value_t value;
    value.ptr = BUILT_IN_FONTS[font_index];
    lv_style_set_prop(obj, prop, value);
}

EM_PORT_API(void) lvglSetStylePropPtr(lv_style_t *obj, lv_style_prop_t prop, const void *ptr) {
        lv_style_value_t value;
    value.ptr = ptr;
    lv_style_set_prop(obj, prop, value);

}

EM_PORT_API(void) lvglSetStylePropNum(lv_style_t *obj, lv_style_prop_t prop, int32_t num) {
    lv_style_value_t value;
    value.num = num;
    lv_style_set_prop(obj, prop, value);
}

EM_PORT_API(void) lvglStyleDelete(lv_style_t *obj) {
#if LVGL_VERSION_MAJOR >= 9
    lv_free(obj);
#else
    lv_mem_free(obj);
#endif
}

EM_PORT_API(void) lvglObjAddStyle(lv_obj_t *obj, lv_style_t *style, lv_style_selector_t selector) {
    lv_obj_add_style(obj, style, selector);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglObjRemoveStyle(lv_obj_t *obj, lv_style_t *style, lv_style_selector_t selector) {
    lv_obj_remove_style(obj, style, selector);
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

EM_PORT_API(lv_font_t *) lvglLoadFont(const char *font_file_path, lv_font_t *fallback_user_font, int32_t fallback_builtin_font) {
    lv_font_t *font;
#if LVGL_VERSION_MAJOR >= 9
    font = lv_binfont_create(font_file_path);
#else
    font = lv_font_load(font_file_path);
#endif
    if (fallback_user_font) {
        font->fallback = fallback_user_font;
    } else if (fallback_builtin_font != -1) {
        font->fallback = BUILT_IN_FONTS[fallback_builtin_font];
    }
    return font;
}

EM_PORT_API(void) lvglFreeFont(lv_font_t *font) {
#if LVGL_VERSION_MAJOR >= 9
    return lv_binfont_destroy(font);
#else
    return lv_font_free(font);
#endif
}

EM_PORT_API(void) lvglAddObjectFlowCallback(lv_obj_t *obj, lv_event_code_t filter, void *flow_state, unsigned component_index, unsigned output_or_property_index, int32_t user_data) {
#if LVGL_VERSION_MAJOR >= 9
    FlowEventCallbackData *data = (FlowEventCallbackData *)lv_malloc(sizeof(FlowEventCallbackData));
#else
    FlowEventCallbackData *data = (FlowEventCallbackData *)lv_mem_alloc(sizeof(FlowEventCallbackData));
#endif

    data->flow_state = flow_state;
    data->component_index = component_index;
    data->output_or_property_index = output_or_property_index;
    data->user_data = user_data;

    if (filter == LV_EVENT_METER_TICK_LABEL_EVENT) {
#if LVGL_VERSION_MAJOR >= 9
        // TODO LVGL 9.0
#else
        lv_obj_add_event_cb(obj, flow_event_meter_tick_label_event_callback, LV_EVENT_DRAW_PART_BEGIN, data);
#endif
    } else if (filter == LV_EVENT_CHECKED_STATE_CHANGED) {
        lv_obj_add_event_cb(obj, flow_event_checked_state_changed_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_CHECKED) {
        lv_obj_add_event_cb(obj, flow_event_checked_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_UNCHECKED) {
        lv_obj_add_event_cb(obj, flow_event_unchecked_callback, LV_EVENT_VALUE_CHANGED, data);
    } else {
        lv_obj_add_event_cb(obj, flow_event_callback, filter, data);
    }

    lv_obj_add_event_cb(obj, flow_event_callback_delete_user_data, LV_EVENT_DELETE, data);
}

EM_PORT_API(uint32_t) lvglLedGetColor(lv_obj_t *obj) {
#if LVGL_VERSION_MAJOR >= 9
    return lv_color_to_u32(((lv_led_t *)obj)->color);
#else
    return lv_color_to32(((lv_led_t *)obj)->color);
#endif
}

#if LVGL_VERSION_MAJOR >= 9
// TODO LVGL 9.0
struct lv_meter_scale_t {
    int dummy;
};
struct lv_meter_indicator_t {
    int dummy;
};
#endif

EM_PORT_API(void) lvglMeterIndicatorNeedleLineSetColor(lv_obj_t *obj, lv_meter_indicator_t *indicator, uint32_t color) {
#if LVGL_VERSION_MAJOR >= 9
#else
    indicator->type_data.needle_line.color = lv_color_hex(color);
    lv_obj_invalidate(obj);
#endif
}

EM_PORT_API(void) lvglMeterIndicatorScaleLinesSetColorStart(lv_obj_t *obj, lv_meter_indicator_t *indicator, uint32_t color) {
#if LVGL_VERSION_MAJOR >= 9
#else
    indicator->type_data.scale_lines.color_start = lv_color_hex(color);
    lv_obj_invalidate(obj);
#endif
}

EM_PORT_API(void) lvglMeterIndicatorScaleLinesSetColorEnd(lv_obj_t *obj, lv_meter_indicator_t *indicator, uint32_t color) {
#if LVGL_VERSION_MAJOR >= 9
#else
    indicator->type_data.scale_lines.color_end = lv_color_hex(color);
    lv_obj_invalidate(obj);
#endif
}

EM_PORT_API(void) lvglMeterIndicatorArcSetColor(lv_obj_t *obj, lv_meter_indicator_t *indicator, uint32_t color) {
#if LVGL_VERSION_MAJOR >= 9
#else
    indicator->type_data.arc.color = lv_color_hex(color);
    lv_obj_invalidate(obj);
#endif
}

EM_PORT_API(void) lvglMeterScaleSetMinorTickColor(lv_obj_t *obj, lv_meter_scale_t *scale, uint32_t color) {
#if LVGL_VERSION_MAJOR >= 9
#else
    scale->tick_color = lv_color_hex(color);
    lv_obj_invalidate(obj);
#endif
}

EM_PORT_API(void) lvglMeterScaleSetMajorTickColor(lv_obj_t *obj, lv_meter_scale_t *scale, uint32_t color) {
#if LVGL_VERSION_MAJOR >= 9
#else
    scale->tick_major_color = lv_color_hex(color);
    lv_obj_invalidate(obj);
#endif
}

EM_PORT_API(int32_t) lvglGetIndicator_start_value(lv_meter_indicator_t *indicator) {
#if LVGL_VERSION_MAJOR >= 9
    return 0;
#else
    return indicator->start_value;
#endif
}
    
EM_PORT_API(int32_t) lvglGetIndicator_end_value(lv_meter_indicator_t *indicator) {
#if LVGL_VERSION_MAJOR >= 9
    return 0;
#else
    return indicator->end_value;
#endif
}
    
EM_PORT_API(void) lvglUpdateCheckedState(lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_CHECKED_STATE, obj, flow_state, component_index, property_index, 0, 0);
}

EM_PORT_API(void) lvglUpdateDisabledState(lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_DISABLED_STATE, obj, flow_state, component_index, property_index, 0, 0);
}

EM_PORT_API(void) lvglUpdateHiddenFlag(lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_HIDDEN_FLAG, obj, flow_state, component_index, property_index, 0, 0);
}

EM_PORT_API(void) lvglUpdateClickableFlag(lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_CLICKABLE_FLAG, obj, flow_state, component_index, property_index, 0, 0);
}

EM_PORT_API(void) lvglAddTimelineKeyframe(
    lv_obj_t *obj,
    void *flowState,
    float start, float end,
    uint32_t enabledProperties,
    int16_t x, uint8_t xEasingFunc,
    int16_t y, uint8_t yEasingFunc,
    int16_t width, uint8_t widthEasingFunc,
    int16_t height, uint8_t heightEasingFunc,
    int16_t opacity, uint8_t opacityEasingFunc,
    int16_t scale, uint8_t scaleEasingFunc,
    int16_t rotate, uint8_t rotateEasingFunc,
    int32_t cp1x, int32_t cp1y, int32_t cp2x, int32_t cp2y
) {
    addTimelineKeyframe(
        obj,
        flowState,
        start, end,
        enabledProperties,
        x, xEasingFunc,
        y, yEasingFunc,
        width, widthEasingFunc,
        height, heightEasingFunc,
        opacity, opacityEasingFunc,
        scale, scaleEasingFunc,
        rotate, rotateEasingFunc,
        cp1x, cp1y, cp2x, cp2y
    );
}

EM_PORT_API(void) lvglSetTimelinePosition(float timelinePosition) {
    setTimelinePosition(timelinePosition);
}

EM_PORT_API(void) lvglClearTimeline() {
    clearTimeline();
}

EM_PORT_API(void) lvglSetScrollBarMode(lv_obj_t *obj, lv_scrollbar_mode_t mode) {
    lv_obj_set_scrollbar_mode(obj, mode);
}

EM_PORT_API(void) lvglSetScrollDir(lv_obj_t *obj, lv_dir_t dir) {
    lv_obj_set_scroll_dir(obj, dir);
}

EM_PORT_API(void) lvglSetScrollSnapX(lv_obj_t *obj, lv_scroll_snap_t align) {
    lv_obj_set_scroll_snap_x(obj, align);
}

EM_PORT_API(void) lvglSetScrollSnapY(lv_obj_t *obj, lv_scroll_snap_t align) {
    lv_obj_set_scroll_snap_y(obj, align);
}

EM_PORT_API(void) lvglTabviewSetActive(lv_obj_t *obj, uint32_t tab_id, lv_anim_enable_t anim_en) {
#if LVGL_VERSION_MAJOR >= 9
    lv_tabview_set_active(obj, tab_id, anim_en);
#else
    lv_tabview_set_act(obj, tab_id, anim_en);
#endif
}

EM_PORT_API(void) lvglLineSetPoints(lv_obj_t *obj, float *point_values, uint32_t point_num) {
    lv_line_t *line = (lv_line_t *)obj;
#if LVGL_VERSION_MAJOR >= 9
    if (line->point_array.constant) {
        lv_free((void *)line->point_array.constant);
#else
    if (line->point_array) {
        lv_mem_free((void *)line->point_array);
#endif
    }

#if LVGL_VERSION_MAJOR >= 9
    lv_point_precise_t *points = (lv_point_precise_t *)lv_malloc(point_num * sizeof(lv_point_precise_t));
#else
    lv_point_t *points = (lv_point_t *)lv_mem_alloc(point_num * sizeof(lv_point_t));
#endif

    for (uint32_t i = 0; i < point_num; i++) {
        points[i].x = point_values[2 * i + 0];
        points[i].y = point_values[2 * i + 1];
    }

    lv_line_set_points(obj, points, point_num);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglScrollTo(lv_obj_t *obj, lv_coord_t x, lv_coord_t y, bool anim_en) {
    lv_obj_scroll_to(obj, x, y, anim_en ? LV_ANIM_ON : LV_ANIM_OFF);
}

EM_PORT_API(lv_coord_t) lvglGetScrollX(lv_obj_t *obj) {
    return lv_obj_get_scroll_x(obj);
}

EM_PORT_API(lv_coord_t) lvglGetScrollY(lv_obj_t *obj) {
    return lv_obj_get_scroll_y(obj);
}

EM_PORT_API(void) lvglObjInvalidate(lv_obj_t *obj) {
    return lv_obj_invalidate(obj);
}

EM_PORT_API(void) lvglDeleteScreenOnUnload(unsigned screenIndex) {
    eez_flow_delete_screen_on_unload(screenIndex);
}

EM_PORT_API(const char *) lvglGetTabName(lv_obj_t *tabview, int tabIndex, lv_dir_t tabDir) {
#if LVGL_VERSION_MAJOR >= 9
    lv_obj_t *tab_bar = lv_tabview_get_tab_bar(tabview);
    lv_obj_t *button = lv_obj_get_child_by_type(tab_bar, tabIndex, &lv_button_class);
    lv_obj_t *label = lv_obj_get_child_by_type(button, 0, &lv_label_class);
    return lv_label_get_text(label);
#else
    if (tabDir == LV_DIR_LEFT || tabDir == LV_DIR_RIGHT) {
        return ((lv_tabview_t *)tabview)->map[tabIndex * 2];
    } else {
        return ((lv_tabview_t *)tabview)->map[tabIndex];
    }
#endif
}

#if LVGL_VERSION_MAJOR >= 9
#else

// These functions are defined as "static inline" in LVGL v8.x,
// so it will not be exported.
// Here we are defining exportable wrappers to these functions.

EM_PORT_API(void) v8_lv_slider_set_range(lv_obj_t *obj, int32_t min, int32_t max) {
    lv_slider_set_range(obj, min, max);
}

EM_PORT_API(void) v8_lv_slider_set_mode(lv_obj_t *obj, lv_slider_mode_t mode) {
    lv_slider_set_mode(obj, mode);
}

EM_PORT_API(void) v8_lv_slider_set_value(lv_obj_t *obj, int32_t value, lv_anim_enable_t anim) {
    lv_slider_set_value(obj, value, anim);
}

EM_PORT_API(int32_t) v8_lv_slider_get_value(const lv_obj_t *obj) {
    return lv_slider_get_value(obj);
}

EM_PORT_API(void) v8_lv_slider_set_left_value(lv_obj_t *obj, int32_t value, lv_anim_enable_t anim) {
    lv_slider_set_left_value(obj, value, anim);
}

EM_PORT_API(int32_t) v8_lv_slider_get_left_value(const lv_obj_t *obj) {
    return lv_slider_get_left_value(obj);
}

#endif

////////////////////////////////////////////////////////////////////////////////

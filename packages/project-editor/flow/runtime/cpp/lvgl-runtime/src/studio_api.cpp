#include <stdlib.h>
#include <stdio.h>
#include <emscripten.h>

#include "lvgl/lvgl.h"

#include <eez/core/os.h>

#include "flow.h"

EM_PORT_API(lv_obj_t *) lvglCreateContainer(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateLabel(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, char *text, lv_label_long_mode_t long_mode, bool recolor) {
    lv_obj_t *obj = lv_label_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    if (text != 0) {
        lv_label_set_text(obj, text);
        free(text);
    }
    lv_label_set_long_mode(obj, long_mode);
    lv_label_set_recolor(obj, recolor);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateButton(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_btn_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreatePanel(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateImage(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, const void *img_src, lv_coord_t pivotX, lv_coord_t pivotY, uint16_t zoom, int16_t angle) {
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
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateSlider(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, int32_t min, int32_t max, lv_slider_mode_t mode, int32_t value, int32_t value_left) {
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
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateRoller(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, char *options, lv_roller_mode_t mode) {
    lv_obj_t *obj = lv_roller_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_roller_set_options(obj, options, mode);
    free(options);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateSwitch(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_switch_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateBar(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, int32_t min, int32_t max, lv_bar_mode_t mode, int32_t value, int32_t value_left) {
    lv_obj_t *obj = lv_bar_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_bar_set_range(obj, min, max);
    lv_bar_set_mode(obj, mode);
    lv_bar_set_value(obj, value, LV_ANIM_OFF);
    if (lv_bar_get_mode(obj) == LV_BAR_MODE_RANGE) {
        lv_bar_set_start_value(obj, value_left, LV_ANIM_OFF);
    }
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateDropdown(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, char *options) {
    lv_obj_t *obj = lv_dropdown_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_dropdown_set_options(obj, options);
    free(options);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateArc(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, int32_t range_min, int32_t range_max, int32_t value, int32_t bg_start_angle, int32_t bg_end_angle, lv_bar_mode_t mode, int32_t rotation) {
    lv_obj_t *obj = lv_arc_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_arc_set_range(obj, range_min, range_max);
    lv_arc_set_value(obj, value);
    lv_arc_set_bg_angles(obj, bg_start_angle, bg_end_angle);
    lv_arc_set_mode(obj, mode);
    lv_arc_set_rotation(obj, rotation);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateSpinner(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_spinner_create(parentObj, 1000, 60);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    if (is_editor) {
        lv_anim_del_all();
    }
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateCheckbox(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, const char *text) {
    lv_obj_t *obj = lv_checkbox_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    lv_checkbox_set_text(obj, text);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateTextarea(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, char *text, char *placeholder, bool one_line_mode, bool password_mode, char *accepted_characters, uint32_t max_text_length) {
    lv_obj_t *obj = lv_textarea_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    if (accepted_characters) {
        lv_textarea_set_accepted_chars(obj, accepted_characters);
        free(accepted_characters);
    }
    lv_textarea_set_max_length(obj, max_text_length);
    if (text != 0) {
        lv_textarea_set_text(obj, text);
        free(text);
    }
    if (placeholder) {
        lv_textarea_set_placeholder_text(obj, placeholder);
        free(placeholder);
    }
    lv_textarea_set_one_line(obj, one_line_mode);
    lv_textarea_set_password_mode(obj, password_mode);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateCalendar(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, uint32_t today_year, uint32_t today_month, uint32_t today_day, uint32_t showed_year, uint32_t showed_month) {
    lv_obj_t *obj = lv_calendar_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    lv_calendar_header_arrow_create(obj);
    lv_calendar_set_today_date(obj, today_year, today_month, today_day);
    lv_calendar_set_showed_date(obj, showed_year, showed_month);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateColorwheel(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, lv_colorwheel_mode_t mode, bool fixed_mode) {
    lv_obj_t *obj = lv_colorwheel_create(parentObj, false);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_colorwheel_set_mode(obj, mode);
    lv_colorwheel_set_mode_fixed(obj, fixed_mode);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateImgbutton(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_imgbtn_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateKeyboard(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h, lv_keyboard_mode_t mode) {
    lv_obj_t *obj = lv_keyboard_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_keyboard_set_mode(obj, mode);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateChart(lv_obj_t *parentObj, int32_t index, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_chart_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_obj_update_layout(obj);
    setObjectIndex(obj, index);
    return obj;
}

static lv_obj_t *current_screen = 0;

EM_PORT_API(void) lvglScreenLoad(unsigned page_index, lv_obj_t *obj) {
    lv_scr_load_anim(obj, (lv_scr_load_anim_t)screenLoad_animType, screenLoad_speed, screenLoad_delay, false);
    current_screen = obj;
    screenLoad_animType = 0;
    screenLoad_speed = 0;
    screenLoad_delay = 0;
    if (page_index != -1) {
        flowOnPageLoadedStudio(page_index);
    }
}

EM_PORT_API(void) lvglDeleteObject(lv_obj_t *obj) {
    if (obj == current_screen) {
        printf("delete current screen called, set fallback screen\n");
        static lv_obj_t *fallback_screen = 0;
        if (!fallback_screen) {
            fallback_screen = lv_obj_create(0);
        }
        lv_scr_load(fallback_screen);
        current_screen = fallback_screen;
    }
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

EM_PORT_API(int32_t) lvglObjGetStylePropBuiltInFont(lv_obj_t *obj, lv_part_t part, lv_style_prop_t prop) {
    lv_style_value_t value = lv_obj_get_style_prop(obj, part, prop);
    for (uint32_t fontIndex = 0; fontIndex < sizeof(BUILT_IN_FONTS) / sizeof(lv_font_t *); fontIndex++) {
        if (value.ptr == BUILT_IN_FONTS[fontIndex]) {
            return (int32_t)fontIndex;
        }
    }
    return -1;
}

EM_PORT_API(void) lvglObjSetLocalStylePropBuiltInFont(lv_obj_t *obj, lv_style_prop_t prop, int font_index, lv_style_selector_t selector) {
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

EM_PORT_API(lv_font_t *) lvglLoadFont(const char *font_file_path) {
    return lv_font_load(font_file_path);
}

EM_PORT_API(void) lvglFreeFont(lv_font_t *font) {
    return lv_font_free(font);
}

void trt(lv_event_t *e) {
    printf("label deleted\n");
}

////////////////////////////////////////////////////////////////////////////////

#define LV_EVENT_TEXTAREA_TEXT_CHANGED 0x79
#define LV_EVENT_CHECKED_STATE_CHANGED 0x7A
#define LV_EVENT_ARC_VALUE_CHANGED 0x7B
#define LV_EVENT_SLIDER_VALUE_CHANGED 0x7C
#define LV_EVENT_SLIDER_VALUE_LEFT_CHANGED 0x7D
#define LV_EVENT_CHECKED   0x7E
#define LV_EVENT_UNCHECKED 0x7F

struct FlowEventCallbackData {
    unsigned page_index;
    unsigned component_index;
    unsigned output_or_property_index;
};

void flow_event_callback(lv_event_t *e) {
    FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
    flowPropagateValue(data->page_index, data->component_index, data->output_or_property_index);
}

void flow_event_textarea_text_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        const char *value = lv_textarea_get_text(ta);
        assignStringProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Text in Textarea widget");
    }
}

void flow_event_checked_state_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        bool value = lv_obj_has_state(ta, LV_STATE_CHECKED);
        assignBooleanProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Checked state");
    }
}

void flow_event_arc_value_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        int32_t value = lv_arc_get_value(ta);
        assignIntegerProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Value in Arc widget");
    }
}

void flow_event_bar_value_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        int32_t value = lv_bar_get_value(ta);
        assignIntegerProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Value in Bar widget");
    }
}

void flow_event_bar_value_start_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        int32_t value = lv_bar_get_start_value(ta);
        assignIntegerProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Value Start in Bar widget");
    }
}

void flow_event_slider_value_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        int32_t value = lv_slider_get_value(ta);
        assignIntegerProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Value in Slider widget");
    }
}

void flow_event_slider_value_left_changed_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);

        FlowEventCallbackData *data = (FlowEventCallbackData *)e->user_data;
        int32_t value = lv_slider_get_left_value(ta);
        assignIntegerProperty(data->page_index, data->component_index, data->output_or_property_index, value, "Failed to assign Value Left in Slider widget");
    }
}

void flow_event_checked_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    lv_obj_t *ta = lv_event_get_target(e);
    if (event == LV_EVENT_VALUE_CHANGED && lv_obj_has_state(ta, LV_STATE_CHECKED)) {
        flow_event_callback(e);
    }
}

void flow_event_unchecked_callback(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    lv_obj_t *ta = lv_event_get_target(e);
    if (event == LV_EVENT_VALUE_CHANGED && !lv_obj_has_state(ta, LV_STATE_CHECKED)) {
        flow_event_callback(e);
    }
}

void flow_event_callback_delete_user_data(lv_event_t *e) {
    lv_mem_free(e->user_data);
}

EM_PORT_API(void) lvglAddObjectFlowCallback(lv_obj_t *obj, lv_event_code_t filter, unsigned page_index, unsigned component_index, unsigned output_or_property_index) {
    FlowEventCallbackData *data = (FlowEventCallbackData *)lv_mem_alloc(sizeof(FlowEventCallbackData));

    data->page_index = page_index;
    data->component_index = component_index;
    data->output_or_property_index = output_or_property_index;

    if (filter == LV_EVENT_TEXTAREA_TEXT_CHANGED) {
        lv_obj_add_event_cb(obj, flow_event_textarea_text_changed_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_CHECKED_STATE_CHANGED) {
        lv_obj_add_event_cb(obj, flow_event_checked_state_changed_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_ARC_VALUE_CHANGED) {
        lv_obj_add_event_cb(obj, flow_event_arc_value_changed_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_SLIDER_VALUE_CHANGED) {
        lv_obj_add_event_cb(obj, flow_event_slider_value_changed_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_SLIDER_VALUE_LEFT_CHANGED) {
        lv_obj_add_event_cb(obj, flow_event_slider_value_left_changed_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_CHECKED) {
        lv_obj_add_event_cb(obj, flow_event_checked_callback, LV_EVENT_VALUE_CHANGED, data);
    } else if (filter == LV_EVENT_UNCHECKED) {
        lv_obj_add_event_cb(obj, flow_event_unchecked_callback, LV_EVENT_VALUE_CHANGED, data);
    } else {
        lv_obj_add_event_cb(obj, flow_event_callback, filter, data);
    }

    lv_obj_add_event_cb(obj, flow_event_callback_delete_user_data, LV_EVENT_DELETE, data);
}

EM_PORT_API(void) lvglUpdateLabelText(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_LABEL_TEXT, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglSetImageSrc(lv_obj_t *obj, const void *img_src) {
    if (img_src != 0) {
        lv_img_set_src(obj, img_src);
    }
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglSetImgbuttonImageSrc(lv_obj_t *obj, lv_imgbtn_state_t state, const void *img_src) {
    lv_imgbtn_set_src(obj, state, NULL, img_src, NULL);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglSetKeyboardTextarea(lv_obj_t *obj, lv_obj_t *textarea) {
    lv_keyboard_set_textarea(obj, textarea);
    lv_obj_update_layout(obj);
}

EM_PORT_API(void) lvglUpdateSliderValue(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_SLIDER_VALUE, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateSliderValueLeft(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_SLIDER_VALUE_LEFT, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateBarValue(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_BAR_VALUE, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateBarValueStart(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_BAR_VALUE_START, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateArcValue(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_ARC_VALUE, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateTextareaText(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_TEXTAREA_TEXT, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateCheckedState(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_CHECKED_STATE, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateDisabledState(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_DISABLED_STATE, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateHiddenFlag(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_HIDDEN_FLAG, obj, page_index, component_index, property_index);
}

EM_PORT_API(void) lvglUpdateClickableFlag(lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    addUpdateTask(UPDATE_TASK_TYPE_CLICKABLE_FLAG, obj, page_index, component_index, property_index);
}

////////////////////////////////////////////////////////////////////////////////

#pragma once

#include <stdint.h>

#include "lvgl/lvgl.h"

#include <eez/flow/lvgl_api.h>

extern bool is_editor;

extern uint32_t screenLoad_animType;
extern uint32_t screenLoad_speed;
extern uint32_t screenLoad_delay;

#ifdef __cplusplus
extern "C" {
#endif
void flowInit(uint32_t wasmModuleId, uint32_t debuggerMessageSubsciptionFilter, uint8_t *assets, uint32_t assetsSize, uint32_t timeZone);
bool flowTick();
#ifdef __cplusplus
}
#endif

void flowOnPageLoadedStudio(unsigned pageIndex);

void addTimelineKeyframe(
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
);
void setTimelinePosition(float timelinePosition);
void clearTimeline();

#define LV_EVENT_METER_TICK_LABEL_EVENT 0x76
#define LV_EVENT_DROPDOWN_SELECTED_CHANGED 0x77
#define LV_EVENT_ROLLER_SELECTED_CHANGED 0x78
#define LV_EVENT_TEXTAREA_TEXT_CHANGED 0x79
#define LV_EVENT_CHECKED_STATE_CHANGED 0x7A
#define LV_EVENT_ARC_VALUE_CHANGED 0x7B
#define LV_EVENT_SLIDER_VALUE_CHANGED 0x7C
#define LV_EVENT_SLIDER_VALUE_LEFT_CHANGED 0x7D
#define LV_EVENT_CHECKED   0x7E
#define LV_EVENT_UNCHECKED 0x7F

struct FlowEventCallbackData {
    void *flow_state;
    unsigned component_index;
    unsigned output_or_property_index;
};

void flow_event_callback(lv_event_t *e);
void flow_event_textarea_text_changed_callback(lv_event_t *e);
void flow_event_checked_state_changed_callback(lv_event_t *e);
void flow_event_arc_value_changed_callback(lv_event_t *e);
void flow_event_bar_value_changed_callback(lv_event_t *e);
void flow_event_bar_value_start_changed_callback(lv_event_t *e);
void flow_event_dropdown_selected_changed_callback(lv_event_t *e);
void flow_event_roller_selected_changed_callback(lv_event_t *e);
void flow_event_slider_value_changed_callback(lv_event_t *e);
void flow_event_slider_value_left_changed_callback(lv_event_t *e);
void flow_event_checked_callback(lv_event_t *e);
void flow_event_unchecked_callback(lv_event_t *e);
void flow_event_meter_tick_label_event_callback(lv_event_t *e);
void flow_event_callback_delete_user_data(lv_event_t *e);

enum UpdateTaskType {
    UPDATE_TASK_TYPE_LABEL_TEXT,
    UPDATE_TASK_TYPE_TEXTAREA_TEXT,
    UPDATE_TASK_TYPE_ROLLER_OPTIONS,
    UPDATE_TASK_TYPE_ROLLER_SELECTED,
    UPDATE_TASK_TYPE_DROPDOWN_OPTIONS,
    UPDATE_TASK_TYPE_DROPDOWN_SELECTED,
    UPDATE_TASK_TYPE_SLIDER_VALUE,
    UPDATE_TASK_TYPE_SLIDER_VALUE_LEFT,
    UPDATE_TASK_TYPE_ARC_RANGE_MIN,
    UPDATE_TASK_TYPE_ARC_RANGE_MAX,
    UPDATE_TASK_TYPE_ARC_VALUE,
    UPDATE_TASK_TYPE_BAR_VALUE,
    UPDATE_TASK_TYPE_BAR_VALUE_START,
    UPDATE_TASK_TYPE_CHECKED_STATE,
    UPDATE_TASK_TYPE_DISABLED_STATE,
    UPDATE_TASK_TYPE_HIDDEN_FLAG,
    UPDATE_TASK_TYPE_CLICKABLE_FLAG,
    UPDATE_TASK_TYPE_METER_INDICATOR_VALUE,
    UPDATE_TASK_TYPE_METER_INDICATOR_START_VALUE,
    UPDATE_TASK_TYPE_METER_INDICATOR_END_VALUE,
    UPDATE_TASK_TYPE_TAB_NAME,
};

void addUpdateTask(enum UpdateTaskType updateTaskType, lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index, void *subobj, int param);

void setObjectIndex(lv_obj_t *obj, int32_t index);

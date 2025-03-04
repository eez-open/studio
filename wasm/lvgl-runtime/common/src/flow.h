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
void flowInit(uint32_t wasmModuleId, uint32_t debuggerMessageSubsciptionFilter, uint8_t *assets, uint32_t assetsSize, bool darkTheme, uint32_t timeZone, bool screensLifetimeSupport);
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

#define LV_EVENT_METER_TICK_LABEL_EVENT 0x74
#define LV_EVENT_CHECKED_STATE_CHANGED 0x78
#define LV_EVENT_CHECKED   0x7E
#define LV_EVENT_UNCHECKED 0x7F

struct FlowEventCallbackData {
    void *flow_state;
    unsigned component_index;
    unsigned output_or_property_index;
    int32_t user_data;
};

void flow_event_callback(lv_event_t *e);
void flow_event_checked_state_changed_callback(lv_event_t *e);
void flow_event_checked_callback(lv_event_t *e);
void flow_event_unchecked_callback(lv_event_t *e);
void flow_event_meter_tick_label_event_callback(lv_event_t *e);
void flow_event_callback_delete_user_data(lv_event_t *e);

enum UpdateTaskType {
    UPDATE_TASK_TYPE_CHECKED_STATE,
    UPDATE_TASK_TYPE_DISABLED_STATE,
    UPDATE_TASK_TYPE_HIDDEN_FLAG,
    UPDATE_TASK_TYPE_CLICKABLE_FLAG
};

void addUpdateTask(enum UpdateTaskType updateTaskType, lv_obj_t *obj, void *flow_state, unsigned component_index, unsigned property_index, void *subobj, int param);

#ifdef __cplusplus
extern "C" {
#endif

void setObjectIndex(lv_obj_t *obj, int32_t index);

#ifdef __cplusplus
}
#endif

void deleteObjectIndex(int32_t index);

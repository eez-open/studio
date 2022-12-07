#pragma once

#include <stdint.h>

#include "lvgl/lvgl.h"

#include <eez/flow/lvgl_api.h>

enum UpdateTaskType {
    UPDATE_TASK_TYPE_LABEL_TEXT,
    UPDATE_TASK_TYPE_TEXTAREA_TEXT,
    UPDATE_TASK_TYPE_ROLLER_SELECTED,
    UPDATE_TASK_TYPE_DROPDOWN_SELECTED,
    UPDATE_TASK_TYPE_SLIDER_VALUE,
    UPDATE_TASK_TYPE_SLIDER_VALUE_LEFT,
    UPDATE_TASK_TYPE_ARC_VALUE,
    UPDATE_TASK_TYPE_BAR_VALUE,
    UPDATE_TASK_TYPE_BAR_VALUE_START,
    UPDATE_TASK_TYPE_CHECKED_STATE,
    UPDATE_TASK_TYPE_DISABLED_STATE,
    UPDATE_TASK_TYPE_HIDDEN_FLAG,
    UPDATE_TASK_TYPE_CLICKABLE_FLAG
};

#ifdef __cplusplus
extern "C" {
#endif

extern bool is_editor;

extern uint32_t screenLoad_animType;
extern uint32_t screenLoad_speed;
extern uint32_t screenLoad_delay;

void flowInit(uint32_t wasmModuleId, uint8_t *assets, uint32_t assetsSize);
bool flowTick();
void flowOnPageLoadedStudio(unsigned pageIndex);

void addTimelineKeyframe(
    lv_obj_t *obj,
    unsigned page_index,
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

void addUpdateTask(enum UpdateTaskType updateTaskType, lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index);

void setObjectIndex(lv_obj_t *obj, int32_t index);

#ifdef __cplusplus
}
#endif

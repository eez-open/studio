#pragma once

#include <stdint.h>

#include "lvgl/lvgl.h"

enum UpdateTaskType {
    UPDATE_TASK_TYPE_LABEL_TEXT,
    UPDATE_TASK_TYPE_TEXTAREA_TEXT,
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
void flowPropagateValue(unsigned pageIndex, unsigned componentIndex, unsigned outputIndex);

void addUpdateTask(enum UpdateTaskType updateTaskType, lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index);
void assignIntegerProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, int32_t value, const char *errorMessage);
void assignBooleanProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, bool value, const char *errorMessage);

void setObjectIndex(lv_obj_t *obj, int32_t index);

#ifdef __cplusplus
}
#endif

#pragma once

#include <stdint.h>

#include "lvgl/lvgl.h"

enum UpdateTaskType {
    UPDATE_TASK_TYPE_LABEL_TEXT,
    UPDATE_TASK_TYPE_SLIDER_VALUE,
    UPDATE_TASK_TYPE_SLIDER_VALUE_LEFT
};

#ifdef __cplusplus
extern "C" {
#endif

void flowInit(uint32_t wasmModuleId, uint8_t *assets, uint32_t assetsSize);
bool flowTick();
void flowOnPageLoaded(unsigned pageIndex);
void flowPropagateValue(unsigned pageIndex, unsigned componentIndex, unsigned outputIndex);

void addUpdateTask(enum UpdateTaskType updateTaskType, lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index);
void assignIntegerProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, int32_t value, const char *errorMessage);

#ifdef __cplusplus
}
#endif

#include <stdio.h>
#include <vector>
#include <map>
#include <emscripten.h>

#include <eez/core/os.h>
#include <eez/core/action.h>

#include <eez/flow/flow.h>
#include <eez/flow/expression.h>
#include <eez/flow/hooks.h>
#include <eez/flow/debugger.h>
#include <eez/flow/components.h>
#include <eez/flow/flow_defs_v3.h>

#include "flow.h"

namespace eez {

ActionExecFunc g_actionExecFunctions[] = {
    0
};

}

////////////////////////////////////////////////////////////////////////////////

static int16_t currentPageId = -1;

uint32_t screenLoad_animType = 0;
uint32_t screenLoad_speed = 0;
uint32_t screenLoad_delay = 0;

////////////////////////////////////////////////////////////////////////////////

struct UpdateTask {
    UpdateTaskType updateTaskType;
    lv_obj_t *obj;
    unsigned page_index;
    unsigned component_index;
    unsigned property_index;
};

std::vector<UpdateTask> updateTasks;

extern "C" void addUpdateTask(UpdateTaskType updateTaskType, lv_obj_t *obj, unsigned page_index, unsigned component_index, unsigned property_index) {
    UpdateTask updateTask;
    updateTask.updateTaskType = updateTaskType;
    updateTask.obj = obj;
    updateTask.page_index = page_index;
    updateTask.component_index = component_index;
    updateTask.property_index = property_index;
    updateTasks.push_back(updateTask);
}

static char textValue[1000];

const char *evalTextProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, const char *errorMessage) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
    eez::Value value;
    if (!eez::flow::evalProperty(flowState, componentIndex, propertyIndex, value, errorMessage)) {
        return "";
    }
    value.toText(textValue, sizeof(textValue));
    return textValue;
}

extern "C" int32_t evalIntegerProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, const char *errorMessage) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
    eez::Value value;
    if (!eez::flow::evalProperty(flowState, componentIndex, propertyIndex, value, errorMessage)) {
        return 0;
    }
    int err;
    int32_t intValue = value.toInt32(&err);
    if (err) {
        eez::flow::throwError(flowState, componentIndex, errorMessage);
        return 0;
    }
    return intValue;
}

extern "C" bool evalBooleanProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, const char *errorMessage) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
    eez::Value value;
    if (!eez::flow::evalProperty(flowState, componentIndex, propertyIndex, value, errorMessage)) {
        return 0;
    }
    int err;
    bool booleanValue = value.toBool(&err);
    if (err) {
        eez::flow::throwError(flowState, componentIndex, errorMessage);
        return 0;
    }
    return booleanValue;
}

extern "C" void assignIntegerProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, int32_t value, const char *errorMessage) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);

    auto component = flowState->flow->components[componentIndex];

    eez::Value dstValue;
    if (!eez::flow::evalAssignableExpression(flowState, componentIndex, component->properties[propertyIndex]->evalInstructions, dstValue, errorMessage)) {
        return;
    }

    eez::Value srcValue(value, eez::VALUE_TYPE_INT32);

    eez::flow::assignValue(flowState, componentIndex, dstValue, srcValue);
}

extern "C" void assignBooleanProperty(unsigned pageIndex, unsigned componentIndex, unsigned propertyIndex, bool value, const char *errorMessage) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);

    auto component = flowState->flow->components[componentIndex];

    eez::Value dstValue;
    if (!eez::flow::evalAssignableExpression(flowState, componentIndex, component->properties[propertyIndex]->evalInstructions, dstValue, errorMessage)) {
        return;
    }

    eez::Value srcValue(value, eez::VALUE_TYPE_BOOLEAN);

    eez::flow::assignValue(flowState, componentIndex, dstValue, srcValue);
}

void doUpdateTasks() {
    for (auto it = updateTasks.begin(); it != updateTasks.end(); it++) {
        UpdateTask &updateTask = *it;
        if (updateTask.updateTaskType == UPDATE_TASK_TYPE_LABEL_TEXT) {
            const char *new_val = evalTextProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Text in Label widget");
            const char *cur_val = lv_label_get_text(updateTask.obj);
            if (strcmp(new_val, cur_val) != 0) lv_label_set_text(updateTask.obj, new_val);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_SLIDER_VALUE) {
            int32_t new_val = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value in Slider widget");
            int32_t cur_val = lv_slider_get_value(updateTask.obj);
            if (new_val != cur_val) lv_slider_set_value(updateTask.obj, new_val, LV_ANIM_OFF);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_SLIDER_VALUE_LEFT) {
            int32_t new_val = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value Left in Slider widget");
            int32_t cur_val = lv_slider_get_left_value(updateTask.obj);
            if (new_val != cur_val) lv_slider_set_left_value(updateTask.obj, new_val, LV_ANIM_OFF);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_ARC_VALUE) {
            int32_t new_val = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value in Arc widget");
            int32_t cur_val = lv_bar_get_value(updateTask.obj);
            if (new_val != cur_val) lv_arc_set_value(updateTask.obj, new_val);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_BAR_VALUE) {
            int32_t new_val = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value in Bar widget");
            int32_t cur_val = lv_bar_get_value(updateTask.obj);
            if (new_val != cur_val) lv_bar_set_value(updateTask.obj, new_val, LV_ANIM_OFF);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_BAR_VALUE_START) {
            int32_t new_val = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value Start in Bar widget");
            int32_t cur_val = lv_bar_get_start_value(updateTask.obj);
            if (new_val != cur_val) lv_bar_set_start_value(updateTask.obj, new_val, LV_ANIM_OFF);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_CHECKED_STATE) {
            bool new_val = evalBooleanProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Checked state");
            bool cur_val = lv_obj_has_state(updateTask.obj, LV_STATE_CHECKED);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_state(updateTask.obj, LV_STATE_CHECKED);
                else lv_obj_clear_state(updateTask.obj, LV_STATE_CHECKED);
            }
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_DISABLED_STATE) {
            bool new_val = evalBooleanProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Disabled state");
            bool cur_val = lv_obj_has_state(updateTask.obj, LV_STATE_DISABLED);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_state(updateTask.obj, LV_STATE_DISABLED);
                else lv_obj_clear_state(updateTask.obj, LV_STATE_DISABLED);
            }
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_HIDDEN_FLAG) {
            bool new_val = evalBooleanProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Hidden flag");
            bool cur_val = lv_obj_has_flag(updateTask.obj, LV_OBJ_FLAG_HIDDEN);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_flag(updateTask.obj, LV_OBJ_FLAG_HIDDEN);
                else lv_obj_clear_flag(updateTask.obj, LV_OBJ_FLAG_HIDDEN);
            }
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_CLICKABLE_FLAG) {
            bool new_val = evalBooleanProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Clickable flag");
            bool cur_val = lv_obj_has_flag(updateTask.obj, LV_OBJ_FLAG_CLICKABLE);
            if (new_val != cur_val) {
                if (new_val) lv_obj_add_flag(updateTask.obj, LV_OBJ_FLAG_CLICKABLE);
                else lv_obj_clear_flag(updateTask.obj, LV_OBJ_FLAG_CLICKABLE);
            }
        }
    }

}

////////////////////////////////////////////////////////////////////////////////

void startToDebuggerMessage() {
    EM_ASM({
        startToDebuggerMessage($0);
    }, eez::flow::g_wasmModuleId);
}

void writeDebuggerBuffer(const char *buffer, uint32_t length) {
    EM_ASM({
        writeDebuggerBuffer($0, new Uint8Array(Module.HEAPU8.buffer, $1, $2));
    }, eez::flow::g_wasmModuleId, buffer, length);
}

void finishToDebuggerMessage() {
    EM_ASM({
        finishToDebuggerMessage($0);
    }, eez::flow::g_wasmModuleId);
}

void onArrayValueFree(eez::ArrayValue *arrayValue) {
    EM_ASM({
        onArrayValueFree($0, $1);
    }, eez::flow::g_wasmModuleId, arrayValue);
}

void replacePageHook(int16_t pageId, uint32_t animType, uint32_t speed, uint32_t delay) {
    screenLoad_animType = animType;
    screenLoad_speed = speed;
    screenLoad_delay = delay;
    eez::flow::onPageChanged(currentPageId, pageId);
    currentPageId = pageId;
}

EM_PORT_API(void) stopScript() {
    eez::flow::stop();
}

EM_PORT_API(void) onMessageFromDebugger(char *messageData, uint32_t messageDataSize) {
    eez::flow::processDebuggerInput(messageData, messageDataSize);
}

////////////////////////////////////////////////////////////////////////////////

static std::map<int, std::map<int, lv_obj_t *>*> pageIndexes;
static auto indexToObject = new std::map<int, lv_obj_t *>;

void setObjectIndex(lv_obj_t *obj, int32_t index) {
    indexToObject->insert(std::make_pair(index, obj));
}

void closeIndexesForPage(int pageIndex) {
    pageIndexes.insert(std::make_pair(pageIndex, indexToObject));
    indexToObject = new std::map<int, lv_obj_t *>;
}

static lv_obj_t *getLvglObjectFromIndex(int32_t index) {
    auto it1 = pageIndexes.find(currentPageId - 1);
    if (it1 == pageIndexes.end()) {
        return 0;
    }

    auto it2 = it1->second->find(index);
    if (it2 == it1->second->end()) {
        return 0;
    }

    return it2->second;
}

////////////////////////////////////////////////////////////////////////////////

static const void *getLvglImageByName(const char *name) {
    return (const void *)EM_ASM_INT({
        return getLvglImageByName($0, UTF8ToString($1));
    }, eez::flow::g_wasmModuleId, name);
}

////////////////////////////////////////////////////////////////////////////////

extern "C" void flowInit(uint32_t wasmModuleId, uint8_t *assets, uint32_t assetsSize) {
    //DISPLAY_WIDTH = eez::g_mainAssets->settings->displayWidth;
    //DISPLAY_HEIGHT = eez::g_mainAssets->settings->displayHeight;

    eez::flow::g_wasmModuleId = wasmModuleId;

    eez::initAssetsMemory();
    eez::loadMainAssets(assets, assetsSize);
    eez::initOtherMemory();
    eez::initAllocHeap(eez::ALLOC_BUFFER, eez::ALLOC_BUFFER_SIZE);

    eez::flow::startToDebuggerMessageHook = startToDebuggerMessage;
    eez::flow::writeDebuggerBufferHook = writeDebuggerBuffer;
    eez::flow::finishToDebuggerMessageHook = finishToDebuggerMessage;
    eez::flow::onArrayValueFreeHook = onArrayValueFree;
    eez::flow::replacePageHook = replacePageHook;
    eez::flow::stopScriptHook = stopScript;
    eez::flow::getLvglObjectFromIndexHook = getLvglObjectFromIndex;
    eez::flow::getLvglImageByNameHook = getLvglImageByName;

    eez::flow::start(eez::g_mainAssets);

    eez::flow::onDebuggerClientConnected();
}

extern "C" bool flowTick() {
    if (eez::flow::isFlowStopped()) {
        return false;
    }

    eez::flow::tick();

    doUpdateTasks();

    return true;
}

extern "C" void flowOnPageLoaded(unsigned pageIndex) {
    if (currentPageId == -1) {
        currentPageId = pageIndex + 1;
    }
    closeIndexesForPage(pageIndex);
    eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
}

extern "C" void flowPropagateValue(unsigned pageIndex, unsigned componentIndex, unsigned outputIndex) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
    eez::flow::propagateValue(flowState, componentIndex, outputIndex);
}

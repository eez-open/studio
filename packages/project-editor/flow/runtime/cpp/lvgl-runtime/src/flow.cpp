#include <stdio.h>
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

lv_obj_t *indexToObject[MAX_OBJECTS];

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

void doUpdateTasks() {
    for (auto it = updateTasks.begin(); it != updateTasks.end(); it++) {
        UpdateTask &updateTask = *it;
        if (updateTask.updateTaskType == UPDATE_TASK_TYPE_LABEL_TEXT) {
            const char *text_new = evalTextProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Text in Label widget");
            const char *text_cur = lv_label_get_text(updateTask.obj);
            if (strcmp(text_new, text_cur) != 0) lv_label_set_text(updateTask.obj, text_new);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_SLIDER_VALUE) {
            int32_t value_new = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value in Slider widget");
            int32_t value_cur = lv_slider_get_value(updateTask.obj);
            if (value_new != value_cur) lv_slider_set_value(updateTask.obj, value_new, LV_ANIM_OFF);
        } else if (updateTask.updateTaskType == UPDATE_TASK_TYPE_SLIDER_VALUE_LEFT) {
            int32_t value_new = evalIntegerProperty(updateTask.page_index, updateTask.component_index, updateTask.property_index, "Failed to evaluate Value Left in Slider widget");
            int32_t value_cur = lv_slider_get_left_value(updateTask.obj);
            if (value_new != value_cur) lv_slider_set_left_value(updateTask.obj, value_new, LV_ANIM_OFF);
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
    static int16_t currentPageId = -1;
    eez::flow::onPageChanged(currentPageId, pageId);
    currentPageId = pageId;
}

EM_PORT_API(void) stopScript() {
    eez::flow::stop();
}

EM_PORT_API(void) onMessageFromDebugger(char *messageData, uint32_t messageDataSize) {
    eez::flow::processDebuggerInput(messageData, messageDataSize);
}

static lv_obj_t *getLvglObjectFromIndex(int32_t index) {
    if (index >= 0 && index < MAX_OBJECTS) {
        return indexToObject[index];
    }
    return 0;
}

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
    eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
}

extern "C" void flowPropagateValue(unsigned pageIndex, unsigned componentIndex, unsigned outputIndex) {
    eez::flow::FlowState *flowState = eez::flow::getPageFlowState(eez::g_mainAssets, pageIndex);
    eez::flow::propagateValue(flowState, componentIndex, outputIndex);
}

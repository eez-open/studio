#include <stdio.h>
#include <emscripten.h>

#include <eez/core/os.h>

#include <eez/flow/flow.h>
#include <eez/flow/hooks.h>
#include <eez/flow/debugger.h>
#include <eez/flow/components.h>
#include <eez/flow/flow_defs_v3.h>

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

EM_PORT_API(void) startFlow() {
    eez::flow::start(eez::g_mainAssets);
    eez::flow::getPageFlowState(eez::g_mainAssets, 0);
}

EM_PORT_API(void) stopScript() {
    eez::flow::stop();
}

EM_PORT_API(void) onMessageFromDebugger(char *messageData, uint32_t messageDataSize) {
    eez::flow::processDebuggerInput(messageData, messageDataSize);
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
    eez::flow::stopScriptHook = stopScript;

    eez::flow::onDebuggerClientConnected();
}

extern "C" bool flowTick() {
    if (eez::flow::isFlowStopped()) {
        return false;
    }
    eez::flow::tick();
    return true;
}

#include <stdio.h>
#include <emscripten.h>

#include <eez/gui/gui.h>
#include <eez/gui/display.h>
#include <eez/gui/thread.h>
#include <eez/flow/flow.h>
#include <eez/flow/hooks.h>
#include <eez/flow/debugger.h>
#include <eez/flow/components.h>
#include <eez/flow/flow_defs_v3.h>

static int g_started = false;

uint32_t DISPLAY_WIDTH;
uint32_t DISPLAY_HEIGHT;

extern void eez_system_tick();

// clang-format off
void mountFileSystem() {
    EM_ASM(
        FS.mkdir("/min_eez_sample");
        FS.mount(IDBFS, {}, "/min_eez_sample");

        //Module.print("start file sync..");

        //flag to check when data are synchronized
        Module.syncdone = 0;

        FS.syncfs(true, function(err) {
            assert(!err);
            //Module.print("end file sync..");
            Module.syncdone = 1;
        });
    , 0);
}
// clang-format on

void startToDebuggerMessage() {
    EM_ASM({
        startToDebuggerMessage();
    }, 0);
}

void writeDebuggerBuffer(const char *buffer, uint32_t length) {
    EM_ASM({
        writeDebuggerBuffer(new Uint8Array(Module.HEAPU8.buffer, $0, $1));
    }, buffer, length);
}

void finishToDebuggerMessage() {
    EM_ASM({
        finishToDebuggerMessage();
    }, 0);
}

void executeDashboardComponent(uint16_t componentType, int flowStateIndex, int componentIndex) {
    EM_ASM({
        executeDashboardComponent($0, $1, $2);
    }, componentType, flowStateIndex, componentIndex);
}

void stopScript() {}

namespace eez {
    namespace flow {
        void executeScpiComponent(FlowState *flowState, unsigned componentIndex);
    }
}

EM_PORT_API(void) init(uint8_t *assets, uint32_t assetsSize, uint32_t displayWidth, uint32_t displayHeight) {
    DISPLAY_WIDTH = displayWidth;
    DISPLAY_HEIGHT = displayHeight;

    eez::initMemory();
    eez::initAllocHeap(eez::ALLOC_BUFFER, eez::ALLOC_BUFFER_SIZE);

    eez::flow::startToDebuggerMessageHook = startToDebuggerMessage;
    eez::flow::writeDebuggerBufferHook = writeDebuggerBuffer;
    eez::flow::finishToDebuggerMessageHook = finishToDebuggerMessage;
    eez::flow::executeDashboardComponentHook = executeDashboardComponent;
    eez::flow::stopScriptHook = stopScript;
    eez::flow::registerComponent(eez::flow::defs_v3::COMPONENT_TYPE_SCPIACTION, eez::flow::executeScpiComponent);

    eez::flow::onDebuggerClientConnected();

    eez::gui::loadMainAssets(assets, assetsSize);
    eez::gui::startThread();
    eez::gui::display::turnOn();
    eez::gui::display::init();
}

EM_PORT_API(void) startFlow() {
    eez::flow::start(eez::gui::g_mainAssets);
}

EM_PORT_API(void) mainLoop() {
    if (!g_started) {
        mountFileSystem();
        g_started = true;
    } else {
        if (emscripten_run_script_int("Module.syncdone") == 1) {
            eez_system_tick();

            // clang-format off
            EM_ASM(
                if (Module.syncdone) {
                    //Module.print("Start File sync..");
                    Module.syncdone = 0;

                    FS.syncfs(false, function(err) {
                        assert(!err);
                        //Module.print("End File sync..");
                        Module.syncdone = 1;
                    });
                }
            , 0);
            // clang-format on
        }
    }
}

EM_PORT_API(void) onMessageFromDebugger(char *messageData, uint32_t messageDataSize) {
    eez::flow::processDebuggerInput(messageData, messageDataSize);
}

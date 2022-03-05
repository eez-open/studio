#include <stdio.h>
#include <emscripten.h>

#include <eez/gui/gui.h>
#include <eez/gui/thread.h>
#include <eez/flow/flow.h>

static int g_started = false;
static int g_initialized = false;

extern void eez_system_tick();

void init() {
    eez::initAllocHeap(ALLOC_BUFFER, ALLOC_BUFFER_SIZE);
    eez::gui::display::turnOn();
    eez::gui::startThread();
}

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

EM_PORT_API(void) mainLoop() {
    if (!g_started) {
        mountFileSystem();
        g_started = true;
    } else {
        if (emscripten_run_script_int("Module.syncdone") == 1) {
            if (!g_initialized) {
                g_initialized = true;
                init();
            } else {
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
}

EM_PORT_API(void) loadAssets(uint8_t *assets, uint32_t assetsSize) {
    static uint8_t *g_assets;

    if (g_assets) {
        free(g_assets);
    }

    g_assets = assets;

    eez::gui::loadMainAssets(assets, assetsSize);
}

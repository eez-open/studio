
#include "ui.h"
#include "screens.h"
#include "images.h"
#include "actions.h"
#include "vars.h"

void flow_init_calculator(lv_obj_t *obj, FlowState_calculator *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_calculator(FlowState_calculator *flowState) {
    (void)flowState;
}

static int16_t currentScreen = -1;

static lv_obj_t *getLvglObjectFromIndex(int32_t index) {
    if (index == -1) {
        return 0;
    }
    return ((lv_obj_t **)&objects)[index];
}

void loadScreen(enum ScreensEnum screenId) {
    currentScreen = screenId - 1;
    lv_obj_t *screen = getLvglObjectFromIndex(currentScreen);
#ifdef EEZ_SCREEN_LIFETIME_SUPPORT
    if (screen == NULL) {
        create_screen_by_id(screenId);
        screen = getLvglObjectFromIndex(currentScreen);
    }
#endif
    lv_scr_load_anim(screen, LV_SCR_LOAD_ANIM_FADE_IN, 200, 0, false);
}

void ui_init() {
    create_screens();
    loadScreen(SCREEN_ID_CALCULATOR);

//flow_init_globals();
}

void ui_tick() {
    tick_screen(currentScreen);
}


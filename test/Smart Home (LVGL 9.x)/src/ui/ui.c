
#include "ui.h"
#include "screens.h"
#include "images.h"
#include "actions.h"
#include "vars.h"

FlowGlobalVariables flow_g;

void flow_init_globals(void) {
    // Initialize array users
    eez_string_assign(&flow_g.users[0].name, "ANA");
    eez_string_assign(&flow_g.users[1].name, "IVAN");
    eez_string_assign(&flow_g.users[2].name, "TOMA");
    // Initialize array zones
    eez_string_assign(&flow_g.zones[0].name, "Garage");
    flow_g.zones[0].temperature = 18;
    flow_g.zones[0].power = 135;
    flow_g.zones[0].locked = true;
    flow_g.zones[0].lighting_percent = 0;
    flow_g.zones[0].heating_saved = true;
    flow_g.zones[0].lighting_saved = true;
    eez_string_assign(&flow_g.zones[1].name, "Room 1");
    flow_g.zones[1].temperature = 22;
    flow_g.zones[1].power = 135;
    flow_g.zones[1].locked = false;
    flow_g.zones[1].lighting_percent = 90;
    flow_g.zones[1].heating_saved = true;
    flow_g.zones[1].lighting_saved = true;
    eez_string_assign(&flow_g.zones[2].name, "Room 2");
    flow_g.zones[2].temperature = 20;
    flow_g.zones[2].power = 135;
    flow_g.zones[2].locked = false;
    flow_g.zones[2].lighting_percent = 10;
    flow_g.zones[2].heating_saved = true;
    flow_g.zones[2].lighting_saved = true;
    eez_string_assign(&flow_g.zones[3].name, "Basement");
    flow_g.zones[3].temperature = 20;
    flow_g.zones[3].power = 135;
    flow_g.zones[3].locked = true;
    flow_g.zones[3].lighting_percent = 0;
    flow_g.zones[3].heating_saved = true;
    flow_g.zones[3].lighting_saved = true;
    eez_string_assign(&flow_g.zones[4].name, "Attic");
    flow_g.zones[4].temperature = 23;
    flow_g.zones[4].power = 135;
    flow_g.zones[4].locked = true;
    flow_g.zones[4].lighting_percent = 90;
    flow_g.zones[4].heating_saved = true;
    flow_g.zones[4].lighting_saved = true;
    flow_g.selected_user = 0;
    flow_g.selected_zone = 0;
}

void flow_init_heating_screen(lv_obj_t *obj, FlowState_heating_screen *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_heating_screen(FlowState_heating_screen *flowState) {
    (void)flowState;
}

void flow_init_security_screen(lv_obj_t *obj, FlowState_security_screen *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_security_screen(FlowState_security_screen *flowState) {
    (void)flowState;
}

void flow_init_lighting_screen(lv_obj_t *obj, FlowState_lighting_screen *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_lighting_screen(FlowState_lighting_screen *flowState) {
    (void)flowState;
}

void flow_init_header(lv_obj_t *obj, FlowState_header *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_header(FlowState_header *flowState) {
    (void)flowState;
}

void flow_init_account_box(lv_obj_t *obj, FlowState_account_box *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_account_box(FlowState_account_box *flowState) {
    (void)flowState;
}

void flow_init_zone_selector(lv_obj_t *obj, FlowState_zone_selector *flowState) {
    (void)obj;
    (void)flowState;
}

void flow_tick_zone_selector(FlowState_zone_selector *flowState) {
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
    loadScreen(SCREEN_ID_HEATING_SCREEN);

flow_init_globals();
}

void ui_tick() {
    tick_screen(currentScreen);
}


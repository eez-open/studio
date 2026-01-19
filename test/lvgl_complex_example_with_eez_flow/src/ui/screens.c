#include <string.h>

#include "screens.h"
#include "images.h"
#include "fonts.h"
#include "actions.h"
#include "vars.h"
#include "styles.h"
#include "ui.h"

#include <string.h>
#include <stdlib.h>

objects_t objects;
lv_obj_t *tick_value_change_obj;

static void event_handler_cb_enter_pin_obj2(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_enter_pin *flowState = (FlowState_enter_pin *)lv_obj_get_user_data(objects.enter_pin);
    
    // Handle VALUE_CHANGED event
    if (lv_event_get_code(e) == LV_EVENT_VALUE_CHANGED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // Evaluate: Event.getKey(event)
        int32_t eval_result_1 = eez_flow_lite_event_get_key(e);
        // Switch/Case - route based on conditions
        if ((eval_result_1 >= 0 && eval_result_1 <= 8) || eval_result_1 == 10) {
            // SetVariable action
            // pin = pin + digit
            eez_string_assign(&flowState->pin, eez_string_concat(eez_string_cstr(&flowState->pin), (eval_result_1 == 10 ? "0" : eez_string_from_char((char)(((48 + eval_result_1) + 1))))));
            // error = ""
            eez_string_assign(&flowState->error, "");
        } else if (eval_result_1 == 9) {
            // Note: SwitchCase test 'back' has no outputValue expression
            // IsTrue: String.length(pin) > 0
            if (strlen(eez_string_cstr(&flowState->pin)) > 0) {
                // True branch
                // SetVariable action
                // pin = String.substring(pin, 0, String.length(pin) - 1)
                eez_string_assign(&flowState->pin, eez_string_substring(eez_string_cstr(&flowState->pin), 0, (strlen(eez_string_cstr(&flowState->pin)) - 1)));
                // error = ""
                eez_string_assign(&flowState->error, "");
            } else {
                // False branch
            }
        } else if (eval_result_1 == 11) {
            // Note: SwitchCase test 'enter' has no outputValue expression
            // IsTrue: pin == MASTER_PIN
            if (eez_string_equals(eez_string_cstr(&flowState->pin), eez_string_cstr(&flow_g.master_pin))) {
                // True branch
                // LVGL Action: Change screen to 'Menu'
                loadScreen(SCREEN_ID_MENU);
            } else {
                // False branch
                // SetVariable action
                // error = "Wrong PIN entered!"
                eez_string_assign(&flowState->error, "Wrong PIN entered!");
            }
        }
        // Log: `Button pressed: ${btn_pressed}`
        LV_LOG_USER("%s", eez_string_concat("Button pressed: ", eez_string_from_int(eval_result_1)));
    }
}

static void event_handler_cb_enter_pin_obj3(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_enter_pin *flowState = (FlowState_enter_pin *)lv_obj_get_user_data(objects.enter_pin);
    
    if (event == LV_EVENT_VALUE_CHANGED) {
        lv_obj_t *ta = lv_event_get_target(e);
        if (tick_value_change_obj != ta) {
            const char *value = lv_textarea_get_text(ta);
            eez_string_assign(&flowState->pin, value);
        }
    }
}

static void event_handler_cb_counter_obj0(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    lv_obj_t *target = lv_event_get_target(e);
    lv_obj_t *user_widget_obj = target;
    while (user_widget_obj && lv_obj_get_parent(user_widget_obj) && lv_obj_get_user_data(user_widget_obj) == NULL) {
        user_widget_obj = lv_obj_get_parent(user_widget_obj);
    }
    FlowState_counter *flowState = (FlowState_counter *)lv_obj_get_user_data(user_widget_obj);
    
    // Handle PRESSED event
    if (lv_event_get_code(e) == LV_EVENT_PRESSED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // cnt = cnt + 1
        flowState->cnt = (flowState->cnt + 1);
    }
}

static void screen_unload_cb_enter_pin(lv_event_t *e) {
    (void)e;
    delete_screen_enter_pin();
}

static void screen_unload_cb_menu(lv_event_t *e) {
    (void)e;
    delete_screen_menu();
}

void create_screen_enter_pin() {
    FlowState_enter_pin *flowState = (FlowState_enter_pin *)lv_malloc(sizeof(FlowState_enter_pin));
    memset(flowState, 0, sizeof(FlowState_enter_pin));
    
    lv_obj_t *obj = lv_obj_create(0);
    objects.enter_pin = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 800, 480);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            lv_obj_set_pos(obj, 342, 18);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "Enter PIN");
        }
        {
            lv_obj_t *obj = lv_buttonmatrix_create(parent_obj);
            objects.obj2 = obj;
            lv_obj_set_pos(obj, 241, 116);
            lv_obj_set_size(obj, 320, 320);
            static const char *map[16] = {
                "1",
                "2",
                "3",
                "\n",
                "4",
                "5",
                "6",
                "\n",
                "7",
                "8",
                "9",
                "\n",
                "Back",
                "0",
                "Enter",
                NULL,
            };
            lv_buttonmatrix_set_map(obj, map);
            lv_obj_add_event_cb(obj, event_handler_cb_enter_pin_obj2, LV_EVENT_ALL, NULL);
        }
        {
            lv_obj_t *obj = lv_textarea_create(parent_obj);
            objects.obj3 = obj;
            lv_obj_set_pos(obj, 325, 54);
            lv_obj_set_size(obj, 150, 53);
            lv_textarea_set_max_length(obj, 128);
            lv_textarea_set_one_line(obj, true);
            lv_textarea_set_password_mode(obj, false);
            lv_obj_add_event_cb(obj, event_handler_cb_enter_pin_obj3, LV_EVENT_ALL, NULL);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.obj4 = obj;
            lv_obj_set_pos(obj, 241, 444);
            lv_obj_set_size(obj, 320, LV_SIZE_CONTENT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_24, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(0xffff0000), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
    }
    
    lv_obj_add_event_cb(objects.enter_pin, screen_unload_cb_enter_pin, LV_EVENT_SCREEN_UNLOADED, NULL);
    
    lv_obj_set_user_data(objects.enter_pin, flowState);
    flow_init_enter_pin(objects.enter_pin, flowState);
    
    tick_screen_enter_pin();
}

void delete_screen_enter_pin() {
    lv_obj_delete(objects.enter_pin);
    objects.enter_pin = 0;
    objects.obj2 = 0;
    objects.obj3 = 0;
    objects.obj4 = 0;
    lv_free(lv_obj_get_user_data(objects.enter_pin));
}

void tick_screen_enter_pin() {
    FlowState_enter_pin *flowState = (FlowState_enter_pin *)lv_obj_get_user_data(objects.enter_pin);
    {
        const char *new_val = eez_string_cstr(&flowState->pin);
        const char *cur_val = lv_textarea_get_text(objects.obj3);
        uint32_t max_length = lv_textarea_get_max_length(objects.obj3);
        if (strncmp(new_val, cur_val, max_length) != 0) {
            tick_value_change_obj = objects.obj3;
            lv_textarea_set_text(objects.obj3, new_val);
            tick_value_change_obj = NULL;
        }
    }
    {
        const char *new_val = eez_string_cstr(&flowState->error);
        const char *cur_val = lv_label_get_text(objects.obj4);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.obj4;
            lv_label_set_text(objects.obj4, new_val);
            tick_value_change_obj = NULL;
        }
    }
}

void create_screen_menu() {
    FlowState_menu *flowState = (FlowState_menu *)lv_malloc(sizeof(FlowState_menu));
    memset(flowState, 0, sizeof(FlowState_menu));
    
    lv_obj_t *obj = lv_obj_create(0);
    objects.menu = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 800, 480);
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj0 = obj;
            lv_obj_set_pos(obj, 300, 78);
            lv_obj_set_size(obj, 200, 50);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                FlowState_counter *userWidgetFlowState = (FlowState_counter *)lv_malloc(sizeof(FlowState_counter));
                memset(userWidgetFlowState, 0, sizeof(FlowState_counter));
                lv_obj_set_user_data(obj, userWidgetFlowState);
                create_user_widget_counter(obj, userWidgetFlowState, 3);
            }
        }
        {
            lv_obj_t *obj = lv_obj_create(parent_obj);
            objects.obj1 = obj;
            lv_obj_set_pos(obj, 300, 157);
            lv_obj_set_size(obj, 200, 50);
            lv_obj_set_style_pad_left(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_bottom(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_border_width(obj, 0, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                FlowState_counter *userWidgetFlowState = (FlowState_counter *)lv_malloc(sizeof(FlowState_counter));
                memset(userWidgetFlowState, 0, sizeof(FlowState_counter));
                lv_obj_set_user_data(obj, userWidgetFlowState);
                create_user_widget_counter(obj, userWidgetFlowState, 6);
            }
        }
    }
    
    lv_obj_add_event_cb(objects.menu, screen_unload_cb_menu, LV_EVENT_SCREEN_UNLOADED, NULL);
    
    lv_obj_set_user_data(objects.menu, flowState);
    flow_init_menu(objects.menu, flowState);
    
    tick_screen_menu();
}

void delete_screen_menu() {
    lv_obj_delete(objects.menu);
    objects.menu = 0;
    objects.obj0 = 0;
    objects.obj1 = 0;
    lv_free(lv_obj_get_user_data(objects.menu));
}

void tick_screen_menu() {
    FlowState_menu *flowState = (FlowState_menu *)lv_obj_get_user_data(objects.menu);
    tick_user_widget_counter((FlowState_counter *)lv_obj_get_user_data(objects.obj0), 3);
    tick_user_widget_counter((FlowState_counter *)lv_obj_get_user_data(objects.obj1), 6);
}

void create_user_widget_counter(lv_obj_t *parent_obj, void *flowState_, int startWidgetIndex) {
    FlowState_counter *flowState = (FlowState_counter *)flowState_;
    (void)flowState;
    (void)startWidgetIndex;
    lv_obj_t *obj = parent_obj;
    {
        lv_obj_t *parent_obj = obj;
        {
            lv_obj_t *obj = lv_button_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 0] = obj;
            lv_obj_set_pos(obj, 100, 0);
            lv_obj_set_size(obj, 100, 50);
            lv_obj_add_event_cb(obj, event_handler_cb_counter_obj0, LV_EVENT_ALL, NULL);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "Button");
                }
            }
        }
        {
            lv_obj_t *obj = lv_label_create(parent_obj);
            ((lv_obj_t **)&objects)[startWidgetIndex + 1] = obj;
            lv_obj_set_pos(obj, 0, 17);
            lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
            lv_label_set_text(obj, "");
        }
    }
}

void tick_user_widget_counter(void *flowState_, int startWidgetIndex) {
    FlowState_counter *flowState = (FlowState_counter *)flowState_;
    (void)flowState;
    (void)startWidgetIndex;
    {
        const char *new_val = eez_string_concat("Count: ", eez_string_from_int(flowState->cnt));
        const char *cur_val = lv_label_get_text(((lv_obj_t **)&objects)[startWidgetIndex + 1]);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = ((lv_obj_t **)&objects)[startWidgetIndex + 1];
            lv_label_set_text(((lv_obj_t **)&objects)[startWidgetIndex + 1], new_val);
            tick_value_change_obj = NULL;
        }
    }
}

static const char *screen_names[] = { "Enter_PIN", "Menu" };
static const char *object_names[] = { "enter_pin", "menu", "obj0", "obj0__obj0", "obj0__obj1", "obj1", "obj1__obj0", "obj1__obj1", "obj2", "obj3", "obj4" };

typedef void (*create_screen_func_t)();
create_screen_func_t create_screen_funcs[] = {
    create_screen_enter_pin,
    create_screen_menu,
};
void create_screen(int screen_index) {
    create_screen_funcs[screen_index]();
}
void create_screen_by_id(enum ScreensEnum screenId) {
    create_screen_funcs[screenId - 1]();
}

typedef void (*delete_screen_func_t)();
delete_screen_func_t delete_screen_funcs[] = {
    delete_screen_enter_pin,
    delete_screen_menu,
};
void delete_screen(int screen_index) {
    delete_screen_funcs[screen_index]();
}
void delete_screen_by_id(enum ScreensEnum screenId) {
    delete_screen_funcs[screenId - 1]();
}

typedef void (*tick_screen_func_t)();
tick_screen_func_t tick_screen_funcs[] = {
    tick_screen_enter_pin,
    tick_screen_menu,
};
void tick_screen(int screen_index) {
    tick_screen_funcs[screen_index]();
}
void tick_screen_by_id(enum ScreensEnum screenId) {
    tick_screen_funcs[screenId - 1]();
}

void create_screens() {
    lv_disp_t *dispp = lv_disp_get_default();
    lv_theme_t *theme = lv_theme_default_init(dispp, lv_palette_main(LV_PALETTE_BLUE), lv_palette_main(LV_PALETTE_RED), false, LV_FONT_DEFAULT);
    lv_disp_set_theme(dispp, theme);
    
    create_screen_enter_pin();
}

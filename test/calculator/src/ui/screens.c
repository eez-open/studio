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

static void event_handler_cb_calculator_btn_clear(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // display = "0"
        eez_string_assign(&flowState->display, "0");
        // operand = 0
        flowState->operand = 0;
        // operator = ""
        eez_string_assign(&flowState->operator, "");
        // newNumber = true
        flowState->new_number = true;
    }
}

static void event_handler_cb_calculator_btn_negate(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // display = -Flow.parseDouble(display)
        eez_string_assign(&flowState->display, eez_string_from_double(-atof(eez_string_cstr(&flowState->display))));
    }
}

static void event_handler_cb_calculator_btn_percent(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // display = Flow.parseDouble(display) / 100
        eez_string_assign(&flowState->display, eez_string_from_double((atof(eez_string_cstr(&flowState->display)) / 100)));
    }
}

static void event_handler_cb_calculator_btn_divide(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // operator = "/"
        eez_string_assign(&flowState->operator, "/");
        // SetVariable action
        // operand = Flow.parseDouble(display)
        flowState->operand = atof(eez_string_cstr(&flowState->display));
        // newNumber = true
        flowState->new_number = true;
    }
}

static void event_handler_cb_calculator_btn_7(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 7;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_10 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_10 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_10 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_10))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_8(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 8;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_11 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_11 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_11 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_11))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_9(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 9;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_12 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_12 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_12 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_12))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_multiply(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // operator = "*"
        eez_string_assign(&flowState->operator, "*");
        // SetVariable action
        // operand = Flow.parseDouble(display)
        flowState->operand = atof(eez_string_cstr(&flowState->display));
        // newNumber = true
        flowState->new_number = true;
    }
}

static void event_handler_cb_calculator_btn_4(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 4;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_13 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_13 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_13 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_13))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_5(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 5;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_14 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_14 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_14 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_14))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_6(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 6;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_15 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_15 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_15 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_15))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_subtract(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // operator = "-"
        eez_string_assign(&flowState->operator, "-");
        // SetVariable action
        // operand = Flow.parseDouble(display)
        flowState->operand = atof(eez_string_cstr(&flowState->display));
        // newNumber = true
        flowState->new_number = true;
    }
}

static void event_handler_cb_calculator_btn_1(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 1;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_16 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_16 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_16 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_16))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_2(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 2;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_17 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_17 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_17 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_17))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_3(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 3;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_18 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_18 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_18 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_18))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_add(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // operator = "+"
        eez_string_assign(&flowState->operator, "+");
        // SetVariable action
        // operand = Flow.parseDouble(display)
        flowState->operand = atof(eez_string_cstr(&flowState->display));
        // newNumber = true
        flowState->new_number = true;
    }
}

static void event_handler_cb_calculator_btn_0(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // Evaluate: Event.getUserData(event)
        const char *eval_result_19 = eez_string_from_int(event_user_data);
        // SetVariable action
        // display = newNumber ? digit : (display == "0" ? digit : display + digit)
        eez_string_assign(&flowState->display, (flowState->new_number ? eval_result_19 : (eez_string_equals(eez_string_cstr(&flowState->display), "0") ? eval_result_19 : eez_string_concat(eez_string_cstr(&flowState->display), eval_result_19))));
        // newNumber = false
        flowState->new_number = false;
    }
}

static void event_handler_cb_calculator_btn_decimal(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // SetVariable action
        // display = String.find(display, ".") == -1 ? display + "." : display
        eez_string_assign(&flowState->display, (eez_string_find(eez_string_cstr(&flowState->display), ".") == -1 ? eez_string_concat(eez_string_cstr(&flowState->display), ".") : eez_string_cstr(&flowState->display)));
    }
}

static void event_handler_cb_calculator_btn_equals(lv_event_t *e) {
    lv_event_code_t event = lv_event_get_code(e);
    (void)event;
    
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    
    // Handle CLICKED event
    if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
        intptr_t event_user_data = 0;
        (void)event_user_data;
        // Switch/Case - route based on conditions
        if (eez_string_equals(eez_string_cstr(&flowState->operator), "+")) {
            // SetVariable action
            // display = result
            eez_string_assign(&flowState->display, eez_string_from_double((flowState->operand + atof(eez_string_cstr(&flowState->display)))));
            // newNumber = true
            flowState->new_number = true;
            // operator = ""
            eez_string_assign(&flowState->operator, "");
        } else if (eez_string_equals(eez_string_cstr(&flowState->operator), "-")) {
            // SetVariable action
            // display = result
            eez_string_assign(&flowState->display, eez_string_from_double((flowState->operand - atof(eez_string_cstr(&flowState->display)))));
            // newNumber = true
            flowState->new_number = true;
            // operator = ""
            eez_string_assign(&flowState->operator, "");
        } else if (eez_string_equals(eez_string_cstr(&flowState->operator), "*")) {
            // SetVariable action
            // display = result
            eez_string_assign(&flowState->display, eez_string_from_double((flowState->operand * atof(eez_string_cstr(&flowState->display)))));
            // newNumber = true
            flowState->new_number = true;
            // operator = ""
            eez_string_assign(&flowState->operator, "");
        } else if (eez_string_equals(eez_string_cstr(&flowState->operator), "/")) {
            // SetVariable action
            // display = result
            eez_string_assign(&flowState->display, eez_string_from_double((atof(eez_string_cstr(&flowState->display)) != 0 ? (flowState->operand / atof(eez_string_cstr(&flowState->display))) : 0)));
            // newNumber = true
            flowState->new_number = true;
            // operator = ""
            eez_string_assign(&flowState->operator, "");
        }
    }
}

void create_screen_calculator() {
    FlowState_calculator *flowState = (FlowState_calculator *)lv_malloc(sizeof(FlowState_calculator));
    memset(flowState, 0, sizeof(FlowState_calculator));
    
    lv_obj_t *obj = lv_obj_create(0);
    objects.calculator = obj;
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_set_size(obj, 480, 640);
    lv_obj_set_style_bg_color(obj, lv_color_hex(0xff1c1c1e), LV_PART_MAIN | LV_STATE_DEFAULT);
    {
        lv_obj_t *parent_obj = obj;
        {
            // display_label
            lv_obj_t *obj = lv_label_create(parent_obj);
            objects.display_label = obj;
            lv_obj_set_pos(obj, 20, 20);
            lv_obj_set_size(obj, 440, 80);
            lv_label_set_long_mode(obj, LV_LABEL_LONG_CLIP);
            lv_obj_set_style_text_font(obj, &lv_font_montserrat_48, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_RIGHT, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_top(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_pad_right(obj, 20, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff333333), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(obj, 255, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_text_color(obj, lv_color_hex(0xffffffff), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_label_set_text(obj, "");
        }
        {
            // btn_clear
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_clear = obj;
            lv_obj_set_pos(obj, 20, 120);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_clear, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffff6b6b), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "C");
                }
            }
        }
        {
            // btn_negate
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_negate = obj;
            lv_obj_set_pos(obj, 130, 120);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_negate, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffa0a0a0), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "+/-");
                }
            }
        }
        {
            // btn_percent
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_percent = obj;
            lv_obj_set_pos(obj, 240, 120);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_percent, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffa0a0a0), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "%");
                }
            }
        }
        {
            // btn_divide
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_divide = obj;
            lv_obj_set_pos(obj, 350, 120);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_divide, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffff9500), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "/");
                }
            }
        }
        {
            // btn_7
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_7 = obj;
            lv_obj_set_pos(obj, 20, 210);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_7, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "7");
                }
            }
        }
        {
            // btn_8
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_8 = obj;
            lv_obj_set_pos(obj, 130, 210);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_8, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "8");
                }
            }
        }
        {
            // btn_9
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_9 = obj;
            lv_obj_set_pos(obj, 240, 210);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_9, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "9");
                }
            }
        }
        {
            // btn_multiply
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_multiply = obj;
            lv_obj_set_pos(obj, 350, 210);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_multiply, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffff9500), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "x");
                }
            }
        }
        {
            // btn_4
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_4 = obj;
            lv_obj_set_pos(obj, 20, 300);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_4, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "4");
                }
            }
        }
        {
            // btn_5
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_5 = obj;
            lv_obj_set_pos(obj, 130, 300);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_5, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "5");
                }
            }
        }
        {
            // btn_6
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_6 = obj;
            lv_obj_set_pos(obj, 240, 300);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_6, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "6");
                }
            }
        }
        {
            // btn_subtract
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_subtract = obj;
            lv_obj_set_pos(obj, 350, 300);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_subtract, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffff9500), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "-");
                }
            }
        }
        {
            // btn_1
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_1 = obj;
            lv_obj_set_pos(obj, 20, 390);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_1, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "1");
                }
            }
        }
        {
            // btn_2
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_2 = obj;
            lv_obj_set_pos(obj, 130, 390);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_2, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "2");
                }
            }
        }
        {
            // btn_3
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_3 = obj;
            lv_obj_set_pos(obj, 240, 390);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_3, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "3");
                }
            }
        }
        {
            // btn_add
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_add = obj;
            lv_obj_set_pos(obj, 350, 390);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_add, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffff9500), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "+");
                }
            }
        }
        {
            // btn_0
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_0 = obj;
            lv_obj_set_pos(obj, 20, 480);
            lv_obj_set_size(obj, 210, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_0, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "0");
                }
            }
        }
        {
            // btn_decimal
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_decimal = obj;
            lv_obj_set_pos(obj, 240, 480);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_decimal, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xff505050), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, ".");
                }
            }
        }
        {
            // btn_equals
            lv_obj_t *obj = lv_button_create(parent_obj);
            objects.btn_equals = obj;
            lv_obj_set_pos(obj, 350, 480);
            lv_obj_set_size(obj, 100, 80);
            lv_obj_add_event_cb(obj, event_handler_cb_calculator_btn_equals, LV_EVENT_ALL, NULL);
            lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
            lv_obj_set_style_bg_color(obj, lv_color_hex(0xffff9500), LV_PART_MAIN | LV_STATE_DEFAULT);
            lv_obj_set_style_radius(obj, 10, LV_PART_MAIN | LV_STATE_DEFAULT);
            {
                lv_obj_t *parent_obj = obj;
                {
                    lv_obj_t *obj = lv_label_create(parent_obj);
                    lv_obj_set_pos(obj, 0, 0);
                    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
                    lv_obj_set_style_text_font(obj, &lv_font_montserrat_32, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_obj_set_style_align(obj, LV_ALIGN_CENTER, LV_PART_MAIN | LV_STATE_DEFAULT);
                    lv_label_set_text(obj, "=");
                }
            }
        }
    }
    
    lv_obj_set_user_data(objects.calculator, flowState);
    flow_init_calculator(objects.calculator, flowState);
    
    tick_screen_calculator();
}

void tick_screen_calculator() {
    FlowState_calculator *flowState = (FlowState_calculator *)lv_obj_get_user_data(objects.calculator);
    {
        const char *new_val = eez_string_cstr(&flowState->display);
        const char *cur_val = lv_label_get_text(objects.display_label);
        if (strcmp(new_val, cur_val) != 0) {
            tick_value_change_obj = objects.display_label;
            lv_label_set_text(objects.display_label, new_val);
            tick_value_change_obj = NULL;
        }
    }
}

static const char *screen_names[] = { "Calculator" };
static const char *object_names[] = { "calculator", "btn_clear", "btn_negate", "btn_percent", "btn_divide", "btn_7", "btn_8", "btn_9", "btn_multiply", "btn_4", "btn_5", "btn_6", "btn_subtract", "btn_1", "btn_2", "btn_3", "btn_add", "btn_0", "btn_decimal", "btn_equals", "display_label" };

typedef void (*tick_screen_func_t)();
tick_screen_func_t tick_screen_funcs[] = {
    tick_screen_calculator,
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
    
    create_screen_calculator();
}

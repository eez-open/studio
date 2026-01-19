#ifndef EEZ_LVGL_UI_SCREENS_H
#define EEZ_LVGL_UI_SCREENS_H

#include <lvgl/lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct _objects_t {
    lv_obj_t *calculator;
    lv_obj_t *btn_clear;
    lv_obj_t *btn_negate;
    lv_obj_t *btn_percent;
    lv_obj_t *btn_divide;
    lv_obj_t *btn_7;
    lv_obj_t *btn_8;
    lv_obj_t *btn_9;
    lv_obj_t *btn_multiply;
    lv_obj_t *btn_4;
    lv_obj_t *btn_5;
    lv_obj_t *btn_6;
    lv_obj_t *btn_subtract;
    lv_obj_t *btn_1;
    lv_obj_t *btn_2;
    lv_obj_t *btn_3;
    lv_obj_t *btn_add;
    lv_obj_t *btn_0;
    lv_obj_t *btn_decimal;
    lv_obj_t *btn_equals;
    lv_obj_t *display_label;
} objects_t;

extern objects_t objects;

enum ScreensEnum {
    SCREEN_ID_CALCULATOR = 1,
};

void create_screen_calculator();
void tick_screen_calculator();

void tick_screen_by_id(enum ScreensEnum screenId);
void tick_screen(int screen_index);

void create_screens();

#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_SCREENS_H*/
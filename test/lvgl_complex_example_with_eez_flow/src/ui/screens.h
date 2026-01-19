#ifndef EEZ_LVGL_UI_SCREENS_H
#define EEZ_LVGL_UI_SCREENS_H

#include <lvgl/lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct _objects_t {
    lv_obj_t *enter_pin;
    lv_obj_t *menu;
    lv_obj_t *obj0;
    lv_obj_t *obj0__obj0;
    lv_obj_t *obj0__obj1;
    lv_obj_t *obj1;
    lv_obj_t *obj1__obj0;
    lv_obj_t *obj1__obj1;
    lv_obj_t *obj2;
    lv_obj_t *obj3;
    lv_obj_t *obj4;
} objects_t;

extern objects_t objects;

enum ScreensEnum {
    SCREEN_ID_ENTER_PIN = 1,
    SCREEN_ID_MENU = 2,
};

void create_screen_enter_pin();
void delete_screen_enter_pin();
void tick_screen_enter_pin();

void create_screen_menu();
void delete_screen_menu();
void tick_screen_menu();

void create_user_widget_counter(lv_obj_t *parent_obj, void *flowState, int startWidgetIndex);
void tick_user_widget_counter(void *flowState, int startWidgetIndex);

#define EEZ_SCREEN_LIFETIME_SUPPORT
void create_screen_by_id(enum ScreensEnum screenId);
void delete_screen_by_id(enum ScreensEnum screenId);
void tick_screen_by_id(enum ScreensEnum screenId);
void tick_screen(int screen_index);

void create_screens();

#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_SCREENS_H*/
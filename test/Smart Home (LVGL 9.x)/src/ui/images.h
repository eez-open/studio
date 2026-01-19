#ifndef EEZ_LVGL_UI_IMAGES_H
#define EEZ_LVGL_UI_IMAGES_H

#include <lvgl/lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

extern const lv_img_dsc_t img_background_1;
extern const lv_img_dsc_t img_background_2;
extern const lv_img_dsc_t img_background_3;
extern const lv_img_dsc_t img_heating_button;
extern const lv_img_dsc_t img_heating_button_hoover;
extern const lv_img_dsc_t img_security_button;
extern const lv_img_dsc_t img_security_button_hoover;
extern const lv_img_dsc_t img_lighting_button;
extern const lv_img_dsc_t img_lighting_button_hoover;
extern const lv_img_dsc_t img_face_0;
extern const lv_img_dsc_t img_face_1;
extern const lv_img_dsc_t img_face_2;
extern const lv_img_dsc_t img_header_menu;
extern const lv_img_dsc_t img_button_main;
extern const lv_img_dsc_t img_save;
extern const lv_img_dsc_t img_saved;
extern const lv_img_dsc_t img_temperature_background;
extern const lv_img_dsc_t img_power_background;
extern const lv_img_dsc_t img_watch;
extern const lv_img_dsc_t img_slider_indicator;
extern const lv_img_dsc_t img_slider_knob;
extern const lv_img_dsc_t img_garage_arrows;
extern const lv_img_dsc_t img_garage_arrows_hoover;
extern const lv_img_dsc_t img_account_box;
extern const lv_img_dsc_t img_arrow_account_hoover;
extern const lv_img_dsc_t img_arrow_account;
extern const lv_img_dsc_t img_checkmark;
extern const lv_img_dsc_t img_big_checkmark;
extern const lv_img_dsc_t img_switch_off;
extern const lv_img_dsc_t img_switch_on;
extern const lv_img_dsc_t img_light_bulb;
extern const lv_img_dsc_t img_slider_lighting;
extern const lv_img_dsc_t img_arrow_next_hover;
extern const lv_img_dsc_t img_arrow_prev_hoover;
extern const lv_img_dsc_t img_arrow_next;
extern const lv_img_dsc_t img_arrow_prev;

#ifndef EXT_IMG_DESC_T
#define EXT_IMG_DESC_T
typedef struct _ext_img_desc_t {
    const char *name;
    const lv_img_dsc_t *img_dsc;
} ext_img_desc_t;
#endif

extern const ext_img_desc_t images[36];

#ifdef __cplusplus
}
#endif

#endif /*EEZ_LVGL_UI_IMAGES_H*/
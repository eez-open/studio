#include <stdlib.h>
#include <stdio.h>
#include <emscripten.h>

#include "lvgl/lvgl.h"

#define EM_PORT_API(rettype) rettype EMSCRIPTEN_KEEPALIVE

EM_PORT_API(lv_obj_t *) lvglCreateContainer(lv_obj_t *parentObj, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_obj_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    if (parentObj == 0) {
        lv_scr_load(obj);
    }
    return obj;
}

EM_PORT_API(lv_obj_t *) lvglCreateLabel(lv_obj_t *parentObj, char *text, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_label_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);
    lv_label_set_text(obj, text);
    free(text);
    return 0;
}

EM_PORT_API(lv_obj_t *) lvglCreateButton(lv_obj_t *parentObj, char *text, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h) {
    lv_obj_t *obj = lv_btn_create(parentObj);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, w, h);

    lv_obj_t *label = lv_label_create(obj);
    lv_label_set_text(label, text);
    free(text);
    lv_obj_center(label);

    return 0;
}

EM_PORT_API(void) lvglDeleteObject(lv_obj_t *obj) {
    lv_obj_del(obj);
}


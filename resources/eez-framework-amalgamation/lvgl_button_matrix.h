/*
 * eez-framework
 * MIT License
 * Copyright 2026 Envox d.o.o.
 * Shared by the Flow runtime and generated LVGL projects without Flow.
 * Include after lvgl.h. All map strings are owned until replacement/deletion.
 */
#ifndef EEZ_LVGL_BUTTON_MATRIX_H
#define EEZ_LVGL_BUTTON_MATRIX_H

#include <stdint.h>
#include <string.h>

#if LVGL_VERSION_MAJOR >= 9
#define EEZ_BM_ALLOC lv_malloc
#define EEZ_BM_FREE lv_free
#define EEZ_BM_GET_MAP lv_buttonmatrix_get_map
#define EEZ_BM_SET_MAP lv_buttonmatrix_set_map
#define EEZ_BM_SET_CTRL_MAP lv_buttonmatrix_set_ctrl_map
#define EEZ_BM_HAS_CTRL lv_buttonmatrix_has_button_ctrl
#define EEZ_BM_CLASS lv_buttonmatrix_class
typedef lv_buttonmatrix_ctrl_t eez_bm_ctrl_t;
#else
#define EEZ_BM_ALLOC lv_mem_alloc
#define EEZ_BM_FREE lv_mem_free
#define EEZ_BM_GET_MAP lv_btnmatrix_get_map
#define EEZ_BM_SET_MAP lv_btnmatrix_set_map
#define EEZ_BM_SET_CTRL_MAP lv_btnmatrix_set_ctrl_map
#define EEZ_BM_HAS_CTRL lv_btnmatrix_has_btn_ctrl
#define EEZ_BM_CLASS lv_btnmatrix_class
typedef lv_btnmatrix_ctrl_t eez_bm_ctrl_t;
#endif

typedef struct {
    const char **map;
    bool bindingsDetached;
} eez_bm_state_t;

static void eez_bm_delete(lv_event_t *event) {
    /* A child's bubbled delete event must not release its parent's map. */
    if (lv_event_get_target(event) != lv_event_get_current_target(event)) return;
    eez_bm_state_t *state = (eez_bm_state_t *)lv_event_get_user_data(event);
    EEZ_BM_FREE((void *)state->map);
    EEZ_BM_FREE(state);
}

static eez_bm_state_t *eez_bm_state(lv_obj_t *obj) {
#if LVGL_VERSION_MAJOR >= 9
    for (uint32_t i = 0; i < lv_obj_get_event_count(obj); i++) {
        lv_event_dsc_t *dsc = lv_obj_get_event_dsc(obj, i);
        if (lv_event_dsc_get_cb(dsc) == eez_bm_delete) {
            return (eez_bm_state_t *)lv_event_dsc_get_user_data(dsc);
        }
    }
    return NULL;
#else
    return (eez_bm_state_t *)lv_obj_get_event_user_data(obj, eez_bm_delete);
#endif
}

/* Copies first, then publishes the new pointers. Never adopts caller memory.
 * An optional text replacement preserves the map structure and control bits.
 * Count is the number of map entries, including explicit newline entries.
 */
static bool eez_bm_replace(lv_obj_t *obj, const char *const *map,
    uint32_t count, const eez_bm_ctrl_t *ctrl, int32_t textIndex,
    const char *text) {
    if (!obj || !lv_obj_check_type(obj, &EEZ_BM_CLASS) || !map || count >= UINT16_MAX) return false;
    if (textIndex >= 0 && ((uint32_t)textIndex >= count || !text)) return false;
    size_t bytes = ((size_t)count + 1) * sizeof(char *);
    uint32_t buttonIndex = 0;
    uint32_t rowUnits = 0;
    uint32_t oldRowUnits = 0;
    bool oldWidthsOverflow = false;
    for (uint32_t i = 0; i < count; i++) {
        const char *str = (int32_t)i == textIndex ? text : map[i];
        if (!str || !str[0]) return false;
        if (!strcmp(str, "\n")) {
            rowUnits = 0;
            oldRowUnits = 0;
        } else {
            /* Older LVGL versions use a uint16_t row-width divisor. Also
             * validate existing widths: set_map preserves them when the button
             * count is unchanged, before set_ctrl_map applies the new widths. */
            uint32_t oldWidth = 0;
            for (uint32_t bit = 1; bit <= 8; bit <<= 1) {
                if (EEZ_BM_HAS_CTRL(obj, buttonIndex, (eez_bm_ctrl_t)bit)) oldWidth |= bit;
            }
            oldRowUnits += oldWidth ? oldWidth : 1;
            if (oldRowUnits > UINT16_MAX) oldWidthsOverflow = true;
            uint32_t width = ctrl ? ((uint32_t)ctrl[buttonIndex] & 15) : 1;
            rowUnits += width ? width : 1;
            if (rowUnits > UINT16_MAX) return false;
            buttonIndex++;
        }
        size_t length = strlen(str) + 1;
        if (length > SIZE_MAX - bytes) return false;
        bytes += length;
    }
    if (oldWidthsOverflow) {
        uint32_t oldButtonCount = 0;
        const char *const *oldMap = EEZ_BM_GET_MAP(obj);
        for (uint32_t i = 0; oldMap && i < UINT16_MAX && oldMap[i] && oldMap[i][0]; i++) {
            if (strcmp(oldMap[i], "\n")) oldButtonCount++;
        }
        if (oldButtonCount == buttonIndex) return false;
    }
    const char **copy = (const char **)EEZ_BM_ALLOC(bytes);
    if (!copy) return false;
    char *dest = (char *)(copy + count + 1);
    for (uint32_t i = 0; i < count; i++) {
        const char *str = (int32_t)i == textIndex ? text : map[i];
        size_t length = strlen(str) + 1;
        memcpy(dest, str, length);
        copy[i] = dest;
        dest += length;
    }
    copy[count] = NULL;
    eez_bm_state_t *state = eez_bm_state(obj);
    if (!state) {
        state = (eez_bm_state_t *)EEZ_BM_ALLOC(sizeof(eez_bm_state_t));
        if (!state) {
            EEZ_BM_FREE((void *)copy);
            return false;
        }
        state->map = NULL;
        state->bindingsDetached = false;
        if (!lv_obj_add_event_cb(obj, eez_bm_delete, LV_EVENT_DELETE, state)) {
            EEZ_BM_FREE(state);
            EEZ_BM_FREE((void *)copy);
            return false;
        }
    }
    const char **oldMap = state->map;
    state->map = copy;
    EEZ_BM_SET_MAP(obj, copy);
    if (ctrl && count) EEZ_BM_SET_CTRL_MAP(obj, ctrl);
    EEZ_BM_FREE((void *)oldMap);
    return true;
}

/* A successful action replaces the complete map, including its text bindings.
 * Failed replacements leave the current map and its bindings intact. */
static bool eez_bm_set_map(lv_obj_t *obj, const char *const *map,
    uint32_t count, const eez_bm_ctrl_t *ctrl) {
    if (!eez_bm_replace(obj, map, count, ctrl, -1, NULL)) return false;
    eez_bm_state(obj)->bindingsDetached = true;
    return true;
}

static bool eez_bm_set_text(lv_obj_t *obj, uint32_t mapIndex, const char *text) {
    if (!obj || !lv_obj_check_type(obj, &EEZ_BM_CLASS) || !text) return false;
    const char *const *map = EEZ_BM_GET_MAP(obj);
    if (!map) return false;
    uint32_t count = 0;
    while (count < UINT16_MAX && map[count] && map[count][0]) count++;
    if (count >= UINT16_MAX || mapIndex >= count || !strcmp(map[mapIndex], "\n")) return false;
    /* Empty display values keep the existing button, as literal empty text does. */
    if (!text[0]) text = " ";
    /* Row boundaries belong to New line, never to an expression result. */
    if (!strcmp(text, "\n")) return false;
    if (!strcmp(map[mapIndex], text)) return true;
    return eez_bm_replace(obj, map, count, NULL, (int32_t)mapIndex, text);
}

static bool eez_bm_update_bound_text(lv_obj_t *obj, uint32_t mapIndex, const char *text) {
    if (!obj || !lv_obj_check_type(obj, &EEZ_BM_CLASS) || !text) return false;
    eez_bm_state_t *state = eez_bm_state(obj);
    if (state && state->bindingsDetached) return true;
    return eez_bm_set_text(obj, mapIndex, text);
}

#endif

#ifndef EEZ_LVGL_UI_GUI_H
#define EEZ_LVGL_UI_GUI_H

#include <lvgl/lvgl.h>

//
// EezString - Dynamic string helper for EEZ Flow Lite
//
#include <string.h>
#include <math.h>

typedef struct {
    char *data;
    size_t length;
    size_t capacity;
} EezString;

// Temporary string buffer for intermediate results
static EezString _eez_str_temp[4];
static int _eez_str_temp_idx = 0;

static inline EezString* _eez_str_get_temp(void) {
    EezString *t = &_eez_str_temp[_eez_str_temp_idx];
    _eez_str_temp_idx = (_eez_str_temp_idx + 1) % 4;
    return t;
}

// Initialize an EezString
static inline void eez_string_init(EezString *s) {
    s->data = NULL;
    s->length = 0;
    s->capacity = 0;
}

// Free a string's data
static inline void eez_string_free(EezString *s) {
    if (s->data) {
        lv_free(s->data);
        s->data = NULL;
        s->length = 0;
        s->capacity = 0;
    }
}

// Get C string (read-only)
static inline const char *eez_string_cstr(EezString *s) {
    return s->data ? s->data : "";
}

// Get string length
static inline size_t eez_string_length(EezString *s) {
    return s->length;
}

// Assign from C string
static inline void eez_string_assign(EezString *s, const char *str) {
    if (str == NULL) {
        eez_string_free(s);
        return;
    }
    size_t len = strlen(str);
    if (len + 1 > s->capacity) {
        if (s->data) lv_free(s->data);
        s->capacity = len + 1;
        s->data = (char *)lv_malloc(s->capacity);
    }
    if (s->data) {
        memcpy(s->data, str, len + 1);
        s->length = len;
    }
}

// Concatenate C string to existing string
static inline void eez_string_append(EezString *s, const char *str) {
    if (str == NULL || *str == '\0') return;
    size_t add_len = strlen(str);
    size_t new_len = s->length + add_len;
    if (new_len + 1 > s->capacity) {
        size_t new_cap = new_len + 1;
        char *new_data = (char *)lv_realloc(s->data, new_cap);
        if (new_data) {
            s->data = new_data;
            s->capacity = new_cap;
        } else {
            return;
        }
    }
    memcpy(s->data + s->length, str, add_len + 1);
    s->length = new_len;
}

// Append integer as string
static inline void eez_string_append_int(EezString *s, int32_t value) {
    char buf[16];
    lv_snprintf(buf, sizeof(buf), "%d", (int)value);
    eez_string_append(s, buf);
}

// Concatenate two C strings, returns C string from temp buffer
static inline const char *eez_string_concat(const char *s1, const char *s2) {
    EezString *result = _eez_str_get_temp();
    eez_string_free(result);
    eez_string_assign(result, s1);
    eez_string_append(result, s2);
    return eez_string_cstr(result);
}

// Concatenate string with integer, returns C string from temp buffer
static inline const char *eez_string_concat_int(const char *s1, int32_t value) {
    EezString *result = _eez_str_get_temp();
    eez_string_free(result);
    eez_string_assign(result, s1);
    eez_string_append_int(result, value);
    return eez_string_cstr(result);
}

// Get substring, returns C string from temp buffer
static inline const char *eez_string_substring(const char *str, int32_t start, int32_t end) {
    EezString *result = _eez_str_get_temp();
    eez_string_free(result);
    eez_string_init(result);
    
    if (str == NULL) return "";
    
    size_t len = strlen(str);
    if (start < 0) start = 0;
    if (end < 0 || (size_t)end > len) end = (int32_t)len;
    if (start >= end) return "";
    
    size_t sub_len = (size_t)(end - start);
    result->capacity = sub_len + 1;
    result->data = (char *)lv_malloc(result->capacity);
    if (result->data) {
        memcpy(result->data, str + start, sub_len);
        result->data[sub_len] = '\0';
        result->length = sub_len;
    }
    return eez_string_cstr(result);
}

// Convert a single character to a string, returns C string from temp buffer
static inline const char *eez_string_from_char(char c) {
    EezString *result = _eez_str_get_temp();
    eez_string_free(result);
    result->capacity = 2;
    result->data = (char *)lv_malloc(result->capacity);
    if (result->data) {
        result->data[0] = c;
        result->data[1] = '\0';
        result->length = 1;
    }
    return eez_string_cstr(result);
}

// Compare strings (returns true if equal)
static inline bool eez_string_equals(const char *s1, const char *s2) {
    if (s1 == s2) return true;
    if (s1 == NULL || s2 == NULL) return false;
    return strcmp(s1, s2) == 0;
}

// Convert integer to string, returns C string from temp buffer
static inline const char *eez_string_from_int(int32_t value) {
    EezString *result = _eez_str_get_temp();
    eez_string_free(result);
    char buf[16];
    lv_snprintf(buf, sizeof(buf), "%d", (int)value);
    eez_string_assign(result, buf);
    return eez_string_cstr(result);
}

// Convert float to string, returns C string from temp buffer
static inline const char *eez_string_from_float(float value) {
    EezString *result = _eez_str_get_temp();
    eez_string_free(result);
    char buf[32];
    lv_snprintf(buf, sizeof(buf), "%.2f", (double)value);
    eez_string_assign(result, buf);
    return eez_string_cstr(result);
}

// EEZ Flow Lite helper function to get key from event
static inline uint32_t eez_flow_lite_event_get_key(lv_event_t *e) {
    lv_event_code_t event_code = lv_event_get_code(e);
    lv_obj_t *target = lv_event_get_target(e);
    uint32_t key = 0;
    if (event_code == LV_EVENT_KEY || (event_code == LV_EVENT_VALUE_CHANGED &&
        #if LVGL_VERSION_MAJOR >= 9
            lv_obj_check_type(target, &lv_buttonmatrix_class)
        #else
            lv_obj_check_type(target, &lv_btnmatrix_class)
        #endif
    )) {
        uint32_t *param = (uint32_t *)lv_event_get_param(e);
        key = param ? *param : 0;
    }
    return key;
}

//
// Struct type definitions
//
typedef struct {
    EezString name;
} EezFlowLite_user;

typedef struct {
    EezString name;
    float temperature;
    float power;
    bool locked;
    float lighting_percent;
    bool heating_saved;
    bool lighting_saved;
} EezFlowLite_zone;

//
// Global variables - shared across all screens
//
typedef struct {
    EezFlowLite_user users[3];  // Global: users
    EezFlowLite_zone zones[5];  // Global: zones
    int32_t selected_user;  // Global: selected_user
    int32_t selected_zone;  // Global: selected_zone
} FlowGlobalVariables;

extern FlowGlobalVariables flow_g;

// Initialize global variables with default values
void flow_init_globals(void);

//
// Flow state for screen 'heating_screen'
// Contains local variables for this screen
//
typedef struct {
    int dummy;  // Placeholder - no local variables
} FlowState_heating_screen;

void flow_init_heating_screen(lv_obj_t *obj, FlowState_heating_screen *flowState);
void flow_tick_heating_screen(FlowState_heating_screen *flowState);

//
// Flow state for screen 'security_screen'
// Contains local variables for this screen
//
typedef struct {
    int dummy;  // Placeholder - no local variables
} FlowState_security_screen;

void flow_init_security_screen(lv_obj_t *obj, FlowState_security_screen *flowState);
void flow_tick_security_screen(FlowState_security_screen *flowState);

//
// Flow state for screen 'lighting_screen'
// Contains local variables for this screen
//
typedef struct {
    int dummy;  // Placeholder - no local variables
} FlowState_lighting_screen;

void flow_init_lighting_screen(lv_obj_t *obj, FlowState_lighting_screen *flowState);
void flow_tick_lighting_screen(FlowState_lighting_screen *flowState);

//
// Flow state for screen 'header'
// Contains local variables for this screen
//
typedef struct {
    bool first_appearance;  // Local: first_appearance
} FlowState_header;

void flow_init_header(lv_obj_t *obj, FlowState_header *flowState);
void flow_tick_header(FlowState_header *flowState);

//
// Flow state for screen 'account_box'
// Contains local variables for this screen
//
typedef struct {
    int dummy;  // Placeholder - no local variables
} FlowState_account_box;

void flow_init_account_box(lv_obj_t *obj, FlowState_account_box *flowState);
void flow_tick_account_box(FlowState_account_box *flowState);

//
// Flow state for screen 'zone_selector'
// Contains local variables for this screen
//
typedef struct {
    int dummy;  // Placeholder - no local variables
} FlowState_zone_selector;

void flow_init_zone_selector(lv_obj_t *obj, FlowState_zone_selector *flowState);
void flow_tick_zone_selector(FlowState_zone_selector *flowState);

#if !defined(EEZ_FOR_LVGL)
#include "screens.h"
#endif

#ifdef __cplusplus
extern "C" {
#endif

void ui_init();
void ui_tick();

#if !defined(EEZ_FOR_LVGL)
void loadScreen(enum ScreensEnum screenId);
#endif

#ifdef __cplusplus
}
#endif

#endif // EEZ_LVGL_UI_GUI_H
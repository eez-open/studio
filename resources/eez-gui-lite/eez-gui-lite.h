#pragma once

#include <inttypes.h>
#include <stdbool.h>
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

////////////////////////////////////////////////////////////////////////////////

#ifndef EEZGUI_DEBUG
#define EEZGUI_DEBUG 0
#endif

////////////////////////////////////////////////////////////////////////////////
// color

#ifndef EEZGUI_DISPLAY_BUFFER_LINES
#define EEZGUI_DISPLAY_BUFFER_LINES 64
#endif

#if defined(EEZ_PLATFORM_STM32)
    typedef uint16_t eezgui_color_t;
    #define EEZGUI_MAKE_COLOR(R, G, B) ((((R) & 0xF8) << 8) | (((G) & 0xFC) << 3) | (((B) & 0xF8) >> 3))
    #define EEZGUI_COLOR_TO_R(C) ((uint8_t)(((C) >> 11) << 3))
    #define EEZGUI_COLOR_TO_G(C) ((uint8_t)((((C) >> 5) << 2) & 0xFF))
    #define EEZGUI_COLOR_TO_B(C) ((uint8_t)(((C) << 3) & 0xFF))
#else
    typedef uint32_t eezgui_color_t;
    #define EEZGUI_MAKE_COLOR(R, G, B) ((R) | ((G) << 8) | ((B) << 16) | (255 << 24))
    #define EEZGUI_COLOR_TO_R(C) ((uint8_t)((C) & 0xFF))
    #define EEZGUI_COLOR_TO_G(C) ((uint8_t)(((C) >> 8) & 0xFF))
    #define EEZGUI_COLOR_TO_B(C) ((uint8_t)(((C) >> 16) & 0xFF))
#endif

extern eezgui_color_t display_buffer[];

////////////////////////////////////////////////////////////////////////////////
// font

typedef struct {
	int8_t dx;
	uint8_t w;
	uint8_t h;
	int8_t x;
	int8_t y;
	uint32_t pixels_index;
} eezgui_glyph_data_t;

typedef struct {
    uint32_t encoding;
    uint32_t glyphIndex;
    uint32_t length;
} eezgui_glyphs_group_t;

typedef struct {
	uint8_t ascent;
	uint8_t descent;
	uint32_t encodingStart;
	uint32_t encodingEnd;
    const eezgui_glyphs_group_t *groups;
    const eezgui_glyph_data_t *glyphs;
    const uint8_t *pixels;
} eezgui_font_data_t;

////////////////////////////////////////////////////////////////////////////////
// style

#define EEZGUI_STYLE_FLAG_HORZ_ALIGN_MASK 0x7
#define EEZGUI_STYLE_FLAG_HORZ_ALIGN_LEFT 0
#define EEZGUI_STYLE_FLAG_HORZ_ALIGN_RIGHT 1
#define EEZGUI_STYLE_FLAG_HORZ_ALIGN_CENTER 2

#define EEZGUI_STYLE_FLAG_VERT_ALIGN_MASK (0x7 << 3)
#define EEZGUI_STYLE_FLAG_VERT_ALIGN_TOP (0 << 3)
#define EEZGUI_STYLE_FLAG_VERT_ALIGN_BOTTOM (1 << 3)
#define EEZGUI_STYLE_FLAG_VERT_ALIGN_CENTER (2 << 3)

#define EEZGUI_STYLE_FLAG_BLINK (1 << 6)

typedef struct {
    uint16_t flags; // STYLE_FLAGS_...

    uint16_t background_color;
    uint16_t color;

    uint16_t active_background_color;
    uint16_t active_color;

    uint8_t border_size_top;
    uint8_t border_size_right;
    uint8_t border_size_bottom;
    uint8_t border_size_left;
    uint16_t border_color;

    uint8_t font;

    int8_t padding_top;
    int8_t padding_right;
    int8_t padding_bottom;
    int8_t padding_left;
} eezgui_style_t;

////////////////////////////////////////////////////////////////////////////////
// events

typedef enum {
    EEZGUI_EVENT_PRESSED,             // Widget has been pressed.
    EEZGUI_EVENT_PRESSING,            // Widget is being pressed (sent continuously while pressing).
    EEZGUI_EVENT_PRESS_LOST,          // Widget is still being pressed but slid cursor/finger off Widget.
    EEZGUI_EVENT_SHORT_CLICKED,       // Widget was pressed for a short period of time, then released. Not sent if scrolled.
    EEZGUI_EVENT_SINGLE_CLICKED,      // Sent for first short click within a small distance and short time.
    EEZGUI_EVENT_DOUBLE_CLICKED,      // Sent for second short click within small distance and short time.
    EEZGUI_EVENT_TRIPLE_CLICKED,      // Sent for third short click within small distance and short time.
    EEZGUI_EVENT_LONG_PRESSED,        // Widget has been pressed for at least `long_press_time`. Not sent if scrolled.
    EEZGUI_EVENT_LONG_PRESSED_REPEAT, // Sent after `long_press_time` in every `long_press_repeat_time` ms. Not sent if scrolled.
    EEZGUI_EVENT_CLICKED,             // Sent on release if not scrolled (regardless to long press).
    EEZGUI_EVENT_RELEASED,            // Sent in every cases when Widget has been released.

    EEZGUI_EVENT_HOVER_OVER,          // Hover over widget.
    EEZGUI_EVENT_HOVER_LEAVE,         // Hover leave widget.
} eezgui_event_type_t;

struct eezgui_widget_t;

typedef struct {
    const struct eezgui_widget_t *widget;
    eezgui_event_type_t type;
} eezgui_event_info_t;

////////////////////////////////////////////////////////////////////////////////
// context

struct eezgui_widget_state_t;

typedef struct {
    const void *data;
    struct eezgui_widget_state_t *first_widget_state;
    uint16_t style;
} eezgui_page_state_t;

typedef struct {
    void *state_buffer;
    int state_buffer_size;
    int state_buffer_index;

#if EEZGUI_DEBUG
    int save_state_buffer_index;
#endif

    eezgui_page_state_t *page_state;
    struct eezgui_widget_state_t *widget_state;
    struct eezgui_widget_state_t *previous_widget_state;

    const char *(*get_str_prop)(uint16_t prop);
    bool (*get_bool_prop)(uint16_t prop);
    int (*get_int_prop)(uint16_t prop);

    void (*on_event)(eezgui_event_info_t *event);

    const eezgui_color_t *colors;
    int num_colors;

    const eezgui_font_data_t **fonts;
    int num_fonts;

    const eezgui_style_t *styles;
    int num_styles;

    const struct eezgui_widget_t *parent_widget;
    bool parent_is_pressed;
    int16_t x_offset;
    int16_t y_offset;

    uint32_t long_press_time;
    uint32_t long_press_repeat_time;

    bool was_pressed;
    bool is_pressed;
    int pointer_x;
    int pointer_y;
    const struct eezgui_widget_t *pressed_widget;
    bool pressed_widget_contains_pointer;
    uint32_t pressed_time;
    bool long_press_sent;

    bool refresh_requested;
} eezgui_ctx_t;

////////////////////////////////////////////////////////////////////////////////
// widget base

#define EEZGUI_WIDGET_FLAG_CLICKABLE (1 << 0)

typedef struct eezgui_widget_t {
    uint32_t flags;
    int16_t x, y, w, h;
    uint16_t style;
    uint16_t is_visible;
} eezgui_widget_t;

////////////////////////////////////////////////////////////////////////////////
// widget state base

#define EEZGUI_WIDGET_STATE_HIDDEN (1 << 0)
#define EEZGUI_WIDGET_STATE_PRESSED (1 << 1)
#define EEZGUI_WIDGET_STATE_CHECKED (1 << 2)

typedef struct eezgui_widget_state_t {
    const struct eezgui_widget_t *widget;
    struct eezgui_widget_state_t *next_sibling;
    uint32_t state;
} eezgui_widget_state_t;

////////////////////////////////////////////////////////////////////////////////
// Text widget
 
typedef struct {
    eezgui_widget_t base;
    uint16_t text;
} eezgui_text_t;

typedef struct {
    eezgui_widget_state_t base_state;
    char text[];
} eezgui_text_state_t;

////////////////////////////////////////////////////////////////////////////////
// Button widget

typedef struct {
    eezgui_widget_t base;
    uint16_t text;
} eezgui_button_t;

typedef struct {
    eezgui_widget_state_t base_state;
    char text[];
} eezgui_button_state_t;

////////////////////////////////////////////////////////////////////////////////
// Rectangle widget
 
typedef struct {
    eezgui_widget_t base;
} eezgui_rectangle_t;

typedef struct {
    eezgui_widget_state_t base_state;
} eezgui_rectangle_state_t;

////////////////////////////////////////////////////////////////////////////////
// Switch widget
 
typedef struct {
    eezgui_widget_t base;
    uint16_t is_checked;
} eezgui_switch_t;

typedef struct {
    eezgui_widget_state_t base_state;
} eezgui_switch_state_t;

////////////////////////////////////////////////////////////////////////////////
// Select widget
 
typedef struct {
    eezgui_widget_t base;
} eezgui_select_t;

typedef struct {
    eezgui_widget_state_t base_state;
} eezgui_select_state_t;

////////////////////////////////////////////////////////////////////////////////
// Container widget
 
typedef struct {
    eezgui_widget_t base;
} eezgui_container_t;

typedef struct {
    eezgui_widget_state_t base_state;
} eezgui_container_state_t;

////////////////////////////////////////////////////////////////////////////////
// public API

// display
int eezgui_display_get_width(void);
int eezgui_display_get_height(void);

// Initialize the display (clears framebuffer)
void eezgui_display_init(int display_width, int display_height);

#if defined(EEZ_PLATFORM_STM32)
#else
uint8_t* eezgui_display_get_frame_buffer_rgba(void);
bool eezgui_display_convert_to_rgba(void);
#endif

// context
void eezgui_set_state_buffer(eezgui_ctx_t *ctx, void *state_buffer, int state_buffer_size);
void *eezgui_alloc_from_state(eezgui_ctx_t *ctx, int size);

#if EEZGUI_DEBUG
void eezgui_measure_memory_consumption_begin(eezgui_ctx_t *ctx);
int eezgui_measure_memory_consumption_end(eezgui_ctx_t *ctx);
#endif

void eezgui_set_colors(eezgui_ctx_t *ctx, const eezgui_color_t *colors, int num_colors);
void eezgui_set_fonts(eezgui_ctx_t *ctx, const eezgui_font_data_t **fonts, int num_fonts);
void eezgui_set_styles(eezgui_ctx_t *ctx, const eezgui_style_t *styles, int num_styles);

void eezgui_refresh(eezgui_ctx_t *ctx);

// page
void eezgui_start_page(eezgui_ctx_t *ctx, const void *data, uint16_t style, void (*on_page_event)(eezgui_event_info_t *event));
void eezgui_end_page(eezgui_ctx_t *ctx);

// widgets
void eezgui_text(eezgui_ctx_t *ctx, const eezgui_text_t *widget);
void eezgui_button(eezgui_ctx_t *ctx, const eezgui_button_t *widget);
void eezgui_rectangle(eezgui_ctx_t *ctx, const eezgui_rectangle_t *widget);
void eezgui_switch(eezgui_ctx_t *ctx, const eezgui_switch_t *widget);

void eezgui_select_begin(eezgui_ctx_t *ctx, const eezgui_select_t *widget);
void eezgui_select_end(eezgui_ctx_t *ctx, const eezgui_select_t *widget);

void eezgui_container_begin(eezgui_ctx_t *ctx, const eezgui_container_t *widget);
void eezgui_container_end(eezgui_ctx_t *ctx, const eezgui_container_t *widget);

// events
void eezgui_pointer_input(eezgui_ctx_t *ctx, int x, int y, bool pressed);

////////////////////////////////////////////////////////////////////////////////

char *String_format(eezgui_ctx_t *ctx, const char *format, ...);
int Math_min(int a, int b);
int Math_max(int a, int b);
uint32_t System_getTick(void);

////////////////////////////////////////////////////////////////////////////////
// logging

typedef enum {
    EEZGUI_LOG_DEBUG,
    EEZGUI_LOG_INFO,
    EEZGUI_LOG_WARNING,
    EEZGUI_LOG_ERROR
} eezgui_log_level_t;

#define EEZGUI_LOG(level, format, ...) \
    eezgui_log(level, __FILE__, __LINE__, format, ##__VA_ARGS__)

void eezgui_log(eezgui_log_level_t level, const char *file, int line, const char *format, ...);

#ifdef __cplusplus
}
#endif

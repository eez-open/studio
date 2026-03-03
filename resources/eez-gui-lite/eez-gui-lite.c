#include <string.h>
#include <string.h>
#include <stdarg.h>

#if defined(EEZ_PLATFORM_STM32)
#include "main.h"
#include "st7735.h"
#elif defined(__EMSCRIPTEN__)
#include <emscripten.h>
#include <emscripten/html5.h>
#else
#include <SDL2/SDL.h>
#endif

#if defined(__EMSCRIPTEN__)
#define EM_PORT_API(rettype) rettype EMSCRIPTEN_KEEPALIVE
#else
#define EM_PORT_API(rettype) rettype
#endif

#include "eez-gui-lite.h"

////////////////////////////////////////////////////////////////////////////////
// Forward declarations

static bool display_box_start(uint16_t x, uint16_t y, uint16_t w, uint16_t h);
static void display_box_end(void);
static void display_fill_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, eezgui_color_t color);
static void display_draw_image(uint16_t x, uint16_t y, uint16_t w, uint16_t h, const eezgui_color_t* data);
static void display_draw_glyph(const uint8_t *src, uint32_t src_line_offset, int x_glyph, int y_glyph, int width, int height, eezgui_color_t color, eezgui_color_t background_color);

static bool widget_is_visible(eezgui_ctx_t *ctx, const eezgui_widget_t *widget);
static void draw_box(eezgui_ctx_t *ctx, const char *text);
static void send_event(eezgui_ctx_t *ctx, const eezgui_widget_t *widget, eezgui_event_type_t type);
static void check_events(eezgui_ctx_t *ctx, const eezgui_widget_t *widget);
static void widget_start(eezgui_ctx_t *ctx, const eezgui_widget_t *widget, int widget_state_size);
static bool is_same_state(eezgui_ctx_t *ctx);
static void erase_widget(eezgui_ctx_t *ctx);

////////////////////////////////////////////////////////////////////////////////

static int DISPLAY_WIDTH;
static int DISPLAY_HEIGHT;

#if defined(EEZ_PLATFORM_STM32)
// pass
#else
static eezgui_color_t *frame_buffer;
static bool frame_buffer_updated;
#ifndef DISPLAY_DEBUG
#define DISPLAY_DEBUG 0
#endif
#if DISPLAY_DEBUG
static uint8_t *frame_buffer_rgba;
static uint32_t *debug_fb_acc;
static uint32_t *debug_fb;
#define DEBUG_COLOR 0xFF00FF00
#endif
#endif

eezgui_color_t display_buffer[EEZGUI_DISPLAY_BUFFER_LINES * 128];

static bool draw_to_display_buffer;
static uint16_t box_x, box_y, box_w, box_h;
static int saved_DISPLAY_WIDTH;

int eezgui_display_get_width(void) {
    return DISPLAY_WIDTH;
}

int eezgui_display_get_height(void) {
    return DISPLAY_HEIGHT;
}

void eezgui_display_init(int display_width, int display_height) {
    DISPLAY_WIDTH = display_width;
    DISPLAY_HEIGHT = display_height;

#if defined(EEZ_PLATFORM_STM32)
    // pass
#else
    frame_buffer = (eezgui_color_t *)malloc(DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(eezgui_color_t));
#if DISPLAY_DEBUG
    frame_buffer_rgba = (uint8_t *)malloc(DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(uint32_t));
    debug_fb_acc = (uint32_t *)malloc(DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(uint32_t));
    debug_fb = (uint32_t *)malloc(DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(uint32_t));
    memset(debug_fb_acc, 0, DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(uint32_t));
    memset(debug_fb, 0, DISPLAY_WIDTH * DISPLAY_HEIGHT * sizeof(uint32_t));
#endif
#endif
}

bool display_box_start(uint16_t x, uint16_t y, uint16_t w, uint16_t h) {
    if (w * h > sizeof(display_buffer) / sizeof(display_buffer[0])) {
        return false;
    }

    box_x = x;
    box_y = y;
    box_w = w;
    box_h = h;

    draw_to_display_buffer = true;
    saved_DISPLAY_WIDTH = DISPLAY_WIDTH;
    DISPLAY_WIDTH = box_w;

    return true;
}

static void display_box_end(void) {
    if (draw_to_display_buffer) {
        draw_to_display_buffer = false;
        DISPLAY_WIDTH = saved_DISPLAY_WIDTH;
        display_draw_image(box_x, box_y, box_w, box_h, display_buffer);
    }
}

static void display_fill_rect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, eezgui_color_t color) {
    // clipping
    if ((x >= DISPLAY_WIDTH) || (y >= DISPLAY_HEIGHT)) return;
    if ((x + w - 1) >= DISPLAY_WIDTH) w = DISPLAY_WIDTH - x;
    if ((y + h - 1) >= DISPLAY_HEIGHT) h = DISPLAY_HEIGHT - y;

    if (draw_to_display_buffer) {
#if defined(EEZ_PLATFORM_STM32)
        color = (color >> 8) | (color << 8);
#endif
        eezgui_color_t *dst = display_buffer + y * DISPLAY_WIDTH + x;
        for (uint16_t j = 0; j < h; j++) {
            for (uint16_t i = 0; i < w; i++) {
                *dst++ = color;
            }
            dst += DISPLAY_WIDTH - w;
        }
        return;
    }

#if defined(EEZ_PLATFORM_STM32)
    ST7735_FillRectangle(x, y, w, h, color);
#else
    for (uint16_t j = 0; j < h; j++) {
        for (uint16_t i = 0; i < w; i++) {
            frame_buffer[(y + j) * DISPLAY_WIDTH + (x + i)] = color;
        }
    }
    frame_buffer_updated = true;
#if DISPLAY_DEBUG
   for (uint16_t j = 0; j < h; j++) {
        for (uint16_t i = 0; i < w; i++) {
            debug_fb[(y + j) * DISPLAY_WIDTH + (x + i)] = DEBUG_COLOR;
        }
    }
#endif
#endif
}

static void display_draw_image(uint16_t x, uint16_t y, uint16_t w, uint16_t h, const eezgui_color_t* data) {
    if ((x >= DISPLAY_WIDTH) || (y >= DISPLAY_HEIGHT)) return;
    if ((x + w - 1) >= DISPLAY_WIDTH) return;
    if ((y + h - 1) >= DISPLAY_HEIGHT) return;

    if (draw_to_display_buffer) {
        eezgui_color_t *dst = display_buffer + y * DISPLAY_WIDTH + x;
        for (uint16_t j = 0; j < h; j++) {
            for (uint16_t i = 0; i < w; i++) {
                *dst++ = *data++;
            }
            dst += DISPLAY_WIDTH - w;
        }
        return;
    }

#if defined(EEZ_PLATFORM_STM32)
    ST7735_DrawImage(x, y, w, h, data);
#else
    for (uint16_t j = 0; j < h; j++) {
        for (uint16_t i = 0; i < w; i++) {
            frame_buffer[(y + j) * DISPLAY_WIDTH + (x + i)] = data[j * w + i];
        }
    }
    frame_buffer_updated = true;
#if DISPLAY_DEBUG
    for (uint16_t j = 0; j < h; j++) {
        for (uint16_t i = 0; i < w; i++) {
            debug_fb[(y + j) * DISPLAY_WIDTH + (x + i)] = DEBUG_COLOR;
        }
    }
#endif
#endif
}

static void display_draw_glyph(const uint8_t *src, uint32_t src_line_offset, int x_glyph, int y_glyph, int width, int height, eezgui_color_t color, eezgui_color_t background_color) {
    int bg_r = EEZGUI_COLOR_TO_R(background_color);
    int bg_g = EEZGUI_COLOR_TO_G(background_color);
    int bg_b = EEZGUI_COLOR_TO_B(background_color);

    int diff_r = EEZGUI_COLOR_TO_R(color) - bg_r;
    int diff_g = EEZGUI_COLOR_TO_G(color) - bg_g;
    int diff_b = EEZGUI_COLOR_TO_B(color) - bg_b;

    eezgui_color_t *glyph_buffer = display_buffer + sizeof(display_buffer) / sizeof(display_buffer[0]) - width * height;
    eezgui_color_t *dst = glyph_buffer;

    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            uint8_t alpha = *src++;

            eezgui_color_t color = EEZGUI_MAKE_COLOR(
                bg_r + diff_r * alpha / 255,
                bg_g + diff_g * alpha / 255,
                bg_b + diff_b * alpha / 255
            );
#if defined(EEZ_PLATFORM_STM32)
            color = (color >> 8) | (color << 8);
#endif                
            *dst++ = color;
        }
        src += src_line_offset;
    }

    display_draw_image(x_glyph, y_glyph, width, height, glyph_buffer);
}

#if defined(EEZ_PLATFORM_STM32)
#else

#if DISPLAY_DEBUG
float clamp(float x, float min, float max) {
    if (x < min) {
        return min;
    }
    if (x > max) {
        return max;
    }
    return x;
}

uint32_t blend_color(uint32_t fg_color, uint32_t bg_color) {
    uint8_t *fg = (uint8_t *)&fg_color;
    uint8_t *bg = (uint8_t *)&bg_color;

    float alphaMult = fg[3] * bg[3] / 255.0f;
    float alphaOut = fg[3] + bg[3] - alphaMult;

    float r = (fg[0] * fg[3] + bg[0] * bg[3] - bg[0] * alphaMult) / alphaOut;
    float g = (fg[1] * fg[3] + bg[1] * bg[3] - bg[1] * alphaMult) / alphaOut;
    float b = (fg[2] * fg[3] + bg[2] * bg[3] - bg[2] * alphaMult) / alphaOut;

    r = clamp(r, 0.0f, 255.0f);
    g = clamp(g, 0.0f, 255.0f);
    b = clamp(b, 0.0f, 255.0f);

    uint32_t result;
    uint8_t *presult = (uint8_t *)&result;
    presult[0] = (uint8_t)r;
    presult[1] = (uint8_t)g;
    presult[2] = (uint8_t)b;
    presult[3] = (uint8_t)alphaOut;

    return result;
}
#endif

uint8_t* eezgui_display_get_frame_buffer_rgba(void) {
#if DISPLAY_DEBUG
    return frame_buffer_rgba;
#else
    return (uint8_t *)frame_buffer;
#endif
}

bool eezgui_display_convert_to_rgba(void) {
#if DISPLAY_DEBUG
    for (int i = 0; i < DISPLAY_WIDTH * DISPLAY_HEIGHT; i++) {
        eezgui_color_t color = frame_buffer[i];
        
        // Convert to RGB888
        uint8_t r8 = EEZGUI_COLOR_TO_R(color);
        uint8_t g8 = EEZGUI_COLOR_TO_G(color);
        uint8_t b8 = EEZGUI_COLOR_TO_B(color);

        int alpha = debug_fb_acc[i] >> 24;
        alpha -= 16;
        if (alpha < 0) {
            alpha = 0;
        }

        debug_fb_acc[i] = blend_color(
            debug_fb[i], 
            (debug_fb_acc[i] & 0x00FFFFFF) | (alpha << 24)
        );
        debug_fb[i] = 0;

        uint32_t c = blend_color(
            debug_fb_acc[i], 
            (r8 << 0) | (g8 << 8) | (b8 << 16) | (0xFF << 24)
        );
        r8 = (c >> 0) & 0xFF;
        g8 = (c >> 8) & 0xFF;
        b8 = (c >> 16) & 0xFF;
        
        // Store as RGBA8888
        frame_buffer_rgba[i * 4 + 0] = r8;
        frame_buffer_rgba[i * 4 + 1] = g8;
        frame_buffer_rgba[i * 4 + 2] = b8;
        frame_buffer_rgba[i * 4 + 3] = 255; // Alpha
    }

    return true;
#else
    bool result = frame_buffer_updated;
    frame_buffer_updated = false;
    return result;
#endif
}
#endif

////////////////////////////////////////////////////////////////////////////////
// Public functions

EM_PORT_API(void) eezgui_set_state_buffer(eezgui_ctx_t *ctx, void *state_buffer, int state_buffer_size) {
    memset(state_buffer, 0, state_buffer_size);

    ctx->state_buffer = state_buffer;
    ctx->state_buffer_size = state_buffer_size;
}

EM_PORT_API(void *) eezgui_alloc_from_state(eezgui_ctx_t *ctx, int size) {
	size = ((size + 3) / 4) * 4;
    if (ctx->state_buffer_index + size < ctx->state_buffer_size) {
        void *ptr = (uint8_t *)ctx->state_buffer + ctx->state_buffer_index;
        ctx->state_buffer_index += size;
        return ptr;
    } else {
        ctx->state_buffer_index = size;
        return ctx->state_buffer;
    }
}

#if EEZGUI_DEBUG
EM_PORT_API(void) eezflow_measure_memory_consumption_begin(eezgui_ctx_t *ctx) {
    ctx->save_state_buffer_index = ctx->state_buffer_index;
}

EM_PORT_API(int) eezflow_measure_memory_consumption_end(eezgui_ctx_t *ctx) {
    int frame_state_size;
    if (ctx->state_buffer_index > ctx->save_state_buffer_index) {
        frame_state_size = ctx->state_buffer_index - ctx->save_state_buffer_index;
    } else {
        frame_state_size = ctx->state_buffer_size - ctx->save_state_buffer_index + ctx->state_buffer_index;
    }

    return frame_state_size;
}
#endif

EM_PORT_API(void) eezgui_set_colors(eezgui_ctx_t *ctx, const eezgui_color_t *colors, int num_colors) {
    ctx->colors = colors;
    ctx->num_colors = num_colors;
}

EM_PORT_API(void) eezgui_set_fonts(eezgui_ctx_t *ctx, const eezgui_font_data_t **fonts, int num_fonts) {
    ctx->fonts = fonts;
    ctx->num_fonts = num_fonts;
}

EM_PORT_API(void) eezgui_set_styles(eezgui_ctx_t *ctx, const eezgui_style_t *styles, int num_styles) {
    ctx->styles = styles;
    ctx->num_styles = num_styles;
}

EM_PORT_API(void) eezgui_refresh(eezgui_ctx_t *ctx) {
    ctx->refresh_requested = true;
}

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(void) eezgui_start_page(eezgui_ctx_t *ctx, const void *data, uint16_t style, void (*on_page_event)(eezgui_event_info_t *event)) {
    ctx->on_event = on_page_event;

#if EEZGUI_DEBUG
    eezflow_measure_memory_consumption_begin(ctx);
#endif

    if (!ctx->refresh_requested && ctx->page_state && ctx->page_state->data == data && ctx->page_state->style == style) {
        ctx->previous_widget_state = ctx->page_state->first_widget_state;
    } else {
        ctx->refresh_requested = false;
        ctx->previous_widget_state = NULL;

        const eezgui_style_t *style_p = ctx->styles + style;
        display_fill_rect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT, ctx->colors[style_p->background_color]);
    }

    ctx->page_state = (eezgui_page_state_t *)eezgui_alloc_from_state(ctx, sizeof(eezgui_page_state_t));
    ctx->page_state->data = data;
    ctx->page_state->first_widget_state = NULL;
    ctx->page_state->style = style;

    ctx->widget_state = NULL;
    ctx->parent_widget = NULL;
}

EM_PORT_API(void) eezgui_end_page(eezgui_ctx_t *ctx) {
    if (!ctx->is_pressed) {
        ctx->pressed_widget = NULL;
    }

#if EEZGUI_DEBUG
    static int max_frame_state_size;
    int frame_state_size = eezflow_measure_memory_consumption_end(ctx);
    if (frame_state_size > max_frame_state_size) {
        max_frame_state_size = frame_state_size;
        EEZGUI_LOG(EEZGUI_LOG_DEBUG, "max_frame_state_size = %d", max_frame_state_size);
    }
#endif
}

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(void) eezgui_text(eezgui_ctx_t *ctx, const eezgui_text_t *widget) {
    const char *text = ctx->get_str_prop(widget->text);

    widget_start(ctx, &widget->base, sizeof(eezgui_text_state_t) + strlen(text) + 1);

    strcpy(((eezgui_text_state_t *)ctx->widget_state)->text, text);

    if (is_same_state(ctx) && strcmp(((eezgui_text_state_t *)ctx->previous_widget_state)->text, text) == 0) {
        return;
    }

    if (ctx->widget_state->state & EEZGUI_WIDGET_STATE_HIDDEN) {
        erase_widget(ctx);
        return;
    }

    draw_box(ctx, text);
}

EM_PORT_API(void) eezgui_button(eezgui_ctx_t *ctx, const eezgui_button_t *widget) {
    const char *text = ctx->get_str_prop(widget->text);

    widget_start(ctx, &widget->base, sizeof(eezgui_button_state_t) + strlen(text) + 1);

    strcpy(((eezgui_button_state_t *)ctx->widget_state)->text, text);

    if (is_same_state(ctx) && strcmp(((eezgui_button_state_t *)ctx->previous_widget_state)->text, text) == 0) {
        return;
    }
    
    if (ctx->widget_state->state & EEZGUI_WIDGET_STATE_HIDDEN) {
        erase_widget(ctx);
        return;
    }

    draw_box(ctx, text);
}

EM_PORT_API(void) eezgui_rectangle(eezgui_ctx_t *ctx, const eezgui_rectangle_t *widget) {
    widget_start(ctx, &widget->base, sizeof(eezgui_rectangle_state_t));

    if (is_same_state(ctx)) {
        return;
    }

    if (ctx->widget_state->state & EEZGUI_WIDGET_STATE_HIDDEN) {
        erase_widget(ctx);
        return;
    }

    draw_box(ctx, NULL);
}

EM_PORT_API(void) eezgui_switch(eezgui_ctx_t *ctx, const eezgui_switch_t *widget) {
    widget_start(ctx, &widget->base, sizeof(eezgui_switch_state_t));

    bool is_pressed = ctx->widget_state->state & EEZGUI_WIDGET_STATE_PRESSED ? true : false;

    bool is_checked = widget->is_checked ? ctx->get_bool_prop(widget->is_checked) : false;
    if (is_checked) {
        ctx->widget_state->state |= EEZGUI_WIDGET_STATE_CHECKED;
    }

    if (is_same_state(ctx)) {
        return;
    }

    if (ctx->widget_state->state & EEZGUI_WIDGET_STATE_HIDDEN) {
        erase_widget(ctx);
        return;
    }

    // render switch
    int x = ctx->x_offset + widget->base.x;
    int y = ctx->y_offset + widget->base.y;
    int w = widget->base.w;
    int h = widget->base.h;

    const eezgui_style_t *style = ctx->styles + (widget->base.style < ctx->num_styles ? widget->base.style : 0);

    eezgui_color_t bgColor = is_pressed ? ctx->colors[style->active_background_color] : ctx->colors[style->background_color];
    eezgui_color_t fgColor = is_pressed ? ctx->colors[style->active_color] : ctx->colors[style->color];

    if (is_checked) {
        // swap bg and fg colors
        eezgui_color_t temp = bgColor;
        bgColor = fgColor;
        fgColor = temp;
    }

    // Draw track (background)
    display_fill_rect(x, y, w, h, bgColor);

    // Draw knob
    int padding = 4;
    int knob_h = h - 2 * padding;
    int knob_w = knob_h;
    int knob_y = y + padding;
    int knob_x;

    if (is_checked) {
        knob_x = x + w - padding - knob_w;
    } else {
        knob_x = x + padding;
    }

    display_fill_rect(knob_x, knob_y, knob_w, knob_h, fgColor);
}

EM_PORT_API(void) eezgui_select_begin(eezgui_ctx_t *ctx, const eezgui_select_t *widget) {
    widget_start(ctx, &widget->base, sizeof(eezgui_select_state_t));

    ctx->parent_widget = &widget->base;

    if (ctx->pressed_widget == &widget->base) {
        ctx->parent_is_pressed = true;
    }

    ctx->x_offset += widget->base.x;
    ctx->y_offset += widget->base.y;
}

EM_PORT_API(void) eezgui_select_end(eezgui_ctx_t *ctx, const eezgui_select_t *widget) {
    ctx->parent_widget = NULL;

    if (ctx->pressed_widget == &widget->base) {
        ctx->parent_is_pressed = false;
    }

    ctx->x_offset -= widget->base.x;
    ctx->y_offset -= widget->base.y;
}

EM_PORT_API(void) eezgui_container_begin(eezgui_ctx_t *ctx, const eezgui_container_t *widget) {
    widget_start(ctx, &widget->base, sizeof(eezgui_container_state_t));

    ctx->parent_widget = &widget->base;

    if (ctx->pressed_widget == &widget->base) {
        ctx->parent_is_pressed = true;
    }

    ctx->x_offset += widget->base.x;
    ctx->y_offset += widget->base.y;
}

EM_PORT_API(void) eezgui_container_end(eezgui_ctx_t *ctx, const eezgui_container_t *widget) {
    ctx->parent_widget = NULL;

    if (ctx->pressed_widget == &widget->base) {
        ctx->parent_is_pressed = false;
    }

    ctx->x_offset -= widget->base.x;
    ctx->y_offset -= widget->base.y;
}

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(void) eezgui_pointer_input(eezgui_ctx_t *ctx, int x, int y, bool pressed) {
    ctx->was_pressed = ctx->is_pressed;
    ctx->is_pressed = pressed;
    ctx->pointer_x = x;
    ctx->pointer_y = y;
}

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(char *) String_format(eezgui_ctx_t *ctx, const char *format, ...) {
    va_list args;
    va_start(args, format);
    va_list args_copy;
    va_copy(args_copy, args);
    int len = vsnprintf(NULL, 0, format, args_copy);
    va_end(args_copy);
    char *result = eezgui_alloc_from_state(ctx, len + 1);
    vsnprintf(result, len + 1, format, args);
    va_end(args);
    return result;
}

EM_PORT_API(int) Math_min(int a, int b) {
    return a < b ? a : b;
}

EM_PORT_API(int) Math_max(int a, int b) {
    return a > b ? a : b;
}

EM_PORT_API(uint32_t) System_getTick(void) {
#if defined(EEZ_PLATFORM_STM32)
	return HAL_GetTick();
#elif defined(__EMSCRIPTEN__)
    return (uint32_t)emscripten_get_now();
#else
    return SDL_GetTicks();
#endif
}

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(void) eezgui_log(eezgui_log_level_t level, const char *file, int line, const char *format, ...) {
    static const char *log_level_strings[] = {
        "DEBUG", "INFO", "WARNING", "ERROR"
    };

    printf("[%s] %s:%d: ", log_level_strings[level], file, line);
    va_list args;
    va_start(args, format);
    vprintf(format, args);
    va_end(args);
    printf("\n");
}

////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Private functions

static bool widget_is_visible(eezgui_ctx_t *ctx, const eezgui_widget_t *widget) {
    if (widget->is_visible && !ctx->get_bool_prop(widget->is_visible)) {
        return false;
    }

    const eezgui_style_t *style_p = ctx->styles + (widget->style < ctx->num_styles ? widget->style : 0);
    if (style_p->flags & EEZGUI_STYLE_FLAG_BLINK) {
        return System_getTick() % 800 < 400;
    }

    return true;
}

static void send_event(eezgui_ctx_t *ctx, const eezgui_widget_t *widget, eezgui_event_type_t type) {
    eezgui_event_info_t event_info = {
        .type = type,
        .widget = widget,
    };
    ctx->on_event(&event_info);
}

static void check_events(eezgui_ctx_t *ctx, const eezgui_widget_t *widget) {
    if (!(widget->flags & EEZGUI_WIDGET_FLAG_CLICKABLE)) {
        return;
    }

    int16_t widget_x = ctx->x_offset + widget->x;
    int16_t widget_y = ctx->y_offset + widget->y;

    bool contains_pointer = ctx->pointer_x >= widget_x && ctx->pointer_x < widget_x + widget->w &&
                            ctx->pointer_y >= widget_y && ctx->pointer_y < widget_y + widget->h;

    if (!ctx->was_pressed && ctx->is_pressed && contains_pointer) {
        ctx->pressed_widget = widget;
        send_event(ctx, widget, EEZGUI_EVENT_PRESSED);

        ctx->pressed_time = System_getTick();
        ctx->long_press_sent = false;
    }

    if (ctx->was_pressed && !ctx->is_pressed) {
        if (ctx->pressed_widget == widget) {
            send_event(ctx, widget, EEZGUI_EVENT_RELEASED);
        }
        if (ctx->pressed_widget == widget && contains_pointer) {
            send_event(ctx, widget, EEZGUI_EVENT_CLICKED);
        }
    }

    if (ctx->was_pressed && ctx->is_pressed && ctx->pressed_widget == widget) {
        ctx->pressed_widget_contains_pointer = contains_pointer;
    }

    if (ctx->was_pressed && ctx->is_pressed && ctx->pressed_widget == widget && contains_pointer && (System_getTick() - ctx->pressed_time >= ctx->long_press_time) && !ctx->long_press_sent) {
        send_event(ctx, widget, EEZGUI_EVENT_LONG_PRESSED);
        ctx->long_press_sent = true;
        ctx->pressed_time = System_getTick();
    }

    if (ctx->was_pressed && ctx->is_pressed && ctx->pressed_widget == widget && contains_pointer && (System_getTick() - ctx->pressed_time >= ctx->long_press_repeat_time) && ctx->long_press_sent) {
        send_event(ctx, widget, EEZGUI_EVENT_LONG_PRESSED_REPEAT);
        ctx->pressed_time = System_getTick();
    }
}

static void widget_start(eezgui_ctx_t *ctx, const eezgui_widget_t *widget, int widget_state_size) {
    eezgui_widget_state_t *widget_state = (eezgui_widget_state_t *)eezgui_alloc_from_state(ctx, widget_state_size);

    widget_state->widget = widget;
    widget_state->next_sibling = NULL;

    widget_state->state = 0;

    if (!widget_is_visible(ctx, widget)) {
        widget_state->state |= EEZGUI_WIDGET_STATE_HIDDEN;
    }

    check_events(ctx, widget);
    if ((ctx->pressed_widget == widget || ctx->parent_is_pressed) && ctx->pressed_widget_contains_pointer) {
        widget_state->state |= EEZGUI_WIDGET_STATE_PRESSED;
    }

    if (ctx->page_state->first_widget_state == NULL) {
        ctx->page_state->first_widget_state = widget_state;
    }

    if (ctx->widget_state) {
        ctx->widget_state->next_sibling = widget_state;

        if (ctx->previous_widget_state) {
            ctx->previous_widget_state = ctx->previous_widget_state->next_sibling;
        }
    }

    ctx->widget_state = widget_state;
}

static bool is_same_state(eezgui_ctx_t *ctx) {
    if (!ctx->previous_widget_state) {
        return false;
    }

    if (ctx->previous_widget_state->widget != ctx->widget_state->widget) {
        return false;
    }

    if (ctx->previous_widget_state->state != ctx->widget_state->state) {
        return false;
    }

    return true;
}

static void erase_widget(eezgui_ctx_t *ctx) {
    // To erase widget, just redraw background of widget's area.

    uint16_t style;
    if (ctx->parent_widget) {
        // If widget has parent widget, use parent's style to erase.
        style = ctx->parent_widget->style;
    } else {
        // If widget has no parent widget, use page style to erase.
        style = ctx->page_state->style;
    }
    
    const eezgui_widget_t *widget = ctx->widget_state->widget;

    int x = ctx->x_offset + widget->x;
    int y = ctx->y_offset + widget->y;
    int w = widget->w;
    int h = widget->h;

    const eezgui_style_t *style_p = ctx->styles + (style < ctx->num_styles ? style : 0);

    eezgui_color_t bgColor = ctx->colors[style_p->background_color];

    display_fill_rect(x, y, w, h, bgColor);
}

////////////////////////////////////////////////////////////////////////////////
// UTF-8 handling

const char *utf8codepoint(const char *str, int32_t *encoding) {
    const unsigned char *s = (const unsigned char *)str;
    if (*s < 0x80) {
        *encoding = *s;
        return str + 1;
    } else if ((*s & 0xE0) == 0xC0) {
        *encoding = ((*s & 0x1F) << 6) | (s[1] & 0x3F);
        return str + 2;
    } else if ((*s & 0xF0) == 0xE0) {
        *encoding = ((*s & 0x0F) << 12) | ((s[1] & 0x3F) << 6) | (s[2] & 0x3F);
        return str + 3;
    } else if ((*s & 0xF8) == 0xF0) {
        *encoding = ((*s & 0x07) << 18) | ((s[1] & 0x3F) << 12) | ((s[2] & 0x3F) << 6) | (s[3] & 0x3F);
        return str + 4;
    }
    // Invalid UTF-8
    *encoding = -1;
    return str + 1;
}

int utf8len(const char *text) {
    int len = 0;
    while (*text) {
        int32_t encoding;
        text = utf8codepoint(text, &encoding);
        if (!encoding) {
            break;
        }
        len++;
    }
    return len;
}

////////////////////////////////////////////////////////////////////////////////

static const eezgui_glyph_data_t *font_get_glyph(const eezgui_font_data_t *font, int32_t encoding) {
	uint32_t start = font->encodingStart;
	uint32_t end = font->encodingEnd;

    uint32_t glyph_index = 0;
	if ((uint32_t)encoding < start || (uint32_t)encoding > end) {
        // TODO use binary search
        const eezgui_glyphs_group_t *group;
		for (group = font->groups; group->length; group++) {
            if ((uint32_t)encoding >= group->encoding && (uint32_t)encoding < group->encoding + group->length) {
                glyph_index = group->glyphIndex + (encoding - group->encoding);
                break;
            }
        }
        if (!group) {
            return NULL;
        }
	} else {
        glyph_index = encoding - start;
    }

	const eezgui_glyph_data_t *glyph = font->glyphs + glyph_index;

	if (glyph->dx == -128) {
		// empty glyph
		return NULL;
	}

	return glyph;
}

static int8_t font_measure_glyph(const eezgui_font_data_t *font, int32_t encoding) {
    const eezgui_glyph_data_t *glyph = font_get_glyph((eezgui_font_data_t *)font, encoding);
    return glyph ? glyph->dx : 0;
}

static int font_measure_str(const eezgui_font_data_t *font, const char *text, int text_length, int max_width) {
    int width = 0;

    if (text_length == -1) {
        while (true) {
            int32_t encoding;
            text = utf8codepoint(text, &encoding);
            if (!encoding) {
                break;
            }
            int glyph_width = font_measure_glyph(font, encoding);
            if (max_width > 0 && width + glyph_width > max_width) {
                return max_width;
            }
            width += glyph_width;
        }
    } else {
        for (int i = 0; i < text_length; ++i) {
            int32_t encoding;
            text = utf8codepoint(text, &encoding);
            if (!encoding) {
                break;
            }
            int glyph_width = font_measure_glyph(font, encoding);
            if (max_width > 0 && width + glyph_width > max_width) {
                return max_width;
            }
            width += glyph_width;
        }
    }

    return width;
}

void font_draw_str(const eezgui_font_data_t *font, const char *text, int text_length, int x, int y, int clip_x1, int clip_y1, int clip_x2, int clip_y2, eezgui_color_t color, eezgui_color_t backgroundColor) {
    if (text_length == -1) {
        text_length = utf8len(text);
    }

    int i;

    for (i = 0; i < text_length; ++i) {
        int32_t encoding;
        text = utf8codepoint(text, &encoding);
        if (!encoding) {
            break;
        }

        int x1 = x;
        int y1 = y;

        const eezgui_glyph_data_t *glyph = font_get_glyph(font, encoding);
        if (glyph) {
            int x_glyph = x1 + glyph->x;
            int y_glyph = y1 + font->ascent - (glyph->y + glyph->h);

            // draw glyph pixels
            int iStartByte = 0;
            if (x_glyph < clip_x1) {
                int dx_off = clip_x1 - x_glyph;
                iStartByte = dx_off;
                x_glyph = clip_x1;
            }

			if (iStartByte < glyph->w) {
				int offset = 0;
				int glyph_height = glyph->h;
				if (y_glyph < clip_y1) {
					int dy_off = clip_y1 - y_glyph;
					offset += dy_off * glyph->w;
					glyph_height -= dy_off;
					y_glyph = clip_y1;
				}

				int width;
				if (x_glyph + (glyph->w - iStartByte) - 1 > clip_x2) {
					width = clip_x2 - x_glyph + 1;
				} else {
					width = (glyph->w - iStartByte);
				}

				int height;
				if (y_glyph + glyph_height - 1 > clip_y2) {
					height = clip_y2 - y_glyph + 1;
				} else {
					height = glyph_height;
				}

				if (width > 0 && height > 0) {
					display_draw_glyph(font->pixels + glyph->pixels_index + offset + iStartByte, glyph->w - width, x_glyph, y_glyph, width, height, color, backgroundColor);
				}
			}

			x += glyph->dx;
		}
    }
}

////////////////////////////////////////////////////////////////////////////////

static void draw_box(eezgui_ctx_t *ctx, const char *text) {
    const eezgui_widget_t *widget = ctx->widget_state->widget;

    int x = ctx->x_offset + widget->x;
    int y = ctx->y_offset + widget->y;
    int w = widget->w;
    int h = widget->h;
    if (display_box_start(x, y, w, h)) {
        x = 0;
        y = 0;
    }

    bool active = ctx->widget_state->state & EEZGUI_WIDGET_STATE_PRESSED ? true : false;

    const eezgui_style_t *style = ctx->styles + (widget->style < ctx->num_styles ? widget->style : 0);

    eezgui_color_t bgColor = active ? ctx->colors[style->active_background_color] : ctx->colors[style->background_color];
    eezgui_color_t fgColor = active ? ctx->colors[style->active_color] : ctx->colors[style->color];
    eezgui_color_t borderColor = ctx->colors[style->border_color];

    // Fill background
    display_fill_rect(x, y, w, h, bgColor);

    // Draw borders (per-side sizes)
    if (style->border_size_top > 0) {
        display_fill_rect(x, y, w, style->border_size_top, borderColor);
    }
    if (style->border_size_bottom > 0) {
        display_fill_rect(x, y + h - style->border_size_bottom, w, style->border_size_bottom, borderColor);
    }
    if (style->border_size_left > 0) {
        display_fill_rect(x, y, style->border_size_left, h, borderColor);
    }
    if (style->border_size_right > 0) {
        display_fill_rect(x + w - style->border_size_right, y, style->border_size_right, h, borderColor);
    }

    // Draw text
    if (text && text[0] && style->font < ctx->num_fonts) {
        const eezgui_font_data_t *font = ctx->fonts[style->font];

        // Content area inside padding and borders
        int content_x = x + style->border_size_left + style->padding_left;
        int content_y = y + style->border_size_top + style->padding_top;
        int content_w = w - style->border_size_left - style->border_size_right - style->padding_left - style->padding_right;
        int content_h = h - style->border_size_top - style->border_size_bottom - style->padding_top - style->padding_bottom;

        if (content_w <= 0 || content_h <= 0) {
            return;
        }

        int text_width = font_measure_str(font, text, -1, content_w);
        int text_height = font->ascent + font->descent;

        // Horizontal alignment
        int text_x;
        int horz_align = style->flags & EEZGUI_STYLE_FLAG_HORZ_ALIGN_MASK;
        if (horz_align == EEZGUI_STYLE_FLAG_HORZ_ALIGN_RIGHT) {
            text_x = content_x + content_w - text_width;
        } else if (horz_align == EEZGUI_STYLE_FLAG_HORZ_ALIGN_CENTER) {
            text_x = content_x + (content_w - text_width) / 2;
        } else {
            text_x = content_x;
        }

        // Vertical alignment
        int text_y;
        int vert_align = style->flags & EEZGUI_STYLE_FLAG_VERT_ALIGN_MASK;
        if (vert_align == EEZGUI_STYLE_FLAG_VERT_ALIGN_BOTTOM) {
            text_y = content_y + content_h - text_height;
        } else if (vert_align == EEZGUI_STYLE_FLAG_VERT_ALIGN_CENTER) {
            text_y = content_y + (content_h - text_height) / 2;
        } else {
            text_y = content_y;
        }

        // Clip to widget bounds
        int clip_x1 = x;
        int clip_y1 = y;
        int clip_x2 = x + w - 1;
        int clip_y2 = y + h - 1;

        font_draw_str(font, text, -1, text_x, text_y, clip_x1, clip_y1, clip_x2, clip_y2, fgColor, bgColor);
    }

    display_box_end();
}

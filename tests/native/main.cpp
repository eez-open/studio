#include "screens.h"
#include <cassert>
#include <cstdio>
#include <cstring>

#ifdef TEST_FLOW
#include "bindings.h"
extern "C" { native_var_t native_vars[] = { {} }; }
static void set_hint(const char *text) {
    eez::flow::setGlobalVariable(TEST_HINT_INDEX, eez::Value(text, eez::VALUE_TYPE_STRING, 0));
}
static void set_key(const char *text) {
    eez::flow::setGlobalVariable(TEST_KEY_LABEL_INDEX, eez::Value(text, eez::VALUE_TYPE_STRING, 0));
}
#else
static const char *hint = "bound hint";
static const char *key_label = "bound key";
extern "C" const char *get_var_hint() { return hint; }
extern "C" const char *get_var_key_label() { return key_label; }
extern "C" void set_var_hint(const char *value) { hint = value; }
extern "C" void set_var_key_label(const char *value) { key_label = value; }
static void set_hint(const char *text) { set_var_hint(text); }
static void set_key(const char *text) { set_var_key_label(text); }
#endif

extern "C" const char *test_translate(const char *text) {
    return !strcmp(text, "Translate me") ? "translated placeholder" : text;
}

#if LVGL_VERSION_MAJOR >= 9
#define BUTTON_TEXT lv_buttonmatrix_get_button_text
static void flush(lv_display_t *display, const lv_area_t *, uint8_t *) { lv_display_flush_ready(display); }
#else
#define BUTTON_TEXT lv_btnmatrix_get_btn_text
static void flush(lv_disp_drv_t *display, const lv_area_t *, lv_color_t *) { lv_disp_flush_ready(display); }
#endif

int main() {
    lv_init();
#if LVGL_VERSION_MAJOR >= 9
    auto display = lv_display_create(320, 240);
    static uint32_t pixels[320 * 20];
    lv_display_set_buffers(display, pixels, nullptr, sizeof(pixels), LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_set_flush_cb(display, flush);
#else
    static lv_color_t pixels[320 * 20];
    static lv_disp_draw_buf_t buffer;
    lv_disp_draw_buf_init(&buffer, pixels, nullptr, 320 * 20);
    static lv_disp_drv_t driver;
    lv_disp_drv_init(&driver);
    driver.hor_res = 320;
    driver.ver_res = 240;
    driver.draw_buf = &buffer;
    driver.flush_cb = flush;
    lv_disp_drv_register(&driver);
#endif
#ifdef TEST_FLOW
    static ActionExecFunc actions[] = { nullptr };
    eez_flow_init(assets, sizeof(assets), (lv_obj_t **)&objects,
        sizeof(objects) / sizeof(lv_obj_t *), nullptr, 0, actions);
    for (int i = 0; i < 10; i++) eez_flow_tick();
    assert(!strcmp(lv_textarea_get_text(objects.input), "hello 世界"));
    assert(lv_textarea_get_one_line(objects.input));
    assert(lv_textarea_get_password_mode(objects.input));
    assert(!strcmp(lv_textarea_get_password_bullet(objects.input), "*"));
    assert(!strcmp(lv_textarea_get_placeholder_text(objects.input), "action placeholder"));
    assert(eez::flow::getGlobalVariable(TEST_SELECTED_INDEX).getInt() == 65535);
    assert(!strcmp(eez::flow::getGlobalVariable(TEST_BUTTON_TEXT_INDEX).getString(), LV_SYMBOL_CLOSE " bound key"));
    assert(!strcmp(BUTTON_TEXT(objects.keys, 0), "A"));
    lv_textarea_set_text(objects.input, "changed");
    assert(!strcmp(eez::flow::getGlobalVariable(TEST_COPIED_INDEX).getString(), "hello 世界"));
#else
    create_screens();
    assert(!strcmp(lv_textarea_get_placeholder_text(objects.input), "旧工程提示"));
    assert(!strcmp(BUTTON_TEXT(objects.keys, 0), "LV_SYMBOL_OK"));
#endif
    tick_screen(0);
    assert(!strcmp(lv_textarea_get_placeholder_text(objects.translated_input), "translated placeholder"));
    assert(!strcmp(lv_textarea_get_placeholder_text(objects.dynamic_input), "bound hint"));
    assert(!strcmp(BUTTON_TEXT(objects.bound_keys, 1), "bound key"));
    for (int i = 0; i < 200; i++) {
#ifdef TEST_FLOW
        assert(!strcmp(BUTTON_TEXT(objects.keys, 0), "A"));
        assert(!strcmp(BUTTON_TEXT(objects.keys, 1), LV_SYMBOL_CLOSE " bound key"));
#endif
        set_hint("");
        set_key("");
        tick_screen(0);
        assert(!strcmp(lv_textarea_get_placeholder_text(objects.dynamic_input), ""));
        assert(!strcmp(BUTTON_TEXT(objects.bound_keys, 1), " "));
        set_hint("new hint");
        set_key(LV_SYMBOL_OK " new");
        tick_screen(0);
        assert(!strcmp(lv_textarea_get_placeholder_text(objects.dynamic_input), "new hint"));
        assert(!strcmp(BUTTON_TEXT(objects.bound_keys, 1), LV_SYMBOL_OK " new"));
    }
#ifdef TEST_FLOW
    assert(!strcmp(eez::flow::getGlobalVariable(TEST_BUTTON_TEXT_INDEX).getString(), LV_SYMBOL_CLOSE " bound key"));
    eez::flow::stop();
    eez::flow::tick();
#endif
#if LVGL_VERSION_MAJOR >= 9
    lv_deinit();
#else
    lv_disp_remove(lv_disp_get_default());
#endif
    printf("PASS: compiled Studio-generated %s C, LVGL %d.%d.%d, live bindings and teardown\n",
#ifdef TEST_FLOW
        "Flow",
#else
        "no-Flow",
#endif
        LVGL_VERSION_MAJOR, LVGL_VERSION_MINOR, LVGL_VERSION_PATCH);
}

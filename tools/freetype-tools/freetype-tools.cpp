#include "agg_font_freetype.h"
#include "agg_pixfmt_rgba.h"
#include "agg_renderer_scanline.h"

#include <cstdint>
#include <stdio.h>
#include <string.h>
#include <string>

#include <emscripten.h>

////////////////////////////////////////////////////////////////////////////////

static_assert(sizeof(int) == 4, "we are expecting sizeof(int) to be 4");
static_assert(sizeof(double) == 8, "we are expecting sizeof(double) to be 8");

#if !(defined(__BYTE_ORDER) && __BYTE_ORDER == __LITTLE_ENDIAN || defined(__LITTLE_ENDIAN__) ||    \
      defined(__ARMEL__) || defined(__THUMBEL__) || defined(__AARCH64EL__) || defined(_MIPSEL) ||  \
      defined(__MIPSEL) || defined(__MIPSEL__))
#error "we are expecting a little endian architecture"
#endif

////////////////////////////////////////////////////////////////////////////////

std::string dir_name(const char *path) {
    size_t n = strlen(path);
    for (int i = n - 1; i >= 0; --i) {
        if (path[i] == '/' || path[i] == '\\') {
            return std::string(path, path + i);
        }
    }

    return std::string("");
}

std::string file_name(const char *path) {
    size_t n = strlen(path);
    for (int i = n - 1; i >= 0; --i) {
        if (path[i] == '/' || path[i] == '\\') {
            return std::string(path + i);
        }
    }
    return std::string(path);
}

////////////////////////////////////////////////////////////////////////////////

typedef agg::pixfmt_rgba32 pixfmt_type;
typedef agg::renderer_base<pixfmt_type> base_ren_type;
typedef agg::renderer_scanline_aa_solid<base_ren_type> renderer_solid;
typedef agg::font_engine_freetype_int32 font_engine_type;
typedef agg::font_cache_manager<font_engine_type> font_manager_type;

////////////////////////////////////////////////////////////////////////////////

struct FontExtractState {
    double ascender;
    double descender;

    uint32_t id;

    font_engine_type feng;
    font_manager_type fman;

    bool loaded;

    FontExtractState(uint32_t id_, std::string fontFilePath, int resolution, int size, int hinting,
                     double gamma);
};

struct GlyphInfo {
    int x1;
    int y1;
    int x2;
    int y2;
    double advanceX;
};

////////////////////////////////////////////////////////////////////////////////

FontExtractState::FontExtractState(uint32_t id_, std::string fontFilePath, int resolution, int size,
                                   int hinting, double gamma)
    : id(id_), fman(feng) {
    loaded = feng.load_font(fontFilePath.c_str(), 0, agg::glyph_ren_agg_gray8);

    feng.hinting(hinting ? true : false);
    feng.resolution(resolution);
    feng.height(size);
    feng.flip_y(true);
    // feng.gamma(agg::gamma_power(gamma));

    this->ascender = feng.ascender();
    this->descender = feng.descender();
}

////////////////////////////////////////////////////////////////////////////////

static uint32_t g_id = 1;

extern "C" int free_font_extract_state(FontExtractState *state);

extern "C" FontExtractState *create_font_extract_state(const char *fontFilePath, int resolution,
                                                       int size, int hinting, double gamma) {
    // clang-format off
    EM_ASM({
        FS.mkdir("/fonts" + $0);
        FS.mount(NODEFS, { root: UTF8ToString($1) }, "/fonts" + $0);
    }, g_id, dir_name(fontFilePath).c_str());
    // clang-format on

    std::string path =
        std::string("/fonts") + std::to_string(g_id) + std::string("/") + file_name(fontFilePath);

    FontExtractState *state = new FontExtractState(g_id, path, resolution, size, hinting, gamma);

    if (!state->loaded) {
        free_font_extract_state(state);
        return nullptr;
    }

    ++g_id;

    return state;
}

extern "C" int extract_glyph(FontExtractState *state, int glyphCode, int x, int y, int canvasWidth,
                             int canvasHeight, uint8_t *data, GlyphInfo *glyphInfo) {
    agg::rendering_buffer rbuf;
    rbuf.attach((unsigned char *)data, canvasWidth, canvasHeight, 4 * canvasWidth);

    pixfmt_type pf(rbuf);
    base_ren_type ren_base(pf);
    renderer_solid ren_solid(ren_base);

    ren_solid.color(agg::rgba8(0, 0, 0));

    const agg::glyph_cache *glyph = state->fman.glyph(glyphCode);
    if (glyph) {
        glyphInfo->x1 = glyph->bounds.x1;
        glyphInfo->y1 = glyph->bounds.y1;
        glyphInfo->x2 = glyph->bounds.x2;
        glyphInfo->y2 = glyph->bounds.y2;
        glyphInfo->advanceX = glyph->advance_x;

        state->fman.init_embedded_adaptors(glyph, x, y);

        agg::render_scanlines(state->fman.gray8_adaptor(), state->fman.gray8_scanline(), ren_solid);

        return 1;
    }

    return 0;
}

extern "C" int free_font_extract_state(FontExtractState *state) {
    // clang-format off
    EM_ASM({
        FS.unmount("/fonts" + $0);
        FS.rmdir("/fonts" + $0);
    }, state->id);
    // clang-format on

    delete state;

    return 1;
}

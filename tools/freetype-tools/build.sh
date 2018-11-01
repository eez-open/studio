source ~/emsdk/emsdk_env.sh
emcc \
    freetype-tools.cpp\
    \
    agg-2.5/src/agg_curves.cpp\
    agg-2.5/font_freetype/agg_font_freetype.cpp\
    \
    FreeType-Emscripten/freetype.bc\
    \
    -Iagg-2.5/include\
    -Iagg-2.5/font_freetype\
    -IFreeType-Emscripten/include\
    \
    -s EXPORTED_FUNCTIONS='["_create_font_extract_state", "_extract_glyph", "_free_font_extract_state"]'\
    -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]'\
    -o ../../libs/freetype-tools-wasm/freetype-tools.js

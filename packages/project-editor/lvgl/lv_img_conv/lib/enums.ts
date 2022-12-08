enum ImageMode {
    /*Helper ARGB formats. Used internally*/
    ICF_TRUE_COLOR_ARGB8332,      
    ICF_TRUE_COLOR_ARGB8565,
    ICF_TRUE_COLOR_ARGB8565_RBSWAP,
    ICF_TRUE_COLOR_ARGB8888,
    CF_ALPHA_1_BIT,
    CF_ALPHA_2_BIT,
    CF_ALPHA_4_BIT,
    CF_ALPHA_8_BIT,
    CF_INDEXED_1_BIT,
    CF_INDEXED_2_BIT,
    CF_INDEXED_4_BIT,
    CF_INDEXED_8_BIT,
    CF_RAW,
    CF_RAW_CHROMA = CF_RAW,
    CF_RAW_ALPHA,

    /*Helper formats if C arrays contains all true color formats (used in "download")*/
    CF_TRUE_COLOR,          
    CF_TRUE_COLOR_ALPHA,
    CF_TRUE_COLOR_CHROMA,

    /*New formats in v8.3+*/
    CF_RGB565A8
};

class ImageModeUtil {
    public static isTrueColor(mode: string|ImageMode) {
        if(typeof mode != 'string')
            mode = ImageMode[mode];
        return mode.startsWith("CF_TRUE_COLOR");
    }
}

enum OutputMode {
    C,
    BIN
}


const BINARY_FORMAT_PREFIX = "ICF_TRUE_COLOR_";

export { ImageMode, ImageModeUtil, OutputMode, BINARY_FORMAT_PREFIX };
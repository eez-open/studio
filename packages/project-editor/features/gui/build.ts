const LZ4 = require("lz4");

import { strToColor16 } from "eez-studio-shared/color";

import { getRootObject } from "project-editor/core/object";
import { OutputSectionsStore } from "project-editor/core/store";
import * as output from "project-editor/core/output";

import { BuildResult } from "project-editor/core/extensions";
import { ProjectStore } from "project-editor/core/store";

import * as projectBuild from "project-editor/project/build";
import { Project, BuildConfiguration } from "project-editor/project/project";

import { DataItem, findDataItem } from "project-editor/features/data/data";
import { Action, findAction } from "project-editor/features/action/action";

import { getData as getBitmapData, Bitmap, findBitmap } from "project-editor/features/gui/bitmap";
import { Style, getStyleProperty, findStyle } from "project-editor/features/gui/style";
import * as Widget from "project-editor/features/gui/widget";
import { Page, findPage } from "project-editor/features/gui/page";
import { Font, findFont } from "project-editor/features/gui/font";
import { Theme } from "project-editor/features/gui/theme";

////////////////////////////////////////////////////////////////////////////////

export function getFontData(font: Font, dataBuffer: DataBuffer) {
    /*
    Font header:

    offset
    0           ascent              uint8
    1           descent             uint8
    2           encoding start      uint8
    3           encoding end        uint8
    4           1st encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    6           2nd encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    ...
    */

    /*
    Glyph header:

    offset
    0             DWIDTH                    int8
    1             BBX width                 uint8
    2             BBX height                uint8
    3             BBX xoffset               int8
    4             BBX yoffset               int8

    Note: byte 0 == 255 indicates empty glyph
    */

    const min = Math.min(...font.glyphs.map(g => g.encoding));
    const startEncoding = Number.isFinite(min) ? min : 32;
    const max = Math.max(...font.glyphs.map(g => g.encoding));
    const endEncoding = Number.isFinite(max) ? max : 127;

    const offsetAtStart = dataBuffer.offset;

    if (startEncoding <= endEncoding) {
        dataBuffer.packInt8(font.ascent);
        dataBuffer.packInt8(font.descent);
        dataBuffer.packInt8(startEncoding);
        dataBuffer.packInt8(endEncoding);

        for (let i = startEncoding; i <= endEncoding; i++) {
            if (font.bpp === 8) {
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
            } else {
                dataBuffer.packInt8(0);
                dataBuffer.packInt8(0);
            }
        }

        for (let i = startEncoding; i <= endEncoding; i++) {
            const offsetIndex = 4 + (i - startEncoding) * (font.bpp === 8 ? 4 : 2);
            const offset = dataBuffer.offset - offsetAtStart;
            if (font.bpp === 8) {
                // uint32 LE
                dataBuffer.packUInt32AtOffset(offsetAtStart + offsetIndex, offset);
            } else {
                // uint16 BE
                dataBuffer.packUInt8AtOffset(offsetAtStart + offsetIndex + 0, offset >> 8);
                dataBuffer.packUInt8AtOffset(offsetAtStart + offsetIndex + 1, offset & 0xff);
            }

            let glyph = font.glyphs.find(glyph => glyph.encoding == i);

            if (glyph && glyph.glyphBitmap && glyph.glyphBitmap.pixelArray) {
                dataBuffer.packInt8(glyph.dx);
                dataBuffer.packInt8(glyph.width);
                dataBuffer.packInt8(glyph.height);
                dataBuffer.packInt8(glyph.x);
                dataBuffer.packInt8(glyph.y);

                dataBuffer.packArray(glyph.glyphBitmap.pixelArray);
            } else {
                dataBuffer.packInt8(255);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

const STYLE_FLAGS_HORZ_ALIGN_LEFT = 0;
const STYLE_FLAGS_HORZ_ALIGN_RIGHT = 1;
const STYLE_FLAGS_HORZ_ALIGN_CENTER = 2;
const STYLE_FLAGS_HORZ_ALIGN_LEFT_RIGHT = 3;

const STYLE_FLAGS_VERT_ALIGN_TOP = 0 << 3;
const STYLE_FLAGS_VERT_ALIGN_BOTTOM = 1 << 3;
const STYLE_FLAGS_VERT_ALIGN_CENTER = 2 << 3;

const STYLE_FLAGS_BLINK = 1 << 6;

const WIDGET_TYPE_NONE = 0;
const WIDGET_TYPE_CONTAINER = 1;
const WIDGET_TYPE_LIST = 2;
const WIDGET_TYPE_GRID = 3;
const WIDGET_TYPE_SELECT = 4;
const WIDGET_TYPE_DISPLAY_DATA = 5;
const WIDGET_TYPE_TEXT = 6;
const WIDGET_TYPE_MULTILINE_TEXT = 7;
const WIDGET_TYPE_RECTANGLE = 8;
const WIDGET_TYPE_BITMAP = 9;
const WIDGET_TYPE_BUTTON = 10;
const WIDGET_TYPE_TOGGLE_BUTTON = 11;
const WIDGET_TYPE_BUTTON_GROUP = 12;
const WIDGET_TYPE_BAR_GRAPH = 14;
const WIDGET_TYPE_LAYOUT_VIEW = 15;
const WIDGET_TYPE_YT_GRAPH = 16;
const WIDGET_TYPE_UP_DOWN = 17;
const WIDGET_TYPE_LIST_GRAPH = 18;
const WIDGET_TYPE_APP_VIEW = 19;
const WIDGET_TYPE_SCROLL_BAR = 20;
const WIDGET_TYPE_PROGRESS = 21;
const WIDGET_TYPE_CANVAS = 22;

const LIST_TYPE_VERTICAL = 1;
const LIST_TYPE_HORIZONTAL = 2;

const GRID_FLOW_ROW = 1;
const GRID_FLOW_COLUMN = 2;

const BAR_GRAPH_ORIENTATION_LEFT_RIGHT = 1;
const BAR_GRAPH_ORIENTATION_RIGHT_LEFT = 2;
const BAR_GRAPH_ORIENTATION_TOP_BOTTOM = 3;
const BAR_GRAPH_ORIENTATION_BOTTOM_TOP = 4;

////////////////////////////////////////////////////////////////////////////////

export class DataBuffer {
    buffer: Uint8Array;
    offset: number;

    constructor() {
        this.buffer = new Uint8Array(10 * 1024 * 1024);
        this.offset = 0;
    }

    packUInt8(value: number) {
        this.buffer[this.offset++] = value;
    }

    packInt8(value: number) {
        if (value < 0) {
            this.buffer[this.offset++] = 256 + value;
        } else {
            this.buffer[this.offset++] = value;
        }
    }

    packUInt16(value: number) {
        this.packUInt8(value & 0xff);
        this.packUInt8(value >> 8);
    }

    packInt16(value: number) {
        if (value < 0) {
            value = 65536 + value;
        }
        this.packUInt8(value & 0xff);
        this.packUInt8(value >> 8);
    }

    packUInt32(value: number) {
        this.packUInt8(value & 0xff);
        this.packUInt8((value >> 8) & 0xff);
        this.packUInt8((value >> 16) & 0xff);
        this.packUInt8(value >> 24);
    }

    packUInt8AtOffset(offset: number, value: number) {
        this.buffer[offset] = value;
    }

    packUInt32AtOffset(offset: number, value: number) {
        this.packUInt8AtOffset(offset + 0, value & 0xff);
        this.packUInt8AtOffset(offset + 1, (value >> 8) & 0xff);
        this.packUInt8AtOffset(offset + 2, (value >> 16) & 0xff);
        this.packUInt8AtOffset(offset + 3, value >> 24);
    }

    packArray(array: Uint8Array | number[]) {
        this.buffer.set(array, this.offset);
        this.offset += array.length;
    }

    addPadding(dataLength: number, length: number) {
        if (length === 2) {
            if (dataLength % 2) {
                this.packUInt8(0);
            }
        } else if (length >= 4) {
            if (dataLength % 4) {
                const n = 4 - (dataLength % 4);
                for (let i = 0; i < n; ++i) {
                    this.packUInt8(0);
                }
            }
        }
    }

    async packRegions(numRegions: number, buildRegion: (i: number) => Promise<void>) {
        const headerOffset = this.offset;

        for (let i = 0; i < numRegions; i++) {
            this.packUInt32(0);
        }

        const dataOffset = this.offset;

        for (let i = 0; i < numRegions; i++) {
            this.packUInt32AtOffset(headerOffset + i * 4, this.offset - headerOffset);
            await buildRegion(i);
            this.addPadding(this.offset - dataOffset, 4);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

abstract class Field {
    offset: number;
    size: number;

    enumObjects(objects: ObjectField[]) { }
    finish() { }
    abstract pack(dataBuffer: DataBuffer): void;
}

abstract class ObjectField extends Field {
    objectOffset: number;
    objectSize: number;

    abstract packObject(dataBuffer: DataBuffer): void;
}

class Struct extends ObjectField {
    fields: Field[] = [];

    constructor() {
        super();
        this.size = 4;
    }

    addField(field: Field) {
        this.fields.push(field);
    }

    enumObjects(objects: ObjectField[]) {
        this.fields.forEach(field => field.enumObjects(objects));
    }

    finish() {
        this.objectSize = this.fields.reduce((offset, field) => {
            if (field.size === 2) {
                if (offset % 2 === 1) {
                    offset += 1;
                }
            } else if (field.size >= 4) {
                if (offset % 4 > 0) {
                    offset += 4 - (offset % 4);
                }
            }

            field.offset = offset;

            return offset + field.size;
        }, 0);

        if (this.objectSize % 4 > 0) {
            this.objectSize += 4 - (this.objectSize % 4);
        }
    }

    pack(dataBuffer: DataBuffer) {
        return dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        const offsetAtStart = dataBuffer.offset;

        this.fields.forEach(field => {
            dataBuffer.addPadding(dataBuffer.offset - offsetAtStart, field.size);
            field.pack(dataBuffer);
        });

        dataBuffer.addPadding(dataBuffer.offset - offsetAtStart, 4);
    }
}

class ObjectPtr extends Field {
    constructor(public value: ObjectField | undefined) {
        super();
        this.size = 4;
    }

    enumObjects(objects: ObjectField[]) {
        if (this.value) {
            objects.push(this.value);
        }
    }

    pack(dataBuffer: DataBuffer) {
        return dataBuffer.packUInt32(this.value ? this.value.objectOffset : 0);
    }
}

class ObjectList extends Field {
    items: ObjectField[] = [];

    constructor() {
        super();
        this.size = 8;
    }

    addItem(item: ObjectField) {
        this.items.push(item);
    }

    enumObjects(objects: ObjectField[]) {
        this.items.forEach(item => objects.push(item));
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.items.length);
        dataBuffer.packUInt32(this.items.length > 0 ? this.items[0].objectOffset : 0);
    }
}

class StringList extends Field {
    items: ObjectField[] = [];

    constructor() {
        super();
        this.size = 8;
    }

    addItem(item: ObjectField) {
        this.items.push(item);
        this.size += 4;
    }

    enumObjects(objects: ObjectField[]) {
        this.items.forEach(item => objects.push(item));
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.items.length);
        dataBuffer.packUInt32(8);
        this.items.forEach(item => dataBuffer.packUInt32(item.objectOffset));
    }
}

class String extends ObjectField {
    constructor(public value: string) {
        super();
        this.size = 4;

        this.objectSize = this.value.length + 1;
        if (this.objectSize % 4 > 0) {
            this.objectSize += 4 - (this.objectSize % 4);
        }
    }

    enumObjects(objects: ObjectField[]) {
        objects.push(this);
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        const offsetAtStart = dataBuffer.offset;

        for (let i = 0; i < this.value.length; i++) {
            dataBuffer.packUInt8(this.value.charCodeAt(i));
        }
        dataBuffer.packUInt8(0);

        dataBuffer.addPadding(dataBuffer.offset - offsetAtStart, 4);
    }
}

class Color extends ObjectField {
    constructor(public value: number) {
        super();
        this.value = value;
        this.objectSize = 2;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt32(this.objectOffset);
    }

    packObject(dataBuffer: DataBuffer) {
        dataBuffer.packUInt16(this.value);
    }
}

class UInt8 extends Field {
    constructor(public value: number) {
        super();
        this.size = 1;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt8(this.value);
    }
}

class UInt16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packUInt16(this.value);
    }
}

class Int16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packInt16(this.value);
    }
}

class UInt8ArrayField extends Field {
    constructor(public value: Uint8Array) {
        super();
        this.size = value.length;
        if (this.size % 4 > 0) {
            this.size += 4 - (this.size % 4);
        }
    }

    pack(dataBuffer: DataBuffer) {
        dataBuffer.packArray(this.value);
        dataBuffer.addPadding(this.value.length, 4);
    }
}

////////////////////////////////////////////////////////////////////////////////

function pack(dataBuffer: DataBuffer, objects: ObjectField[] = []) {
    objects.forEach(object => object.packObject(dataBuffer));
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiFontsEnum(assets: Assets) {
    let fonts = assets.fonts.map(
        (font, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "FONT_ID_",
                font,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    // TODO what if font name is none!?
    fonts.unshift(`${projectBuild.TAB}FONT_ID_NONE = 0`);

    return `enum FontsEnum {\n${fonts.join(",\n")}\n};`;
}

async function buildGuiFontsData(assets: Assets, dataBuffer: DataBuffer) {
    if (!ProjectStore.masterProject) {
        await dataBuffer.packRegions(assets.fonts.length, async (i: number) => {
            getFontData(assets.fonts[i], dataBuffer);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiBitmapsEnum(assets: Assets) {
    let bitmaps = assets.bitmaps.map(
        (bitmap, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "BITMAP_ID_",
                bitmap,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    bitmaps.unshift(`${projectBuild.TAB}BITMAP_ID_NONE = 0`);

    return `enum BitmapsEnum {\n${bitmaps.join(",\n")}\n};`;
}

async function buildGuiBitmaps(assets: Assets) {
    if (assets.bitmaps.length === 0) {
        return null;
    }

    let bitmaps: {
        name: string;
        width: number;
        height: number;
        bpp: number;
        pixels: Uint8Array;
    }[] = [];

    for (let i = 0; i < assets.bitmaps.length; i++) {
        const bitmapsData = await getBitmapData(assets.bitmaps[i]);

        bitmaps.push({
            name: assets.bitmaps[i].name,
            width: bitmapsData.width,
            height: bitmapsData.height,
            bpp: bitmapsData.bpp,
            pixels: bitmapsData.pixels
        });
    }

    return bitmaps;
}

async function buildGuiBitmapsData(assets: Assets, dataBuffer: DataBuffer) {
    const bitmaps = await buildGuiBitmaps(assets);
    if (bitmaps) {
        await dataBuffer.packRegions(bitmaps.length, async (i: number) => {
            const bitmap = bitmaps[i];

            const struct = new Struct();

            struct.addField(new Int16(bitmap.width));
            struct.addField(new Int16(bitmap.height));
            struct.addField(new Int16(bitmap.bpp));
            struct.addField(new Int16(0));
            struct.addField(new UInt8ArrayField(bitmap.pixels));

            struct.packObject(dataBuffer);
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiStylesEnum(assets: Assets) {
    let styles = assets.styles
        .map((style, i) => {
            if (style) {
                return `${projectBuild.TAB}${projectBuild.getName(
                    "STYLE_ID_",
                    style.name ? style : "inline" + i,
                    projectBuild.NamingConvention.UnderscoreUpperCase
                )} = ${i}`;
            } else {
                return undefined;
            }
        })
        .filter(style => !!style);

    styles.unshift(`${projectBuild.TAB}STYLE_ID_NONE = 0`);

    return `enum StylesEnum {\n${styles.join(",\n")}\n};`;
}

function buildListData(build: (document: Struct) => void, dataBuffer: DataBuffer | null) {
    function finish() {
        let objects: ObjectField[] = [];
        let newObjects: ObjectField[] = [document];
        while (newObjects.length > 0) {
            objects = objects.concat(newObjects);
            let temp: ObjectField[] = [];
            newObjects.forEach(object => object.enumObjects(temp));
            newObjects = temp.filter(object => objects.indexOf(object) == -1);
        }

        objects.forEach(object => object.finish());

        let objectOffset = 0;
        objects.forEach(object => {
            object.objectOffset = objectOffset;
            objectOffset += object.objectSize;
        });

        return objects;
    }

    let document = new Struct();

    build(document);

    if (dataBuffer) {
        let objects = finish();
        pack(dataBuffer, objects);
    }

    return [];
}

function buildGuiStylesData(assets: Assets, dataBuffer: DataBuffer | null) {
    function buildStyle(style: Style) {
        let result = new Struct();

        // flags
        let flags = 0;

        let styleAlignHorizontal = style.alignHorizontalProperty;
        if (styleAlignHorizontal == "left") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_LEFT;
        } else if (styleAlignHorizontal == "right") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_RIGHT;
        } else if (styleAlignHorizontal == "left-right") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_LEFT_RIGHT;
        } else {
            flags |= STYLE_FLAGS_HORZ_ALIGN_CENTER;
        }

        let styleAlignVertical = style.alignVerticalProperty;
        if (styleAlignVertical == "top") {
            flags |= STYLE_FLAGS_VERT_ALIGN_TOP;
        } else if (styleAlignVertical == "bottom") {
            flags |= STYLE_FLAGS_VERT_ALIGN_BOTTOM;
        } else {
            flags |= STYLE_FLAGS_VERT_ALIGN_CENTER;
        }

        let styleBlink = style.blinkProperty;
        if (styleBlink) {
            flags |= STYLE_FLAGS_BLINK;
        }

        result.addField(new UInt16(flags));

        // colors
        let backgroundColor = assets.getColorIndex(style, "backgroundColor");
        if (isNaN(backgroundColor)) {
            backgroundColor = 0;
        }
        result.addField(new UInt16(backgroundColor));

        let color = assets.getColorIndex(style, "color");
        if (isNaN(color)) {
            color = 0;
        }
        result.addField(new UInt16(color));

        let activeBackgroundColor = assets.getColorIndex(style, "activeBackgroundColor");
        if (isNaN(activeBackgroundColor)) {
            activeBackgroundColor = 0;
        }
        result.addField(new UInt16(activeBackgroundColor));

        let activeColor = assets.getColorIndex(style, "activeColor");
        if (isNaN(activeColor)) {
            activeColor = 0;
        }
        result.addField(new UInt16(activeColor));

        let focusBackgroundColor = assets.getColorIndex(style, "focusBackgroundColor");
        if (isNaN(focusBackgroundColor)) {
            focusBackgroundColor = 0;
        }
        result.addField(new UInt16(focusBackgroundColor));

        let focusColor = assets.getColorIndex(style, "focusColor");
        if (isNaN(focusColor)) {
            focusColor = 0;
        }
        result.addField(new UInt16(focusColor));

        result.addField(new UInt8(style.borderSizeRect.top));
        result.addField(new UInt8(style.borderSizeRect.right));
        result.addField(new UInt8(style.borderSizeRect.bottom));
        result.addField(new UInt8(style.borderSizeRect.left));

        result.addField(new UInt16(style.borderRadius || 0));

        let borderColor = assets.getColorIndex(style, "borderColor");
        if (isNaN(borderColor)) {
            borderColor = 0;
        }
        result.addField(new UInt16(borderColor));

        // font
        let fontIndex = style.fontName ? assets.getFontIndex(style, "fontName") : 0;
        result.addField(new UInt8(fontIndex));

        // opacity
        result.addField(new UInt8(style.opacityProperty));

        // padding
        result.addField(new UInt8(style.paddingRect.top));
        result.addField(new UInt8(style.paddingRect.right));
        result.addField(new UInt8(style.paddingRect.bottom));
        result.addField(new UInt8(style.paddingRect.left));

        // margin
        result.addField(new UInt8(style.marginRect.top));
        result.addField(new UInt8(style.marginRect.right));
        result.addField(new UInt8(style.marginRect.bottom));
        result.addField(new UInt8(style.marginRect.left));

        return result;
    }

    return buildListData((document: Struct) => {
        let styles = new ObjectList();
        if (!ProjectStore.masterProject) {
            const assetStyles = assets.styles.filter(style => !!style) as Style[];
            assetStyles.forEach(style => {
                styles.addItem(buildStyle(style));
            });
        }
        document.addField(styles);
    }, dataBuffer);
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiThemesEnum(assets: Assets) {
    let themes = assets.rootProject.gui.themes.map(
        (theme, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "THEME_ID_",
                theme,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i}`
    );

    return `enum ThemesEnum {\n${themes.join(",\n")}\n};`;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiColorsEnum(assets: Assets) {
    let colors = assets.rootProject.gui.colors.map(
        (color, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "COLOR_ID_",
                color,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i}`
    );

    return `enum ColorsEnum {\n${colors.join(",\n")}\n};`;
}

////////////////////////////////////////////////////////////////////////////////

function buildWidgetText(text: string) {
    try {
        return JSON.parse('"' + text + '"');
    } catch (e) { }
    return text;
}

function buildWidget(object: Widget.Widget | Page, assets: Assets) {
    let result = new Struct();

    // type
    let type: number;
    if (object instanceof Page) {
        type = WIDGET_TYPE_CONTAINER;
    } else {
        let widget = object;
        if (widget.type == "Container") {
            type = WIDGET_TYPE_CONTAINER;
        } else if (widget.type == "List") {
            type = WIDGET_TYPE_LIST;
        } else if (widget.type == "Select") {
            type = WIDGET_TYPE_SELECT;
        } else if (widget.type == "DisplayData") {
            type = WIDGET_TYPE_DISPLAY_DATA;
        } else if (widget.type == "Text") {
            type = WIDGET_TYPE_TEXT;
        } else if (widget.type == "MultilineText") {
            type = WIDGET_TYPE_MULTILINE_TEXT;
        } else if (widget.type == "Rectangle") {
            type = WIDGET_TYPE_RECTANGLE;
        } else if (widget.type == "Bitmap") {
            type = WIDGET_TYPE_BITMAP;
        } else if (widget.type == "Button") {
            type = WIDGET_TYPE_BUTTON;
        } else if (widget.type == "ToggleButton") {
            type = WIDGET_TYPE_TOGGLE_BUTTON;
        } else if (widget.type == "ButtonGroup") {
            type = WIDGET_TYPE_BUTTON_GROUP;
        } else if (widget.type == "BarGraph") {
            type = WIDGET_TYPE_BAR_GRAPH;
        } else if (widget.type == "YTGraph") {
            type = WIDGET_TYPE_YT_GRAPH;
        } else if (widget.type == "UpDown") {
            type = WIDGET_TYPE_UP_DOWN;
        } else if (widget.type == "ListGraph") {
            type = WIDGET_TYPE_LIST_GRAPH;
        } else if (widget.type == "LayoutView") {
            type = WIDGET_TYPE_LAYOUT_VIEW;
        } else if (widget.type == "AppView") {
            type = WIDGET_TYPE_APP_VIEW;
        } else if (widget.type == "Grid") {
            type = WIDGET_TYPE_GRID;
        } else if (widget.type == "ScrollBar") {
            type = WIDGET_TYPE_SCROLL_BAR;
        } else if (widget.type == "Progress") {
            type = WIDGET_TYPE_PROGRESS;
        } else if (widget.type == "Canvas") {
            type = WIDGET_TYPE_CANVAS;
        } else {
            type = WIDGET_TYPE_NONE;
        }
    }
    result.addField(new UInt8(type));

    // data
    let data = 0;
    if (object instanceof Widget.Widget && object.data) {
        data = assets.getDataItemIndex(object, "data");
    }
    result.addField(new UInt16(data));

    // action
    let action: number = 0;
    if (object instanceof Widget.Widget) {
        if (object.action) {
            action = assets.getActionIndex(object, "action");
        }
    }
    result.addField(new UInt16(action));

    // x
    result.addField(new Int16(object.left || 0));

    // y
    result.addField(new Int16(object.top || 0));

    // width
    result.addField(new Int16(object.width || 0));

    // height
    result.addField(new Int16(object.height || 0));

    // style
    result.addField(new UInt16(assets.getStyleIndex(object, "style")));

    // specific
    let specific: Struct | undefined;

    if (type == WIDGET_TYPE_CONTAINER) {
        specific = new Struct();

        // widgets
        let widgets: Widget.Widget[] | undefined;
        if (object instanceof Page) {
            widgets = object.widgets;
        } else {
            widgets = (object as Widget.ContainerWidget).widgets;
        }

        let childWidgets = new ObjectList();
        if (widgets) {
            widgets.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget, assets));
            });
        }

        specific.addField(childWidgets);

        let overlay = 0;
        if (object instanceof Widget.ContainerWidget && object.overlay) {
            overlay = assets.getDataItemIndex(object, "overlay");
        }
        specific.addField(new UInt16(overlay));

        // flags
        let flags = 0;

        if (overlay && object instanceof Widget.ContainerWidget) {
            if (object.shadow) {
                flags |= 1;
            }
        }

        if (object instanceof Page) {
            if (object.closePageIfTouchedOutside) {
                flags |= 2;
            }
        }

        specific.addField(new UInt8(flags));
    } else if (type == WIDGET_TYPE_SELECT) {
        let widget = object as Widget.SelectWidget;
        specific = new Struct();

        // widgets
        let childWidgets = new ObjectList();
        if (widget.widgets) {
            widget.widgets.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget, assets));
            });
        }

        specific.addField(childWidgets);
    } else if (type == WIDGET_TYPE_LIST) {
        let widget = object as Widget.ListWidget;
        specific = new Struct();

        // listType
        specific.addField(
            new UInt8(widget.listType === "vertical" ? LIST_TYPE_VERTICAL : LIST_TYPE_HORIZONTAL)
        );

        // itemWidget
        let itemWidget: Struct | undefined;
        if (widget.itemWidget) {
            itemWidget = buildWidget(widget.itemWidget, assets);
        } else {
            itemWidget = undefined;
        }

        specific.addField(new ObjectPtr(itemWidget));

        // gap
        specific.addField(new UInt8(widget.gap || 0));
    } else if (type == WIDGET_TYPE_GRID) {
        let widget = object as Widget.GridWidget;
        specific = new Struct();

        // listType
        specific.addField(
            new UInt8(widget.gridFlow === "column" ? GRID_FLOW_COLUMN : GRID_FLOW_ROW)
        );

        // itemWidget
        let itemWidget: Struct | undefined;
        if (widget.itemWidget) {
            itemWidget = buildWidget(widget.itemWidget, assets);
        } else {
            itemWidget = undefined;
        }

        specific.addField(new ObjectPtr(itemWidget));
    } else if (type == WIDGET_TYPE_DISPLAY_DATA) {
        let widget = object as Widget.DisplayDataWidget;
        specific = new Struct();

        // displayOption
        specific.addField(new UInt8(widget.displayOption || 0));
    } else if (type == WIDGET_TYPE_TEXT) {
        let widget = object as Widget.TextWidget;
        specific = new Struct();

        // text
        let text: string;
        if (widget.text) {
            text = buildWidgetText(widget.text);
        } else {
            text = "";
        }

        specific.addField(new String(text));

        // flags
        let flags: number = 0;

        // ignoreLuminocity
        if (widget.ignoreLuminocity) {
            flags |= 1 << 0;
        }

        specific.addField(new UInt8(flags));
    } else if (type == WIDGET_TYPE_MULTILINE_TEXT) {
        let widget = object as Widget.MultilineTextWidget;
        specific = new Struct();

        // text
        let text: string;
        if (widget.text) {
            text = buildWidgetText(widget.text);
        } else {
            text = "";
        }

        specific.addField(new String(text));

        // first line
        specific.addField(new Int16(widget.firstLineIndent || 0));

        // hanging
        specific.addField(new Int16(widget.hangingIndent || 0));
    } else if (type == WIDGET_TYPE_RECTANGLE) {
        let widget = object as Widget.RectangleWidget;
        specific = new Struct();

        // flags
        let flags: number = 0;

        // invertColors
        if (widget.invertColors) {
            flags |= 1 << 0;
        }

        // ignoreLuminocity
        if (widget.ignoreLuminocity) {
            flags |= 1 << 1;
        }

        specific.addField(new UInt8(flags));
    } else if (type == WIDGET_TYPE_BUTTON_GROUP) {
        let widget = object as Widget.ButtonGroupWidget;
        specific = new Struct();

        // selectedStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "selectedStyle")));
    } else if (type == WIDGET_TYPE_BAR_GRAPH) {
        let widget = object as Widget.BarGraphWidget;
        specific = new Struct();

        // orientation
        let orientation: number;
        switch (widget.orientation) {
            case "left-right":
                orientation = BAR_GRAPH_ORIENTATION_LEFT_RIGHT;
                break;
            case "right-left":
                orientation = BAR_GRAPH_ORIENTATION_RIGHT_LEFT;
                break;
            case "top-bottom":
                orientation = BAR_GRAPH_ORIENTATION_TOP_BOTTOM;
                break;
            default:
                orientation = BAR_GRAPH_ORIENTATION_BOTTOM_TOP;
        }

        specific.addField(new UInt8(orientation));

        // textStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "textStyle")));

        // line1Data
        let line1Data = 0;
        if (widget.line1Data) {
            line1Data = assets.getDataItemIndex(widget, "line1Data");
        }

        specific.addField(new UInt16(line1Data));

        // line1Style
        specific.addField(new UInt16(assets.getStyleIndex(widget, "line1Style")));

        // line2Data
        let line2Data = 0;
        if (widget.line2Data) {
            line2Data = assets.getDataItemIndex(widget, "line2Data");
        }

        specific.addField(new UInt16(line2Data));

        // line2Style
        specific.addField(new UInt16(assets.getStyleIndex(widget, "line2Style")));
    } else if (type == WIDGET_TYPE_UP_DOWN) {
        let widget = object as Widget.UpDownWidget;
        specific = new Struct();

        // buttonStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "buttonsStyle")));

        // down button text
        let downButtonText: string;
        if (widget.downButtonText) {
            downButtonText = buildWidgetText(widget.downButtonText);
        } else {
            downButtonText = "<";
        }

        specific.addField(new String(downButtonText));
        // up button text
        let upButtonText: string;
        if (widget.upButtonText) {
            upButtonText = buildWidgetText(widget.upButtonText);
        } else {
            upButtonText = ">";
        }

        specific.addField(new String(upButtonText));
    } else if (type == WIDGET_TYPE_LIST_GRAPH) {
        let widget = object as Widget.ListGraphWidget;
        specific = new Struct();

        // dwellData
        let dwellData = 0;
        if (widget.dwellData) {
            dwellData = assets.getDataItemIndex(widget, "dwellData");
        }

        specific.addField(new UInt16(dwellData));

        // y1Data
        let y1Data = 0;
        if (widget.y1Data) {
            y1Data = assets.getDataItemIndex(widget, "y1Data");
        }

        specific.addField(new UInt16(y1Data));

        // y1Style
        specific.addField(new UInt16(assets.getStyleIndex(widget, "y1Style")));

        // y2Data
        let y2Data = 0;
        if (widget.y2Data) {
            y2Data = assets.getDataItemIndex(widget, "y2Data");
        }

        specific.addField(new UInt16(y2Data));

        // y2Style
        specific.addField(new UInt16(assets.getStyleIndex(widget, "y2Style")));

        // cursorData
        let cursorData = 0;
        if (widget.cursorData) {
            cursorData = assets.getDataItemIndex(widget, "cursorData");
        }

        specific.addField(new UInt16(cursorData));

        // cursorStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "cursorStyle")));
    } else if (type == WIDGET_TYPE_BUTTON) {
        let widget = object as Widget.ButtonWidget;
        specific = new Struct();

        // text
        let text: string;
        if (widget.text) {
            text = buildWidgetText(widget.text);
        } else {
            text = "";
        }

        specific.addField(new String(text));

        // enabled
        let enabledData = 0;
        if (widget.enabled) {
            enabledData = assets.getDataItemIndex(widget, "enabled");
        }

        specific.addField(new UInt16(enabledData));

        // disabledStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "disabledStyle")));
    } else if (type == WIDGET_TYPE_TOGGLE_BUTTON) {
        let widget = object as Widget.ToggleButtonWidget;
        specific = new Struct();

        // text 1
        let text1: string;
        if (widget.text1) {
            text1 = buildWidgetText(widget.text1);
        } else {
            text1 = "";
        }

        specific.addField(new String(text1));

        // text 2
        let text2: string;
        if (widget.text2) {
            text2 = buildWidgetText(widget.text2);
        } else {
            text2 = "";
        }

        specific.addField(new String(text2));
    } else if (type == WIDGET_TYPE_BITMAP) {
        let widget = object as Widget.BitmapWidget;
        specific = new Struct();

        // bitmap
        let bitmap: number = 0;
        if (widget.bitmap) {
            bitmap = assets.getBitmapIndex(widget, "bitmap");
        }

        specific.addField(new UInt8(bitmap));
    } else if (type == WIDGET_TYPE_LAYOUT_VIEW) {
        let widget = object as Widget.LayoutViewWidget;
        specific = new Struct();

        // layout
        let layout: number = 0;
        if (widget.layout) {
            layout = assets.getPageIndex(widget, "layout");
        }

        specific.addField(new Int16(layout));

        // context
        let context = 0;
        if (widget.context) {
            context = assets.getDataItemIndex(widget, "context");
        }
        specific.addField(new UInt16(context));
    } else if (type == WIDGET_TYPE_APP_VIEW) {
        // no specific fields
    } else if (type == WIDGET_TYPE_SCROLL_BAR) {
        let widget = object as Widget.ScrollBarWidget;
        specific = new Struct();

        // thumbStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "thumbStyle")));

        // buttonStyle
        specific.addField(new UInt16(assets.getStyleIndex(widget, "buttonsStyle")));

        // down button text
        let leftButtonText: string;
        if (widget.leftButtonText) {
            leftButtonText = buildWidgetText(widget.leftButtonText);
        } else {
            leftButtonText = "<";
        }
        specific.addField(new String(leftButtonText));

        // up button text
        let rightButtonText: string;
        if (widget.rightButtonText) {
            rightButtonText = buildWidgetText(widget.rightButtonText);
        } else {
            rightButtonText = ">";
        }
        specific.addField(new String(rightButtonText));
    } else if (type == WIDGET_TYPE_PROGRESS) {
    } else if (type == WIDGET_TYPE_CANVAS) {
    }

    result.addField(new ObjectPtr(specific));

    return result;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiPagesEnum(assets: Assets) {
    let pages = assets.pages.map(
        (widget, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "PAGE_ID_",
                widget,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    pages.unshift(`${projectBuild.TAB}PAGE_ID_NONE = 0`);

    return `enum PagesEnum {\n${pages.join(",\n")}\n};`;
}

function buildGuiDocumentData(assets: Assets, dataBuffer: DataBuffer | null) {
    return buildListData((document: Struct) => {
        let pages = new ObjectList();
        assets.pages.forEach(page => {
            pages.addItem(buildWidget(page, assets));
        });
        document.addField(pages);
    }, dataBuffer);
}

function buildGuiColors(assets: Assets, dataBuffer: DataBuffer) {
    function buildTheme(theme: Theme) {
        let result = new Struct();

        result.addField(new String(theme.name));

        // widgets
        let colors = new ObjectList();
        theme.colors.forEach(color => {
            colors.addItem(buildColor(color));
        });

        result.addField(colors);

        return result;
    }

    function buildColor(color: string) {
        return new Color(strToColor16(color));
    }

    return buildListData((document: Struct) => {
        let themes = new ObjectList();

        if (!ProjectStore.masterProject) {
            assets.rootProject.gui.themes.forEach(theme => {
                themes.addItem(buildTheme(theme));
            });
        }

        document.addField(themes);

        let colors = new ObjectList();

        if (!ProjectStore.masterProject) {
            assets.colors.forEach(color => {
                colors.addItem(buildColor(color));
            });
        }

        document.addField(colors);
    }, dataBuffer);
}

function buildActionNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let actionNames = new StringList();
        for (let i = 0; i < assets.actions.length; i++) {
            actionNames.addItem(new String(assets.actions[i].name));
        }
        document.addField(actionNames);
    }, dataBuffer);
}

function buildDataItemNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let dataItemNames = new StringList();
        for (let i = 0; i < assets.dataItems.length; i++) {
            dataItemNames.addItem(new String(assets.dataItems[i].name));
        }
        document.addField(dataItemNames);
    }, dataBuffer);
}

async function buildGuiAssetsData(assets: Assets) {
    const dataBuffer = new DataBuffer();

    await dataBuffer.packRegions(ProjectStore.masterProject ? 7 : 5, async i => {
        if (i == 0) {
            buildGuiDocumentData(assets, dataBuffer);
        } else if (i == 1) {
            buildGuiStylesData(assets, dataBuffer);
        } else if (i == 2) {
            await buildGuiFontsData(assets, dataBuffer);
        } else if (i == 3) {
            await buildGuiBitmapsData(assets, dataBuffer);
        } else if (i == 4) {
            buildGuiColors(assets, dataBuffer);
        } else if (i == 5) {
            buildActionNames(assets, dataBuffer);
        } else if (i == 6) {
            buildDataItemNames(assets, dataBuffer);
        }
    });

    var inputBuffer = Buffer.from(dataBuffer.buffer.slice(0, dataBuffer.offset));
    var outputBuffer = Buffer.alloc(LZ4.encodeBound(inputBuffer.length));
    var compressedSize = LZ4.encodeBlock(inputBuffer, outputBuffer);

    // console.log(assetRegions.map(x => x.length));
    // outputBuffer = inputBuffer;
    // compressedSize = outputBuffer.length;

    const compressedData = Buffer.alloc(4 + compressedSize);
    compressedData.writeUInt32LE(inputBuffer.length, 0); // write uncomprresed size at the beginning
    outputBuffer.copy(compressedData, 4, 0, compressedSize);

    OutputSectionsStore.write(
        output.Section.OUTPUT,
        output.Type.INFO,
        "Uncompressed size: " + inputBuffer.length
    );

    OutputSectionsStore.write(
        output.Section.OUTPUT,
        output.Type.INFO,
        "Compressed size: " + compressedSize
    );

    return [inputBuffer, compressedData];
}

function buildGuiAssetsDecl(data: Buffer) {
    return `extern const uint8_t assets[${data.length}];`;
}

function buildGuiAssetsDef(data: Buffer) {
    return `// ASSETS DEFINITION\nconst uint8_t assets[${data.length}] = {${projectBuild.dumpData(
        data
    )}};`;
}

////////////////////////////////////////////////////////////////////////////////

class Assets {
    projects: Project[];

    dataItems: DataItem[];
    actions: Action[];
    pages: Page[];
    styles: (Style | undefined)[];
    fonts: Font[] = [];
    bitmaps: Bitmap[] = [];
    colors: string[] = [];

    collectProjects(project: Project) {
        if (this.projects.indexOf(project) === -1) {
            this.projects.push(project);
            for (const importDirective of ProjectStore.project.settings.general.imports) {
                if (importDirective.project) {
                    this.collectProjects(importDirective.project);
                }
            }
        }
    }

    getAssets<T>(
        getCollection: (project: Project) => T[],
        assetIncludePredicate: (asset: T) => boolean
    ) {
        const assets = [];
        for (const project of this.projects) {
            assets.push(...getCollection(project).filter(assetIncludePredicate));
        }
        return assets;
    }

    constructor(public rootProject: Project, buildConfiguration: BuildConfiguration | undefined) {
        this.projects = [];
        this.collectProjects(rootProject);

        {
            const assetIncludePredicate = (asset: DataItem | Action | Page) =>
                !buildConfiguration ||
                !asset.usedIn ||
                asset.usedIn.indexOf(buildConfiguration.name) !== -1;

            this.dataItems = this.getAssets<DataItem>(
                project => project.data,
                assetIncludePredicate
            );

            this.actions = this.getAssets<Action>(
                project => project.actions,
                assetIncludePredicate
            );

            this.pages = this.getAssets<Page>(project => project.gui.pages, assetIncludePredicate);
        }

        this.styles = [undefined];
        if (!ProjectStore.masterProject) {
            this.getAssets<Style>(
                project => project.gui.styles,
                style => style.id != undefined
            ).forEach(style => this.addStyle(style));

            this.getAssets<Style>(
                project => project.gui.styles,
                style => style.alwaysBuild
            ).forEach(style => this.addStyle(style));
        }

        {
            const assetIncludePredicate = (asset: Font | Bitmap) => asset.alwaysBuild;

            this.fonts = this.getAssets<Font>(project => project.gui.fonts, assetIncludePredicate);

            this.bitmaps = this.getAssets<Bitmap>(
                project => project.gui.bitmaps,
                assetIncludePredicate
            );
        }

        buildGuiDocumentData(this, null);
        buildGuiStylesData(this, null);
    }

    static getAssetIndex<T>(
        object: any,
        propertyName: string,
        findAsset: (project: Project, assetName: string) => T | undefined,
        collection: T[]
    ) {
        const project = getRootObject(object) as Project;
        const assetName = object[propertyName];
        const asset = findAsset(project, assetName);

        if (asset) {
            let assetIndex = collection.indexOf(asset);
            if (assetIndex == -1) {
                collection.push(asset);
                assetIndex = collection.length - 1;
            }
            assetIndex++;
            return ProjectStore.masterProject ? -assetIndex : assetIndex;
        }

        const message = output.propertyNotFoundMessage(object, propertyName);
        OutputSectionsStore.write(
            output.Section.OUTPUT,
            message.type,
            message.text,
            message.object
        );

        return 0;
    }

    getDataItemIndex(object: any, propertyName: string) {
        return Assets.getAssetIndex(object, propertyName, findDataItem, this.dataItems);
    }

    getActionIndex(object: any, propertyName: string) {
        return Assets.getAssetIndex(object, propertyName, findAction, this.actions);
    }

    getPageIndex(object: any, propertyName: string) {
        return Assets.getAssetIndex(object, propertyName, findPage, this.pages);
    }

    addStyle(style: Style) {
        if (style.id != undefined) {
            this.styles[style.id] = style;
            return style.id;
        }

        for (let i = 1; i < this.styles.length; i++) {
            if (this.styles[i] == undefined) {
                this.styles[i] = style;
                return i;
            }
        }

        this.styles.push(style);
        return this.styles.length - 1;
    }

    doGetStyleIndex(project: Project, styleNameOrObject: string | Style): number {
        if (ProjectStore.masterProject) {
            if (typeof styleNameOrObject === "string") {
                const styleName = styleNameOrObject;
                const style = findStyle(project, styleName);
                if (style && style.id != undefined) {
                    return style.id;
                }
            } else {
                const style = styleNameOrObject;
                if (style.id != undefined) {
                    return style.id;
                }
                if (style.inheritFrom) {
                    return this.doGetStyleIndex(project, style.inheritFrom);
                }
            }
        } else {
            if (typeof styleNameOrObject === "string") {
                const styleName = styleNameOrObject;

                for (let i = 1; i < this.styles.length; i++) {
                    const style = this.styles[i];
                    if (style && style.name == styleName) {
                        return i;
                    }
                }

                const style = findStyle(project, styleName);
                if (style) {
                    if (style.id != undefined) {
                        return style.id;
                    }

                    return this.addStyle(style);
                }
            } else {
                const style = styleNameOrObject;

                if (style.inheritFrom) {
                    const parentStyle = findStyle(project, style.inheritFrom);
                    if (parentStyle) {
                        if (style.compareTo(parentStyle)) {
                            if (style.id != undefined) {
                                return style.id;
                            }
                            return this.doGetStyleIndex(project, parentStyle.name);
                        }
                    }
                }

                for (let i = 1; i < this.styles.length; i++) {
                    const s = this.styles[i];
                    if (s && style.compareTo(s)) {
                        return i;
                    }
                }

                return this.addStyle(style);
            }
        }

        return 0;
    }

    getStyleIndex(object: any, propertyName: string): number {
        const project = getRootObject(object) as Project;

        let style: string | Style | undefined = object[propertyName];
        if (style === undefined) {
            style = findStyle(project, "default");
            if (!style) {
                return 0;
            }
        }

        return this.doGetStyleIndex(project, style);
    }

    getFontIndex(object: any, propertyName: string) {
        return Assets.getAssetIndex(object, propertyName, findFont, this.fonts);
    }

    getBitmapIndex(object: any, propertyName: string) {
        return Assets.getAssetIndex(object, propertyName, findBitmap, this.bitmaps);
    }

    getColorIndex(
        style: Style,
        propertyName:
            | "color"
            | "backgroundColor"
            | "activeColor"
            | "activeBackgroundColor"
            | "focusColor"
            | "focusBackgroundColor"
            | "borderColor"
    ) {
        let color = getStyleProperty(style, propertyName, false);

        let colors = ProjectStore.project.gui.colors;

        for (let i = 0; i < colors.length; i++) {
            if (colors[i].name === color) {
                return i;
            }
        }

        for (let i = 0; i < this.colors.length; i++) {
            if (this.colors[i] == color) {
                return colors.length + i;
            }
        }

        this.colors.push(color);

        return colors.length + this.colors.length - 1;
    }

    reportUnusedAssets() {
        this.projects.forEach(project => {
            project.gui.styles.forEach(style => {
                if (
                    !this.styles.find(usedStyle => {
                        if (!usedStyle) {
                            return false;
                        }

                        if (usedStyle == style) {
                            return true;
                        }

                        let baseStyle = findStyle(ProjectStore.project, usedStyle.inheritFrom);
                        while (baseStyle) {
                            if (baseStyle == style) {
                                return true;
                            }
                            baseStyle = findStyle(ProjectStore.project, baseStyle.inheritFrom);
                        }

                        return false;
                    })
                ) {
                    OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused style: " + style.name,
                        style
                    );
                }
            });

            project.gui.fonts.forEach(font => {
                if (this.fonts.indexOf(font) === -1) {
                    OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused font: " + font.name,
                        font
                    );
                }
            });

            project.gui.bitmaps.forEach(bitmap => {
                if (this.bitmaps.indexOf(bitmap) === -1) {
                    OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused bitmap: " + bitmap.name,
                        bitmap
                    );
                }
            });
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

import { build as buildV1 } from "project-editor/features/gui/build-v1";

export async function build(
    project: Project,
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined
): Promise<BuildResult> {
    if (project.settings.general.projectVersion === "v1") {
        return buildV1(project, sectionNames, buildConfiguration);
    }

    const result: any = {};

    const assets = new Assets(project, buildConfiguration);

    assets.reportUnusedAssets();

    // build enum's
    if (!sectionNames || sectionNames.indexOf("GUI_PAGES_ENUM") !== -1) {
        result.GUI_PAGES_ENUM = buildGuiPagesEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_STYLES_ENUM") !== -1) {
        result.GUI_STYLES_ENUM = buildGuiStylesEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_FONTS_ENUM") !== -1) {
        result.GUI_FONTS_ENUM = buildGuiFontsEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_BITMAPS_ENUM") !== -1) {
        result.GUI_BITMAPS_ENUM = buildGuiBitmapsEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_THEMES_ENUM") !== -1) {
        result.GUI_THEMES_ENUM = buildGuiThemesEnum(assets);
    }

    if (!sectionNames || sectionNames.indexOf("GUI_COLORS_ENUM") !== -1) {
        result.GUI_COLORS_ENUM = buildGuiColorsEnum(assets);
    }

    const buildAssetsDecl = !sectionNames || sectionNames.indexOf("GUI_ASSETS_DECL") !== -1;
    const buildAssetsDeclCompressed =
        !sectionNames || sectionNames.indexOf("GUI_ASSETS_DECL_COMPRESSED") !== -1;
    const buildAssetsDef = !sectionNames || sectionNames.indexOf("GUI_ASSETS_DEF") !== -1;
    const buildAssetsDefCompressed =
        !sectionNames || sectionNames.indexOf("GUI_ASSETS_DEF_COMPRESSED") !== -1;
    const buildAssetsData = !sectionNames || sectionNames.indexOf("GUI_ASSETS_DATA") !== -1;
    if (
        buildAssetsDecl ||
        buildAssetsDeclCompressed ||
        buildAssetsDef ||
        buildAssetsDefCompressed ||
        buildAssetsData
    ) {
        // build all assets as single data chunk
        const [assetsData, compressedAssetsData] = await buildGuiAssetsData(assets);

        if (buildAssetsDecl) {
            result.GUI_ASSETS_DECL = buildGuiAssetsDecl(assetsData);
        }

        if (buildAssetsDeclCompressed) {
            result.GUI_ASSETS_DECL_COMPRESSED = buildGuiAssetsDecl(compressedAssetsData);
        }

        if (buildAssetsDef) {
            result.GUI_ASSETS_DEF = await buildGuiAssetsDef(assetsData);
        }

        if (buildAssetsDefCompressed) {
            result.GUI_ASSETS_DEF_COMPRESSED = await buildGuiAssetsDef(compressedAssetsData);
        }

        if (buildAssetsData) {
            result.GUI_ASSETS_DATA = compressedAssetsData;
        }
    }

    return result;
}

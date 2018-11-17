import {
    OutputSectionsStore,
    getParent,
    getProperty,
    ProjectStore
} from "project-editor/core/store";
import * as output from "project-editor/core/output";
import { BuildResult } from "project-editor/core/extensions";

import * as projectBuild from "project-editor/project/build";
import { ProjectProperties } from "project-editor/project/project";

import { DataItemProperties } from "project-editor/project/features/data/data";
import { ActionProperties } from "project-editor/project/features/action/action";

import {
    GuiProperties,
    findStyle,
    findFont,
    findBitmap
} from "project-editor/project/features/gui/gui";
import { getData as getFontData } from "project-editor/project/features/gui/font";
import {
    getData as getBitmapData,
    BitmapProperties
} from "project-editor/project/features/gui/bitmap";
import { StyleProperties } from "project-editor/project/features/gui/style";
import * as Widget from "project-editor/project/features/gui/widget";
import { PageProperties, PageResolutionProperties } from "project-editor/project/features/gui/page";
import { FontProperties } from "./fontMetaData";

////////////////////////////////////////////////////////////////////////////////

const STYLE_FLAGS_BORDER = 1 << 0;
const STYLE_FLAGS_HORZ_ALIGN_LEFT = 0 << 1;
const STYLE_FLAGS_HORZ_ALIGN_RIGHT = 1 << 1;
const STYLE_FLAGS_HORZ_ALIGN_CENTER = 2 << 1;
const STYLE_FLAGS_VERT_ALIGN_TOP = 0 << 3;
const STYLE_FLAGS_VERT_ALIGN_BOTTOM = 1 << 3;
const STYLE_FLAGS_VERT_ALIGN_CENTER = 2 << 3;
const STYLE_FLAGS_BLINK = 1 << 5;

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
const WIDGET_TYPE_SCALE = 13;
const WIDGET_TYPE_BAR_GRAPH = 14;
const WIDGET_TYPE_LAYOUT_VIEW = 15;
const WIDGET_TYPE_YT_GRAPH = 16;
const WIDGET_TYPE_UP_DOWN = 17;
const WIDGET_TYPE_LIST_GRAPH = 18;
const WIDGET_TYPE_APP_VIEW = 19;

const LIST_TYPE_VERTICAL = 1;
const LIST_TYPE_HORIZONTAL = 2;

const SCALE_NEEDLE_POSITION_LEFT = 1;
const SCALE_NEEDLE_POSITION_RIGHT = 2;
const SCALE_NEEDLE_POSITION_TOP = 3;
const SCALE_NEEDLE_POSITION_BOTTOM = 4;

const BAR_GRAPH_ORIENTATION_LEFT_RIGHT = 1;
const BAR_GRAPH_ORIENTATION_RIGHT_LEFT = 2;
const BAR_GRAPH_ORIENTATION_TOP_BOTTOM = 3;
const BAR_GRAPH_ORIENTATION_BOTTOM_TOP = 4;

////////////////////////////////////////////////////////////////////////////////

function packUInt16(value: number) {
    return [value & 0xff, value >> 8];
}

function packInt16(value: number) {
    if (value < 0) {
        value = 65535 + value + 1;
    }
    return [value & 0xff, value >> 8];
}

function packUInt32(value: number) {
    return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >> 24];
}

function addPadding(data: number[], length: number) {
    if (length === 2) {
        if (data.length % 2) {
            data.push(0);
        }
    } else if (length >= 4) {
        if (data.length % 4) {
            const n = 4 - (data.length % 4);
            for (let i = 0; i < n; ++i) {
                data.push(0);
            }
        }
    }
}

function packRegions(regions: number[][]) {
    let header: number[] = [];
    let data: number[] = [];

    const headerLength = 4 * regions.length;

    regions.forEach(region => {
        header = header.concat(packUInt32(headerLength + data.length));
        data = data.concat(region);
        addPadding(data, 4);
    });

    return header.concat(data);
}

abstract class Field {
    offset: number;
    size: number;

    enumObjects(objects: ObjectField[]) {}
    finish() {}
    abstract pack(): number[];
}

abstract class ObjectField extends Field {
    objectOffset: number;
    objectSize: number;

    abstract packObject(): number[];
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

    pack(): number[] {
        return packUInt32(this.objectOffset);
    }

    packObject(): number[] {
        let data: number[] = [];

        this.fields.forEach(
            field => {
                addPadding(data, field.size);
                data = data.concat(field.pack());
            },
            [] as number[]
        );

        addPadding(data, 4);

        return data;
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

    pack(): number[] {
        return packUInt32(this.value ? this.value.objectOffset : 0);
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

    pack(): number[] {
        return packUInt32(this.items.length).concat(
            packUInt32(this.items.length > 0 ? this.items[0].objectOffset : 0)
        );
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

    pack(): number[] {
        return packUInt32(this.objectOffset);
    }

    packObject(): number[] {
        let packedData: number[] = [];
        for (let i = 0; i < this.value.length; i++) {
            packedData.push(this.value.charCodeAt(i));
        }
        packedData.push(0);
        addPadding(packedData, 4);
        return packedData;
    }
}

class UInt8 extends Field {
    constructor(public value: number) {
        super();
        this.size = 1;
    }

    pack(): number[] {
        return [this.value];
    }
}

class UInt16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(): number[] {
        return packUInt16(this.value);
    }
}

class Int16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(): number[] {
        return packInt16(this.value);
    }
}

class UInt8Array extends Field {
    constructor(public value: number[]) {
        super();
        this.size = value.length;
        if (this.size % 4 > 0) {
            this.size += 4 - (this.size % 4);
        }
    }

    pack(): number[] {
        if (this.value.length % 4 === 0) {
            return this.value;
        } else {
            const result = this.value.slice();
            addPadding(result, 4);
            return result;
        }
    }
}

function pack(objects: ObjectField[] = []): number[] {
    return objects.reduce((data: any, object: any) => data.concat(object.packObject()), []);
}

////////////////////////////////////////////////////////////////////////////////

function buildWidgetText(text: string) {
    try {
        return JSON.parse('"' + text + '"');
    } catch (e) {}
    return text;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiFontsEnum(assets: Assets) {
    let fonts = assets.fonts.map(
        (font, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "FONT_ID_",
                font.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    // TODO what if font name is none!?
    fonts.unshift(`${projectBuild.TAB}FONT_ID_NONE = 0`);

    return `enum FontsEnum {\n${fonts.join(",\n")}\n};`;
}

function buildGuiFontsData(assets: Assets) {
    return packRegions(assets.fonts.map(font => getFontData(font)));
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiBitmapsEnum(assets: Assets) {
    let bitmaps = assets.bitmaps.map(
        (bitmap, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "BITMAP_ID_",
                bitmap.name,
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
        pixels: number[];
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

async function buildGuiBitmapsData(assets: Assets) {
    const bitmaps = await buildGuiBitmaps(assets);

    if (!bitmaps) {
        return [];
    }

    return packRegions(
        bitmaps.map(bitmap => {
            const struct = new Struct();

            struct.addField(new Int16(bitmap.width));
            struct.addField(new Int16(bitmap.height));
            struct.addField(new Int16(bitmap.bpp === 32 ? 32 : 16));
            struct.addField(new Int16(0));
            struct.addField(new UInt8Array(bitmap.pixels));

            return struct.packObject();
        })
    );
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiStylesEnum(assets: Assets) {
    let styles = assets.styles.map(
        (style, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "STYLE_ID_",
                style.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    styles.unshift(`${projectBuild.TAB}STYLE_ID_NONE = 0`);

    return `enum StylesEnum {\n${styles.join(",\n")}\n};`;
}

function buildGuiStylesData(assets: Assets) {
    function buildStyle(style: StyleProperties) {
        let result = new Struct();

        // flags
        let flags = 0;
        let styleBorderSize = style.borderSizeProperty;
        if (styleBorderSize == 1) {
            flags |= STYLE_FLAGS_BORDER;
        }

        let styleAlignHorizontal = style.alignHorizontalProperty;
        if (styleAlignHorizontal == "left") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_LEFT;
        } else if (styleAlignHorizontal == "right") {
            flags |= STYLE_FLAGS_HORZ_ALIGN_RIGHT;
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
        let backgroundColor16 = style.backgroundColor16;
        if (isNaN(backgroundColor16)) {
            backgroundColor16 = 0;
        }
        result.addField(new UInt16(backgroundColor16));
        colors.add(backgroundColor16);

        let color16 = style.color16;
        if (isNaN(color16)) {
            color16 = 0;
        }
        result.addField(new UInt16(color16));
        colors.add(color16);

        let borderColor16 = style.borderColor16;
        if (isNaN(borderColor16)) {
            borderColor16 = 0;
        }
        result.addField(new UInt16(borderColor16));
        colors.add(borderColor16);

        // font
        let fontIndex = style.fontName ? assets.getFontIndex(style.fontName) : 0;
        result.addField(new UInt8(fontIndex));

        // opacity
        result.addField(new UInt8(style.opacityProperty));

        // padding
        result.addField(new UInt8(style.paddingHorizontalProperty || 0));
        result.addField(new UInt8(style.paddingVerticalProperty || 0));

        return result;
    }

    function build() {
        let styles = new ObjectList();

        assets.styles.forEach(style => {
            styles.addItem(buildStyle(style));
        });

        document.addField(styles);
    }

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

    let colors = new Set<number>();

    let document = new Struct();
    build();
    let objects = finish();
    let data = pack(objects);
    return data;
}

////////////////////////////////////////////////////////////////////////////////

function buildWidget(object: Widget.WidgetProperties | PageResolutionProperties, assets: Assets) {
    let result = new Struct();

    // type
    let type: number;
    if (object instanceof PageResolutionProperties) {
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
        } else if (widget.type == "Scale") {
            type = WIDGET_TYPE_SCALE;
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
        } else {
            type = WIDGET_TYPE_NONE;
        }
    }
    result.addField(new UInt8(type));

    // data
    let data = 0;
    if (object instanceof Widget.WidgetProperties && object.data) {
        data = assets.getDataItemIndex(object, "data");
    }
    result.addField(new UInt16(data));

    // action
    let action: number = 0;
    if (object instanceof Widget.WidgetProperties) {
        if (object.action) {
            action = assets.getActionIndex(object, "action");
        }
    }
    result.addField(new UInt16(action));

    // x
    let x: number = 0;
    if (object instanceof Widget.WidgetProperties || object instanceof PageResolutionProperties) {
        x = object.x || 0;
    }
    result.addField(new Int16(x));

    // y
    let y: number = 0;
    if (object instanceof Widget.WidgetProperties || object instanceof PageResolutionProperties) {
        y = object.y || 0;
    }
    result.addField(new Int16(y));

    // width
    result.addField(new Int16(object.width || 0));

    // height
    result.addField(new Int16(object.height || 0));

    // style
    let style: number;
    if (object.style) {
        style = assets.getStyleIndex(object.style);
    } else {
        style = assets.getStyleIndex("default");
    }
    result.addField(new UInt16(style));

    // style
    let activeStyle: number;
    if (object instanceof Widget.WidgetProperties && object.activeStyle) {
        activeStyle = assets.getStyleIndex(object.activeStyle);
    } else {
        activeStyle = 0;
    }
    result.addField(new UInt16(activeStyle));

    // specific
    let specific: Struct | undefined;

    if (type == WIDGET_TYPE_CONTAINER) {
        specific = new Struct();

        let widgets: Widget.WidgetProperties[] | undefined;
        if (object instanceof PageResolutionProperties) {
            widgets = object.widgets._array;
        } else {
            widgets = (object as Widget.ContainerWidgetProperties).widgets._array;
        }

        // widgets
        let childWidgets = new ObjectList();
        if (widgets) {
            widgets.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget, assets));
            });
        }

        specific.addField(childWidgets);

        if (object instanceof PageResolutionProperties) {
            specific.addField(
                new UInt8((getParent(object) as PageProperties).closePageIfTouchedOutside ? 1 : 0)
            );
        }
    } else if (type == WIDGET_TYPE_SELECT) {
        let widget = object as Widget.SelectWidgetProperties;
        specific = new Struct();

        // widgets
        let childWidgets = new ObjectList();
        if (widget.widgets) {
            widget.widgets._array.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget, assets));
            });
        }

        specific.addField(childWidgets);
    } else if (type == WIDGET_TYPE_LIST) {
        let widget = object as Widget.ListWidgetProperties;
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
    } else if (type == WIDGET_TYPE_GRID) {
        let widget = object as Widget.GridWidgetProperties;
        specific = new Struct();

        // itemWidget
        let itemWidget: Struct | undefined;
        if (widget.itemWidget) {
            itemWidget = buildWidget(widget.itemWidget, assets);
        } else {
            itemWidget = undefined;
        }

        specific.addField(new ObjectPtr(itemWidget));
    } else if (type == WIDGET_TYPE_DISPLAY_DATA) {
        let widget = object as Widget.DisplayDataWidgetProperties;
        specific = new Struct();

        // focusStyle
        let focusStyle: number;
        if (widget.focusStyle) {
            focusStyle = assets.getStyleIndex(widget.focusStyle);
            if (focusStyle == 0) {
                focusStyle = style;
            }
        } else {
            focusStyle = style;
        }

        specific.addField(new UInt16(focusStyle));
    } else if (type == WIDGET_TYPE_TEXT) {
        let widget = object as Widget.TextWidgetProperties;
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
        let widget = object as Widget.MultilineTextWidgetProperties;
        specific = new Struct();

        // text
        let text: string;
        if (widget.text) {
            text = buildWidgetText(widget.text);
        } else {
            text = "";
        }

        specific.addField(new String(text));
    } else if (type == WIDGET_TYPE_RECTANGLE) {
        let widget = object as Widget.RectangleWidgetProperties;
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
    } else if (type == WIDGET_TYPE_SCALE) {
        let widget = object as Widget.ScaleWidgetProperties;
        specific = new Struct();

        // needlePosition
        let needlePosition: number;
        switch (widget.needlePosition) {
            case "left":
                needlePosition = SCALE_NEEDLE_POSITION_LEFT;
            case "right":
                needlePosition = SCALE_NEEDLE_POSITION_RIGHT;
            case "top":
                needlePosition = SCALE_NEEDLE_POSITION_TOP;
            default:
                needlePosition = SCALE_NEEDLE_POSITION_BOTTOM;
        }

        specific.addField(new UInt8(needlePosition));

        // needleWidth
        specific.addField(new UInt8(widget.needleWidth || 0));

        // needleHeight
        specific.addField(new UInt8(widget.needleHeight || 0));
    } else if (type == WIDGET_TYPE_BAR_GRAPH) {
        let widget = object as Widget.BarGraphWidgetProperties;
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
        let textStyle: number = 0;
        if (widget.textStyle) {
            textStyle = assets.getStyleIndex(widget.textStyle);
        }

        specific.addField(new UInt16(textStyle));

        // line1Data
        let line1Data = 0;
        if (widget.line1Data) {
            line1Data = assets.getDataItemIndex(widget, "line1Data");
        }

        specific.addField(new UInt16(line1Data));

        // line1Style
        let line1Style: number = 0;
        if (widget.line1Style) {
            line1Style = assets.getStyleIndex(widget.line1Style);
        }

        specific.addField(new UInt16(line1Style));

        // line2Data
        let line2Data = 0;
        if (widget.line2Data) {
            line2Data = assets.getDataItemIndex(widget, "line2Data");
        }

        specific.addField(new UInt16(line2Data));

        // line2Style
        let line2Style: number = 0;
        if (widget.line2Style) {
            line2Style = assets.getStyleIndex(widget.line2Style);
        }

        specific.addField(new UInt16(line2Style));
    } else if (type == WIDGET_TYPE_YT_GRAPH) {
        let widget = object as Widget.YTGraphWidgetProperties;
        specific = new Struct();

        // y1Style
        let y1Style: number = 0;
        if (widget.y1Style) {
            y1Style = assets.getStyleIndex(widget.y1Style);
        }

        specific.addField(new UInt16(y1Style));

        // data2
        let y2Data = 0;
        if (widget.y2Data) {
            y2Data = assets.getDataItemIndex(widget, "y2Data");
        }

        specific.addField(new UInt16(y2Data));

        // y2Style
        let y2Style: number = 0;
        if (widget.y2Style) {
            y2Style = assets.getStyleIndex(widget.y2Style);
        }

        specific.addField(new UInt16(y2Style));
    } else if (type == WIDGET_TYPE_UP_DOWN) {
        let widget = object as Widget.UpDownWidgetProperties;
        specific = new Struct();

        // buttonStyle
        let buttonsStyle: number = 0;
        if (widget.buttonsStyle) {
            buttonsStyle = assets.getStyleIndex(widget.buttonsStyle);
        }

        specific.addField(new UInt16(buttonsStyle));

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
        let widget = object as Widget.ListGraphWidgetProperties;
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
        let y1Style: number = 0;
        if (widget.y1Style) {
            y1Style = assets.getStyleIndex(widget.y1Style);
        }

        specific.addField(new UInt16(y1Style));

        // y2Data
        let y2Data = 0;
        if (widget.y2Data) {
            y2Data = assets.getDataItemIndex(widget, "y2Data");
        }

        specific.addField(new UInt16(y2Data));

        // y2Style
        let y2Style: number = 0;
        if (widget.y2Style) {
            y2Style = assets.getStyleIndex(widget.y2Style);
        }

        specific.addField(new UInt16(y2Style));

        // cursorData
        let cursorData = 0;
        if (widget.cursorData) {
            cursorData = assets.getDataItemIndex(widget, "cursorData");
        }

        specific.addField(new UInt16(cursorData));

        // cursorStyle
        let cursorStyle: number = 0;
        if (widget.cursorStyle) {
            cursorStyle = assets.getStyleIndex(widget.cursorStyle);
        }

        specific.addField(new UInt16(cursorStyle));
    } else if (type == WIDGET_TYPE_BUTTON) {
        let widget = object as Widget.ButtonWidgetProperties;
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
        let disabledStyle: number = 0;
        if (widget.disabledStyle) {
            disabledStyle = assets.getStyleIndex(widget.disabledStyle);
        }

        specific.addField(new UInt16(disabledStyle));
    } else if (type == WIDGET_TYPE_TOGGLE_BUTTON) {
        let widget = object as Widget.ToggleButtonWidgetProperties;
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
        let widget = object as Widget.BitmapWidgetProperties;
        specific = new Struct();

        // bitmap
        let bitmap: number = 0;
        if (widget.bitmap) {
            bitmap = assets.getBitmapIndex(widget.bitmap);
        }

        specific.addField(new UInt8(bitmap));
    } else if (type == WIDGET_TYPE_LAYOUT_VIEW) {
        let widget = object as Widget.LayoutViewWidgetProperties;
        specific = new Struct();

        // bitmap
        let layout: number = -1;
        if (widget.layout) {
            layout = assets.getPageIndex(widget.layout);
        }

        specific.addField(new Int16(layout));
    } else if (type == WIDGET_TYPE_APP_VIEW) {
        // no specific fields
    }

    result.addField(new ObjectPtr(specific));

    return result;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiPagesEnum(assets: Assets) {
    let pages = assets.pages
        .map(
            (widget, i) =>
                `${projectBuild.TAB}${projectBuild.getName(
                    "PAGE_ID_",
                    widget.name,
                    projectBuild.NamingConvention.UnderscoreUpperCase
                )} = ${i}`
        )
        .join(",\n");

    return `enum PagesEnum {\n${pages}\n};`;
}

function buildGuiDocumentData(assets: Assets) {
    function buildPage(page: PageResolutionProperties) {
        return buildWidget(page, assets);
    }

    function build() {
        let pages = new ObjectList();

        assets.pages.forEach(page => {
            pages.addItem(buildPage(page.resolutions._array[0]));
        });

        document.addField(pages);
    }

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
    build();
    let objects = finish();
    let data = pack(objects);

    return data;
}

async function buildGuiAssetsData(assets: Assets) {
    const inputArray = packRegions([
        buildGuiDocumentData(assets),
        buildGuiStylesData(assets),
        buildGuiFontsData(assets),
        await buildGuiBitmapsData(assets)
    ]);

    const LZ4 = require("lz4");
    var inputBuffer = Buffer.alloc(inputArray.length);
    for (let i = 0; i < inputArray.length; ++i) {
        inputBuffer[i] = inputArray[i];
    }

    var outputBuffer = Buffer.alloc(LZ4.encodeBound(inputBuffer.length));
    var compressedSize = LZ4.encodeBlock(inputBuffer, outputBuffer);

    const data = Buffer.alloc(4 + compressedSize);
    data.writeUInt32LE(inputBuffer.length, 0); // write uncomprresed size at the beginning
    outputBuffer.copy(data, 4, 0, compressedSize);

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

    return data;
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
    dataItems: DataItemProperties[];
    actions: ActionProperties[];

    pages: PageProperties[];
    styles: StyleProperties[] = [];
    fonts: FontProperties[] = [];
    bitmaps: BitmapProperties[] = [];

    constructor(public project: ProjectProperties) {
        this.dataItems = (project.data._array as DataItemProperties[]).filter(
            dataItem =>
                !ProjectStore.selectedBuildConfiguration ||
                !dataItem.usedIn ||
                dataItem.usedIn.indexOf(ProjectStore.selectedBuildConfiguration.name) !== -1
        );

        this.actions = (project.actions._array as ActionProperties[]).filter(
            action =>
                !ProjectStore.selectedBuildConfiguration ||
                !action.usedIn ||
                action.usedIn.indexOf(ProjectStore.selectedBuildConfiguration.name) !== -1
        );

        this.pages = (getProperty(project, "gui") as GuiProperties).pages._array.filter(
            page =>
                !ProjectStore.selectedBuildConfiguration ||
                !page.usedIn ||
                page.usedIn.indexOf(ProjectStore.selectedBuildConfiguration.name) !== -1
        );

        this.styles = (getProperty(project, "gui") as GuiProperties).styles._array.filter(
            style => style.alwaysBuild
        );

        this.fonts = (getProperty(project, "gui") as GuiProperties).fonts._array.filter(
            bitmap => bitmap.alwaysBuild
        );

        this.bitmaps = (getProperty(project, "gui") as GuiProperties).bitmaps._array.filter(
            font => font.alwaysBuild
        );

        while (true) {
            const n = this.totalGuiAssets;
            buildGuiDocumentData(this);
            buildGuiStylesData(this);
            if (n === this.totalGuiAssets) {
                break;
            }
        }
    }

    getDataItemIndex(object: any, propertyName: string) {
        const dataItemName = object[propertyName];

        for (let i = 0; i < this.dataItems.length; i++) {
            if (this.dataItems[i].name === dataItemName) {
                return Math.min(i + 1, 65535);
            }
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

    getActionIndex(object: any, propertyName: string) {
        const actionName = object[propertyName];
        for (let i = 0; i < this.actions.length; i++) {
            if (this.actions[i].name === actionName) {
                return Math.min(i + 1, 65535);
            }
        }

        output.propertyNotFoundMessage(object, propertyName);

        return 0;
    }

    get totalGuiAssets() {
        return this.pages.length + this.styles.length + this.fonts.length + this.bitmaps.length;
    }

    add(object: StyleProperties | FontProperties | BitmapProperties) {
        if (object instanceof StyleProperties && this.styles.indexOf(object) === -1) {
            this.styles.push(object);
        }

        if (object instanceof FontProperties && this.fonts.indexOf(object) === -1) {
            this.fonts.push(object);
        }

        if (object instanceof BitmapProperties && this.bitmaps.indexOf(object) === -1) {
            this.bitmaps.push(object);
        }
    }

    getPageIndex(pageName: string) {
        for (let i = 0; i < this.pages.length; i++) {
            if (this.pages[i].name == pageName) {
                return i;
            }
        }

        return -1;
    }

    getStyleIndex(styleName: string) {
        for (let i = 0; i < this.styles.length; i++) {
            if (this.styles[i].name == styleName) {
                return i + 1;
            }
        }

        const style = findStyle(styleName);
        if (style) {
            this.styles.push(style);
        }

        return 0;
    }

    getFontIndex(fontName: string) {
        for (let i = 0; i < this.fonts.length; i++) {
            if (this.fonts[i].name == fontName) {
                return i + 1;
            }
        }

        const font = findFont(fontName);
        if (font) {
            this.fonts.push(font);
        }

        return 0;
    }

    getBitmapIndex(bitmapName: string) {
        for (let i = 0; i < this.bitmaps.length; i++) {
            if (this.bitmaps[i].name == bitmapName) {
                return i + 1;
            }
        }

        const bitmap = findBitmap(bitmapName);
        if (bitmap) {
            this.bitmaps.push(bitmap);
        }

        return 0;
    }

    reportUnusedAssets() {
        let gui = getProperty(this.project, "gui") as GuiProperties;

        gui.pages._array.forEach(page => {
            if (this.pages.indexOf(page) === -1) {
                OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.INFO,
                    "Unused page: " + page.name,
                    page
                );
            }
        });

        gui.styles._array.forEach(style => {
            if (this.styles.indexOf(style) === -1) {
                OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.INFO,
                    "Unused style: " + style.name,
                    style
                );
            }
        });

        gui.fonts._array.forEach(font => {
            if (this.fonts.indexOf(font) === -1) {
                OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.INFO,
                    "Unused font: " + font.name,
                    font
                );
            }
        });

        gui.bitmaps._array.forEach(bitmap => {
            if (this.bitmaps.indexOf(bitmap) === -1) {
                OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.INFO,
                    "Unused bitmap: " + bitmap.name,
                    bitmap
                );
            }
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export async function build(
    project: ProjectProperties,
    sectionNames: string[] | undefined
): Promise<BuildResult> {
    const result: any = {};

    const assets = new Assets(project);

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

    const buildAssetsDecl = !sectionNames || sectionNames.indexOf("GUI_ASSETS_DECL") !== -1;
    const buildAssetsDef = !sectionNames || sectionNames.indexOf("GUI_ASSETS_DEF") !== -1;
    if (buildAssetsDecl || buildAssetsDef) {
        // build all assets as single data chunk
        const assetsData = await buildGuiAssetsData(assets);
        if (buildAssetsDecl) {
            result.GUI_ASSETS_DECL = buildGuiAssetsDecl(assetsData);
        }
        if (buildAssetsDef) {
            result.GUI_ASSETS_DEF = await buildGuiAssetsDef(assetsData);
        }
    }

    return result;
}

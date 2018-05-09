import { OutputSectionsStore } from "project-editor/core/store";
import * as output from "project-editor/core/output";
import { BuildResult } from "project-editor/core/extensions";

import * as projectBuild from "project-editor/project/build";
import { ProjectProperties } from "project-editor/project/project";

import { findDataItemIndex } from "project-editor/project/features/data/data";
import { findActionIndex } from "project-editor/project/features/action/action";

import {
    GuiProperties,
    findLocalWidgetTypeIndex,
    findBitmapIndex,
    findStyleIndex
} from "project-editor/project/features/gui/gui";
import { getData as getFontData } from "project-editor/project/features/gui/font";
import { getData as getBitmapData, BitmapData } from "project-editor/project/features/gui/bitmap";
import { StyleProperties } from "project-editor/project/features/gui/style";
import * as Widget from "project-editor/project/features/gui/widget";
import {
    PageProperties,
    PageOrientationProperties,
    findPageTransparentRectanglesInContainer
} from "project-editor/project/features/gui/page";
import { WidgetTypeProperties } from "project-editor/project/features/gui/widgetType";

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
const WIDGET_TYPE_SELECT = 3;
const WIDGET_TYPE_DISPLAY_DATA = 4;
const WIDGET_TYPE_TEXT = 5;
const WIDGET_TYPE_MULTILINE_TEXT = 6;
const WIDGET_TYPE_RECTANGLE = 7;
const WIDGET_TYPE_BITMAP = 8;
const WIDGET_TYPE_BUTTON = 9;
const WIDGET_TYPE_TOGGLE_BUTTON = 10;
const WIDGET_TYPE_BUTTON_GROUP = 11;
const WIDGET_TYPE_SCALE = 12;
const WIDGET_TYPE_BAR_GRAPH = 13;
const WIDGET_TYPE_CUSTOM = 14;
const WIDGET_TYPE_YT_GRAPH = 15;
const WIDGET_TYPE_UP_DOWN = 16;
const WIDGET_TYPE_LIST_GRAPH = 17;

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

function buildWidgetText(text: string) {
    try {
        return JSON.parse('"' + text + '"');
    } catch (e) {}
    return text;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiFontsEnum(project: ProjectProperties) {
    let gui = project["gui"] as GuiProperties;

    let fonts = gui.fonts.map(
        font =>
            `${projectBuild.TAB}${projectBuild.getName(
                "FONT_ID_",
                font.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )}`
    );

    // TODO what if font name is none!?
    fonts.unshift(`${projectBuild.TAB}FONT_ID_NONE`);

    return `enum FontsEnum {\n${fonts.join(",\n")}\n};`;
}

function buildGuiFontsDecl(project: ProjectProperties) {
    return `extern const uint8_t *fonts[];`;
}

function buildGuiFontsDef(project: ProjectProperties) {
    let gui = project["gui"] as GuiProperties;

    let fontItemDataList: string[] = [];
    let fontItemList: string[] = [];

    gui.fonts.forEach(font => {
        let fontItemDataName = projectBuild.getName(
            "font_data_",
            font.name,
            projectBuild.NamingConvention.UnderscoreLowerCase
        );

        let data = projectBuild.fixDataForMegaBootloader(getFontData(font), font);

        let fontItemData = `const uint8_t ${fontItemDataName}[${
            data.length
        }] = {${projectBuild.dumpData(data)}};`;
        if (font.screenOrientation != "all") {
            let orientation = font.screenOrientation.toUpperCase();
            fontItemData = `#if DISPLAY_ORIENTATION == DISPLAY_ORIENTATION_${orientation}\n${fontItemData}\n#endif`;
        }
        fontItemDataList.push(fontItemData);

        let fontItem = `${projectBuild.TAB}${fontItemDataName},`;
        if (font.screenOrientation != "all") {
            let orientation = font.screenOrientation.toUpperCase();
            fontItem = `#if DISPLAY_ORIENTATION == DISPLAY_ORIENTATION_${orientation}\n${fontItem}\n#else\n${
                projectBuild.TAB
            }0,\n#endif`;
        }
        fontItemList.push(fontItem);
    });

    return `// FONT DEFINITIONS\n\n${fontItemDataList.join(
        "\n\n"
    )}\n\nconst uint8_t *fonts[] = {\n${fontItemList.join("\n")}\n};`;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiBitmapsEnum(project: ProjectProperties) {
    let gui = project["gui"] as GuiProperties;

    let bitmaps = gui.bitmaps.map(
        bitmap =>
            `${projectBuild.TAB}${projectBuild.getName(
                "BITMAP_ID_",
                bitmap.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )}`
    );

    bitmaps.unshift(`${projectBuild.TAB}BITMAP_ID_NONE`);

    return `enum BitmapsEnum {\n${bitmaps.join(",\n")}\n};`;
}

function buildGuiBitmapsDecl(project: ProjectProperties) {
    return `struct Bitmap {
            uint16_t w;
            uint16_t h;
            const uint8_t *pixels;
        };

        extern Bitmap bitmaps[];`.replace(/\n        /g, "\n");
}

function buildGuiBitmapsDef(project: ProjectProperties) {
    return new Promise<string>((resolve, reject) => {
        let gui = project["gui"] as GuiProperties;

        let getBitmapDataPromises: Promise<BitmapData>[] = [];
        for (let i = 0; i < gui.bitmaps.length; ++i) {
            getBitmapDataPromises.push(getBitmapData(gui.bitmaps[i]));
        }

        Promise.all(getBitmapDataPromises).then(bitmapsData => {
            let bitmapsPixelData: string[] = [];
            let bitmapsArray: string[] = [];

            let bitmaps: {
                name: string;
                width: number;
                height: number;
                pixels: number[];
            }[] = [];
            for (let i = 0; i < gui.bitmaps.length; ++i) {
                bitmaps.push({
                    name: gui.bitmaps[i].name,
                    width: bitmapsData[i].width,
                    height: bitmapsData[i].height,
                    pixels: projectBuild.fixDataForMegaBootloader(
                        bitmapsData[i].pixels,
                        gui.bitmaps[i]
                    )
                });
            }

            bitmaps.forEach(bitmap => {
                let bitmapPixelDataName = projectBuild.getName(
                    "bitmap_pixel_data_",
                    bitmap.name,
                    projectBuild.NamingConvention.UnderscoreLowerCase
                );
                bitmapsPixelData.push(
                    `const uint8_t ${bitmapPixelDataName}[${
                        bitmap.pixels.length
                    }] = {${projectBuild.dumpData(bitmap.pixels)}};`
                );
                bitmapsArray.push(
                    `${projectBuild.TAB}{ ${bitmap.width}, ${
                        bitmap.height
                    }, ${bitmapPixelDataName} }`
                );
            });

            resolve(
                `// BITMAP DEFINITIONS\n\n${bitmapsPixelData.join(
                    "\n\n"
                )}\n\nBitmap bitmaps[] = {\n${bitmapsArray.join(",\n")}\n};`
            );
        });
    });
}

////////////////////////////////////////////////////////////////////////////////

function packUnsignedShort(value: number) {
    return [value & 0xff, value >> 8];
}

function packSignedShort(value: number) {
    if (value < 0) {
        value = 65535 + value + 1;
    }
    return [value & 0xff, value >> 8];
}

////////////////////////////////////////////////////////////////////////////////

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

    addField(field: Field) {
        this.fields.push(field);
    }

    enumObjects(objects: ObjectField[]) {
        this.fields.forEach(field => field.enumObjects(objects));
    }

    finish() {
        this.objectSize = this.fields.reduce((offset, field) => {
            field.offset = offset;
            return offset + field.size;
        }, 0);
    }

    pack(): number[] {
        return packUnsignedShort(this.objectOffset);
    }

    packObject(): number[] {
        return this.fields.reduce((data: any, field: any) => data.concat(field.pack()), []);
    }
}

class ObjectPtr extends Field {
    constructor(public value: ObjectField | undefined) {
        super();
        this.size = 2;
    }

    enumObjects(objects: ObjectField[]) {
        if (this.value) {
            objects.push(this.value);
        }
    }

    pack(): number[] {
        return packUnsignedShort(this.value ? this.value.objectOffset : 0);
    }
}

class ObjectList extends Field {
    items: ObjectField[] = [];

    constructor() {
        super();
        this.size = 3;
    }

    addItem(item: ObjectField) {
        this.items.push(item);
    }

    enumObjects(objects: ObjectField[]) {
        this.items.forEach(item => objects.push(item));
    }

    pack(): number[] {
        return [this.items.length].concat(
            packUnsignedShort(this.items.length > 0 ? this.items[0].objectOffset : 0)
        );
    }
}

class String extends ObjectField {
    constructor(public value: string) {
        super();
        this.size = 2;
        this.objectSize = this.value.length + 1;
    }

    enumObjects(objects: ObjectField[]) {
        objects.push(this);
    }

    pack(): number[] {
        return packUnsignedShort(this.objectOffset);
    }

    packObject(): number[] {
        let packedData: number[] = [];
        for (let i = 0; i < this.value.length; ++i) {
            packedData.push(this.value.charCodeAt(i));
        }
        packedData.push(0);
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
        return packUnsignedShort(this.value);
    }
}

class Int16 extends Field {
    constructor(public value: number) {
        super();
        this.size = 2;
    }

    pack(): number[] {
        return packSignedShort(this.value);
    }
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiStylesEnum(project: ProjectProperties) {
    let gui = project["gui"] as GuiProperties;

    let styles = gui.styles.map(
        style =>
            `${projectBuild.TAB}${projectBuild.getName(
                "STYLE_ID_",
                style.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )}`
    );

    styles.unshift(`${projectBuild.TAB}STYLE_ID_NONE`);

    return `enum StylesEnum {\n${styles.join(",\n")}\n};`;
}

function buildGuiStylesDecl(project: ProjectProperties) {
    return `extern const uint8_t styles[];`;
}

function buildGuiStylesDef(project: ProjectProperties) {
    function buildStyle(style: StyleProperties) {
        let result = new Struct();

        // font
        let fontIndex = style.fontIndex;
        if (fontIndex == -1) {
            fontIndex = 0;
        }
        result.addField(new UInt8(fontIndex + 1));

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

        // padding
        result.addField(new UInt8(style.paddingHorizontalProperty || 0));
        result.addField(new UInt8(style.paddingVerticalProperty || 0));

        return result;
    }

    function build() {
        let gui = project["gui"] as GuiProperties;

        let styles = new ObjectList();

        gui.styles.forEach(style => {
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

    function pack(objects: ObjectField[] = []): number[] {
        return objects.reduce((data: any, object: any) => data.concat(object.packObject()), []);
    }

    let colors = new Set<number>();

    let document = new Struct();
    build();
    let objects = finish();
    let data = pack(objects);

    let threeExclamationsDetected = false;
    for (let i = 2; i < data.length; ++i) {
        if (data[i - 2] == 33 && data[i - 1] == 33 && data[i] == 33) {
            threeExclamationsDetected = true;
        }
    }
    if (threeExclamationsDetected) {
        // OutputSectionsStore.write(output.Section.OUTPUT, output.Type.ERROR, `"!!!" detected in data, not possible to fix (Arduino Mega bootloader bug).`, project);
    }

    return `// STYLES DEFINITION\nconst uint8_t styles[${
        data.length
    }] = {${projectBuild.dumpData(data)}};`;
}

////////////////////////////////////////////////////////////////////////////////

function buildWidget(
    object: Widget.WidgetProperties | PageOrientationProperties | WidgetTypeProperties
) {
    let result = new Struct();

    // type
    let type: number;
    if (object instanceof PageOrientationProperties || object instanceof WidgetTypeProperties) {
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
        } else if (widget.type && widget.type.startsWith("Local.")) {
            type = WIDGET_TYPE_CUSTOM;
        } else {
            type = WIDGET_TYPE_NONE;
        }
    }
    result.addField(new UInt8(type));

    // data
    let data: number = 0;
    if (object instanceof Widget.WidgetProperties) {
        if (object.data) {
            data = findDataItemIndex(object.data);
            if (data != -1) {
                ++data;
                if (data > 255) {
                    data = 0;
                }
            }
        }
    }
    result.addField(new UInt8(data));

    // action
    let action: number = 0;
    if (object instanceof Widget.WidgetProperties) {
        if (object.action) {
            action = findActionIndex(object.action);
            if (action != -1) {
                ++action;
                if (action > 255) {
                    action = 0;
                }
            }
        }
    }
    result.addField(new UInt8(action));

    // x
    let x: number = 0;
    if (object instanceof Widget.WidgetProperties || object instanceof PageOrientationProperties) {
        x = object.x || 0;
    }
    result.addField(new Int16(x));

    // y
    let y: number = 0;
    if (object instanceof Widget.WidgetProperties || object instanceof PageOrientationProperties) {
        y = object.y || 0;
    }
    result.addField(new Int16(y));

    // width
    result.addField(new UInt16(object.width || 0));

    // height
    result.addField(new UInt16(object.height || 0));

    // style
    let style: number;
    if (object.style) {
        style = findStyleIndex(object.style);
    } else {
        style = findStyleIndex("default");
    }
    ++style;
    result.addField(new UInt8(style));

    // specific
    let specific: Struct | undefined;

    if (type == WIDGET_TYPE_CONTAINER) {
        specific = new Struct();

        let widgets: Widget.WidgetProperties[] | undefined;
        if (object instanceof PageOrientationProperties || object instanceof WidgetTypeProperties) {
            widgets = object.widgets;
        } else {
            widgets = (object as Widget.ContainerWidgetProperties).widgets;
        }

        // widgets
        let childWidgets = new ObjectList();
        if (widgets) {
            widgets.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget));
            });
        }

        specific.addField(childWidgets);

        if (object instanceof PageOrientationProperties) {
            let rects = findPageTransparentRectanglesInContainer(object);

            let rectObjectList = new ObjectList();

            for (let i = 0; i < rects.length; ++i) {
                var rect = rects[i];

                let rectStruct = new Struct();

                rectStruct.addField(new Int16(rect.x));
                rectStruct.addField(new Int16(rect.y));
                rectStruct.addField(new UInt16(rect.width));
                rectStruct.addField(new UInt16(rect.height));

                rectObjectList.addItem(rectStruct);
            }

            specific.addField(rectObjectList);

            specific.addField(
                new UInt8((object.getParent() as PageProperties).closePageIfTouchedOutside ? 1 : 0)
            );
        }
    } else if (type == WIDGET_TYPE_SELECT) {
        let widget = object as Widget.SelectWidgetProperties;
        specific = new Struct();

        // widgets
        let childWidgets = new ObjectList();
        if (widget.widgets) {
            widget.widgets.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget));
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
            itemWidget = buildWidget(widget.itemWidget);
        } else {
            OutputSectionsStore.write(
                output.Section.OUTPUT,
                output.Type.ERROR,
                "List item widget is missing",
                widget
            );
            itemWidget = undefined;
        }

        specific.addField(new ObjectPtr(itemWidget));
    } else if (type == WIDGET_TYPE_DISPLAY_DATA) {
        let widget = object as Widget.DisplayDataWidgetProperties;
        specific = new Struct();

        // activeStyle
        let activeStyle: number;
        if (widget.activeStyle) {
            activeStyle = findStyleIndex(widget.activeStyle) + 1;
            if (activeStyle == 0) {
                activeStyle = style;
            }
        } else {
            activeStyle = style;
        }

        specific.addField(new UInt8(activeStyle));
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
            textStyle = findStyleIndex(widget.textStyle) + 1;
        }

        specific.addField(new UInt8(textStyle));

        // line1Data
        let line1Data: number | undefined = 0;
        if (widget.line1Data) {
            line1Data = findDataItemIndex(widget.line1Data);
            if (line1Data != -1) {
                ++line1Data;
                if (line1Data > 255) {
                    line1Data = 255;
                }
            }
        }

        specific.addField(new UInt8(line1Data));

        // line1Style
        let line1Style: number = 0;
        if (widget.line1Style) {
            line1Style = findStyleIndex(widget.line1Style) + 1;
        }

        specific.addField(new UInt8(line1Style));

        // line2Data
        let line2Data: number | undefined = 0;
        if (widget.line2Data) {
            line2Data = findDataItemIndex(widget.line2Data);
            if (line2Data != -1) {
                ++line2Data;
                if (line2Data > 255) {
                    line2Data = 255;
                }
            }
        }

        specific.addField(new UInt8(line2Data));

        // line2Style
        let line2Style: number = 0;
        if (widget.line2Style) {
            line2Style = findStyleIndex(widget.line2Style) + 1;
        }

        specific.addField(new UInt8(line2Style));
    } else if (type == WIDGET_TYPE_YT_GRAPH) {
        let widget = object as Widget.YTGraphWidgetProperties;
        specific = new Struct();

        // y1Style
        let y1Style: number = 0;
        if (widget.y1Style) {
            y1Style = findStyleIndex(widget.y1Style) + 1;
        }

        specific.addField(new UInt8(y1Style));

        // data2
        let y2Data: number | undefined = 0;
        if (widget.y2Data) {
            y2Data = findDataItemIndex(widget.y2Data);
            if (y2Data != -1) {
                ++y2Data;
                if (y2Data > 255) {
                    y2Data = 255;
                }
            }
        }

        specific.addField(new UInt8(y2Data));

        // y2Style
        let y2Style: number = 0;
        if (widget.y2Style) {
            y2Style = findStyleIndex(widget.y2Style) + 1;
        }

        specific.addField(new UInt8(y2Style));
    } else if (type == WIDGET_TYPE_UP_DOWN) {
        let widget = object as Widget.UpDownWidgetProperties;
        specific = new Struct();

        // buttonStyle
        let buttonsStyle: number = 0;
        if (widget.buttonsStyle) {
            buttonsStyle = findStyleIndex(widget.buttonsStyle) + 1;
        }

        specific.addField(new UInt8(buttonsStyle));

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
        let dwellData: number | undefined = 0;
        if (widget.dwellData) {
            dwellData = findDataItemIndex(widget.dwellData);
            if (dwellData != -1) {
                ++dwellData;
                if (dwellData > 255) {
                    dwellData = 255;
                }
            }
        }

        specific.addField(new UInt8(dwellData));

        // y1Data
        let y1Data: number | undefined = 0;
        if (widget.y1Data) {
            y1Data = findDataItemIndex(widget.y1Data);
            if (y1Data != -1) {
                ++y1Data;
                if (y1Data > 255) {
                    y1Data = 255;
                }
            }
        }

        specific.addField(new UInt8(y1Data));

        // y1Style
        let y1Style: number = 0;
        if (widget.y1Style) {
            y1Style = findStyleIndex(widget.y1Style) + 1;
        }

        specific.addField(new UInt8(y1Style));

        // y2Data
        let y2Data: number | undefined = 0;
        if (widget.y2Data) {
            y2Data = findDataItemIndex(widget.y2Data);
            if (y2Data != -1) {
                ++y2Data;
                if (y2Data > 255) {
                    y2Data = 255;
                }
            }
        }

        specific.addField(new UInt8(y2Data));

        // y2Style
        let y2Style: number = 0;
        if (widget.y2Style) {
            y2Style = findStyleIndex(widget.y2Style) + 1;
        }

        specific.addField(new UInt8(y2Style));

        // cursorData
        let cursorData: number | undefined = 0;
        if (widget.cursorData) {
            cursorData = findDataItemIndex(widget.cursorData);
            if (cursorData != -1) {
                ++cursorData;
                if (cursorData > 255) {
                    cursorData = 255;
                }
            }
        }

        specific.addField(new UInt8(cursorData));

        // cursorStyle
        let cursorStyle: number = 0;
        if (widget.cursorStyle) {
            cursorStyle = findStyleIndex(widget.cursorStyle) + 1;
        }

        specific.addField(new UInt8(cursorStyle));
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
        let enabledData: number | undefined = 0;
        if (widget.enabled) {
            enabledData = findDataItemIndex(widget.enabled);
            if (enabledData != -1) {
                ++enabledData;
                if (enabledData > 255) {
                    enabledData = 255;
                }
            }
        }

        specific.addField(new UInt8(enabledData));

        // disabledStyle
        let disabledStyle: number = 0;
        if (widget.disabledStyle) {
            disabledStyle = findStyleIndex(widget.disabledStyle) + 1;
        }

        specific.addField(new UInt8(disabledStyle));
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
            bitmap = findBitmapIndex(widget.bitmap);
            if (bitmap != -1) {
                ++bitmap;
                if (bitmap > 255) {
                    bitmap = 0;
                }
            }
        }

        specific.addField(new UInt8(bitmap));
    } else if (type == WIDGET_TYPE_CUSTOM) {
        let widget = object as Widget.WidgetProperties;
        specific = new Struct();

        let customWidget = findLocalWidgetTypeIndex(widget.type.substring("Local.".length)) + 1;
        specific.addField(new UInt8(customWidget));
    }

    result.addField(new ObjectPtr(specific));

    return result;
}

////////////////////////////////////////////////////////////////////////////////

function buildGuiPagesEnum(project: ProjectProperties) {
    let gui = project["gui"] as GuiProperties;

    let pages = gui.pages
        .map(
            widget =>
                `${projectBuild.TAB}${projectBuild.getName(
                    "PAGE_ID_",
                    widget.name,
                    projectBuild.NamingConvention.UnderscoreUpperCase
                )}`
        )
        .join(",\n");

    return `enum PagesEnum {\n${pages}\n};`;
}

function buildGuiDocumentDecl(project: ProjectProperties) {
    return `extern const uint8_t document[];`;
}

function buildGuiDocumentDef(project: ProjectProperties, screenOrientation: string) {
    function buildCustomWidget(customWidget: WidgetTypeProperties) {
        var customWidgetStruct = new Struct();

        // widgets
        let childWidgets = new ObjectList();
        customWidget.widgets.forEach(childWidget => {
            childWidgets.addItem(buildWidget(childWidget));
        });

        customWidgetStruct.addField(childWidgets);

        return customWidgetStruct;
    }

    function buildPage(page: PageOrientationProperties) {
        return buildWidget(page);
    }

    function build() {
        let gui = project["gui"] as GuiProperties;

        let customWidgets = new ObjectList();
        gui.widgets.forEach(customWidget => {
            customWidgets.addItem(buildCustomWidget(customWidget));
        });
        document.addField(customWidgets);

        let pages = new ObjectList();
        gui.pages.forEach(page => {
            pages.addItem(buildPage(page[screenOrientation]));
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

    function pack(objects: ObjectField[] = []): number[] {
        return objects.reduce((data: any, object: any) => data.concat(object.packObject()), []);
    }

    let document = new Struct();
    build();
    let objects = finish();
    let data = pack(objects);

    let threeExclamationsDetected = false;
    for (let i = 2; i < data.length; ++i) {
        if (data[i - 2] == 33 && data[i - 1] == 33 && data[i] == 33) {
            threeExclamationsDetected = true;
        }
    }
    if (threeExclamationsDetected) {
        //OutputSectionsStore.write(output.Section.OUTPUT, output.Type.ERROR, `"!!!" detected in data, not possible to fix (Arduino Mega bootloader bug).`, project);
    }

    return `// DOCUMENT DEFINITION\nconst uint8_t document[${
        data.length
    }] = {${projectBuild.dumpData(data)}};`;
}

////////////////////////////////////////////////////////////////////////////////

export function build(project: ProjectProperties): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        buildGuiBitmapsDef(project).then(bitmapsDef => {
            resolve({
                GUI_FONTS_ENUM: buildGuiFontsEnum(project),
                GUI_BITMAPS_ENUM: buildGuiBitmapsEnum(project),
                GUI_STYLES_ENUM: buildGuiStylesEnum(project),
                GUI_PAGES_ENUM: buildGuiPagesEnum(project),
                GUI_FONTS_DECL: buildGuiFontsDecl(project),
                GUI_FONTS_DEF: buildGuiFontsDef(project),
                GUI_BITMAPS_DECL: buildGuiBitmapsDecl(project),
                GUI_BITMAPS_DEF: bitmapsDef,
                GUI_STYLES_DECL: buildGuiStylesDecl(project),
                GUI_STYLES_DEF: buildGuiStylesDef(project),
                GUI_DOCUMENT_DECL: buildGuiDocumentDecl(project),
                GUI_DOCUMENT_PORTRAIT_DEF: buildGuiDocumentDef(project, "portrait"),
                GUI_DOCUMENT_LANDSCAPE_DEF: buildGuiDocumentDef(project, "landscape")
            });
        });
    });
}

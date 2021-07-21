import { Page } from "project-editor/features/page/page";
import { Widget } from "project-editor/flow/component";
import {
    BarGraphWidget,
    BitmapWidget,
    ButtonWidget,
    ContainerWidget,
    DisplayDataWidget,
    LayoutViewWidget,
    ListGraphWidget,
    ListWidget,
    MultilineTextWidget,
    RectangleWidget,
    SelectWidget,
    TextWidget,
    ToggleButtonWidget,
    UpDownWidget,
    GridWidget,
    ButtonGroupWidget,
    ScrollBarWidget
} from "project-editor/flow/widgets";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";

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
const BAR_GRAPH_DO_NOT_DISPLAY_VALUE = 1 << 4;

function buildWidgetText(text: string | undefined, defaultValue: string = "") {
    if (!text) {
        return defaultValue;
    }
    try {
        return JSON.parse('"' + text + '"');
    } catch (e) {}

    return text;
}

export function buildWidget(
    object: Widget | Page,
    assets: Assets,
    dataBuffer: DataBuffer
) {
    // type
    let type: number;
    if (object instanceof Page) {
        type = WIDGET_TYPE_CONTAINER;
    } else {
        let widget = object;

        let widgetType = widget.type;
        if (widgetType.endsWith("Widget")) {
            widgetType = widgetType.substring(
                0,
                widgetType.length - "Widget".length
            );
        }

        if (widgetType == "Container") {
            type = WIDGET_TYPE_CONTAINER;
        } else if (widgetType == "List") {
            type = WIDGET_TYPE_LIST;
        } else if (widgetType == "Select") {
            type = WIDGET_TYPE_SELECT;
        } else if (widgetType == "DisplayData") {
            type = WIDGET_TYPE_DISPLAY_DATA;
        } else if (widgetType == "Text") {
            type = WIDGET_TYPE_TEXT;
        } else if (widgetType == "MultilineText") {
            type = WIDGET_TYPE_MULTILINE_TEXT;
        } else if (widgetType == "Rectangle") {
            type = WIDGET_TYPE_RECTANGLE;
        } else if (widgetType == "Bitmap") {
            type = WIDGET_TYPE_BITMAP;
        } else if (widgetType == "Button") {
            type = WIDGET_TYPE_BUTTON;
        } else if (widgetType == "ToggleButton") {
            type = WIDGET_TYPE_TOGGLE_BUTTON;
        } else if (widgetType == "ButtonGroup") {
            type = WIDGET_TYPE_BUTTON_GROUP;
        } else if (widgetType == "BarGraph") {
            type = WIDGET_TYPE_BAR_GRAPH;
        } else if (widgetType == "YTGraph") {
            type = WIDGET_TYPE_YT_GRAPH;
        } else if (widgetType == "UpDown") {
            type = WIDGET_TYPE_UP_DOWN;
        } else if (widgetType == "ListGraph") {
            type = WIDGET_TYPE_LIST_GRAPH;
        } else if (widgetType == "LayoutView") {
            type = WIDGET_TYPE_LAYOUT_VIEW;
        } else if (widgetType == "AppView") {
            type = WIDGET_TYPE_APP_VIEW;
        } else if (widgetType == "Grid") {
            type = WIDGET_TYPE_GRID;
        } else if (widgetType == "ScrollBar") {
            type = WIDGET_TYPE_SCROLL_BAR;
        } else if (widgetType == "Progress") {
            type = WIDGET_TYPE_PROGRESS;
        } else if (widgetType == "Canvas") {
            type = WIDGET_TYPE_CANVAS;
        } else {
            type = WIDGET_TYPE_NONE;
        }
    }
    dataBuffer.writeUint16(type);

    // data
    let data = 0;
    if (object instanceof Widget) {
        data = assets.getWidgetDataItemIndex(object, "data");
    }
    dataBuffer.writeInt16(data);

    // action
    let action: number = 0;
    if (object instanceof Widget) {
        action = assets.getWidgetActionIndex(object, "action");
    }
    dataBuffer.writeInt16(action);

    // x
    dataBuffer.writeInt16(object.left || 0);

    // y
    dataBuffer.writeInt16(object.top || 0);

    // width
    dataBuffer.writeInt16(object.width || 0);

    // height
    dataBuffer.writeInt16(object.height || 0);

    // style
    dataBuffer.writeUint16(assets.getStyleIndex(object, "style"));

    // specific
    if (type == WIDGET_TYPE_CONTAINER) {
        // widgets
        let widgets: Widget[] | undefined;
        if (object instanceof Page) {
            widgets = object.components.filter(
                widget => widget instanceof Widget
            ) as Widget[];
        } else {
            widgets = (object as ContainerWidget).widgets;
        }

        dataBuffer.writeArray(widgets, widget =>
            buildWidget(widget, assets, dataBuffer)
        );

        let overlay = 0;
        if (object instanceof ContainerWidget) {
            overlay = assets.getWidgetDataItemIndex(object, "overlay");
        }

        // flags
        let flags = 0;

        if (overlay && object instanceof ContainerWidget) {
            if (object.shadow) {
                flags |= 1;
            }
        }

        if (object instanceof Page) {
            if (object.closePageIfTouchedOutside) {
                flags |= 2;
            }
        }

        dataBuffer.writeUint16(flags);

        // overlay
        dataBuffer.writeInt16(overlay);
    } else if (type == WIDGET_TYPE_SELECT) {
        let widget = object as SelectWidget;

        // widgets
        dataBuffer.writeArray(widget.widgets, widget =>
            buildWidget(widget, assets, dataBuffer)
        );
    } else if (type == WIDGET_TYPE_LIST) {
        let widget = object as ListWidget;

        // itemWidget
        const itemWidget = widget.itemWidget;
        if (itemWidget) {
            dataBuffer.writeObjectOffset(() =>
                buildWidget(itemWidget, assets, dataBuffer)
            );
        } else {
            dataBuffer.writeUint32(0);
        }

        // listType
        dataBuffer.writeUint8(
            widget.listType === "vertical"
                ? LIST_TYPE_VERTICAL
                : LIST_TYPE_HORIZONTAL
        );

        // gap
        dataBuffer.writeUint8(widget.gap || 0);
    } else if (type == WIDGET_TYPE_GRID) {
        let widget = object as GridWidget;

        // itemWidget
        const itemWidget = widget.itemWidget;
        if (itemWidget) {
            dataBuffer.writeObjectOffset(() =>
                buildWidget(itemWidget, assets, dataBuffer)
            );
        } else {
            dataBuffer.writeUint32(0);
        }

        // gridFlow
        dataBuffer.writeUint8(
            widget.gridFlow === "column" ? GRID_FLOW_COLUMN : GRID_FLOW_ROW
        );
    } else if (type == WIDGET_TYPE_DISPLAY_DATA) {
        let widget = object as DisplayDataWidget;

        // displayOption
        dataBuffer.writeUint8(widget.displayOption || 0);
    } else if (type == WIDGET_TYPE_TEXT) {
        let widget = object as TextWidget;

        // text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.text))
        );

        // flags
        let flags: number = 0;

        // ignoreLuminocity
        if (widget.ignoreLuminocity) {
            flags |= 1 << 0;
        }

        dataBuffer.writeInt8(flags);
    } else if (type == WIDGET_TYPE_MULTILINE_TEXT) {
        let widget = object as MultilineTextWidget;

        // text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.text))
        );

        // first line
        dataBuffer.writeInt16(widget.firstLineIndent || 0);

        // hanging
        dataBuffer.writeInt16(widget.hangingIndent || 0);
    } else if (type == WIDGET_TYPE_RECTANGLE) {
        let widget = object as RectangleWidget;

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

        dataBuffer.writeUint8(flags);
    } else if (type == WIDGET_TYPE_BUTTON_GROUP) {
        let widget = object as ButtonGroupWidget;

        // selectedStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "selectedStyle"));
    } else if (type == WIDGET_TYPE_BAR_GRAPH) {
        let widget = object as BarGraphWidget;

        // textStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "textStyle"));

        // line1Data
        let line1Data = assets.getWidgetDataItemIndex(widget, "line1Data");

        dataBuffer.writeInt16(line1Data);

        // line1Style
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "line1Style"));

        // line2Data
        let line2Data = assets.getWidgetDataItemIndex(widget, "line2Data");

        dataBuffer.writeInt16(line2Data);

        // line2Style
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "line2Style"));

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

        if (!widget.displayValue) {
            orientation |= BAR_GRAPH_DO_NOT_DISPLAY_VALUE;
        }

        dataBuffer.writeUint8(orientation);
    } else if (type == WIDGET_TYPE_UP_DOWN) {
        let widget = object as UpDownWidget;

        // down button text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.downButtonText, "<"))
        );

        // up button text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.upButtonText, ">"))
        );

        // buttonStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "buttonsStyle"));
    } else if (type == WIDGET_TYPE_LIST_GRAPH) {
        let widget = object as ListGraphWidget;

        // dwellData
        dataBuffer.writeInt16(
            assets.getWidgetDataItemIndex(widget, "dwellData")
        );
        // y1Data
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(widget, "y1Data"));
        // y1Style
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "y1Style"));
        // y2Data
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(widget, "y2Data"));
        // y2Style
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "y2Style"));
        // cursorData
        dataBuffer.writeInt16(
            assets.getWidgetDataItemIndex(widget, "cursorData")
        );
        // cursorStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "cursorStyle"));
    } else if (type == WIDGET_TYPE_BUTTON) {
        let widget = object as ButtonWidget;

        // text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.text))
        );

        // enabled
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(widget, "enabled"));

        // disabledStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "disabledStyle"));
    } else if (type == WIDGET_TYPE_TOGGLE_BUTTON) {
        let widget = object as ToggleButtonWidget;

        // text 1
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.text1))
        );

        // text 2
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.text2))
        );
    } else if (type == WIDGET_TYPE_BITMAP) {
        let widget = object as BitmapWidget;

        // bitmap
        let bitmap: number = 0;
        if (widget.bitmap) {
            bitmap = assets.getBitmapIndex(widget, "bitmap");
        }

        dataBuffer.writeInt16(bitmap);
    } else if (type == WIDGET_TYPE_LAYOUT_VIEW) {
        let widget = object as LayoutViewWidget;

        // layout
        let layout: number = 0;
        if (widget.layout) {
            layout = assets.getPageIndex(widget, "layout");
        }
        dataBuffer.writeInt16(layout);

        // context
        dataBuffer.writeInt16(assets.getWidgetDataItemIndex(widget, "context"));
    } else if (type == WIDGET_TYPE_APP_VIEW) {
        // no specific fields
    } else if (type == WIDGET_TYPE_SCROLL_BAR) {
        let widget = object as ScrollBarWidget;

        // thumbStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "thumbStyle"));

        // buttonStyle
        dataBuffer.writeUint16(assets.getStyleIndex(widget, "buttonsStyle"));

        // down button text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.leftButtonText, "<"))
        );

        // up button text
        dataBuffer.writeObjectOffset(() =>
            dataBuffer.writeString(buildWidgetText(widget.rightButtonText, ">"))
        );
    } else if (type == WIDGET_TYPE_PROGRESS) {
    } else if (type == WIDGET_TYPE_CANVAS) {
    }
}

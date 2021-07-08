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
import { Assets } from "project-editor/features/page/build/assets";
import {
    Struct,
    Int16,
    UInt16,
    UInt8,
    ObjectList,
    ObjectPtr,
    String
} from "project-editor/features/page/build/pack";

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

function buildWidgetText(text: string) {
    try {
        return JSON.parse('"' + text + '"');
    } catch (e) {}
    return text;
}

export function buildWidget(object: Widget | Page, assets: Assets) {
    let result = new Struct();

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
    result.addField(new UInt8(type));

    // data
    let data = 0;
    if (object instanceof Widget && object.data) {
        data = assets.getDataItemIndex(object, "data");
    }
    result.addField(new UInt16(data));

    // action
    let action: number = 0;
    if (object instanceof Widget) {
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
        let widgets: Widget[] | undefined;
        if (object instanceof Page) {
            widgets = object.components.filter(
                widget => widget instanceof Widget
            ) as Widget[];
        } else {
            widgets = (object as ContainerWidget).widgets;
        }

        let childWidgets = new ObjectList();
        if (widgets) {
            widgets.forEach(childWidget => {
                childWidgets.addItem(buildWidget(childWidget, assets));
            });
        }

        specific.addField(childWidgets);

        let overlay = 0;
        if (object instanceof ContainerWidget && object.overlay) {
            overlay = assets.getDataItemIndex(object, "overlay");
        }
        specific.addField(new UInt16(overlay));

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

        specific.addField(new UInt8(flags));
    } else if (type == WIDGET_TYPE_SELECT) {
        let widget = object as SelectWidget;
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
        let widget = object as ListWidget;
        specific = new Struct();

        // listType
        specific.addField(
            new UInt8(
                widget.listType === "vertical"
                    ? LIST_TYPE_VERTICAL
                    : LIST_TYPE_HORIZONTAL
            )
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
        let widget = object as GridWidget;
        specific = new Struct();

        // listType
        specific.addField(
            new UInt8(
                widget.gridFlow === "column" ? GRID_FLOW_COLUMN : GRID_FLOW_ROW
            )
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
        let widget = object as DisplayDataWidget;
        specific = new Struct();

        // displayOption
        specific.addField(new UInt8(widget.displayOption || 0));
    } else if (type == WIDGET_TYPE_TEXT) {
        let widget = object as TextWidget;
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
        let widget = object as MultilineTextWidget;
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
        let widget = object as RectangleWidget;
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
        let widget = object as ButtonGroupWidget;
        specific = new Struct();

        // selectedStyle
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "selectedStyle"))
        );
    } else if (type == WIDGET_TYPE_BAR_GRAPH) {
        let widget = object as BarGraphWidget;
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

        if (!widget.displayValue) {
            orientation |= BAR_GRAPH_DO_NOT_DISPLAY_VALUE;
        }

        specific.addField(new UInt8(orientation));

        // textStyle
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "textStyle"))
        );

        // line1Data
        let line1Data = 0;
        if (widget.line1Data) {
            line1Data = assets.getDataItemIndex(widget, "line1Data");
        }

        specific.addField(new UInt16(line1Data));

        // line1Style
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "line1Style"))
        );

        // line2Data
        let line2Data = 0;
        if (widget.line2Data) {
            line2Data = assets.getDataItemIndex(widget, "line2Data");
        }

        specific.addField(new UInt16(line2Data));

        // line2Style
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "line2Style"))
        );
    } else if (type == WIDGET_TYPE_UP_DOWN) {
        let widget = object as UpDownWidget;
        specific = new Struct();

        // buttonStyle
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "buttonsStyle"))
        );

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
        let widget = object as ListGraphWidget;
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
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "cursorStyle"))
        );
    } else if (type == WIDGET_TYPE_BUTTON) {
        let widget = object as ButtonWidget;
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
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "disabledStyle"))
        );
    } else if (type == WIDGET_TYPE_TOGGLE_BUTTON) {
        let widget = object as ToggleButtonWidget;
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
        let widget = object as BitmapWidget;
        specific = new Struct();

        // bitmap
        let bitmap: number = 0;
        if (widget.bitmap) {
            bitmap = assets.getBitmapIndex(widget, "bitmap");
        }

        specific.addField(new UInt8(bitmap));
    } else if (type == WIDGET_TYPE_LAYOUT_VIEW) {
        let widget = object as LayoutViewWidget;
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
        let widget = object as ScrollBarWidget;
        specific = new Struct();

        // thumbStyle
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "thumbStyle"))
        );

        // buttonStyle
        specific.addField(
            new UInt16(assets.getStyleIndex(widget, "buttonsStyle"))
        );

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

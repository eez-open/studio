import { observable } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";
import { Rect } from "eez-studio-shared/geometry";

import {
    EezObject,
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    getChildOfObject,
    hidePropertiesInPropertyGrid,
    IPropertyGridGroupDefinition
} from "eez-studio-shared/model/object";
import * as output from "eez-studio-shared/model/output";

import {
    Widget,
    ContainerWidget,
    makeDataPropertyInfo,
    makeStylePropertyInfo,
    SelectWidget as BaseSelectWidget,
    LayoutViewWidget
} from "eez-studio-page-editor/widget";
import { Style } from "eez-studio-page-editor/style";
import { getPageContext, IDataContext } from "eez-studio-page-editor/page-context";

import * as data from "project-editor/project/features/data/data";

import { findBitmap } from "project-editor/project/features/gui/gui";
import * as draw from "project-editor/project/features/gui/draw";

////////////////////////////////////////////////////////////////////////////////

export {
    Widget,
    getWidgetType,
    ContainerWidget,
    SelectWidget,
    ListWidget,
    GridWidget,
    LayoutViewWidget
} from "eez-studio-page-editor/widget";

////////////////////////////////////////////////////////////////////////////////

hidePropertiesInPropertyGrid(Widget, [
    "display",
    "position",
    "right",
    "bottom",
    "resizing",
    "css",
    "className",
    "unsetAllResolutionDependablePropertiesForLowerResolutions"
]);
hidePropertiesInPropertyGrid(LayoutViewWidget, ["dataContext"]);
hidePropertiesInPropertyGrid(ContainerWidget, ["scrollable", "data", "action"]);

////////////////////////////////////////////////////////////////////////////////

class SelectWidget extends BaseSelectWidget {
    static classInfo = makeDerivedClassInfo(BaseSelectWidget.classInfo, {});
}

registerClass(SelectWidget);

////////////////////////////////////////////////////////////////////////////////

export class DisplayDataWidget extends Widget {
    @observable focusStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [makeStylePropertyInfo("focusStyle")],

        beforeLoadHook: (object: EezObject, jsObject: any) => {
            if (typeof jsObject["focusStyle"] === "string") {
                jsObject["focusStyle"] = {
                    inheritFrom: jsObject["focusStyle"]
                };
            }
        },

        defaultValue: {
            type: "DisplayData",
            data: "data",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/Data.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawDisplayDataWidget(this, rect);
    }
}

registerClass(DisplayDataWidget);

////////////////////////////////////////////////////////////////////////////////

const textPropertiesGroup: IPropertyGridGroupDefinition = {
    id: "text",
    title: "Text properties"
};

export class TextWidget extends Widget {
    @observable
    text?: string;
    @observable
    ignoreLuminocity: boolean;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        label: (widget: TextWidget) => {
            if (widget.text) {
                return `${humanize(widget.type)}: ${widget.text}`;
            }

            if (widget.data) {
                return `${humanize(widget.type)}: ${widget.data}`;
            }

            return humanize(widget.type);
        },

        properties: [
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: textPropertiesGroup
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                defaultValue: false,
                propertyGridGroup: textPropertiesGroup
            }
        ],

        defaultValue: {
            type: "Text",
            text: "Text",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/Text.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.text && !this.data) {
            messages.push(output.propertyNotSetMessage(this, "text"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawTextWidget(this, rect);
    }
}

registerClass(TextWidget);

////////////////////////////////////////////////////////////////////////////////

const multilineTextPropertiesGroup: IPropertyGridGroupDefinition = {
    id: "multilineText",
    title: "Multiline text properties"
};

export class MultilineTextWidget extends Widget {
    @observable
    text?: string;

    get label() {
        return this.text ? `${this.type}: "${this.text}"` : this.type;
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: multilineTextPropertiesGroup
            }
        ],

        defaultValue: {
            type: "MultilineText",
            text: "Multiline text",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/MultilineText.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.text && !this.data) {
            messages.push(output.propertyNotSetMessage(this, "text"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawMultilineTextWidget(this, rect);
    }
}

registerClass(MultilineTextWidget);

////////////////////////////////////////////////////////////////////////////////

const rectanglePropertiesGroup: IPropertyGridGroupDefinition = {
    id: "multilineText",
    title: "Rectangle properties"
};

export class RectangleWidget extends Widget {
    @observable
    ignoreLuminocity: boolean;
    @observable
    invertColors: boolean;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "invertColors",
                type: PropertyType.Boolean,
                propertyGridGroup: rectanglePropertiesGroup,
                defaultValue: false
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                propertyGridGroup: rectanglePropertiesGroup,
                defaultValue: false
            }
        ],

        defaultValue: {
            type: "Rectangle",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/Rectangle.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (this.data) {
            messages.push(output.propertySetButNotUsedMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawRectangleWidget(this, rect);
    }
}

registerClass(RectangleWidget);

////////////////////////////////////////////////////////////////////////////////

const bitmapPropertiesGroup: IPropertyGridGroupDefinition = {
    id: "bitmap",
    title: "Bitmap properties"
};

export class BitmapWidget extends Widget {
    @observable
    bitmap?: string;

    get label() {
        return this.bitmap ? `${this.type}: ${this.bitmap}` : this.type;
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "bitmap",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "bitmaps"],
                propertyGridGroup: bitmapPropertiesGroup
            }
        ],

        defaultValue: { type: "Bitmap", left: 0, top: 0, width: 64, height: 32 },

        icon: "_images/widgets/Bitmap.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data && !this.bitmap) {
            messages.push(
                new output.Message(output.Type.ERROR, "Either bitmap or data must be set", this)
            );
        } else {
            if (this.data && this.bitmap) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Both bitmap and data set, only bitmap is used",
                        this
                    )
                );
            }

            if (this.bitmap) {
                let bitmap = findBitmap(this.bitmap);
                if (!bitmap) {
                    messages.push(output.propertyNotFoundMessage(this, "bitmap"));
                }
            }
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawBitmapWidget(this, rect);
    }
}

registerClass(BitmapWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonWidget extends Widget {
    @observable
    text?: string;
    @observable
    enabled?: string;
    @observable
    disabledStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text",
                type: PropertyType.String
            },
            makeDataPropertyInfo("enabled"),
            makeStylePropertyInfo("disabledStyle")
        ],

        beforeLoadHook: (object: EezObject, jsObject: any) => {
            if (typeof jsObject["disabledStyle"] === "string") {
                jsObject["disabledStyle"] = {
                    inheritFrom: jsObject["disabledStyle"]
                };
            }
        },

        defaultValue: { type: "Button", left: 0, top: 0, width: 32, height: 32 },

        icon: "_images/widgets/Button.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.text && !this.data) {
            messages.push(output.propertyNotSetMessage(this, "text"));
        }

        if (this.enabled) {
            let dataIndex = data.findDataItemIndex(this.enabled);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "enabled"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Enabled ignored",
                        getChildOfObject(this, "enabled")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "enabled"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawButtonWidget(this, rect);
    }
}

registerClass(ButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ToggleButtonWidget extends Widget {
    @observable
    text1?: string;
    @observable
    text2?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text1",
                type: PropertyType.String
            },
            {
                name: "text2",
                type: PropertyType.String
            }
        ],

        defaultValue: {
            type: "ToggleButton",
            left: 0,
            top: 0,
            width: 32,
            height: 32
        },

        icon: "_images/widgets/ToggleButton.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (!this.text1) {
            messages.push(output.propertyNotSetMessage(this, "text1"));
        }

        if (!this.text2) {
            messages.push(output.propertyNotSetMessage(this, "text2"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawToggleButtonWidget(this, rect);
    }
}

registerClass(ToggleButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonGroupWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: {
            type: "ButtonGroup",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/ButtonGroup.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawButtonGroupWidget(this, rect);
    }
}

registerClass(ButtonGroupWidget);

////////////////////////////////////////////////////////////////////////////////

export class ScaleWidget extends Widget {
    @observable
    needlePosition: string;
    @observable
    needleWidth: number;
    @observable
    needleHeight: number;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "needlePosition",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "left"
                    },
                    {
                        id: "right"
                    },
                    {
                        id: "top"
                    },
                    {
                        id: "bottom"
                    }
                ]
            },
            {
                name: "needleWidth",
                type: PropertyType.Number
            },
            {
                name: "needleHeight",
                type: PropertyType.Number
            }
        ],

        defaultValue: {
            type: "Scale",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            needlePostion: "right",
            needleWidth: 19,
            needleHeight: 11
        },

        icon: "_images/widgets/Scale.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawScaleWidget(this, rect);
    }
}

registerClass(ScaleWidget);

////////////////////////////////////////////////////////////////////////////////

export class BarGraphWidget extends Widget {
    @observable orientation?: string;
    @observable textStyle: Style;
    @observable line1Data?: string;
    @observable line1Style: Style;
    @observable line2Data?: string;
    @observable line2Style: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "orientation",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: "left-right"
                    },
                    {
                        id: "right-left"
                    },
                    {
                        id: "top-bottom"
                    },
                    {
                        id: "bottom-top"
                    }
                ]
            },
            makeStylePropertyInfo("textStyle"),
            makeStylePropertyInfo("line1Style"),
            makeStylePropertyInfo("line2Style"),
            makeDataPropertyInfo("line1Data"),
            makeDataPropertyInfo("line2Data")
        ],

        beforeLoadHook: (object: EezObject, jsObject: any) => {
            if (typeof jsObject["textStyle"] === "string") {
                jsObject["textStyle"] = {
                    inheritFrom: jsObject["textStyle"]
                };
            }

            if (typeof jsObject["line1Style"] === "string") {
                jsObject["line1Style"] = {
                    inheritFrom: jsObject["line1Style"]
                };
            }

            if (typeof jsObject["line2Style"] === "string") {
                jsObject["line2Style"] = {
                    inheritFrom: jsObject["line2Style"]
                };
            }
        },

        defaultValue: {
            type: "BarGraph",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            orientation: "left-right"
        },

        icon: "_images/widgets/BarGraph.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.line1Data) {
            let dataIndex = data.findDataItemIndex(this.line1Data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "line1Data"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Line 1 data ignored",
                        getChildOfObject(this, "line1Data")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "line1Data"));
        }

        if (this.line2Data) {
            let dataIndex = data.findDataItemIndex(this.line2Data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "line2Data"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Line 1 data ignored",
                        getChildOfObject(this, "line2Data")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "line2Data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawBarGraphWidget(this, rect);
    }
}

registerClass(BarGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class YTGraphWidget extends Widget {
    @observable y1Style: Style;
    @observable y2Data?: string;
    @observable y2Style: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeStylePropertyInfo("y1Style"),
            makeStylePropertyInfo("y2Style"),
            makeDataPropertyInfo("y2Data")
        ],

        beforeLoadHook: (object: EezObject, jsObject: any) => {
            if (typeof jsObject["y1Style"] === "string") {
                jsObject["y1Style"] = {
                    inheritFrom: jsObject["y1Style"]
                };
            }

            if (typeof jsObject["y2Style"] === "string") {
                jsObject["y2Style"] = {
                    inheritFrom: jsObject["y2Style"]
                };
            }
        },

        defaultValue: {
            type: "YTGraph",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/YTGraph.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.y2Data) {
            let dataIndex = data.findDataItemIndex(this.y2Data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "y2Data"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Y2 data ignored",
                        getChildOfObject(this, "y2Data")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y2Data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawYTGraphWidget(this, rect);
    }
}

registerClass(YTGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class UpDownWidget extends Widget {
    @observable buttonsStyle: Style;
    @observable downButtonText?: string;
    @observable upButtonText?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeStylePropertyInfo("buttonsStyle"),
            {
                name: "downButtonText",
                type: PropertyType.String
            },
            {
                name: "upButtonText",
                type: PropertyType.String
            }
        ],

        beforeLoadHook: (object: EezObject, jsObject: any) => {
            if (typeof jsObject["buttonsStyle"] === "string") {
                jsObject["buttonsStyle"] = {
                    inheritFrom: jsObject["buttonsStyle"]
                };
            }
        },

        defaultValue: {
            type: "UpDown",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            upButtonText: ">",
            downButtonText: "<"
        },

        icon: "_images/widgets/UpDown.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (!this.downButtonText) {
            messages.push(output.propertyNotSetMessage(this, "downButtonText"));
        }

        if (!this.upButtonText) {
            messages.push(output.propertyNotSetMessage(this, "upButtonText"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawUpDownWidget(this, rect);
    }
}

registerClass(UpDownWidget);

////////////////////////////////////////////////////////////////////////////////

export class ListGraphWidget extends Widget {
    @observable dwellData?: string;
    @observable y1Data?: string;
    @observable y1Style: Style;
    @observable y2Data?: string;
    @observable y2Style: Style;
    @observable cursorData?: string;
    @observable cursorStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeDataPropertyInfo("dwellData"),
            makeDataPropertyInfo("y1Data"),
            makeStylePropertyInfo("y1Style"),
            makeStylePropertyInfo("y2Style"),
            makeStylePropertyInfo("cursorStyle"),
            makeDataPropertyInfo("y2Data"),
            makeDataPropertyInfo("cursorData")
        ],

        beforeLoadHook: (object: EezObject, jsObject: any) => {
            if (typeof jsObject["y1Style"] === "string") {
                jsObject["y1Style"] = {
                    inheritFrom: jsObject["y1Style"]
                };
            }

            if (typeof jsObject["y2Style"] === "string") {
                jsObject["y2Style"] = {
                    inheritFrom: jsObject["y2Style"]
                };
            }

            if (typeof jsObject["cursorStyle"] === "string") {
                jsObject["cursorStyle"] = {
                    inheritFrom: jsObject["cursorStyle"]
                };
            }
        },

        defaultValue: {
            type: "ListGraph",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/ListGraph.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.dwellData) {
            let dataIndex = data.findDataItemIndex(this.dwellData);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "dwellData"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Dwell data ignored",
                        getChildOfObject(this, "dwellData")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "dwellData"));
        }

        if (this.y1Data) {
            let dataIndex = data.findDataItemIndex(this.y1Data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "y1Data"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Y1 data ignored",
                        getChildOfObject(this, "y1Data")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y1Data"));
        }

        if (this.y2Data) {
            let dataIndex = data.findDataItemIndex(this.y2Data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "y2Data"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Y2 data ignored",
                        getChildOfObject(this, "y2Data")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y2Data"));
        }

        if (this.cursorData) {
            let dataIndex = data.findDataItemIndex(this.cursorData);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "cursorData"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Cursor data ignored",
                        getChildOfObject(this, "cursorData")
                    )
                );
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "cursorData"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawListGraphWidget(this, rect);
    }
}

registerClass(ListGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class AppViewWidget extends Widget {
    @observable
    page: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: { type: "AppView", left: 0, top: 0, width: 64, height: 32 },

        icon: "_images/widgets/AppView.png"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    render(rect: Rect, dataContext: IDataContext) {
        if (!this.data) {
            return null;
        }

        const pageName = dataContext.get(this.data);
        if (!pageName) {
            return null;
        }

        const page = getPageContext().findPage(pageName);
        if (!page) {
            return null;
        }

        return page.render(rect, dataContext);
    }
}

registerClass(AppViewWidget);

import { observable, computed } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { Rect } from "eez-studio-shared/geometry";

import {
    registerClass,
    PropertyType,
    makeDerivedClassInfo,
    getChildOfObject
} from "eez-studio-shared/model/object";
import * as output from "eez-studio-shared/model/output";

import { Widget } from "eez-studio-page-editor/widget";

import * as data from "project-editor/project/features/data/data";

import { findStyle, findBitmap } from "project-editor/project/features/gui/gui";
import * as draw from "project-editor/project/features/gui/draw";

////////////////////////////////////////////////////////////////////////////////

export {
    Widget,
    getWidgetType,
    IWidgetContainerDisplayItem,
    WidgetContainerDisplayItem,
    ContainerWidget,
    SelectWidgetEditor,
    SelectWidget,
    ListWidget,
    GridWidget,
    LayoutViewWidget
} from "eez-studio-page-editor/widget";

////////////////////////////////////////////////////////////////////////////////

export class DisplayDataWidget extends Widget {
    @observable
    focusStyle?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "focusStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            }
        ],

        defaultValue: {
            type: "DisplayData",
            data: "data",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default"
        }
    });

    @computed
    get focusStyleObject() {
        if (this.focusStyle) {
            return findStyle(this.focusStyle);
        }
        return undefined;
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.focusStyle) {
            if (!this.focusStyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "focusStyle"));
            }
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawDisplayDataWidget(this, rect);
    }
}

registerClass(DisplayDataWidget);

export class TextWidget extends Widget {
    @observable
    text?: string;
    @observable
    ignoreLuminocity: boolean;

    get label() {
        return this.text ? `${this.type}: "${this.text}"` : this.type;
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text",
                type: PropertyType.String
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                defaultValue: false
            }
        ],

        defaultValue: {
            type: "Text",
            text: "Text",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default"
        }
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
                type: PropertyType.String
            }
        ],

        defaultValue: {
            type: "MultilineText",
            text: "Multiline text",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default"
        }
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
                defaultValue: false
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                defaultValue: false
            }
        ],

        defaultValue: { type: "Rectangle", x: 0, y: 0, width: 64, height: 32, style: "default" }
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
                referencedObjectCollectionPath: ["gui", "bitmaps"]
            }
        ],

        defaultValue: { type: "Bitmap", x: 0, y: 0, width: 64, height: 32, style: "default" }
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
    disabledStyle?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text",
                type: PropertyType.String
            },
            {
                name: "enabled",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "disabledStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            }
        ],

        defaultValue: { type: "Button", x: 0, y: 0, width: 32, height: 32, style: "default" }
    });

    @computed
    get disabledStyleObject() {
        if (this.disabledStyle) {
            return findStyle(this.disabledStyle);
        }
        return undefined;
    }

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

        if (this.disabledStyle) {
            if (!this.disabledStyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "disabledStyle"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "disabledStyle"));
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

        defaultValue: { type: "ToggleButton", x: 0, y: 0, width: 32, height: 32, style: "default" }
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
        defaultValue: { type: "ButtonGroup", x: 0, y: 0, width: 64, height: 32, style: "default" }
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
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            needlePostion: "right",
            needleWidth: 19,
            needleHeight: 11,
            style: "default"
        }
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
    @observable
    orientation?: string;
    @observable
    textStyle?: string;
    @observable
    line1Data?: string;
    @observable
    line1Style?: string;
    @observable
    line2Data?: string;
    @observable
    line2Style?: string;

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
            {
                name: "textStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "line1Data",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "line1Style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "line2Data",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "line2Style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            }
        ],

        defaultValue: {
            type: "BarGraph",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            orientation: "left-right",
            style: "default"
        }
    });

    @computed
    get textStyleObject() {
        if (this.textStyle) {
            return findStyle(this.textStyle);
        }
        return undefined;
    }

    @computed
    get line1StyleObject() {
        if (this.line1Style) {
            return findStyle(this.line1Style);
        }
        return undefined;
    }

    @computed
    get line2StyleObject() {
        if (this.line2Style) {
            return findStyle(this.line2Style);
        }
        return undefined;
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.textStyle) {
            if (!this.textStyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "textStyle"));
            }
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

        if (this.line1Style) {
            if (!this.line1StyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "line1Style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "line1Style"));
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

        if (this.line2Style) {
            if (!this.line2StyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "line2Style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "line2Style"));
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
    @observable
    y1Style?: string;
    @observable
    y2Data?: string;
    @observable
    y2Style?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "y1Style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "y2Data",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "y2Style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            }
        ],

        defaultValue: {
            type: "YTGraph",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default",
            y1Style: "default",
            y2Style: "default"
        }
    });

    @computed
    get y1StyleObject() {
        if (this.y1Style) {
            return findStyle(this.y1Style);
        }
        return undefined;
    }

    @computed
    get y2StyleObject() {
        if (this.y2Style) {
            return findStyle(this.y2Style);
        }
        return undefined;
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.y1Style) {
            if (!this.y1StyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "y1Style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y1Style"));
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

        if (this.y2Style) {
            if (!this.y2StyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "y2Style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y2Style"));
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
    @observable
    buttonsStyle?: string;
    @observable
    downButtonText?: string;
    @observable
    upButtonText?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "buttonsStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "downButtonText",
                type: PropertyType.String
            },
            {
                name: "upButtonText",
                type: PropertyType.String
            }
        ],

        defaultValue: {
            type: "UpDown",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default",
            buttonsStyle: "default",
            upButtonText: ">",
            downButtonText: "<"
        }
    });

    @computed
    get buttonsStyleObject() {
        if (this.buttonsStyle) {
            return findStyle(this.buttonsStyle);
        }
        return undefined;
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.buttonsStyle) {
            if (!this.buttonsStyle) {
                messages.push(output.propertyNotFoundMessage(this, "buttonsStyle"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "buttonsStyle"));
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
    @observable
    dwellData?: string;
    @observable
    y1Data?: string;
    @observable
    y1Style?: string;
    @observable
    y2Data?: string;
    @observable
    y2Style?: string;
    @observable
    cursorData?: string;
    @observable
    cursorStyle?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "dwellData",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "y1Data",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "y1Style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "y2Data",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "y2Style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "cursorData",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "cursorStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            }
        ],

        defaultValue: {
            type: "ListGraph",
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default",
            y1Style: "default",
            y2Style: "default"
        }
    });

    @computed
    get y1StyleObject() {
        if (this.y1Style) {
            return findStyle(this.y1Style);
        }
        return undefined;
    }

    @computed
    get y2StyleObject() {
        if (this.y2Style) {
            return findStyle(this.y2Style);
        }
        return undefined;
    }

    @computed
    get cursorStyleObject() {
        if (this.cursorStyle) {
            return findStyle(this.cursorStyle);
        }
        return undefined;
    }

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

        if (this.y1Style) {
            if (!this.y1StyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "y1Style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y1Style"));
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

        if (this.y2Style) {
            if (!this.y2StyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "y2Style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "y2Style"));
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

        if (this.cursorStyle) {
            if (!this.cursorStyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "cursorStyle"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "cursorStyle"));
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
        defaultValue: { type: "AppView", x: 0, y: 0, width: 64, height: 32, style: "default" }
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawAppViewWidget(this, rect);
    }
}

registerClass(AppViewWidget);

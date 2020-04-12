import React from "react";
import { observable, computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find, _range } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";
import { humanize } from "eez-studio-shared/string";
import { Rect } from "eez-studio-shared/geometry";
import { validators } from "eez-studio-shared/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    IEezObject,
    EezObject,
    registerClass,
    ClassInfo,
    PropertyInfo,
    PropertyType,
    makeDerivedClassInfo,
    findClass,
    isArray,
    cloneObject,
    generalGroup,
    dataGroup,
    actionsGroup,
    geometryGroup,
    styleGroup,
    specificGroup,
    IPropertyGridGroupDefinition,
    areAllChildrenOfTheSameParent,
    isAncestor,
    IOnSelectParams,
    getChildOfObject,
    getParent
} from "project-editor/core/object";
import { loadObject, objectToJS } from "project-editor/core/serialization";
import { DocumentStore, NavigationStore, IContextMenuContext } from "project-editor/core/store";
import * as output from "project-editor/core/output";

import { Project } from "project-editor/project/project";

import {
    IResizeHandler,
    IDesignerContext
} from "project-editor/features/gui/page-editor/designer-interfaces";
import {
    WidgetContainerComponent,
    WidgetComponent
} from "project-editor/features/gui/page-editor/render";
import { EditorObject } from "project-editor/features/gui/page-editor/editor";

import { PropertyProps } from "project-editor/components/PropertyGrid";
import { onSelectItem } from "project-editor/components/SelectItem";

import { ProjectStore } from "project-editor/core/store";

// import * as data from "project-editor/features/data/data";

import { Page } from "project-editor/features/gui/page";
import { findPage, findBitmap } from "project-editor/features/gui/gui";
import { Style, IStyle, getStyleProperty } from "project-editor/features/gui/style";
import { findDataItem, DataContext, dataContext } from "project-editor/features/data/data";
import { findAction } from "project-editor/features/action/action";
import {
    drawOnCanvas,
    drawText,
    styleGetBorderRadius,
    styleIsHorzAlignLeft,
    styleIsHorzAlignRight,
    styleIsVertAlignTop,
    styleIsVertAlignBottom,
    styleGetFont,
    textDrawingInBackground
} from "project-editor/features/gui/draw";
import * as draw from "project-editor/features/gui/draw";
import { Font } from "project-editor/features/gui/font";

import { BootstrapButton } from "project-editor/components/BootstrapButton";

const { MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

function makeDataPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.ObjectReference,
        referencedObjectCollectionPath: ["data"],
        propertyGridGroup: propertyGridGroup || dataGroup,
        onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
            onSelectItem(object, propertyInfo, {
                title: propertyInfo.onSelectTitle!,
                width: 800
            }),
        onSelectTitle: "Select Data"
    };
}

function makeActionPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.ObjectReference,
        referencedObjectCollectionPath: ["actions"],
        propertyGridGroup: propertyGridGroup || actionsGroup,
        onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
            onSelectItem(object, propertyInfo, {
                title: propertyInfo.onSelectTitle!,
                width: 800
            }),
        onSelectTitle: "Select Action"
    };
}

function makeStylePropertyInfo(name: string, displayName?: string): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.Object,
        typeClass: Style,
        propertyGridGroup: styleGroup,
        propertyGridCollapsable: true,
        propertyGridCollapsableDefaultPropertyName: "inheritFrom",
        propertyGridCollapsableEnabled: () => !ProjectStore.masterProjectEnabled,
        enumerable: false
    };
}

function makeTextPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.String,
        propertyGridGroup: propertyGridGroup || specificGroup,
        onSelect: (object: IEezObject, propertyInfo: PropertyInfo, params?: IOnSelectParams) =>
            onSelectItem(
                object,
                propertyInfo,
                {
                    title: propertyInfo.onSelectTitle!,
                    width: 800
                },
                params
            ),
        onSelectTitle: "Select Glyph"
    };
}

function htmlEncode(value: string) {
    const el = document.createElement("div");
    el.innerText = value;
    return el.innerHTML;
}

function migrateStyleProperty(jsObject: any, propertyName: string, propertyName2?: string) {
    if (jsObject[propertyName] === undefined) {
        jsObject[propertyName] = propertyName2
            ? jsObject[propertyName2]
            : {
                  inheritFrom: "default"
              };
    } else if (typeof jsObject[propertyName] === "string") {
        jsObject[propertyName] = {
            inheritFrom: jsObject[propertyName]
        };
    } else if (!jsObject[propertyName].inheritFrom) {
        jsObject[propertyName].inheritFrom = "default";
    }
}

////////////////////////////////////////////////////////////////////////////////

// Return immediate parent, which can be of type Page or Widget
// (i.e. ContainerWidget, ListWidget, GridWidget, SelectWidget)
export function getWidgetParent(widget: Widget) {
    let parent = getParent(widget);
    if (isArray(parent)) {
        parent = getParent(parent);
    }
    return parent as Widget | Page;
}

////////////////////////////////////////////////////////////////////////////////

export interface IWidget {
    type: string;
    style: IStyle;
    data?: string;
    action?: string;

    left: number;
    top: number;
    width: number;
    height: number;
}

export class Widget extends EezObject implements IWidget {
    @observable type: string;
    @observable style: Style;
    @observable data?: string;
    @observable action?: string;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    get label() {
        return this.type;
    }

    static classInfo: ClassInfo = {
        getClass: function (jsObject: any) {
            if (jsObject.type.startsWith("Local.")) {
                return findClass("LayoutViewWidget");
            }
            return findClass(jsObject.type + "Widget");
        },

        label: (widget: Widget) => {
            if (widget.data) {
                return `${humanize(widget.type)}: ${widget.data}`;
            }

            return humanize(widget.type);
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                hideInPropertyGrid: true
            },
            {
                name: "left",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "top",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "width",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "height",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "absolutePosition",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                computed: true
            },
            makeDataPropertyInfo("data"),
            makeActionPropertyInfo("action"),
            makeStylePropertyInfo("style", "Normal style")
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.type.startsWith("Local.")) {
                jsObject.layout = jsObject.type.substring("Local.".length);
                jsObject.type = "LayoutView";
            }

            if (jsObject["x"] !== undefined) {
                jsObject["left"] = jsObject["x"];
                delete jsObject["x"];
            }

            if (jsObject["y"] !== undefined) {
                jsObject["top"] = jsObject["y"];
                delete jsObject["y"];
            }

            if (typeof jsObject.left === "string") {
                jsObject.left = parseInt(jsObject.left);
            }

            if (typeof jsObject.top === "string") {
                jsObject.top = parseInt(jsObject.top);
            }

            if (typeof jsObject.width === "string") {
                jsObject.width = parseInt(jsObject.width);
            }

            if (typeof jsObject.height === "string") {
                jsObject.height = parseInt(jsObject.height);
            }

            migrateStyleProperty(jsObject, "style");

            if (jsObject.style && typeof jsObject.style.padding === "number") {
                delete jsObject.style.padding;
            }

            delete jsObject.activeStyle;
        },

        isPropertyMenuSupported: true,

        extendContextMenu: (
            thisObject: Widget,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[]
        ): void => {
            var additionalMenuItems: Electron.MenuItem[] = [];

            if (objects.length === 1) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Put in Select",
                        click: () => {
                            const selectWidget = (objects[0] as Widget).putInSelect();
                            context.selectObject(selectWidget);
                        }
                    })
                );
            }

            if (areAllChildrenOfTheSameParent(objects)) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Put in Container",
                        click: () => {
                            const containerWidget = Widget.putInContainer(objects as Widget[]);
                            context.selectObject(containerWidget);
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Create Layout",
                        click: async () => {
                            const layoutWidget = await Widget.createLayout(objects as Widget[]);
                            if (layoutWidget) {
                                context.selectObject(layoutWidget);
                            }
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Replace with Layout",
                        click: async () => {
                            const layoutWidget = await Widget.replaceWithLayout(
                                objects as Widget[]
                            );
                            if (layoutWidget) {
                                context.selectObject(layoutWidget);
                            }
                        }
                    })
                );
            }

            if (objects.length === 1) {
                const object = objects[0];

                if (object instanceof TextWidget) {
                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Convert to DisplayData",
                            click: () => {
                                const widget = object.convertToDisplayData();
                                if (widget) {
                                    context.selectObject(widget);
                                }
                            }
                        })
                    );
                }

                if (object instanceof LayoutViewWidget) {
                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Replace with Container",
                            click: () => {
                                const widget = object.replaceWithContainer();
                                if (widget) {
                                    context.selectObject(widget);
                                }
                            }
                        })
                    );
                }

                let parent = getParent(object);
                if (parent && getParent(parent) instanceof SelectWidget) {
                    additionalMenuItems.push(
                        new MenuItem({
                            label: "Replace Parent",
                            click: () => {
                                const widget = (object as Widget).replaceParent();
                                if (widget) {
                                    context.selectObject(widget);
                                }
                            }
                        })
                    );
                }
            }

            if (additionalMenuItems.length > 0) {
                additionalMenuItems.push(
                    new MenuItem({
                        type: "separator"
                    })
                );

                menuItems.unshift(...additionalMenuItems);
            }
        },

        check: (object: Widget) => {
            let messages: output.Message[] = [];

            if (object.left < 0) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Widget is outside of its parent",
                        getChildOfObject(object, "left")
                    )
                );
            }

            if (object.top < 0) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Widget is outside of its parent",
                        getChildOfObject(object, "top")
                    )
                );
            }

            if (object.left + object.width > getWidgetParent(object).width) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Widget is outside of its parent",
                        getChildOfObject(object, "width")
                    )
                );
            }

            if (object.top + object.height > getWidgetParent(object).height) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Widget is outside of its parent",
                        getChildOfObject(object, "height")
                    )
                );
            }

            let selectParent = object.selectParent;
            if (selectParent) {
                if (object.width != selectParent.width) {
                    messages.push(
                        new output.Message(
                            output.Type.WARNING,
                            "Child of select has different width",
                            object
                        )
                    );
                }

                if (object.height != selectParent.height) {
                    messages.push(
                        new output.Message(
                            output.Type.WARNING,
                            "Child of select has different height",
                            object
                        )
                    );
                }
            }

            if (object.data) {
                if (!findDataItem(object.data)) {
                    messages.push(output.propertyNotFoundMessage(object, "data"));
                }
            }

            if (object.action) {
                if (!findAction(object.action)) {
                    messages.push(output.propertyNotFoundMessage(object, "action"));
                }
            }

            return messages;
        }
    };

    @computed
    get absolutePosition() {
        let x = this.left;
        let y = this.top;

        for (
            let parent = getWidgetParent(this);
            parent && !(parent instanceof Page);
            parent = getWidgetParent(parent)
        ) {
            x += parent.left;
            y += parent.top;
        }

        return `${x}, ${y}`;
    }

    @computed
    get isMoveable() {
        return true;
    }

    @computed
    get styleObject() {
        return this.style;
    }

    // If this widget is immediate child of SelectWidgetProperties parent return that parent.
    get selectParent(): SelectWidget | undefined {
        const parent = getWidgetParent(this);
        if (parent instanceof SelectWidget) {
            return parent;
        }
        return undefined;
    }

    putInSelect() {
        let thisWidgetJsObject = objectToJS(this);

        var selectWidgetJsObject = Object.assign({}, SelectWidget.classInfo.defaultValue);

        selectWidgetJsObject.left = this.left;
        selectWidgetJsObject.top = this.top;
        selectWidgetJsObject.width = this.width;
        selectWidgetJsObject.height = this.height;

        thisWidgetJsObject.left = 0;
        delete thisWidgetJsObject.left_;
        thisWidgetJsObject.top = 0;
        delete thisWidgetJsObject.top_;

        selectWidgetJsObject.widgets = [thisWidgetJsObject];

        return DocumentStore.replaceObject(
            this,
            loadObject(getParent(this), selectWidgetJsObject, Widget)
        );
    }

    static createWidgets(fromWidgets: Widget[]) {
        let x1 = fromWidgets[0].left;
        let y1 = fromWidgets[0].top;
        let x2 = fromWidgets[0].left + fromWidgets[0].width;
        let y2 = fromWidgets[0].top + fromWidgets[0].height;

        for (let i = 1; i < fromWidgets.length; i++) {
            let widget = fromWidgets[i];
            x1 = Math.min(widget.left, x1);
            y1 = Math.min(widget.top, y1);
            x2 = Math.max(widget.left + widget.width, x2);
            y2 = Math.max(widget.top + widget.height, y2);
        }

        const widgets = [];

        for (let i = 0; i < fromWidgets.length; i++) {
            let widget = fromWidgets[i];
            let widgetJsObject = objectToJS(widget);

            widgetJsObject.left = fromWidgets[i].left - x1;
            delete widgetJsObject.left_;
            widgetJsObject.top = fromWidgets[i].top - y1;
            delete widgetJsObject.top_;

            widgets.push(widgetJsObject);
        }

        return {
            widgets,
            left: x1,
            top: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    static putInContainer(fromWidgets: Widget[]) {
        var containerWidgetJsObject: IContainerWidget = Object.assign(
            {},
            ContainerWidget.classInfo.defaultValue
        );

        const createWidgetsResult = Widget.createWidgets(fromWidgets);

        containerWidgetJsObject.widgets = createWidgetsResult.widgets;

        containerWidgetJsObject.left = createWidgetsResult.left;
        containerWidgetJsObject.top = createWidgetsResult.top;
        containerWidgetJsObject.width = createWidgetsResult.width;
        containerWidgetJsObject.height = createWidgetsResult.height;

        return DocumentStore.replaceObjects(
            fromWidgets,
            loadObject(getParent(fromWidgets[0]), containerWidgetJsObject, Widget)
        );
    }

    static async createLayout(fromWidgets: Widget[]) {
        const layouts = ProjectStore.project.gui.pages;

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Layout name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [validators.required, validators.unique({}, layouts)]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const layoutName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            DocumentStore.addObject(
                layouts,
                loadObject(
                    undefined,
                    {
                        name: layoutName,
                        left: 0,
                        top: 0,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        widgets: createWidgetsResult.widgets
                    },
                    findClass("Page")!
                )
            );

            return DocumentStore.replaceObjects(
                fromWidgets,
                loadObject(
                    getParent(fromWidgets[0]),
                    {
                        type: "LayoutView",
                        left: createWidgetsResult.left,
                        top: createWidgetsResult.top,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        layout: layoutName
                    },
                    Widget
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    static async replaceWithLayout(fromWidgets: Widget[]) {
        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Layout name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [validators.required]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const layoutName = result.values.name;

            const createWidgetsResult = Widget.createWidgets(fromWidgets);

            return DocumentStore.replaceObjects(
                fromWidgets,
                loadObject(
                    getParent(fromWidgets[0]),
                    {
                        type: "LayoutView",
                        left: createWidgetsResult.left,
                        top: createWidgetsResult.top,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        layout: layoutName
                    },
                    Widget
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    replaceParent() {
        let parent = getParent(this);
        if (parent) {
            let selectWidget = getParent(parent);
            if (selectWidget instanceof SelectWidget) {
                return DocumentStore.replaceObject(
                    selectWidget,
                    cloneObject(getParent(selectWidget), this)
                );
            }
        }
        return undefined;
    }

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        return undefined;
    }

    render(
        rect: Rect,
        dataContext: DataContext,
        designerContext?: IDesignerContext
    ): React.ReactNode {
        return undefined;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [
            {
                x: 0,
                y: 0,
                type: "nw-resize"
            },
            {
                x: 50,
                y: 0,
                type: "n-resize"
            },
            {
                x: 100,
                y: 0,
                type: "ne-resize"
            },
            {
                x: 0,
                y: 50,
                type: "w-resize"
            },
            {
                x: 100,
                y: 50,
                type: "e-resize"
            },
            {
                x: 0,
                y: 100,
                type: "sw-resize"
            },
            {
                x: 50,
                y: 100,
                type: "s-resize"
            },
            {
                x: 100,
                y: 100,
                type: "se-resize"
            }
        ];
    }

    getColumnWidth(columnIndex: number) {
        return NaN;
    }

    resizeColumn(columnIndex: number, savedColumnWidth: number, offset: number) {}

    getRowHeight(rowIndex: number) {
        return NaN;
    }

    resizeRow(rowIndex: number, savedRowWidth: number, offset: number) {}

    open() {}

    styleHook(style: React.CSSProperties, designerContext: IDesignerContext | undefined) {
        const backgroundColor = getStyleProperty(this.style, "backgroundColor");
        style.backgroundColor = to16bitsColor(backgroundColor);
    }
}

registerClass(Widget);

////////////////////////////////////////////////////////////////////////////////

export interface IContainerWidget extends IWidget {
    name?: string;
    widgets: IWidget[];
    overlay?: string;
    shadow?: boolean;
}

export class ContainerWidget extends Widget implements IContainerWidget {
    @observable name?: string;
    @observable widgets: Widget[];
    @observable overlay?: string;
    @observable shadow?: boolean;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        label: (widget: ContainerWidget) => {
            if (widget.name) {
                return `${humanize(widget.type)}: ${widget.name}`;
            }
            return humanize(widget.type);
        },

        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            {
                name: "name",
                type: PropertyType.String,
                propertyGridGroup: generalGroup
            },
            makeDataPropertyInfo("overlay"),
            {
                name: "shadow",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                hideInPropertyGrid: (containerWidget: ContainerWidget) => {
                    return !containerWidget.overlay;
                }
            }
        ],

        defaultValue: {
            type: "Container",
            style: {
                inheritFrom: "default"
            },
            widgets: [],
            left: 0,
            top: 0,
            width: 64,
            height: 32
        } as IContainerWidget,

        icon: "_images/widgets/Container.png",

        check: (object: ContainerWidget) => {
            let messages: output.Message[] = [];

            if (object.overlay) {
                if (!findDataItem(object.overlay)) {
                    messages.push(output.propertyNotFoundMessage(object, "overlay"));
                }
            }

            return messages;
        }
    });

    render(rect: Rect, dataContext: DataContext) {
        return (
            <WidgetContainerComponent
                containerWidget={this}
                widgets={this.widgets}
                dataContext={dataContext}
            />
        );
    }

    styleHook(style: React.CSSProperties, designerContext: IDesignerContext | undefined) {
        super.styleHook(style, designerContext);
        if (this.overlay) {
            if (this.shadow) {
                style.boxShadow = "1px 1px 8px 1px rgba(0,0,0,0.5)";
            }
            style.opacity = getStyleProperty(this.style, "opacity") / 255;
        }
    }
}

registerClass(ContainerWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IListWidget extends IWidget {
    itemWidget?: IWidget;
    listType?: string;
    gap?: number;
}

export class ListWidget extends Widget implements IListWidget {
    @observable itemWidget?: Widget;
    @observable listType?: string;
    @observable gap?: number;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "itemWidget",
                type: PropertyType.Object,
                typeClass: Widget,
                hideInPropertyGrid: true,
                isOptional: true
            },
            {
                name: "listType",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "vertical"
                    },
                    {
                        id: "horizontal"
                    }
                ]
            },
            {
                name: "gap",
                type: PropertyType.Number,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            type: "List",
            itemWidget: {
                type: "Container",
                widgets: [],
                left: 0,
                top: 0,
                width: 64,
                height: 32
            },
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            listType: "vertical",
            gap: 0
        },

        icon: "_images/widgets/List.png",

        check: (object: ListWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.itemWidget) {
                messages.push(
                    new output.Message(output.Type.ERROR, "List item widget is missing", object)
                );
            }

            return messages;
        }
    });

    render(rect: Rect, dataContext: DataContext) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        const dataValue = this.data ? dataContext.get(this.data) : 0;

        if (!dataValue || !Array.isArray(dataValue)) {
            return null;
        }

        return _range(dataValue.length).map(i => {
            let xListItem = 0;
            let yListItem = 0;

            const gap = this.gap || 0;

            if (this.listType === "horizontal") {
                xListItem += i * (itemWidget.width + gap);
            } else {
                yListItem += i * (itemWidget.height + gap);
            }

            return (
                <WidgetComponent
                    key={i}
                    widget={itemWidget}
                    rect={{
                        left: xListItem,
                        top: yListItem,
                        width: itemWidget.width,
                        height: itemWidget.height
                    }}
                    dataContext={new DataContext(dataContext, dataValue[i])}
                />
            );
        });
    }
}

registerClass(ListWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IGridWidget extends IWidget {
    itemWidget?: IWidget;
    gridFlow?: string;
}

export class GridWidget extends Widget implements IGridWidget {
    @observable itemWidget?: Widget;
    @observable gridFlow?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "itemWidget",
                type: PropertyType.Object,
                typeClass: Widget,
                hideInPropertyGrid: true,
                isOptional: true
            },
            {
                name: "gridFlow",
                type: PropertyType.Enum,
                propertyGridGroup: specificGroup,
                enumItems: [
                    {
                        id: "row"
                    },
                    {
                        id: "column"
                    }
                ]
            }
        ],

        defaultValue: {
            type: "Grid",
            itemWidget: {
                type: "Container",
                widgets: [],
                left: 0,
                top: 0,
                width: 32,
                height: 32,
                gridFlow: "row"
            },
            left: 0,
            top: 0,
            width: 64,
            height: 64
        },

        icon: "_images/widgets/Grid.png",

        check: (object: GridWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.itemWidget) {
                messages.push(
                    new output.Message(output.Type.ERROR, "Grid item widget is missing", object)
                );
            }

            return messages;
        }
    });

    render(rect: Rect, dataContext: DataContext) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        const gridRect = rect;

        const dataValue = this.data ? dataContext.get(this.data) : 0;

        if (!dataValue || !Array.isArray(dataValue)) {
            return null;
        }

        return _range(dataValue.length).map(i => {
            const rows = Math.floor(gridRect.width / itemWidget.width);
            const cols = Math.floor(gridRect.height / itemWidget.height);

            let row;
            let col;
            if (this.gridFlow === "column") {
                row = Math.floor(i / cols);
                col = i % cols;
                if (row >= rows) {
                    return undefined;
                }
            } else {
                row = i % rows;
                col = Math.floor(i / rows);
                if (col >= cols) {
                    return undefined;
                }
            }

            let xListItem = row * itemWidget.width;
            let yListItem = col * itemWidget.height;

            return (
                <WidgetComponent
                    key={i}
                    widget={itemWidget}
                    rect={{
                        left: xListItem,
                        top: yListItem,
                        width: itemWidget.width,
                        height: itemWidget.height
                    }}
                    dataContext={new DataContext(dataContext, dataValue[i])}
                />
            );
        });
    }
}

registerClass(GridWidget);

////////////////////////////////////////////////////////////////////////////////

export interface ISelectWidget extends IWidget {
    widgets: IWidget[];
}

export class SelectWidget extends Widget implements ISelectWidget {
    @observable widgets: Widget[];

    _lastSelectedIndexInSelectWidget: number | undefined;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true,
                childLabel: (childObject: IEezObject, childLabel: string) => {
                    let label;

                    if (getParent(childObject)) {
                        let selectWidgetProperties = getParent(
                            getParent(childObject)
                        ) as SelectWidget;

                        label = selectWidgetProperties.getChildLabel(childObject as Widget);
                    }

                    return `${label || "???"} ➔ ${childLabel}`;
                },

                interceptAddObject: (widgets: Widget[], object: Widget) => {
                    object.left = 0;
                    object.top = 0;
                    object.width = (getParent(widgets) as SelectWidget).width;
                    object.height = (getParent(widgets) as SelectWidget).height;
                    return object;
                }
            }
        ],

        defaultValue: {
            type: "Select",
            widgets: [],
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/Select.png",

        check: (object: SelectWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            } else {
                let dataItem = findDataItem(object.data);
                if (dataItem) {
                    let enumItems: string[] = [];
                    if (dataItem.type == "enum") {
                        try {
                            enumItems = JSON.parse(dataItem.enumItems || "[]");
                        } catch (err) {
                            enumItems = [];
                        }
                    } else if (dataItem.type == "boolean") {
                        enumItems = ["0", "1"];
                    }
                    if (enumItems.length > object.widgets.length) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Some select children are missing",
                                object
                            )
                        );
                    } else if (enumItems.length < object.widgets.length) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Too many select children defined",
                                object
                            )
                        );
                    }
                }
            }

            return messages;
        }
    });

    getChildLabel(childObject: Widget) {
        if (this.widgets) {
            let index = this.widgets.indexOf(childObject);
            if (index != -1) {
                if (this.data) {
                    let dataItem = findDataItem(this.data);
                    if (dataItem) {
                        if (dataItem.type == "enum") {
                            let enumItems: string[];
                            try {
                                enumItems = JSON.parse(dataItem.enumItems || "[]");
                            } catch (err) {
                                enumItems = [];
                                console.error("Invalid enum items", dataItem, err);
                            }

                            if (index < enumItems.length) {
                                let enumItemLabel = htmlEncode(enumItems[index]);
                                return enumItemLabel;
                            }
                        } else if (dataItem.type == "boolean") {
                            if (index == 0) {
                                return "0";
                            } else if (index == 1) {
                                return "1";
                            }
                        }
                    }
                }
            }
        }

        return undefined;
    }

    getSelectedWidget(dataContext: DataContext) {
        if (this.data) {
            let index: number = dataContext.getEnumValue(this.data);
            if (index >= 0 && index < this.widgets.length) {
                return this.widgets[index];
            }
        }
        return undefined;
    }

    getSelectedIndex(dataContext: DataContext, designerContext?: IDesignerContext) {
        if (designerContext) {
            const selectedObjects = designerContext.viewState.selectedObjects;

            for (let i = 0; i < this.widgets.length; ++i) {
                if (
                    selectedObjects.find(selectedObject =>
                        isAncestor((selectedObject as EditorObject).object, this.widgets[i])
                    )
                ) {
                    this._lastSelectedIndexInSelectWidget = i;
                    return i;
                }
            }

            if (
                this._lastSelectedIndexInSelectWidget !== undefined &&
                this._lastSelectedIndexInSelectWidget < this.widgets.length
            ) {
                return this._lastSelectedIndexInSelectWidget;
            }

            const selectedWidget = this.getSelectedWidget(dataContext);
            if (selectedWidget) {
                return this.widgets.indexOf(selectedWidget);
            }

            if (this.widgets.length > 0) {
                this._lastSelectedIndexInSelectWidget = 0;
                return this._lastSelectedIndexInSelectWidget;
            }
        } else {
            if (
                this._lastSelectedIndexInSelectWidget !== undefined &&
                this._lastSelectedIndexInSelectWidget < this.widgets.length
            ) {
                return this._lastSelectedIndexInSelectWidget;
            }

            const selectedWidget = this.getSelectedWidget(dataContext);
            if (selectedWidget) {
                return this.widgets.indexOf(selectedWidget);
            }
        }

        return -1;
    }

    render(rect: Rect, dataContext: DataContext, designerContext?: IDesignerContext) {
        const index = this.getSelectedIndex(dataContext, designerContext);
        if (index === -1) {
            return null;
        }

        const selectedWidget = this.widgets[index];

        return (
            <WidgetContainerComponent
                containerWidget={this}
                widgets={[selectedWidget]}
                dataContext={dataContext}
            />
        );
    }
}

registerClass(SelectWidget);

////////////////////////////////////////////////////////////////////////////////

@observer
class LayoutViewPropertyGridUI extends React.Component<PropertyProps> {
    @bind
    showLayout() {
        (this.props.objects[0] as LayoutViewWidget).open();
    }

    render() {
        if (this.props.objects.length > 1) {
            return null;
        }
        return (
            <BootstrapButton color="primary" size="small" onClick={this.showLayout}>
                Show Layout
            </BootstrapButton>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface ILayoutViewWidget extends IWidget {
    layout: string;
    context?: string;
}

export class LayoutViewWidget extends Widget implements ILayoutViewWidget {
    @observable layout: string;
    @observable context?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "layout",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: ["gui", "pages"]
            },
            makeDataPropertyInfo("context"),
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridComponent: LayoutViewPropertyGridUI
            }
        ],

        label: (widget: LayoutViewWidget) => {
            if (widget.layout) {
                return `${widget.type}: ${widget.layout}`;
            }

            return humanize(widget.type);
        },

        defaultValue: {
            type: "LayoutView",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/LayoutView.png",

        check: (object: LayoutViewWidget) => {
            let messages: output.Message[] = [];

            if (!object.data && !object.layout) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Either layout or data must be set",
                        object
                    )
                );
            } else {
                if (object.data && object.layout) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Both layout and data set, only layout is used",
                            object
                        )
                    );
                }

                if (object.layout) {
                    let layout = findPage(object.layout);
                    if (!layout) {
                        messages.push(output.propertyNotFoundMessage(object, "layout"));
                    }
                }
            }

            if (object.context) {
                if (!findDataItem(object.context)) {
                    messages.push(output.propertyNotFoundMessage(object, "context"));
                }
            }

            return messages;
        }
    });

    get layoutPage() {
        let layout;

        if (this.data) {
            const layoutName = dataContext.get(this.data);
            if (layoutName) {
                layout = findPage(layoutName);
            }
        }

        if (!layout) {
            layout = findPage(this.layout);
        }

        if (!layout) {
            return null;
        }

        if (isAncestor(this, layout)) {
            // prevent cyclic referencing
            return null;
        }

        return layout;
    }

    getLayoutPage(dataContext: DataContext) {
        let layout;

        if (this.data) {
            const layoutName = dataContext.get(this.data);
            if (layoutName) {
                layout = findPage(layoutName);
            }
        }

        if (!layout) {
            layout = findPage(this.layout);
        }

        if (!layout) {
            return null;
        }

        if (isAncestor(this, layout)) {
            // prevent cyclic referencing
            return null;
        }

        return layout;
    }

    render(rect: Rect, dataContext: DataContext): React.ReactNode {
        const layoutPage = this.getLayoutPage(dataContext);
        if (!layoutPage) {
            return null;
        }

        return <WidgetComponent widget={layoutPage} dataContext={dataContext} />;
    }

    open() {
        if (this.layoutPage) {
            NavigationStore.showObject(this.layoutPage);
        }
    }

    replaceWithContainer() {
        if (this.layoutPage) {
            var containerWidgetJsObject = Object.assign({}, ContainerWidget.classInfo.defaultValue);

            containerWidgetJsObject.widgets = this.layoutPage.widgets.map(widget =>
                objectToJS(widget)
            );

            containerWidgetJsObject.left = this.left;
            containerWidgetJsObject.top = this.top;
            containerWidgetJsObject.width = this.width;
            containerWidgetJsObject.height = this.height;

            return DocumentStore.replaceObject(
                this,
                loadObject(getParent(this), containerWidgetJsObject, Widget)
            );
        }
        return undefined;
    }
}

registerClass(LayoutViewWidget);

////////////////////////////////////////////////////////////////////////////////

enum DisplayOption {
    All = 0,
    Integer = 1,
    FractionAndUnit = 2,
    Fraction = 3,
    Unit = 4,
    IntegerAndFraction = 5
}

const hideIfNotProjectVersion1: Partial<PropertyInfo> = {
    hideInPropertyGrid: () => ProjectStore.project.settings.general.projectVersion !== "v1"
};

export interface IDisplayDataWidget extends IWidget {
    focusStyle: IStyle;
    displayOption: DisplayOption;
}

export class DisplayDataWidget extends Widget implements IDisplayDataWidget {
    @observable focusStyle: Style;
    @observable displayOption: DisplayOption;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            Object.assign(makeStylePropertyInfo("focusStyle"), hideIfNotProjectVersion1, {
                isOptional: true
            }),
            {
                name: "displayOption",
                type: PropertyType.Enum,
                enumItems: [
                    {
                        id: DisplayOption.All,
                        label: "All"
                    },
                    {
                        id: DisplayOption.Integer,
                        label: "Integer"
                    },
                    {
                        id: DisplayOption.FractionAndUnit,
                        label: "Fraction and unit"
                    },
                    {
                        id: DisplayOption.Fraction,
                        label: "Fraction"
                    },
                    {
                        id: DisplayOption.Unit,
                        label: "Unit"
                    },
                    {
                        id: DisplayOption.IntegerAndFraction,
                        label: "Integer and fraction"
                    }
                ],
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            type: "DisplayData",
            data: "data",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            displayOption: 0
        },

        icon: "_images/widgets/Data.png",

        check: (object: DisplayDataWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (object.displayOption === undefined) {
                if ((ProjectStore.project as Project).settings.general.projectVersion !== "v1") {
                    messages.push(output.propertyNotSetMessage(object, "displayOption"));
                }
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let text = (this.data && (dataContext.get(this.data) as string)) || "";

        function findStartOfFraction() {
            let i;
            for (i = 0; text[i] && (text[i] == "-" || (text[i] >= "0" && text[i] <= "9")); i++) {}
            return i;
        }

        function findStartOfUnit(i: number) {
            for (
                i = 0;
                text[i] && (text[i] == "-" || (text[i] >= "0" && text[i] <= "9") || text[i] == ".");
                i++
            ) {}
            return i;
        }

        if (this.displayOption === DisplayOption.Integer) {
            let i = findStartOfFraction();
            text = text.substr(0, i);
        } else if (this.displayOption === DisplayOption.FractionAndUnit) {
            let i = findStartOfFraction();
            text = text.substr(i);
        } else if (this.displayOption === DisplayOption.Fraction) {
            let i = findStartOfFraction();
            let k = findStartOfUnit(i);
            if (i < k) {
                text = text.substring(i, k);
            } else {
                text = ".00";
            }
        } else if (this.displayOption === DisplayOption.Unit) {
            let i = findStartOfUnit(0);
            text = text.substr(i);
        } else if (this.displayOption === DisplayOption.IntegerAndFraction) {
            let i = findStartOfUnit(0);
            text = text.substr(0, i);
        }

        return drawText(text, rect.width, rect.height, this.style, false);
    }
}

registerClass(DisplayDataWidget);

////////////////////////////////////////////////////////////////////////////////

export interface ITextWidget extends IWidget {
    text?: string;
    ignoreLuminocity: boolean;
    focusStyle: IStyle;
}

export class TextWidget extends Widget implements ITextWidget {
    @observable text?: string;
    @observable ignoreLuminocity: boolean;
    @observable focusStyle: Style;

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
            makeTextPropertyInfo("text"),
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                defaultValue: false,
                propertyGridGroup: specificGroup
            },
            Object.assign(makeStylePropertyInfo("focusStyle"), hideIfNotProjectVersion1, {
                isOptional: true
            })
        ],

        defaultValue: {
            type: "Text",
            text: "Text",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/Text.png",

        check: (object: TextWidget) => {
            let messages: output.Message[] = [];

            if (!object.text && !object.data) {
                messages.push(output.propertyNotSetMessage(object, "text"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let text = this.text ? this.text : this.data ? (dataContext.get(this.data) as string) : "";
        return drawText(text, rect.width, rect.height, this.style, false);
    }

    convertToDisplayData() {
        var displayDataWidgetJsObject = Object.assign(
            {},
            DisplayDataWidget.classInfo.defaultValue,
            objectToJS(this),
            {
                type: DisplayDataWidget.classInfo.defaultValue.type
            }
        );

        return DocumentStore.replaceObject(
            this,
            loadObject(getParent(this), displayDataWidgetJsObject, Widget)
        );
    }
}

registerClass(TextWidget);

////////////////////////////////////////////////////////////////////////////////

enum MultilineTextRenderStep {
    MEASURE,
    RENDER
}

class MultilineTextRender {
    constructor(
        private ctx: CanvasRenderingContext2D,
        private text: string,
        private x1: number,
        private y1: number,
        private x2: number,
        private y2: number,
        private style: Style,
        private inverse: boolean,
        private firstLineIndent: number,
        private hangingIndent: number
    ) {}

    private font: Font;

    private spaceWidth: number;

    private lineHeight: number;
    private textHeight: number;

    private line: string;
    private lineIndent: number;
    private lineWidth: number;

    flushLine(y: number, step: MultilineTextRenderStep) {
        if (this.line != "" && this.lineWidth > 0) {
            if (step == MultilineTextRenderStep.RENDER) {
                let x;

                if (styleIsHorzAlignLeft(this.style)) {
                    x = this.x1;
                } else if (styleIsHorzAlignRight(this.style)) {
                    x = this.x2 + 1 - this.lineWidth;
                } else {
                    x = this.x1 + Math.floor((this.x2 - this.x1 + 1 - this.lineWidth) / 2);
                }

                if (this.inverse) {
                    draw.setBackColor(getStyleProperty(this.style, "color"));
                    draw.setColor(getStyleProperty(this.style, "backgroundColor"));
                } else {
                    draw.setBackColor(getStyleProperty(this.style, "backgroundColor"));
                    draw.setColor(getStyleProperty(this.style, "color"));
                }

                textDrawingInBackground.drawStr(
                    this.ctx,
                    this.line,
                    x + this.lineIndent,
                    y,
                    x + this.lineWidth - 1,
                    y + this.font.height - 1,
                    this.font
                );
            } else {
                this.textHeight = Math.max(this.textHeight, y + this.lineHeight - this.y1);
            }

            this.line = "";
            this.lineWidth = this.lineIndent = this.hangingIndent;
        }
    }

    executeStep(step: MultilineTextRenderStep) {
        this.textHeight = 0;

        let y = this.y1;

        this.line = "";
        this.lineWidth = this.lineIndent = this.firstLineIndent;

        let i = 0;

        while (true) {
            let word = "";
            while (i < this.text.length && this.text[i] != " " && this.text[i] != "\n") {
                word += this.text[i++];
            }

            let width = draw.measureStr(word, this.font, 0);

            while (
                this.lineWidth + (this.line != "" ? this.spaceWidth : 0) + width >
                this.x2 - this.x1 + 1
            ) {
                this.flushLine(y, step);

                y += this.lineHeight;
                if (y + this.lineHeight - 1 > this.y2) {
                    break;
                }
            }

            if (y + this.lineHeight - 1 > this.y2) {
                break;
            }

            if (this.line != "") {
                this.line += " ";
                this.lineWidth += this.spaceWidth;
            }
            this.line += word;
            this.lineWidth += width;

            while (this.text[i] == " ") {
                i++;
            }

            if (i == this.text.length || this.text[i] == "\n") {
                this.flushLine(y, step);

                y += this.lineHeight;

                if (i == this.text.length) {
                    break;
                }

                i++;

                let extraHeightBetweenParagraphs = Math.floor(0.2 * this.lineHeight);

                y += extraHeightBetweenParagraphs;

                if (y + this.lineHeight - 1 > this.y2) {
                    break;
                }
            }
        }

        this.flushLine(y, step);

        return this.textHeight + this.font.height - this.lineHeight;
    }

    render() {
        const borderSize = this.style.borderSizeRect;
        let borderRadius = styleGetBorderRadius(this.style) || 0;
        if (
            borderSize.top > 0 ||
            borderSize.right > 0 ||
            borderSize.bottom > 0 ||
            borderSize.left > 0
        ) {
            draw.setColor(getStyleProperty(this.style, "borderColor"));
            draw.fillRect(this.ctx, this.x1, this.y1, this.x2, this.y2, borderRadius);
            this.x1 += borderSize.left;
            this.y1 += borderSize.top;
            this.x2 -= borderSize.right;
            this.y2 -= borderSize.bottom;
            borderRadius = Math.max(
                borderRadius -
                    Math.max(borderSize.top, borderSize.right, borderSize.bottom, borderSize.left),
                0
            );
        }

        let backgroundColor = this.inverse
            ? getStyleProperty(this.style, "color")
            : getStyleProperty(this.style, "backgroundColor");
        draw.setColor(backgroundColor);
        draw.fillRect(this.ctx, this.x1, this.y1, this.x2, this.y2, borderRadius);

        const font = styleGetFont(this.style);
        if (!font) {
            return;
        }

        let lineHeight = Math.floor(0.9 * font.height);
        if (lineHeight <= 0) {
            return;
        }

        try {
            this.text = JSON.parse('"' + this.text + '"');
        } catch (e) {
            console.error(e, this.text);
            return;
        }

        this.font = font;
        this.lineHeight = lineHeight;

        this.x1 += this.style.paddingRect.left;
        this.x2 -= this.style.paddingRect.right;
        this.y1 += this.style.paddingRect.top;
        this.y2 -= this.style.paddingRect.bottom;

        const spaceGlyph = font.glyphs.find(glyph => glyph.encoding == 32);
        this.spaceWidth = (spaceGlyph && spaceGlyph.dx) || 0;

        const textHeight = this.executeStep(MultilineTextRenderStep.MEASURE);

        if (styleIsVertAlignTop(this.style)) {
        } else if (styleIsVertAlignBottom(this.style)) {
            this.y1 = this.y2 + 1 - textHeight;
        } else {
            this.y1 += Math.floor((this.y2 - this.y1 + 1 - textHeight) / 2);
        }
        this.y2 = this.y1 + textHeight - 1;

        this.executeStep(MultilineTextRenderStep.RENDER);
    }
}

export const indentationGroup: IPropertyGridGroupDefinition = {
    id: "indentation",
    title: "Indentation",
    position: 5
};

export interface IMultilineTextWidget extends IWidget {
    text?: string;
    firstLineIndent: number;
    hangingIndent: number;
}

export class MultilineTextWidget extends Widget implements IMultilineTextWidget {
    @observable text?: string;
    @observable firstLineIndent: number;
    @observable hangingIndent: number;

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
            makeTextPropertyInfo("text"),
            {
                name: "firstLineIndent",
                displayName: "First line",
                type: PropertyType.Number,
                propertyGridGroup: indentationGroup
            },
            {
                name: "hangingIndent",
                displayName: "Hanging",
                type: PropertyType.Number,
                propertyGridGroup: indentationGroup
            }
        ],

        defaultValue: {
            type: "MultilineText",
            text: "Multiline text",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            firstLineIndent: 0,
            hangingIndent: 0
        },

        icon: "_images/widgets/MultilineText.png",

        check: (object: MultilineTextWidget) => {
            let messages: output.Message[] = [];

            if (!object.text && !object.data) {
                messages.push(output.propertyNotSetMessage(object, "text"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let text = (this.data ? (dataContext.get(this.data) as string) : this.text) || "";

        const w = rect.width;
        const h = rect.height;
        const style = this.style;
        const inverse = false;

        return drawOnCanvas(w, h, (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = w - 1;
            let y2 = h - 1;

            var multilineTextRender = new MultilineTextRender(
                ctx,
                text,
                x1,
                y1,
                x2,
                y2,
                style,
                inverse,
                this.firstLineIndent || 0,
                this.hangingIndent || 0
            );
            multilineTextRender.render();
        });
    }
}

registerClass(MultilineTextWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IRectangleWidget extends IWidget {
    ignoreLuminocity: boolean;
    invertColors: boolean;
}

export class RectangleWidget extends Widget implements IRectangleWidget {
    @observable ignoreLuminocity: boolean;
    @observable invertColors: boolean;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "invertColors",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
                defaultValue: false
            },
            {
                name: "ignoreLuminocity",
                type: PropertyType.Boolean,
                propertyGridGroup: specificGroup,
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

        icon: "_images/widgets/Rectangle.png",

        check: (object: RectangleWidget) => {
            let messages: output.Message[] = [];

            if (object.data) {
                messages.push(output.propertySetButNotUsedMessage(object, "data"));
            }

            return messages;
        }
    });

    draw(rect: Rect): HTMLCanvasElement | undefined {
        const w = rect.width;
        const h = rect.height;
        const style = this.style;
        const inverse = this.invertColors;

        if (w > 0 && h > 0) {
            return drawOnCanvas(w, h, (ctx: CanvasRenderingContext2D) => {
                let x1 = 0;
                let y1 = 0;
                let x2 = w - 1;
                let y2 = h - 1;

                const borderSize = style.borderSizeRect;
                let borderRadius = styleGetBorderRadius(style) || 0;
                if (
                    borderSize.top > 0 ||
                    borderSize.right > 0 ||
                    borderSize.bottom > 0 ||
                    borderSize.left > 0
                ) {
                    draw.setColor(getStyleProperty(style, "borderColor"));
                    draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
                    x1 += borderSize.left;
                    y1 += borderSize.top;
                    x2 -= borderSize.right;
                    y2 -= borderSize.bottom;
                    borderRadius = Math.max(
                        borderRadius -
                            Math.max(
                                borderSize.top,
                                borderSize.right,
                                borderSize.bottom,
                                borderSize.left
                            ),
                        0
                    );
                }

                draw.setColor(
                    inverse
                        ? getStyleProperty(style, "backgroundColor")
                        : getStyleProperty(style, "color")
                );
                draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
            });
        }
        return undefined;
    }
}

registerClass(RectangleWidget);

////////////////////////////////////////////////////////////////////////////////

@observer
class BitmapWidgetPropertyGridUI extends React.Component<PropertyProps> {
    get bitmapWidget() {
        return this.props.objects[0] as BitmapWidget;
    }

    @bind
    resizeToFitBitmap() {
        DocumentStore.updateObject(this.props.objects[0], {
            width: this.bitmapWidget.bitmapObject!.imageElement!.width,
            height: this.bitmapWidget.bitmapObject!.imageElement!.height
        });
    }

    render() {
        if (this.props.objects.length > 1) {
            return null;
        }

        const bitmapObject = this.bitmapWidget.bitmapObject;
        if (!bitmapObject) {
            return null;
        }

        const imageElement = bitmapObject.imageElement;
        if (!imageElement) {
            return null;
        }

        return (
            <BootstrapButton color="primary" size="small" onClick={this.resizeToFitBitmap}>
                Resize to Fit Bitmap
            </BootstrapButton>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IBitmapWidget extends IWidget {
    bitmap?: string;
}

export class BitmapWidget extends Widget implements IBitmapWidget {
    @observable bitmap?: string;

    get label() {
        return this.bitmap ? `${this.type}: ${this.bitmap}` : this.type;
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "bitmap",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "bitmaps"],
                propertyGridGroup: specificGroup
            },
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridComponent: BitmapWidgetPropertyGridUI
            }
        ],

        defaultValue: { type: "Bitmap", left: 0, top: 0, width: 64, height: 32 },

        icon: "_images/widgets/Bitmap.png",

        check: (object: BitmapWidget) => {
            let messages: output.Message[] = [];

            if (!object.data && !object.bitmap) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Either bitmap or data must be set",
                        object
                    )
                );
            } else {
                if (object.data && object.bitmap) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Both bitmap and data set, only bitmap is used",
                            object
                        )
                    );
                }

                if (object.bitmap) {
                    let bitmap = findBitmap(object.bitmap);
                    if (!bitmap) {
                        messages.push(output.propertyNotFoundMessage(object, "bitmap"));
                    }
                }
            }

            return messages;
        }
    });

    @computed
    get bitmapObject() {
        return this.bitmap
            ? findBitmap(this.bitmap)
            : this.data
            ? findBitmap(dataContext.get(this.data) as string)
            : undefined;
    }

    getBitmapObject(dataContext: DataContext) {
        return this.bitmap
            ? findBitmap(this.bitmap)
            : this.data
            ? findBitmap(dataContext.get(this.data) as string)
            : undefined;
    }

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        const w = rect.width;
        const h = rect.height;
        const style = this.style;

        const bitmap = this.getBitmapObject(dataContext);

        const inverse = false;

        if (bitmap) {
            const imageElement = bitmap.imageElement;
            if (!imageElement) {
                return undefined;
            }

            return drawOnCanvas(w, h, (ctx: CanvasRenderingContext2D) => {
                let x1 = 0;
                let y1 = 0;
                let x2 = w - 1;
                let y2 = h - 1;

                if (bitmap.bpp !== 32) {
                    let backgroundColor = inverse
                        ? getStyleProperty(style, "color")
                        : getStyleProperty(style, "backgroundColor");
                    draw.setColor(backgroundColor);
                    draw.fillRect(ctx, x1, y1, x2, y2, 0);
                }

                let width = imageElement.width;
                let height = imageElement.height;

                let x_offset: number;
                if (styleIsHorzAlignLeft(style)) {
                    x_offset = x1 + style.paddingRect.left;
                } else if (styleIsHorzAlignRight(style)) {
                    x_offset = x2 - style.paddingRect.right - width;
                } else {
                    x_offset = Math.floor(x1 + (x2 - x1 - width) / 2);
                }

                let y_offset: number;
                if (styleIsVertAlignTop(style)) {
                    y_offset = y1 + style.paddingRect.top;
                } else if (styleIsVertAlignBottom(style)) {
                    y_offset = y2 - style.paddingRect.bottom - height;
                } else {
                    y_offset = Math.floor(y1 + (y2 - y1 - height) / 2);
                }

                if (inverse) {
                    draw.setBackColor(getStyleProperty(style, "color"));
                    draw.setColor(getStyleProperty(style, "backgroundColor"));
                } else {
                    draw.setBackColor(getStyleProperty(style, "backgroundColor"));
                    draw.setColor(getStyleProperty(style, "color"));
                }

                draw.drawBitmap(ctx, imageElement, x_offset, y_offset, width, height);
            });
        }

        return undefined;
    }
}

registerClass(BitmapWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IButtonWidget extends IWidget {
    text?: string;
    enabled?: string;
    disabledStyle: IStyle;
}

export class ButtonWidget extends Widget implements IButtonWidget {
    @observable text?: string;
    @observable enabled?: string;
    @observable disabledStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            makeDataPropertyInfo("enabled"),
            makeStylePropertyInfo("disabledStyle")
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "disabledStyle");
        },

        defaultValue: { type: "Button", left: 0, top: 0, width: 32, height: 32 },

        icon: "_images/widgets/Button.png",

        check: (object: ButtonWidget) => {
            let messages: output.Message[] = [];

            if (!object.text && !object.data) {
                messages.push(output.propertyNotSetMessage(object, "text"));
            }

            if (object.enabled) {
                if (!findDataItem(object.enabled)) {
                    messages.push(output.propertyNotFoundMessage(object, "enabled"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "enabled"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let text = this.data && dataContext.get(this.data);
        if (!text) {
            text = this.text;
        }
        let style =
            this.enabled && dataContext.getBool(this.enabled) ? this.style : this.disabledStyle;
        return drawText(text, rect.width, rect.height, style, false);
    }
}

registerClass(ButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IToggleButtonWidget extends IWidget {
    text1?: string;
    text2?: string;
}

export class ToggleButtonWidget extends Widget implements IToggleButtonWidget {
    @observable text1?: string;
    @observable text2?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "text1",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            },
            {
                name: "text2",
                type: PropertyType.String,
                propertyGridGroup: specificGroup
            }
        ],

        defaultValue: {
            type: "ToggleButton",
            left: 0,
            top: 0,
            width: 32,
            height: 32
        },

        icon: "_images/widgets/ToggleButton.png",

        check: (object: ToggleButtonWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.text1) {
                messages.push(output.propertyNotSetMessage(object, "text1"));
            }

            if (!object.text2) {
                messages.push(output.propertyNotSetMessage(object, "text2"));
            }

            return messages;
        }
    });

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return drawText(this.text1 || "", rect.width, rect.height, this.style, false);
    }
}

registerClass(ToggleButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IButtonGroupWidget extends IWidget {
    selectedStyle: IStyle;
}

export class ButtonGroupWidget extends Widget implements IButtonGroupWidget {
    @observable selectedStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [makeStylePropertyInfo("selectedStyle")],

        defaultValue: {
            type: "ButtonGroup",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/ButtonGroup.png",

        check: (object: ButtonGroupWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let buttonLabels = (this.data && dataContext.getValueList(this.data)) || [];
        let selectedButton = (this.data && dataContext.get(this.data)) || 0;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            let x = 0;
            let y = 0;
            let w = rect.width;
            let h = rect.height;

            if (w > h) {
                // horizontal orientation
                let buttonWidth = Math.floor(w / buttonLabels.length);
                x += Math.floor((w - buttonWidth * buttonLabels.length) / 2);
                let buttonHeight = h;
                for (let i = 0; i < buttonLabels.length; i++) {
                    ctx.drawImage(
                        i == selectedButton
                            ? drawText(
                                  buttonLabels[i],
                                  buttonWidth,
                                  buttonHeight,
                                  this.selectedStyle,
                                  false
                              )
                            : drawText(
                                  buttonLabels[i],
                                  buttonWidth,
                                  buttonHeight,
                                  this.style,
                                  false
                              ),
                        x,
                        y
                    );
                    x += buttonWidth;
                }
            } else {
                // vertical orientation
                let buttonWidth = w;
                let buttonHeight = Math.floor(h / buttonLabels.length);

                y += Math.floor((h - buttonHeight * buttonLabels.length) / 2);

                let labelHeight = Math.min(buttonWidth, buttonHeight);
                let yOffset = Math.floor((buttonHeight - labelHeight) / 2);

                for (let i = 0; i < buttonLabels.length; i++) {
                    ctx.drawImage(
                        i == selectedButton
                            ? drawText(
                                  buttonLabels[i],
                                  buttonWidth,
                                  labelHeight,
                                  this.selectedStyle,
                                  false
                              )
                            : drawText(
                                  buttonLabels[i],
                                  buttonWidth,
                                  labelHeight,
                                  this.style,
                                  false
                              ),
                        x,
                        y + yOffset
                    );
                    y += buttonHeight;
                }
            }
        });
    }
}

registerClass(ButtonGroupWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IBarGraphWidget extends IWidget {
    orientation?: string;
    textStyle: IStyle;
    line1Data?: string;
    line1Style: IStyle;
    line2Data?: string;
    line2Style: IStyle;
}

export class BarGraphWidget extends Widget implements IBarGraphWidget {
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
                propertyGridGroup: specificGroup,
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

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "textStyle");
            migrateStyleProperty(jsObject, "line1Style");
            migrateStyleProperty(jsObject, "line2Style");
        },

        defaultValue: {
            type: "BarGraph",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            orientation: "left-right"
        },

        icon: "_images/widgets/BarGraph.png",

        check: (object: BarGraphWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (object.line1Data) {
                if (!findDataItem(object.line1Data)) {
                    messages.push(output.propertyNotFoundMessage(object, "line1Data"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "line1Data"));
            }

            if (object.line2Data) {
                if (!findDataItem(object.line2Data)) {
                    messages.push(output.propertyNotFoundMessage(object, "line2Data"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "line2Data"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let barGraphWidget = this;
        let style = barGraphWidget.style;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            let min = (barGraphWidget.data && dataContext.getMin(barGraphWidget.data)) || 0;
            let max = (barGraphWidget.data && dataContext.getMax(barGraphWidget.data)) || 0;
            let valueText = (barGraphWidget.data && dataContext.get(barGraphWidget.data)) || "0";
            let value = parseFloat(valueText);
            if (isNaN(value)) {
                value = 0;
            }
            let horizontal =
                barGraphWidget.orientation == "left-right" ||
                barGraphWidget.orientation == "right-left";

            let d = horizontal ? rect.width : rect.height;

            function calcPos(value: number) {
                let pos = Math.round((value * d) / (max - min));
                if (pos < 0) {
                    pos = 0;
                }
                if (pos > d) {
                    pos = d;
                }
                return pos;
            }

            let pos = calcPos(value);

            if (barGraphWidget.orientation == "left-right") {
                draw.setColor(getStyleProperty(style, "color"));
                draw.fillRect(ctx, 0, 0, pos - 1, rect.height - 1);
                draw.setColor(getStyleProperty(style, "backgroundColor"));
                draw.fillRect(ctx, pos, 0, rect.width - 1, rect.height - 1);
            } else if (barGraphWidget.orientation == "right-left") {
                draw.setColor(getStyleProperty(style, "backgroundColor"));
                draw.fillRect(ctx, 0, 0, rect.width - pos - 1, rect.height - 1);
                draw.setColor(getStyleProperty(style, "color"));
                draw.fillRect(ctx, rect.width - pos, 0, rect.width - 1, rect.height - 1);
            } else if (barGraphWidget.orientation == "top-bottom") {
                draw.setColor(getStyleProperty(style, "color"));
                draw.fillRect(ctx, 0, 0, rect.width - 1, pos - 1);
                draw.setColor(getStyleProperty(style, "backgroundColor"));
                draw.fillRect(ctx, 0, pos, rect.width - 1, rect.height - 1);
            } else {
                draw.setColor(getStyleProperty(style, "backgroundColor"));
                draw.fillRect(ctx, 0, 0, rect.width - 1, rect.height - pos - 1);
                draw.setColor(getStyleProperty(style, "color"));
                draw.fillRect(ctx, 0, rect.height - pos, rect.width - 1, rect.height - 1);
            }

            if (horizontal) {
                let textStyle = barGraphWidget.textStyle;
                const font = styleGetFont(textStyle);
                if (font) {
                    let w = draw.measureStr(valueText, font, rect.width);
                    w += style.paddingRect.left;

                    if (w > 0 && rect.height > 0) {
                        let backgroundColor: string;
                        let x: number;

                        if (pos + w <= rect.width) {
                            backgroundColor = getStyleProperty(style, "backgroundColor");
                            x = pos;
                        } else {
                            backgroundColor = getStyleProperty(style, "color");
                            x = pos - w - style.paddingRect.right;
                        }

                        ctx.drawImage(
                            drawText(valueText, w, rect.height, textStyle, false, backgroundColor),
                            x,
                            0
                        );
                    }
                }
            }

            function drawLine(lineData: string | undefined, lineStyle: Style) {
                let value = (lineData && parseFloat(dataContext.get(lineData))) || 0;
                if (isNaN(value)) {
                    value = 0;
                }
                let pos = calcPos(value);
                if (pos == d) {
                    pos = d - 1;
                }
                draw.setColor(getStyleProperty(lineStyle, "color"));
                if (barGraphWidget.orientation == "left-right") {
                    draw.drawVLine(ctx, pos, 0, rect.height - 1);
                } else if (barGraphWidget.orientation == "right-left") {
                    draw.drawVLine(ctx, rect.width - pos, 0, rect.height - 1);
                } else if (barGraphWidget.orientation == "top-bottom") {
                    draw.drawHLine(ctx, 0, pos, rect.width - 1);
                } else {
                    draw.drawHLine(ctx, 0, rect.height - pos, rect.width - 1);
                }
            }

            drawLine(barGraphWidget.line1Data, barGraphWidget.line1Style);
            drawLine(barGraphWidget.line2Data, barGraphWidget.line2Style);
        });
    }
}

registerClass(BarGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IYTGraphWidget extends IWidget {
    y1Style: IStyle;
    y2Data?: string;
    y2Style: IStyle;
}

export class YTGraphWidget extends Widget implements IYTGraphWidget {
    @observable y1Style: Style;
    @observable y2Data?: string;
    @observable y2Style: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            Object.assign(makeStylePropertyInfo("y1Style"), hideIfNotProjectVersion1),
            Object.assign(makeStylePropertyInfo("y2Style"), hideIfNotProjectVersion1),
            Object.assign(makeDataPropertyInfo("y2Data"), hideIfNotProjectVersion1)
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "y1Style");
            migrateStyleProperty(jsObject, "y2Style");
        },

        defaultValue: {
            type: "YTGraph",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/YTGraph.png",

        check: (object: YTGraphWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (ProjectStore.project.settings.general.projectVersion === "v1") {
                if (object.y2Data) {
                    if (!findDataItem(object.y2Data)) {
                        messages.push(output.propertyNotFoundMessage(object, "y2Data"));
                    }
                } else {
                    messages.push(output.propertyNotSetMessage(object, "y2Data"));
                }
            }

            return messages;
        }
    });

    draw(rect: Rect): HTMLCanvasElement | undefined {
        let ytGraphWidget = this;
        let style = ytGraphWidget.style;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = rect.width - 1;
            let y2 = rect.height - 1;

            const borderSize = style.borderSizeRect;
            let borderRadius = styleGetBorderRadius(style) || 0;
            if (
                borderSize.top > 0 ||
                borderSize.right > 0 ||
                borderSize.bottom > 0 ||
                borderSize.left > 0
            ) {
                draw.setColor(getStyleProperty(style, "borderColor"));
                draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
                x1 += borderSize.left;
                y1 += borderSize.top;
                x2 -= borderSize.right;
                y2 -= borderSize.bottom;
                borderRadius = Math.max(
                    borderRadius -
                        Math.max(
                            borderSize.top,
                            borderSize.right,
                            borderSize.bottom,
                            borderSize.left
                        ),
                    0
                );
            }

            draw.setColor(getStyleProperty(style, "backgroundColor"));
            draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
        });
    }
}

registerClass(YTGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IUpDownWidget extends IWidget {
    buttonsStyle: IStyle;
    downButtonText?: string;
    upButtonText?: string;
}

export class UpDownWidget extends Widget implements IUpDownWidget {
    @observable buttonsStyle: Style;
    @observable downButtonText?: string;
    @observable upButtonText?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeStylePropertyInfo("buttonsStyle"),
            makeTextPropertyInfo("downButtonText", undefined, specificGroup),
            makeTextPropertyInfo("upButtonText", undefined, specificGroup)
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "buttonsStyle");
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

        icon: "_images/widgets/UpDown.png",

        check: (object: UpDownWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.downButtonText) {
                messages.push(output.propertyNotSetMessage(object, "downButtonText"));
            }

            if (!object.upButtonText) {
                messages.push(output.propertyNotSetMessage(object, "upButtonText"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let upDownWidget = this;
        let style = upDownWidget.style;
        let buttonsStyle = upDownWidget.buttonsStyle;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            const buttonsFont = styleGetFont(buttonsStyle);
            if (!buttonsFont) {
                return;
            }

            let downButtonCanvas = drawText(
                upDownWidget.downButtonText || "<",
                buttonsFont.height,
                rect.height,
                buttonsStyle,
                false
            );
            ctx.drawImage(downButtonCanvas, 0, 0);

            let text = upDownWidget.data ? (dataContext.get(upDownWidget.data) as string) : "";
            let textCanvas = drawText(
                text,
                rect.width - 2 * buttonsFont.height,
                rect.height,
                style,
                false
            );
            ctx.drawImage(textCanvas, buttonsFont.height, 0);

            let upButonCanvas = drawText(
                upDownWidget.upButtonText || ">",
                buttonsFont.height,
                rect.height,
                buttonsStyle,
                false
            );
            ctx.drawImage(upButonCanvas, rect.width - buttonsFont.height, 0);
        });
    }
}

registerClass(UpDownWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IListGraphWidget extends IWidget {
    dwellData?: string;
    y1Data?: string;
    y1Style: IStyle;
    y2Data?: string;
    y2Style: IStyle;
    cursorData?: string;
    cursorStyle: IStyle;
}

export class ListGraphWidget extends Widget implements IListGraphWidget {
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

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "y1Style");
            migrateStyleProperty(jsObject, "y2Style");
            migrateStyleProperty(jsObject, "cursorStyle");
        },

        defaultValue: {
            type: "ListGraph",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/ListGraph.png",

        check: (object: ListGraphWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (object.dwellData) {
                if (!findDataItem(object.dwellData)) {
                    messages.push(output.propertyNotFoundMessage(object, "dwellData"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "dwellData"));
            }

            if (object.y1Data) {
                if (!findDataItem(object.y1Data)) {
                    messages.push(output.propertyNotFoundMessage(object, "y1Data"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "y1Data"));
            }

            if (object.y2Data) {
                if (!findDataItem(object.y2Data)) {
                    messages.push(output.propertyNotFoundMessage(object, "y2Data"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "y2Data"));
            }

            if (object.cursorData) {
                if (!findDataItem(object.cursorData)) {
                    messages.push(output.propertyNotFoundMessage(object, "cursorData"));
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "cursorData"));
            }

            return messages;
        }
    });

    draw(rect: Rect): HTMLCanvasElement | undefined {
        let listGraphWidget = this;
        let style = listGraphWidget.style;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = rect.width - 1;
            let y2 = rect.height - 1;

            const borderSize = style.borderSizeRect;
            let borderRadius = styleGetBorderRadius(style) || 0;
            if (
                borderSize.top > 0 ||
                borderSize.right > 0 ||
                borderSize.bottom > 0 ||
                borderSize.left > 0
            ) {
                draw.setColor(getStyleProperty(style, "borderColor"));
                draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
                x1 += borderSize.left;
                y1 += borderSize.top;
                x2 -= borderSize.right;
                y2 -= borderSize.bottom;
                borderRadius = Math.max(
                    borderRadius -
                        Math.max(
                            borderSize.top,
                            borderSize.right,
                            borderSize.bottom,
                            borderSize.left
                        ),
                    0
                );
            }

            draw.setColor(getStyleProperty(style, "backgroundColor"));
            draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
        });
    }
}

registerClass(ListGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IAppViewWidget extends IWidget {
    page: string;
}

export class AppViewWidget extends Widget implements IAppViewWidget {
    @observable page: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: { type: "AppView", left: 0, top: 0, width: 64, height: 32 },

        icon: "_images/widgets/AppView.png",

        check: (object: AppViewWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            return messages;
        }
    });

    render(rect: Rect, dataContext: DataContext) {
        if (!this.data) {
            return null;
        }

        const pageName = dataContext.get(this.data);
        if (!pageName) {
            return null;
        }

        const page = findPage(pageName);
        if (!page) {
            return null;
        }

        return page.render(rect, dataContext);
    }
}

registerClass(AppViewWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IScrollBarWidget extends IWidget {
    thumbStyle: IStyle;
    buttonsStyle: IStyle;
    leftButtonText?: string;
    rightButtonText?: string;
}

export class ScrollBarWidget extends Widget implements IScrollBarWidget {
    @observable thumbStyle: Style;
    @observable buttonsStyle: Style;
    @observable leftButtonText?: string;
    @observable rightButtonText?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeStylePropertyInfo("thumbStyle"),
            makeStylePropertyInfo("buttonsStyle"),
            makeTextPropertyInfo("leftButtonText", undefined, specificGroup),
            makeTextPropertyInfo("rightButtonText", undefined, specificGroup)
        ],

        defaultValue: {
            type: "ScrollBar",
            left: 0,
            top: 0,
            width: 128,
            height: 32,
            leftButtonText: "<",
            rightButtonText: ">"
        },

        icon: "_images/widgets/UpDown.png",

        check: (object: ScrollBarWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.leftButtonText) {
                messages.push(output.propertyNotSetMessage(object, "leftButtonText"));
            }

            if (!object.rightButtonText) {
                messages.push(output.propertyNotSetMessage(object, "rightButtonText"));
            }

            return messages;
        }
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let widget = this;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            const buttonsFont = styleGetFont(widget.buttonsStyle);
            if (!buttonsFont) {
                return;
            }

            let isHorizontal = rect.width > rect.height;

            let buttonSize = isHorizontal ? rect.height : rect.width;

            // draw left button
            let leftButtonCanvas = drawText(
                widget.leftButtonText || "<",
                isHorizontal ? buttonSize : rect.width,
                isHorizontal ? rect.height : buttonSize,
                widget.buttonsStyle,
                false
            );
            ctx.drawImage(leftButtonCanvas, 0, 0);

            // draw track
            let x;
            let y;
            let width;
            let height;

            if (isHorizontal) {
                x = buttonSize;
                y = 0;
                width = rect.width - 2 * buttonSize;
                height = rect.height;
            } else {
                x = 0;
                y = buttonSize;
                width = rect.width;
                height = rect.height - 2 * buttonSize;
            }

            draw.setColor(getStyleProperty(this.style, "color"));
            draw.fillRect(ctx, x, y, x + width - 1, y + height - 1, 0);

            // draw thumb
            const [size, position, pageSize] = (widget.data && dataContext.get(widget.data)) || [
                100,
                25,
                20
            ];

            let xThumb;
            let widthThumb;
            let yThumb;
            let heightThumb;

            if (isHorizontal) {
                xThumb = Math.floor((position * width) / size);
                widthThumb = Math.max(Math.floor((pageSize * width) / size), buttonSize);
                yThumb = y;
                heightThumb = height;
            } else {
                xThumb = x;
                widthThumb = width;
                yThumb = Math.floor((position * height) / size);
                heightThumb = Math.max(Math.floor((pageSize * height) / size), buttonSize);
            }

            draw.setColor(getStyleProperty(this.thumbStyle, "color"));
            draw.fillRect(
                ctx,
                xThumb,
                yThumb,
                xThumb + widthThumb - 1,
                yThumb + heightThumb - 1,
                0
            );

            // draw right button
            let rightButonCanvas = drawText(
                widget.rightButtonText || ">",
                isHorizontal ? buttonSize : rect.width,
                isHorizontal ? rect.height : buttonSize,
                widget.buttonsStyle,
                false
            );
            ctx.drawImage(
                rightButonCanvas,
                isHorizontal ? rect.width - buttonSize : 0,
                isHorizontal ? 0 : rect.height - buttonSize
            );
        });
    }
}

registerClass(ScrollBarWidget);

////////////////////////////////////////////////////////////////////////////////

export interface IProgressWidget extends IWidget {}

export class ProgressWidget extends Widget implements IProgressWidget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: {
            type: "Progress",
            left: 0,
            top: 0,
            width: 128,
            height: 32
        },

        icon: "_images/widgets/Progress.png"
    });

    draw(rect: Rect, dataContext: DataContext): HTMLCanvasElement | undefined {
        let widget = this;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            let isHorizontal = rect.width > rect.height;

            draw.setColor(getStyleProperty(this.style, "backgroundColor"));
            draw.fillRect(ctx, 0, 0, rect.width - 1, rect.height - 1, 0);

            // draw thumb
            const percent = (widget.data && dataContext.get(widget.data)) || 25;
            draw.setColor(getStyleProperty(this.style, "color"));
            if (isHorizontal) {
                draw.fillRect(ctx, 0, 0, (percent * rect.width) / 100 - 1, rect.height - 1, 0);
            } else {
                draw.fillRect(
                    ctx,
                    0,
                    rect.height - (percent * rect.height) / 100,
                    rect.width - 1,
                    rect.height - 1,
                    0
                );
            }
        });
    }
}

registerClass(ProgressWidget);

////////////////////////////////////////////////////////////////////////////////

export interface ICanvasWidget extends IWidget {}

export class CanvasWidget extends Widget implements ICanvasWidget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: {
            type: "Canvas",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "_images/widgets/Canvas.png"
    });

    draw(rect: Rect): HTMLCanvasElement | undefined {
        let widget = this;
        let style = widget.style;

        return drawOnCanvas(rect.width, rect.height, (ctx: CanvasRenderingContext2D) => {
            let x1 = 0;
            let y1 = 0;
            let x2 = rect.width - 1;
            let y2 = rect.height - 1;

            draw.setColor(getStyleProperty(style, "backgroundColor"));
            draw.fillRect(ctx, x1, y1, x2, y2, 0);
        });
    }
}

registerClass(CanvasWidget);

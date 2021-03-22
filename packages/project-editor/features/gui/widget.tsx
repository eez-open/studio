import React from "react";
import { observable, computed } from "mobx";

import { _find, _range } from "eez-studio-shared/algorithm";
import { to16bitsColor } from "eez-studio-shared/color";
import { humanize } from "eez-studio-shared/string";
import { validators } from "eez-studio-shared/validation";
import { Rect } from "eez-studio-shared/geometry";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    IEezObject,
    EezObject,
    ClassInfo,
    PropertyInfo,
    PropertyType,
    findClass,
    isArray,
    dataGroup,
    actionsGroup,
    geometryGroup,
    styleGroup,
    specificGroup,
    IPropertyGridGroupDefinition,
    areAllChildrenOfTheSameParent,
    IOnSelectParams,
    getChildOfObject,
    getParent,
    getClassInfo,
    makeDerivedClassInfo,
    getLabel
} from "project-editor/core/object";
import { loadObject, objectToJS } from "project-editor/core/serialization";
import {
    IContextMenuContext,
    getDocumentStore
} from "project-editor/core/store";
import * as output from "project-editor/core/output";

import { checkObjectReference } from "project-editor/project/project";

import type {
    IResizeHandler,
    IDesignerContext,
    IDataContext
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { WidgetGeometry } from "project-editor/features/gui/page-editor/render";
import {
    IResizing,
    resizingProperty
} from "project-editor/features/gui/page-editor/resizing-widget-property";

import { onSelectItem } from "project-editor/components/SelectItem";

import { Page } from "project-editor/features/gui/page";
import { Style, IStyle } from "project-editor/features/gui/style";

import type { IContainerWidget } from "project-editor/features/gui/widgets";

const { MenuItem } = EEZStudio.remote;

////////////////////////////////////////////////////////////////////////////////

export function makeDataPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.ObjectReference,
        referencedObjectCollectionPath: "data",
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
        referencedObjectCollectionPath: "actions",
        propertyGridGroup: propertyGridGroup || actionsGroup,
        onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
            onSelectItem(object, propertyInfo, {
                title: propertyInfo.onSelectTitle!,
                width: 800
            }),
        onSelectTitle: "Select Action"
    };
}

export function makeStylePropertyInfo(
    name: string,
    displayName?: string
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.Object,
        typeClass: Style,
        propertyGridGroup: styleGroup,
        propertyGridCollapsable: true,
        propertyGridCollapsableDefaultPropertyName: "inheritFrom",
        propertyGridCollapsableEnabled: (object: IEezObject) =>
            !getDocumentStore(object).masterProjectEnabled,
        enumerable: false
    };
}

export function makeTextPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return {
        name,
        displayName,
        type: PropertyType.String,
        propertyGridGroup: propertyGridGroup || specificGroup,
        onSelect: (
            object: IEezObject,
            propertyInfo: PropertyInfo,
            params?: IOnSelectParams
        ) =>
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

export function migrateStyleProperty(
    jsObject: any,
    propertyName: string,
    propertyName2?: string
) {
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

function getClassFromType(type: string) {
    if (type.startsWith("Local.")) {
        return findClass("LayoutViewWidget");
    }
    let widgetClass = findClass(type + "Widget");
    if (!widgetClass) {
        widgetClass = findClass(type);
    }
    return widgetClass;
}

export function getTypeFromClass(objectClass: typeof EezObject) {
    const className = objectClass.name;
    if (className.endsWith("Widget")) {
        return className.substring(0, className.length - "Widget".length);
    }
    return className;
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

    wireID?: string;
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

    @observable resizing: IResizing;

    @observable wireID?: string;

    @observable _geometry: WidgetGeometry;

    get autoSize() {
        return false;
    }

    get label() {
        return this.type;
    }

    static classInfo: ClassInfo = {
        getClass: function (jsObject: any) {
            return getClassFromType(jsObject.type);
        },

        label: (widget: Widget) => {
            if (widget.data) {
                return `${humanize(widget.type)}: ${widget.data}`;
            }

            if (widget.type.endsWith("ActionNode")) {
                return humanize(
                    widget.type.substring(
                        0,
                        widget.type.length - "ActionNode".length
                    )
                );
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
            resizingProperty,
            {
                name: "absolutePosition",
                type: PropertyType.String,
                propertyGridGroup: geometryGroup,
                computed: true
            },
            makeDataPropertyInfo("data"),
            makeActionPropertyInfo("action"),
            makeStylePropertyInfo("style", "Normal style"),
            {
                name: "wireID",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
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
                            const containerWidget = Widget.putInContainer(
                                objects as Widget[]
                            );
                            context.selectObject(containerWidget);
                        }
                    })
                );

                additionalMenuItems.push(
                    new MenuItem({
                        label: "Create Layout",
                        click: async () => {
                            const layoutWidget = await Widget.createLayout(
                                objects as Widget[]
                            );
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

            const parent = getWidgetParent(object);
            if (
                !(
                    (parent instanceof Page && parent.isAction) ||
                    object instanceof ActionNode
                )
            ) {
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

                if (
                    object.left + object.width >
                    getWidgetParent(object).width
                ) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Widget is outside of its parent",
                            getChildOfObject(object, "width")
                        )
                    );
                }

                if (
                    object.top + object.height >
                    getWidgetParent(object).height
                ) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Widget is outside of its parent",
                            getChildOfObject(object, "height")
                        )
                    );
                }
            }

            checkObjectReference(object, "data", messages);
            checkObjectReference(object, "action", messages);

            return messages;
        },
        getRect: (object: Widget) => {
            return {
                left: object.left,
                top: object.top,
                width: object._geometry?.width ?? 0,
                height: object._geometry?.height ?? 0
            };
        },
        setRect: (object: Widget, value: Rect) => {
            const props: Partial<Rect> = {};

            if (value.left !== object.left) {
                props.left = value.left;
            }

            if (value.top !== object.top) {
                props.top = value.top;
            }

            if (value.width !== object._geometry?.width ?? 0) {
                props.width = value.width;
            }

            if (value.height !== object._geometry?.height ?? 0) {
                props.height = value.height;
            }

            const DocumentStore = getDocumentStore(object);
            DocumentStore.updateObject(object, props);
        },
        isMoveable: (object: Widget) => {
            return object.isMoveable;
        },
        isSelectable: (object: Widget) => {
            return true;
        },
        showSelectedObjectsParent: (object: Widget) => {
            return true;
        },
        getResizeHandlers(object: Widget) {
            return object.getResizeHandlers();
        }
    };

    @computed
    get absolutePositionPoint() {
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

        return { x, y };
    }

    @computed
    get absolutePosition() {
        const point = this.absolutePositionPoint;

        return `${point.x}, ${point.y}`;
    }

    @computed get inputProperties() {
        const classInfo = getClassInfo(this);
        const properties = classInfo.properties;
        return properties.filter(
            property => property.type == PropertyType.ConnectionInput
        );
    }

    @computed get outputProperties() {
        const classInfo = getClassInfo(this);
        const properties = classInfo.properties;
        return properties.filter(
            property => property.type == PropertyType.ConnectionOutput
        );
    }

    @computed
    get isMoveable() {
        return true;
    }

    @computed
    get styleObject() {
        return this.style;
    }

    putInSelect() {
        let thisWidgetJsObject = objectToJS(this);

        var selectWidgetJsObject = Object.assign(
            {},
            getClassFromType("Select")?.classInfo.defaultValue,
            { type: "Select" }
        );

        selectWidgetJsObject.left = this.left;
        selectWidgetJsObject.top = this.top;
        selectWidgetJsObject.width = this.width;
        selectWidgetJsObject.height = this.height;

        thisWidgetJsObject.left = 0;
        delete thisWidgetJsObject.left_;
        thisWidgetJsObject.top = 0;
        delete thisWidgetJsObject.top_;

        selectWidgetJsObject.widgets = [thisWidgetJsObject];

        const DocumentStore = getDocumentStore(this);

        return DocumentStore.replaceObject(
            this,
            loadObject(
                DocumentStore,
                getParent(this),
                selectWidgetJsObject,
                Widget
            )
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
            getClassFromType("Container")?.classInfo.defaultValue,
            { type: "Container" }
        );

        const createWidgetsResult = Widget.createWidgets(fromWidgets);

        containerWidgetJsObject.widgets = createWidgetsResult.widgets;

        containerWidgetJsObject.left = createWidgetsResult.left;
        containerWidgetJsObject.top = createWidgetsResult.top;
        containerWidgetJsObject.width = createWidgetsResult.width;
        containerWidgetJsObject.height = createWidgetsResult.height;

        const DocumentStore = getDocumentStore(fromWidgets[0]);

        return DocumentStore.replaceObjects(
            fromWidgets,
            loadObject(
                DocumentStore,
                getParent(fromWidgets[0]),
                containerWidgetJsObject,
                Widget
            )
        );
    }

    static async createLayout(fromWidgets: Widget[]) {
        const DocumentStore = getDocumentStore(fromWidgets[0]);
        const layouts = DocumentStore.project.gui.pages;

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Layout name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [
                                validators.required,
                                validators.unique({}, layouts)
                            ]
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
                    DocumentStore,
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
                    DocumentStore,
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

            return getDocumentStore(fromWidgets[0]).replaceObjects(
                fromWidgets,
                loadObject(
                    getDocumentStore(fromWidgets[0]),
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

    draw?: (
        ctx: CanvasRenderingContext2D,
        designerContext: IDesignerContext,
        dataContext: IDataContext
    ) => void;

    render(
        designerContext: IDesignerContext,
        dataContext: IDataContext
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

    getClassName() {
        return "";
    }

    styleHook(
        style: React.CSSProperties,
        designerContext: IDesignerContext | undefined
    ) {
        const backgroundColor = this.style.backgroundColorProperty;
        style.backgroundColor = to16bitsColor(backgroundColor);
    }

    onClick?: () => void = undefined;
}

////////////////////////////////////////////////////////////////////////////////

export class ActionNode extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {});

    get autoSize() {
        return true;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [];
    }

    getClassName() {
        return "eez-action-node";
    }

    styleHook(
        style: React.CSSProperties,
        designerContext: IDesignerContext | undefined
    ) {}

    render(designerContext: IDesignerContext, dataContext: IDataContext) {
        const classInfo = getClassInfo(this);

        return (
            <>
                <div className="title-enclosure">
                    <div className="title">
                        {typeof classInfo.icon == "string" ? (
                            <img src={classInfo.icon} />
                        ) : (
                            classInfo.icon
                        )}
                        <span>{getLabel(this)}</span>
                    </div>
                </div>
                <div className="body">
                    <div className="inports">
                        {this.inputProperties.map(property => (
                            <div
                                key={property.name}
                                className="eez-connection-input"
                                data-connection-input-id={property.name}
                            >
                                {humanize(property.name)}
                            </div>
                        ))}
                    </div>
                    <div className="outports">
                        {this.outputProperties.map(property => (
                            <div
                                key={property.name}
                                className="eez-connection-output"
                                data-connection-output-id={property.name}
                            >
                                {humanize(property.name)}
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    execute() {}
}

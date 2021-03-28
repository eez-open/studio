import React from "react";
import { observable, computed } from "mobx";

import { _each, _find, _range } from "eez-studio-shared/algorithm";
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
    getLabel,
    getAncestorOfType,
    findPropertyByNameInObject
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
import { ComponentGeometry } from "project-editor/features/gui/page-editor/render";
import {
    IResizing,
    resizingProperty
} from "project-editor/features/gui/page-editor/resizing-widget-property";

import { onSelectItem } from "project-editor/components/SelectItem";

import { Page } from "project-editor/features/gui/page";
import { Style } from "project-editor/features/gui/style";
import { ContainerWidget } from "project-editor/features/gui/widgets";

const { MenuItem } = EEZStudio.remote || {};

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

    if (!widgetClass) {
        widgetClass = NotFoundComponent;
    }

    return widgetClass;
}

////////////////////////////////////////////////////////////////////////////////

// Return immediate parent, which can be of type Page or Widget
// (i.e. ContainerWidget, ListWidget, GridWidget, SelectWidget)
export function getWidgetParent(widget: Component | Page) {
    let parent = getParent(widget);
    if (isArray(parent)) {
        parent = getParent(parent);
    }
    return parent as Component | Page;
}

////////////////////////////////////////////////////////////////////////////////

export class Component extends EezObject {
    @observable type: string;

    @observable left: number;
    @observable top: number;
    @observable width: number;
    @observable height: number;

    @observable wireID?: string;

    @observable _geometry: ComponentGeometry;

    get autoSize() {
        return false;
    }

    static classInfo: ClassInfo = {
        getClass: function (jsObject: any) {
            return getClassFromType(jsObject.type);
        },

        label: (component: Component) => {
            let type = component.type;

            const parts = type.split("/");
            if (parts.length == 2) {
                type = parts[1];
            }

            if (type.endsWith("Widget")) {
                type = type.substring(0, type.length - "Widget".length);
            } else if (type.endsWith("ActionComponent")) {
                type = type.substring(
                    0,
                    type.length - "ActionComponent".length
                );
            }

            type = humanize(type);

            if (component instanceof Widget && component.data) {
                return `${type}: ${component.data}`;
            }

            return humanize(type);
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
            {
                name: "wireID",
                type: PropertyType.String,
                hideInPropertyGrid: true
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
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
        },

        isPropertyMenuSupported: true,

        getRect: (object: Component) => {
            return {
                left: object.left,
                top: object.top,
                width: object._geometry?.width ?? 0,
                height: object._geometry?.height ?? 0
            };
        },
        setRect: (object: Component, value: Rect) => {
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
        isMoveable: (object: Component) => {
            return object.isMoveable;
        },
        isSelectable: (object: Component) => {
            return true;
        }
    };

    @computed
    get absolutePositionPoint() {
        let x = this.left;
        let y = this.top;

        for (
            let parent = getWidgetParent(this);
            parent && (parent instanceof Page || parent instanceof Widget);
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

    getClassName() {
        return "";
    }

    onClick?: () => void = undefined;

    styleHook(
        style: React.CSSProperties,
        designerContext: IDesignerContext | undefined
    ) {}
}

////////////////////////////////////////////////////////////////////////////////

export class Widget extends Component {
    @observable style: Style;
    @observable data?: string;
    @observable action?: string;

    @observable resizing: IResizing;

    static classInfo: ClassInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: [
            resizingProperty,
            makeDataPropertyInfo("data"),
            makeActionPropertyInfo("action"),
            makeStylePropertyInfo("style", "Normal style")
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.type.startsWith("Local.")) {
                jsObject.layout = jsObject.type.substring("Local.".length);
                jsObject.type = "LayoutView";
            }

            migrateStyleProperty(jsObject, "style");

            if (jsObject.style && typeof jsObject.style.padding === "number") {
                delete jsObject.style.padding;
            }

            delete jsObject.activeStyle;
        },

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
                                objects as Component[]
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
                                objects as Component[]
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
                                objects as Component[]
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

        check: (object: Component) => {
            let messages: output.Message[] = [];

            const parent = getWidgetParent(object);
            if (
                !(
                    (parent instanceof Page && parent.isAction) ||
                    object instanceof ActionComponent
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
        showSelectedObjectsParent: () => {
            return true;
        },
        getResizeHandlers(object: Widget) {
            return object.getResizeHandlers();
        }
    });

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
                Component
            )
        );
    }

    static createWidgets(fromWidgets: Component[]) {
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

    static putInContainer(fromWidgets: Component[]) {
        var containerWidgetJsObject: ContainerWidget = Object.assign(
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
                Component
            )
        );
    }

    static async createLayout(fromWidgets: Component[]) {
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
                    Component
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
    }

    static async replaceWithLayout(fromWidgets: Component[]) {
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
                    Component
                )
            );
        } catch (error) {
            console.error(error);
            return undefined;
        }
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

    styleHook(
        style: React.CSSProperties,
        designerContext: IDesignerContext | undefined
    ) {
        const backgroundColor = this.style.backgroundColorProperty;
        style.backgroundColor = to16bitsColor(backgroundColor);
    }
}

////////////////////////////////////////////////////////////////////////////////

function renderActionComponent(
    actionNode: ActionComponent,
    designerContext: IDesignerContext,
    dataContext: IDataContext,
    titleStyle?: React.CSSProperties
) {
    const classInfo = getClassInfo(actionNode);

    const inputs = actionNode.inputProperties;
    const outputs = actionNode.outputProperties;

    return (
        <>
            <div className="title-enclosure">
                <div className="title" style={titleStyle}>
                    {typeof classInfo.icon == "string" ? (
                        <img src={classInfo.icon} />
                    ) : (
                        classInfo.icon
                    )}
                    <span>{getLabel(actionNode)}</span>
                </div>
            </div>
            {(inputs.length > 0 || outputs.length > 0) && (
                <div className="body">
                    <div className="inports">
                        {inputs.map(property => (
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
                        {outputs.map(property => (
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
            )}
        </>
    );
}

////////////////////////////////////////////////////////////////////////////////

export class ActionComponent extends Component {
    static classInfo = makeDerivedClassInfo(Component.classInfo, {});

    get autoSize() {
        return true;
    }

    @computed
    get absolutePositionPoint() {
        return { x: this.left, y: this.top };
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return [];
    }

    getClassName() {
        return "eez-action-node";
    }

    render(designerContext: IDesignerContext, dataContext: IDataContext) {
        return renderActionComponent(this, designerContext, dataContext);
    }

    execute() {}
}

////////////////////////////////////////////////////////////////////////////////

export class NotFoundComponent extends ActionComponent {
    static classInfo = makeDerivedClassInfo(ActionComponent.classInfo, {
        label: (widget: Component) => {
            return `${ActionComponent.classInfo.label!(widget)} [NOT FOUND]`;
        },
        icon: (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 4.970000743865967 8"
            >
                <path d="M2.47 0C1.62 0 .99.26.59.66c-.4.4-.54.9-.59 1.28l1 .13c.04-.25.12-.5.31-.69C1.5 1.19 1.8 1 2.47 1c.66 0 1.02.16 1.22.34.2.18.28.4.28.66 0 .83-.34 1.06-.84 1.5-.5.44-1.16 1.08-1.16 2.25V6h1v-.25c0-.83.31-1.06.81-1.5.5-.44 1.19-1.08 1.19-2.25 0-.48-.17-1.02-.59-1.41C3.95.2 3.31 0 2.47 0zm-.5 7v1h1V7h-1z" />
            </svg>
        ),
        beforeLoadHook(object: NotFoundComponent, jsObject: any) {
            // make sure unknow properties are remembered
            _each(jsObject, (value, key) => {
                if (!findPropertyByNameInObject(object, key)) {
                    (object as any)[key] = value;
                }
            });
        }
    });

    @computed get inputProperties() {
        const page = getAncestorOfType(this, Page.classInfo) as Page;
        return page.connectionLines
            .filter(connectionLine => connectionLine.target == this.wireID)
            .map(connectionLine => ({
                name: connectionLine.input,
                type: PropertyType.ConnectionInput
            }));
    }

    @computed get outputProperties() {
        const page = getAncestorOfType(this, Page.classInfo) as Page;
        return page.connectionLines
            .filter(connectionLine => connectionLine.source == this.wireID)
            .map(connectionLine => ({
                name: connectionLine.output,
                type: PropertyType.ConnectionOutput
            }));
    }

    get autoSize() {
        return (
            this.inputProperties.length > 0 ||
            this.outputProperties.length > 0 ||
            this.width === 0 ||
            this.height == 0
        );
    }

    render(
        designerContext: IDesignerContext,
        dataContext: IDataContext
    ): JSX.Element {
        return renderActionComponent(this, designerContext, dataContext, {
            backgroundColor: "red"
        });
    }
}

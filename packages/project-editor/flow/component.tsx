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
    findPropertyByNameInObject,
    findPropertyByNameInClassInfo,
    PropertyProps,
    generalGroup,
    isPropertyHidden,
    getObjectPropertyDisplayName,
    getProperty
} from "project-editor/core/object";
import { loadObject, objectToJS } from "project-editor/core/serialization";
import {
    IContextMenuContext,
    getDocumentStore
} from "project-editor/core/store";
import * as output from "project-editor/core/output";

import { checkObjectReference, getFlow } from "project-editor/project/project";

import type {
    IResizeHandler,
    IFlowContext,
    IRunningFlow
} from "project-editor/flow/flow-interfaces";
import { ComponentGeometry } from "project-editor/flow/flow-editor/render";
import {
    IResizing,
    resizingProperty
} from "project-editor/flow/flow-editor/resizing-widget-property";

import { onSelectItem } from "project-editor/components/SelectItem";

import { Page } from "project-editor/features/page/page";
import { Style } from "project-editor/features/style/style";
import { ContainerWidget } from "project-editor/flow/widgets";
import { guid } from "eez-studio-shared/guid";
import classNames from "classnames";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { checkExpression } from "./expression";

const { MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export function makeDataPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return makeToggablePropertyToInput({
        name,
        displayName,
        type: PropertyType.ObjectReference,
        referencedObjectCollectionPath: "globalVariables",
        propertyGridGroup: propertyGridGroup || dataGroup,
        onSelect: (object: IEezObject, propertyInfo: PropertyInfo) =>
            onSelectItem(object, propertyInfo, {
                title: propertyInfo.onSelectTitle!,
                width: 800
            }),
        onSelectTitle: "Select Data"
    });
}

export function makeActionPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
): PropertyInfo {
    return makeToggablePropertyToOutput({
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
    });
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
        enumerable: false,
        hideInPropertyGrid: (object: IEezObject) =>
            getDocumentStore(object).isDashboardProject
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

export function makeToggablePropertyToInput(
    propertyInfo: PropertyInfo
): PropertyInfo {
    return Object.assign(propertyInfo, {
        toggableProperty: "input",
        propertyMenu(props: PropertyProps) {
            let menuItems: Electron.MenuItem[] = [];

            if (props.objects.length == 1) {
                const component = props.objects[0] as Component;

                let asInputProperties = (
                    component.asInputProperties ?? []
                ).slice();
                const i = asInputProperties.indexOf(props.propertyInfo.name);

                menuItems.push(
                    new MenuItem({
                        label:
                            i === -1
                                ? "Convert to input"
                                : "Convert to property",
                        click: () => {
                            const DocumentStore = getDocumentStore(
                                props.objects[0]
                            );

                            DocumentStore.UndoManager.setCombineCommands(true);

                            if (i === -1) {
                                asInputProperties.push(props.propertyInfo.name);
                            } else {
                                asInputProperties.splice(i, 1);

                                getFlow(component).deleteConnectionLinesToInput(
                                    component,
                                    props.propertyInfo.name
                                );
                            }

                            asInputProperties.sort();

                            DocumentStore.updateObject(component, {
                                asInputProperties,
                                [props.propertyInfo.name]: undefined
                            });

                            DocumentStore.UndoManager.setCombineCommands(false);
                        }
                    })
                );
            }

            return menuItems;
        },

        readOnlyInPropertyGrid(
            component: Component,
            propertyInfo: PropertyInfo
        ) {
            return (
                component.isInputProperty(propertyInfo) ||
                component.isOutputProperty(propertyInfo)
            );
        }
    } as Partial<PropertyInfo>);
}

export function makeToggablePropertyToOutput(
    propertyInfo: PropertyInfo
): PropertyInfo {
    return Object.assign(propertyInfo, {
        toggableProperty: "output",

        propertyMenu(props: PropertyProps) {
            let menuItems: Electron.MenuItem[] = [];

            if (props.objects.length == 1) {
                const component = props.objects[0] as Component;

                let asOutputProperties = (
                    component.asOutputProperties ?? []
                ).slice();
                const i = asOutputProperties.indexOf(props.propertyInfo.name);

                menuItems.push(
                    new MenuItem({
                        label:
                            i === -1
                                ? "Convert to output"
                                : "Convert to property",
                        click: () => {
                            const DocumentStore = getDocumentStore(
                                props.objects[0]
                            );

                            DocumentStore.UndoManager.setCombineCommands(true);

                            if (i === -1) {
                                asOutputProperties.push(
                                    props.propertyInfo.name
                                );
                            } else {
                                asOutputProperties.splice(i, 1);

                                getFlow(
                                    component
                                ).deleteConnectionLinesFromOutput(
                                    component,
                                    props.propertyInfo.name
                                );
                            }

                            asOutputProperties.sort();

                            DocumentStore.updateObject(component, {
                                asOutputProperties,
                                [props.propertyInfo.name]: undefined
                            });

                            DocumentStore.UndoManager.setCombineCommands(false);
                        }
                    })
                );
            }

            return menuItems;
        },
        readOnlyInPropertyGrid(
            component: Component,
            propertyInfo: PropertyInfo
        ) {
            return (
                (component.asOutputProperties ?? []).indexOf(
                    propertyInfo.name
                ) !== -1
            );
        }
    } as Partial<PropertyInfo>);
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

    @observable wireID: string;

    @observable asInputProperties: string[];

    @observable asOutputProperties: string[];

    @observable _geometry: ComponentGeometry;

    @observable catchError: boolean;

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
            },
            {
                name: "asInputProperties",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true,
                defaultValue: []
            },
            {
                name: "asOutputProperties",
                type: PropertyType.StringArray,
                hideInPropertyGrid: true,
                defaultValue: []
            },
            {
                name: "catchError",
                type: PropertyType.Boolean,
                propertyGridGroup: generalGroup
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (!jsObject.wireID) {
                jsObject.wireID = guid();
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
        },

        check: (component: Component) => {
            let messages: output.Message[] = [];

            component.inputs.forEach(input => {
                if (
                    !getFlow(component).connectionLines.find(
                        connectionLine =>
                            connectionLine.targetComponent === component &&
                            connectionLine.input === input.name
                    )
                ) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            `No connection to input "${
                                input.displayName || input.name
                            }"`,
                            component
                        )
                    );
                }
            });

            component.outputs.forEach(componentOutput => {
                if (
                    !getFlow(component).connectionLines.find(
                        connectionLine =>
                            connectionLine.sourceComponent === component &&
                            connectionLine.output === componentOutput.name
                    )
                ) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            `Output "${
                                componentOutput.displayName ||
                                componentOutput.name
                            }" is not connected`,
                            component
                        )
                    );
                }
            });

            if (
                getDocumentStore(component).isAppletProject ||
                getDocumentStore(component).isDashboardProject
            ) {
                if (!(component instanceof ActionComponent)) {
                    if (component.left < 0) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Widget is outside of its parent",
                                getChildOfObject(component, "left")
                            )
                        );
                    }

                    if (component.top < 0) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Widget is outside of its parent",
                                getChildOfObject(component, "top")
                            )
                        );
                    }

                    if (
                        component.left + component.width >
                        getWidgetParent(component).width
                    ) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Widget is outside of its parent",
                                getChildOfObject(component, "width")
                            )
                        );
                    }

                    if (
                        component.top + component.height >
                        getWidgetParent(component).height
                    ) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Widget is outside of its parent",
                                getChildOfObject(component, "height")
                            )
                        );
                    }
                }

                for (const propertyInfo of getClassInfo(component).properties) {
                    if (propertyInfo.toggableProperty === "input") {
                        try {
                            checkExpression(
                                component,
                                getProperty(component, propertyInfo.name)
                            );
                        } catch (err) {
                            new output.Message(
                                output.Type.ERROR,
                                "Invalid expression",
                                getChildOfObject(component, propertyInfo.name)
                            );
                        }
                    }
                }
            } else {
                checkObjectReference(component, "data", messages);
                checkObjectReference(component, "action", messages);
            }

            return messages;
        },

        updateObjectValueHook: (object: Component, values: any) => {
            if (values.catchError !== undefined) {
                if (!values.catchError && object.catchError) {
                    const flow = getFlow(object);
                    flow.deleteConnectionLinesFromOutput(object, "@error");
                }
            }
        }
    };

    set geometry(value: ComponentGeometry) {
        this._geometry = value;
        this.width = this._geometry.width;
        this.height = this._geometry.height;
    }

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

    isInputProperty(property: PropertyInfo | string) {
        if (!this.asInputProperties) {
            return false;
        }

        return (
            this.asInputProperties.indexOf(
                typeof property === "string" ? property : property.name
            ) !== -1
        );
    }

    isOutputProperty(property: PropertyInfo | string) {
        if (!this.asOutputProperties) {
            return false;
        }

        return (
            this.asOutputProperties.indexOf(
                typeof property === "string" ? property : property.name
            ) !== -1
        );
    }

    get inputs() {
        return [
            ...((this.asInputProperties ?? [])
                .map(inputPropertyName =>
                    findPropertyByNameInClassInfo(
                        getClassInfo(this),
                        inputPropertyName
                    )
                )
                .filter(
                    propertyInfo =>
                        propertyInfo && !isPropertyHidden(this, propertyInfo)
                ) as PropertyInfo[])
        ];
    }

    get outputs() {
        const outputs = [
            ...((this.asOutputProperties ?? [])
                .map(outputPropertyName =>
                    findPropertyByNameInClassInfo(
                        getClassInfo(this),
                        outputPropertyName
                    )
                )
                .filter(
                    propertyInfo =>
                        propertyInfo && !isPropertyHidden(this, propertyInfo)
                ) as PropertyInfo[])
        ];

        if (this.catchError) {
            outputs.push({
                name: "@error",
                displayName: "@Error",
                type: PropertyType.String
            });
        }

        return outputs;
    }

    @computed
    get isMoveable() {
        return true;
    }

    draw?: (ctx: CanvasRenderingContext2D) => void;

    render(flowContext: IFlowContext): React.ReactNode {
        return null;
    }

    getClassName() {
        return "";
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {}

    async execute(
        runningFlow: IRunningFlow,
        dispose: (() => void) | undefined
    ): Promise<(() => void) | undefined> {
        return undefined;
    }

    buildFlowComponentSpecific(assets: Assets, dataBuffer: DataBuffer) {}
}

////////////////////////////////////////////////////////////////////////////////

export class Widget extends Component {
    @observable data?: string;
    @observable action?: string;
    @observable resizing: IResizing;
    @observable className: string;

    static classInfo: ClassInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: [
            resizingProperty,
            makeDataPropertyInfo("data"),
            makeActionPropertyInfo("action"),
            {
                name: "className",
                type: PropertyType.String,
                propertyGridGroup: styleGroup,
                hideInPropertyGrid: (object: IEezObject) =>
                    !getDocumentStore(object).isDashboardProject
            }
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            if (jsObject.type.startsWith("Local.")) {
                jsObject.layout = jsObject.type.substring("Local.".length);
                jsObject.type = "LayoutView";
            }
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
                            const selectWidget = (
                                objects[0] as Widget
                            ).putInSelect();
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

            if (!(object instanceof ActionComponent)) {
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

            const DocumentStore = getDocumentStore(object);

            if (
                !DocumentStore.isAppletProject &&
                !DocumentStore.isDashboardProject
            ) {
                checkObjectReference(object, "data", messages);
            }

            checkObjectReference(object, "action", messages);

            return messages;
        },
        showSelectedObjectsParent: () => {
            return true;
        },
        getResizeHandlers(object: Widget) {
            return object.getResizeHandlers();
        },
        componentHeaderColor: "#FFFFFF"
    });

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
        const layouts = DocumentStore.project.pages;

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

    getClassName() {
        return classNames("eez-widget-component", this.type, this.className);
    }

    render(flowContext: IFlowContext): React.ReactNode {
        if (flowContext.frontFace) {
            return null;
        }

        if (flowContext.document.flow.object !== getFlow(this)) {
            return null;
        }

        const inputs = this.inputs;
        const outputs = this.outputs;

        if (inputs.length === 0 && outputs.length === 0) {
            return null;
        }

        return (
            <>
                <div className="inputs">
                    {inputs.map(property => (
                        <div
                            key={property.name}
                            data-connection-input-id={property.name}
                            className={classNames({
                                seq: property.name === "@seqin"
                            })}
                            title={getObjectPropertyDisplayName(this, property)}
                        ></div>
                    ))}
                </div>
                <div className="outputs">
                    {outputs.map(property => (
                        <div
                            key={property.name}
                            data-connection-output-id={property.name}
                            className={classNames({
                                seq: property.name === "@seqout"
                            })}
                            title={getObjectPropertyDisplayName(this, property)}
                        ></div>
                    ))}
                </div>
            </>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class EmbeddedWidget extends Widget {
    @observable style: Style;

    static classInfo: ClassInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [makeStylePropertyInfo("style", "Normal style")],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "style");

            if (jsObject.style && typeof jsObject.style.padding === "number") {
                delete jsObject.style.padding;
            }

            delete jsObject.activeStyle;
        }
    });

    @computed
    get styleObject() {
        return this.style;
    }

    styleHook(style: React.CSSProperties, flowContext: IFlowContext) {
        if (!flowContext.document.DocumentStore.isDashboardProject) {
            const backgroundColor = this.style.backgroundColorProperty;
            style.backgroundColor = to16bitsColor(backgroundColor);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function renderActionComponent(
    actionNode: ActionComponent,
    flowContext: IFlowContext
) {
    const classInfo = getClassInfo(actionNode);

    const inputs = actionNode.inputs;

    let outputs = actionNode.outputs;

    // move @error output to end
    let i = outputs.findIndex(output => output.name === "@error");
    if (i !== -1) {
        outputs = [...outputs.slice(0, i), ...outputs.slice(i + 1), outputs[i]];
    }

    let titleStyle: React.CSSProperties | undefined;
    if (classInfo.componentHeaderColor) {
        titleStyle = {
            backgroundColor: classInfo.componentHeaderColor
        };
    }

    return (
        <>
            <div className="title-enclosure">
                <div className="title" style={titleStyle}>
                    <span
                        className="title-image"
                        data-connection-input-id="@seqin"
                    >
                        {classInfo.icon}
                    </span>
                    <span className="title-text">{getLabel(actionNode)}</span>
                    <span data-connection-output-id="@seqout"></span>
                </div>
            </div>
            <div className="content">
                {inputs.length > 0 && (
                    <div className="inputs">
                        {inputs.map(property => (
                            <div
                                key={property.name}
                                data-connection-input-id={property.name}
                            >
                                {getObjectPropertyDisplayName(
                                    actionNode,
                                    property
                                )}
                            </div>
                        ))}
                    </div>
                )}
                {actionNode.getBody(flowContext)}
                {outputs.length > 0 && (
                    <div className="outputs">
                        {outputs.map(property => (
                            <div
                                key={property.name}
                                data-connection-output-id={property.name}
                                className={classNames({
                                    error: property.name === "@error"
                                })}
                            >
                                {getObjectPropertyDisplayName(
                                    actionNode,
                                    property
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

////////////////////////////////////////////////////////////////////////////////

export class ActionComponent extends Component {
    static classInfo = makeDerivedClassInfo(Component.classInfo, {
        properties: []
    });

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
        return "eez-action-component";
    }

    getBody(flowContext: IFlowContext): React.ReactNode {
        return null;
    }

    render(flowContext: IFlowContext) {
        return renderActionComponent(this, flowContext);
    }
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
        },
        componentHeaderColor: "#fc9b9b"
    });

    @computed get inputs() {
        return getFlow(this)
            .connectionLines.filter(
                connectionLine => connectionLine.target == this.wireID
            )
            .map(connectionLine => ({
                name: connectionLine.input,
                type: PropertyType.Any
            }));
    }

    @computed get outputs() {
        return getFlow(this)
            .connectionLines.filter(
                connectionLine => connectionLine.source == this.wireID
            )
            .map(connectionLine => ({
                name: connectionLine.output,
                type: PropertyType.Any
            }));
    }

    get autoSize() {
        return (
            this.inputs.length > 0 ||
            this.outputs.length > 0 ||
            this.width === 0 ||
            this.height == 0
        );
    }

    render(flowContext: IFlowContext): JSX.Element {
        return renderActionComponent(this, flowContext);
    }
}

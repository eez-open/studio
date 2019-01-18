import { observable, computed, action, autorun } from "mobx";

import { _find } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";
import { Rect } from "eez-studio-shared/geometry";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    ClassInfo,
    EezObject,
    registerClass,
    EezArrayObject,
    PropertyType,
    makeDerivedClassInfo,
    findClass,
    isArray,
    getChildOfObject,
    objectToJS,
    cloneObject,
    geometryGroup,
    styleGroup,
    actionsGroup,
    TargetDataType,
    IPropertyGridGroupDefinition,
    dataGroup
} from "eez-studio-shared/model/object";
import { loadObject } from "eez-studio-shared/model/serialization";
import {
    TreeObjectAdapter,
    DisplayItem,
    DisplayItemChildrenArray,
    getDisplayItemFromObjectId
} from "eez-studio-shared/model/objectAdapter";
import { DocumentStore, IMenuItem, UIElementsFactory } from "eez-studio-shared/model/store";
import * as output from "eez-studio-shared/model/output";

import { PageInitContext } from "eez-studio-page-editor/page-init-context";
import { PageContext } from "eez-studio-page-editor/page-context";
import { Page } from "eez-studio-page-editor/page";

////////////////////////////////////////////////////////////////////////////////

export interface GeometryProperties {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export interface ObjectGeometryChange {
    object: EezObject;
    changedProperties: GeometryProperties;
}

////////////////////////////////////////////////////////////////////////////////

export function makeDataPropertyInfo(
    name: string,
    targetDataType?: TargetDataType,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
) {
    return {
        name,
        displayName,
        type: PropertyType.ObjectReference,
        referencedObjectCollectionPath: PageInitContext.dataItemsCollectionPath,
        onSelect: PageInitContext.onDataItemSelect,
        targetDataType: targetDataType || TargetDataType.String,
        propertyGridGroup: propertyGridGroup || dataGroup
    };
}

////////////////////////////////////////////////////////////////////////////////

function htmlEncode(value: string) {
    const el = document.createElement("div");
    el.innerText = value;
    return el.innerHTML;
}

////////////////////////////////////////////////////////////////////////////////

export type WidgetParent = Page | Widget;

export class Widget extends EezObject {
    // shared properties
    @observable
    type: string;
    @observable
    style?: string;
    @observable
    activeStyle?: string;
    @observable
    data?: string;
    @observable
    action?: string;
    @observable
    x: number;
    @observable
    y: number;
    @observable
    width: number;
    @observable
    height: number;

    get label() {
        return this.type;
    }

    static classInfo: ClassInfo = {
        getClass: function(jsObject: any) {
            return findClass(jsObject.type + "Widget");
        },

        label: (widget: Widget) => {
            if (widget.data) {
                return `${humanize(widget.type)}: ${widget.data}`;
            }

            if (widget instanceof LayoutViewWidget) {
                if (widget.layout) {
                    return `${widget.type}: ${widget.layout}`;
                }
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
                name: "x",
                type: PropertyType.Number,
                propertyGridGroup: geometryGroup
            },
            {
                name: "y",
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
            makeDataPropertyInfo("data"),
            {
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["actions"],
                propertyGridGroup: actionsGroup
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"],
                propertyGridGroup: styleGroup
            },
            {
                name: "activeStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"],
                propertyGridGroup: styleGroup
            }
        ]
    };

    @computed
    get styleObject() {
        if (this.style) {
            return PageContext.findStyle(this.style);
        }
        return undefined;
    }

    @computed
    get activeStyleObject() {
        if (this.activeStyle) {
            return PageContext.findStyle(this.activeStyle);
        }
        return undefined;
    }

    // Return immediate parent, which can be of type Page or Widget
    // (i.e. ContainerWidget, ListWidget, GridWidget, SelectWidget)
    get parent(): WidgetParent {
        let parent = this._parent!;
        if (isArray(parent)) {
            parent = parent._parent!;
        }
        return parent as WidgetParent;
    }

    // If this widget is immediate child of SelectWidgetProperties parent return that parent.
    get selectParent(): SelectWidget | undefined {
        const parent = this.parent;
        if (parent instanceof SelectWidget) {
            return parent;
        }
        return undefined;
    }

    check() {
        let messages: output.Message[] = [];

        let parent = this.parent;
        if (
            this.x < 0 ||
            this.y < 0 ||
            (parent && (this.x + this.width > parent.width || this.y + this.height > parent.height))
        ) {
            messages.push(
                new output.Message(output.Type.ERROR, "Widget is outside of its parent", this)
            );
        }

        let selectParent = this.selectParent;
        if (selectParent) {
            if (this.width != selectParent.width) {
                messages.push(
                    new output.Message(
                        output.Type.WARNING,
                        "Child of select has different width",
                        this
                    )
                );
            }

            if (this.height != selectParent.height) {
                messages.push(
                    new output.Message(
                        output.Type.WARNING,
                        "Child of select has different height",
                        this
                    )
                );
            }
        }

        if (this.style) {
            if (!this.styleObject) {
                messages.push(output.propertyNotFoundMessage(this, "style"));
            }
        } else {
            messages.push(output.propertyNotSetMessage(this, "style"));
        }

        if (this.activeStyle) {
            if (!this.activeStyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "activeStyle"));
            }
        }

        if (this.data) {
            let dataIndex = PageContext.data.findDataItemIndex(this.data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "data"));
            } else if (dataIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Data ignored",
                        getChildOfObject(this, "data")
                    )
                );
            }
        }

        if (this.action) {
            let actionIndex = PageContext.findActionIndex(this.action);
            if (actionIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "action"));
            } else if (actionIndex >= 65535) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Action ignored",
                        getChildOfObject(this, "action")
                    )
                );
            }
        }

        return messages;
    }

    extendContextMenu(objects: EezObject[], menuItems: IMenuItem[]): void {
        var additionalMenuItems: IMenuItem[] = [];

        if (objects.length === 1) {
            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Put in Select",
                    click: () => (objects[0] as Widget).putInSelect()
                })
            );
        }

        let i: number;
        for (i = 1; i < objects.length; i++) {
            if (objects[i]._parent !== objects[0]._parent) {
                break;
            }
        }
        if (i == objects.length) {
            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Put in Container",
                    click: () => Widget.putInContainer(objects as Widget[])
                })
            );
        }

        if (objects.length === 1) {
            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Create Layout",
                    click: () => (objects[0] as Widget).createLayout()
                })
            );

            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Replace with Layout",
                    click: () => (objects[0] as Widget).replaceWithLayout()
                })
            );

            let parent = objects[0]._parent;
            if (parent && parent._parent instanceof SelectWidget) {
                additionalMenuItems.push(
                    UIElementsFactory.createMenuItem({
                        label: "Replace Parent",
                        click: () => (objects[0] as Widget).replaceParent()
                    })
                );
            }
        }

        if (additionalMenuItems.length > 0) {
            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    type: "separator"
                })
            );

            menuItems.unshift(...additionalMenuItems);
        }
    }

    putInSelect() {
        let thisWidgetJsObject = objectToJS(this);

        var selectWidgetJsObject = new SelectWidget();
        Object.assign(selectWidgetJsObject, SelectWidget.classInfo.defaultValue);

        selectWidgetJsObject.x = thisWidgetJsObject.x;
        selectWidgetJsObject.y = thisWidgetJsObject.y;
        selectWidgetJsObject.width = thisWidgetJsObject.width;
        selectWidgetJsObject.height = thisWidgetJsObject.height;

        thisWidgetJsObject.x = 0;
        thisWidgetJsObject.y = 0;

        selectWidgetJsObject.widgets._array = [thisWidgetJsObject];

        DocumentStore.replaceObject(this, loadObject(undefined, selectWidgetJsObject, Widget));
    }

    static putInContainer(widgets: Widget[]) {
        let x1 = widgets[0].x;
        let y1 = widgets[0].y;
        let x2 = widgets[0].x + widgets[0].width;
        let y2 = widgets[0].y + widgets[0].height;
        for (let i = 1; i < widgets.length; i++) {
            let widget = widgets[i];
            x1 = Math.min(widget.x, x1);
            y1 = Math.min(widget.y, y1);
            x2 = Math.max(widget.x + widget.width, x2);
            y2 = Math.max(widget.y + widget.height, y2);
        }

        var containerWidgetJsObject = new ContainerWidget();
        Object.assign(containerWidgetJsObject, ContainerWidget.classInfo.defaultValue);

        containerWidgetJsObject.x = x1;
        containerWidgetJsObject.y = y1;
        containerWidgetJsObject.width = x2 - x1;
        containerWidgetJsObject.height = y2 - y1;

        for (let i = 0; i < widgets.length; i++) {
            let widget = widgets[i];
            let widgetJsObject = objectToJS(widget);

            widgetJsObject.x -= x1;
            widgetJsObject.y -= y1;

            containerWidgetJsObject.widgets._array = [widgetJsObject];
        }

        DocumentStore.replaceObjects(
            widgets,
            loadObject(undefined, containerWidgetJsObject, Widget)
        );
    }

    async createLayout() {
        const layouts = PageContext.getPages();

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

            // create a new layout
            const layoutName = result.values.name;

            const thisWidgetJS = objectToJS(this);
            thisWidgetJS.x = 0;
            thisWidgetJS.y = 0;

            DocumentStore.addObject(
                layouts,
                loadObject(
                    undefined,
                    {
                        name: layoutName,
                        x: 0,
                        y: 0,
                        width: this.width,
                        height: this.height,
                        style: "default",
                        widgets: [thisWidgetJS]
                    },
                    findClass("Page")!
                )
            );

            // replace this widget with the LayoutView of new layout
            const newWidget = loadObject(
                undefined,
                {
                    type: "LayoutView",
                    style: "default",
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height,
                    layout: layoutName
                },
                Widget
            );

            DocumentStore.replaceObject(this, newWidget);
        } catch (error) {
            console.error(error);
        }
    }

    async replaceWithLayout() {
        const layouts = PageContext.getPages();

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Select layout",
                    fields: [
                        {
                            name: "name",
                            type: "enum",
                            enumItems: layouts._array.map(layout => layout.name)
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const layoutName = result.values.name;

            // replace this widget with LayoutView
            const newWidget = loadObject(
                undefined,
                {
                    type: "LayoutView",
                    style: "default",
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height,
                    layout: layoutName
                },
                Widget
            );

            DocumentStore.replaceObject(this, newWidget);
        } catch (error) {
            console.error(error);
        }
    }

    replaceParent() {
        let parent = this._parent;
        if (parent) {
            let selectWidget = parent._parent;
            if (selectWidget instanceof SelectWidget) {
                DocumentStore.replaceObject(selectWidget, cloneObject(undefined, this));
            }
        }
    }

    @action
    applyGeometryChange(
        geometryProperties: GeometryProperties,
        geometryChanges: ObjectGeometryChange[]
    ) {
        let changedGeometryProperties: Partial<GeometryProperties> = {};

        if (geometryProperties.x !== undefined && geometryProperties.x !== this.x) {
            changedGeometryProperties.x = geometryProperties.x;
        }
        if (geometryProperties.y !== undefined && geometryProperties.y !== this.y) {
            changedGeometryProperties.y = geometryProperties.y;
        }
        if (geometryProperties.width !== undefined && geometryProperties.width !== this.width) {
            changedGeometryProperties.width = geometryProperties.width;
        }
        if (geometryProperties.height !== undefined && geometryProperties.height !== this.height) {
            changedGeometryProperties.height = geometryProperties.height;
        }

        DocumentStore.updateObject(this, changedGeometryProperties);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return undefined;
    }

    render(): React.ReactNode {
        return undefined;
    }
}

registerClass(Widget);

////////////////////////////////////////////////////////////////////////////////

export class ContainerWidget extends Widget {
    @observable
    widgets: EezArrayObject<Widget>;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            }
        ],

        defaultValue: {
            type: "Container",
            widgets: [],
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default"
        },

        // eez-studio-page-editor\_images\Container.png
        icon:
            "data:image/png;base64,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"
    });

    check() {
        let messages: output.Message[] = [];

        if (this.data) {
            messages.push(output.propertySetButNotUsedMessage(this, "data"));
        }

        return super.check().concat(messages);
    }

    @action
    applyGeometryChange(
        changedProperties: GeometryProperties,
        geometryChanges: ObjectGeometryChange[]
    ) {
        let widthBefore = this.width;
        let heightBefore = this.height;

        DocumentStore.updateObject(this, changedProperties);

        for (const childWidget of this.widgets._array) {
            if (!geometryChanges.find(geometryChange => geometryChange.object == childWidget)) {
                var childChangedProperties: GeometryProperties = {};
                var changed = false;

                if (
                    changedProperties.width != undefined &&
                    childWidget.x == 0 &&
                    childWidget.x + childWidget.width == widthBefore
                ) {
                    childChangedProperties.width = changedProperties.width;
                    changed = true;
                }

                if (
                    changedProperties.height != undefined &&
                    childWidget.y == 0 &&
                    childWidget.y + childWidget.height == heightBefore
                ) {
                    childChangedProperties.height = changedProperties.height;
                    changed = true;
                }

                if (changed) {
                    childWidget.applyGeometryChange(childChangedProperties, geometryChanges);
                }
            }
        }
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return PageContext.draw.drawDefaultWidget(this, rect);
    }
}

registerClass(ContainerWidget);

////////////////////////////////////////////////////////////////////////////////

export class ListWidget extends Widget {
    @observable
    itemWidget?: Widget;
    @observable
    listType?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "listType",
                type: PropertyType.Enum,
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
                name: "itemWidget",
                type: PropertyType.Object,
                typeClass: Widget,
                hideInPropertyGrid: true,
                isOptional: true
            }
        ],

        defaultValue: {
            type: "List",
            listType: "vertical",
            itemWidget: {
                type: "Container",
                widgets: [],
                x: 0,
                y: 0,
                width: 64,
                height: 32
            },
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default"
        },

        // eez-studio-page-editor\_images\List.png
        icon:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMS41ZEdYUgAAAyhJREFUeF7t2AENACEMBMFKQ8AjE528ARzsXDIWNk1nrXWBJgGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAsNn7O0DTmJmZWXGvswBo8ASEMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAsNn7O0DTmJmZWXGvswBo8ASEMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGAMAGArHV/IgVNuqJc7fsAAAAASUVORK5CYII="
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (!this.itemWidget) {
            messages.push(
                new output.Message(output.Type.ERROR, "List item widget is missing", this)
            );
        }

        return super.check().concat(messages);
    }

    @action
    applyGeometryChange(
        changedProperties: GeometryProperties,
        geometryChanges: ObjectGeometryChange[]
    ) {
        DocumentStore.updateObject(this, changedProperties);

        if (this.itemWidget) {
            if (!geometryChanges.find(geometryChange => geometryChange.object == this.itemWidget)) {
                var itemChangedProperties: GeometryProperties = {};
                var changed = false;

                if (this.listType == "vertical" && changedProperties.width != undefined) {
                    itemChangedProperties.x = 0;
                    itemChangedProperties.width = changedProperties.width;
                    changed = true;
                } else if (changedProperties.height != undefined) {
                    itemChangedProperties.y = 0;
                    itemChangedProperties.height = changedProperties.height;
                    changed = true;
                }

                if (changed) {
                    this.itemWidget.applyGeometryChange(itemChangedProperties, geometryChanges);
                }
            }
        }
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return PageContext.draw.drawDefaultWidget(this, rect);
    }
}

registerClass(ListWidget);

////////////////////////////////////////////////////////////////////////////////

export class GridWidget extends Widget {
    @observable
    itemWidget?: Widget;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "itemWidget",
                type: PropertyType.Object,
                typeClass: Widget,
                hideInPropertyGrid: true,
                isOptional: true
            }
        ],

        defaultValue: {
            type: "Grid",
            itemWidget: {
                type: "Container",
                widgets: [],
                x: 0,
                y: 0,
                width: 32,
                height: 32
            },
            x: 0,
            y: 0,
            width: 64,
            height: 64,
            style: "default"
        },

        // eez-studio-page-editor\_images\Grid.png
        icon:
            "data:image/png;base64,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"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (!this.itemWidget) {
            messages.push(
                new output.Message(output.Type.ERROR, "Grid item widget is missing", this)
            );
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return PageContext.draw.drawDefaultWidget(this, rect);
    }
}

registerClass(GridWidget);

////////////////////////////////////////////////////////////////////////////////

export type Position = "left" | "right" | "top" | "bottom";

export class SelectWidgetEditor extends EezObject {
    static readonly EDITOR_PADDING = 10;

    @observable
    x: number;
    @observable
    y: number;

    static classInfo: ClassInfo = {
        label: (selectWidgetEditor: SelectWidgetEditor) => {
            const parent = selectWidgetEditor._parent!;
            return parent._label + " Editor";
        },

        properties: [
            {
                name: "x",
                type: PropertyType.Number
            },
            {
                name: "y",
                type: PropertyType.Number
            }
        ],

        defaultValue: {
            x: 350,
            y: 0
        }
    };

    get parent() {
        return this._parent as SelectWidget;
    }

    @computed
    get editorOrientation(): "vertical" | "horizontal" {
        // currently, it is always vertical orientation
        return "vertical";
    }

    @computed
    get rect() {
        let width;
        let height;

        const count = this.parent.widgets._array.length;

        if (this.editorOrientation === "vertical") {
            width = this.parent.width + 2 * SelectWidgetEditor.EDITOR_PADDING;

            height =
                (this.parent.height + SelectWidgetEditor.EDITOR_PADDING) * count +
                SelectWidgetEditor.EDITOR_PADDING;
        } else {
            width =
                (this.parent.width + SelectWidgetEditor.EDITOR_PADDING) * count +
                SelectWidgetEditor.EDITOR_PADDING;

            height = this.parent.height + 2 * SelectWidgetEditor.EDITOR_PADDING;
        }

        return {
            left: this.x - Math.round(width / 2),
            top: this.y - Math.round(height / 2),
            width,
            height
        };
    }
}

registerClass(SelectWidgetEditor);

export class SelectWidget extends Widget {
    @observable
    widgets: EezArrayObject<Widget>;

    @observable
    editor: SelectWidgetEditor;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true,
                childLabel: (childObject: EezObject, childLabel: string) => {
                    let label;

                    if (childObject._parent) {
                        let selectWidgetProperties = childObject._parent!._parent as SelectWidget;

                        label = selectWidgetProperties.getChildLabel(childObject as Widget);
                    }

                    return `${label || "???"} ➔ ${childLabel}`;
                }
            },
            {
                name: "editor",
                type: PropertyType.Object,
                typeClass: SelectWidgetEditor,
                hideInPropertyGrid: true,
                enumerable: false
            }
        ],

        defaultValue: {
            type: "Select",
            editor: {
                x: 0,
                y: 0
            },
            widgets: [],
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default"
        },

        // eez-studio-page-editor\_images\Select.png
        icon:
            "data:image/png;base64,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"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        } else {
            let dataItem = PageContext.data.findDataItem(this.data);
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

                if (enumItems.length > this.widgets._array.length) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Some select children are missing",
                            this
                        )
                    );
                } else if (enumItems.length < this.widgets._array.length) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Too many select children defined",
                            this
                        )
                    );
                }
            }
        }

        return super.check().concat(messages);
    }

    @action
    applyGeometryChange(
        changedProperties: GeometryProperties,
        geometryChanges: ObjectGeometryChange[]
    ) {
        DocumentStore.updateObject(this, changedProperties);

        for (const childWidget of this.widgets._array) {
            if (!geometryChanges.find(geometryChange => geometryChange.object == childWidget)) {
                var childChangedProperties: GeometryProperties = {};
                var changed = false;

                if (changedProperties.width != undefined) {
                    childWidget.x = 0;
                    childChangedProperties.width = changedProperties.width;
                    changed = true;
                }

                if (changedProperties.height != undefined) {
                    childWidget.y = 0;
                    childChangedProperties.height = changedProperties.height;
                    changed = true;
                }

                if (changed) {
                    childWidget.applyGeometryChange(childChangedProperties, geometryChanges);
                }
            }
        }
    }

    getChildLabel(childObject: Widget) {
        if (this.widgets) {
            let index = this.widgets._array.indexOf(childObject);
            if (index != -1) {
                if (this.data) {
                    let dataItem = PageContext.data.findDataItem(this.data);
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

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return PageContext.draw.drawDefaultWidget(this, rect);
    }
}

registerClass(SelectWidget);

////////////////////////////////////////////////////////////////////////////////

export class LayoutViewWidget extends Widget {
    @observable
    layout: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "layout",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "pages"]
            }
        ],

        defaultValue: { type: "LayoutView", x: 0, y: 0, width: 64, height: 32, style: "default" },

        // eez-studio-page-editor\_images\LayoutView.png
        icon:
            "data:image/png;base64,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"
    });

    check() {
        let messages: output.Message[] = [];

        if (!this.data && !this.layout) {
            messages.push(
                new output.Message(output.Type.ERROR, "Either layout or data must be set", this)
            );
        } else {
            if (this.data && this.layout) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Both layout and data set, only layout is used",
                        this
                    )
                );
            }

            if (this.layout) {
                let layout = PageContext.findPage(this.layout);
                if (!layout) {
                    messages.push(output.propertyNotFoundMessage(this, "layout"));
                }
            }
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return PageContext.draw.drawLayoutViewWidget(this, rect);
    }
}

registerClass(LayoutViewWidget);

////////////////////////////////////////////////////////////////////////////////

export function getWidgetType(widgetClass: typeof EezObject) {
    if (widgetClass.name.endsWith("Widget")) {
        return widgetClass.name.substring(0, widgetClass.name.length - "Widget".length);
    }
    return widgetClass.name;
}

////////////////////////////////////////////////////////////////////////////////

export interface IWidgetContainerDisplayItem extends DisplayItem {
    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined;
}

export class WidgetContainerDisplayItem extends TreeObjectAdapter
    implements IWidgetContainerDisplayItem {
    // this is used to remember the last selected widget for the select widget
    selectWidgetToSelectedWidget: any = {};

    constructor(object: EezObject) {
        super(object);

        autorun(() => {
            // update selectWidgetToSelectedWidget when selection is changed
            let selectedObjects = this.selectedObjects;
            for (let i = 0; i < selectedObjects.length; i++) {
                let selectedObject = selectedObjects[i];

                // remove all what we remembered below selected object
                Object.keys(this.selectWidgetToSelectedWidget).forEach(key => {
                    if (key.startsWith(selectedObject._id)) {
                        delete this.selectWidgetToSelectedWidget[key];
                    }
                });

                // remember from selectedObject up to the root
                while (selectedObject._parent && selectedObject._parent!._parent) {
                    if (selectedObject._parent!._parent instanceof SelectWidget) {
                        this.selectWidgetToSelectedWidget[selectedObject._parent!._parent!._id] =
                            selectedObject._id;
                    }
                    selectedObject = selectedObject._parent!;
                }
            }

            // remove nonexistent objects from the selectWidgetToSelectedWidget
            Object.keys(this.selectWidgetToSelectedWidget).forEach(key => {
                if (!getDisplayItemFromObjectId(this, key)) {
                    delete this.selectWidgetToSelectedWidget[key];
                } else if (
                    !getDisplayItemFromObjectId(this, this.selectWidgetToSelectedWidget[key])
                ) {
                    delete this.selectWidgetToSelectedWidget[key];
                }
            });
        });
    }

    loadState(state: any) {
        // restore selectWidgetToSelectedWidget
        if (state.selectWidgetToSelectedWidget) {
            this.selectWidgetToSelectedWidget = state.selectWidgetToSelectedWidget;
        }

        super.loadState(state.tree || {});
    }

    saveState() {
        return {
            tree: super.saveState(),
            selectWidgetToSelectedWidget: this.selectWidgetToSelectedWidget
        };
    }

    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined {
        let widget = item.object as SelectWidget;
        let widgetsItemChildren = item.children as DisplayItemChildrenArray;

        let selectedWidgetItem: DisplayItem | undefined;

        // first, find selected widget by checking if any child widget is selected or has descendant that is selected
        function isSelected(item: DisplayItem): boolean {
            return (
                item.selected ||
                !!_find(item.children, (displayItemChild: any) => {
                    let child: DisplayItem = displayItemChild;
                    return isSelected(child);
                })
            );
        }
        selectedWidgetItem = widgetsItemChildren.find(childWidgetItem =>
            isSelected(childWidgetItem)
        );

        // second, use selectWidgetToSelectedWidget to find selected widget
        if (!selectedWidgetItem) {
            let selectedWidgetId = this.selectWidgetToSelectedWidget[widget._id];
            if (selectedWidgetId) {
                selectedWidgetItem = getDisplayItemFromObjectId(this, selectedWidgetId);
            }
        }

        if (!selectedWidgetItem) {
            // if not found then select default for enum data
            if (widget.data && widget.widgets) {
                let index: number = PageContext.data.getEnumValue(widget.data);
                if (index >= 0 && index < widget.widgets._array.length) {
                    selectedWidgetItem = widgetsItemChildren[index];
                }
            }
        }

        if (!selectedWidgetItem) {
            // if still nothing selected then just select the first one
            if (widgetsItemChildren.length) {
                selectedWidgetItem = widgetsItemChildren[0];
            }
        }

        return selectedWidgetItem;
    }
}

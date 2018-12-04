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
    cloneObject
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

import { PageContext } from "eez-studio-page-editor/context";
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
                name: "data",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["data"]
            },
            {
                name: "action",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["actions"]
            },
            {
                name: "x",
                type: PropertyType.Number
            },
            {
                name: "y",
                type: PropertyType.Number
            },
            {
                name: "width",
                type: PropertyType.Number
            },
            {
                name: "height",
                type: PropertyType.Number
            },
            {
                name: "style",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
            },
            {
                name: "activeStyle",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: ["gui", "styles"]
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

    // Return first ancestor of type:
    //   - Page
    //   - Widget, if that ancestor parent is SelectWidget
    get anchorParent() {
        let widget: Widget = this;

        while (true) {
            let parent = widget.parent;

            if (!(parent instanceof Widget)) {
                return parent;
            }

            if (parent instanceof SelectWidget) {
                return widget;
            }

            widget = parent;
        }
    }

    // If this widget is immediate child of SelectWidgetProperties parent return that parent.
    get selectParent(): SelectWidget | undefined {
        const parent = this.parent;
        if (parent instanceof SelectWidget) {
            return parent;
        }
        return undefined;
    }

    @computed
    get boundingRect() {
        const rect = {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };

        let object: Widget = this;

        while (true) {
            let parent = object.parent;

            if (parent instanceof SelectWidget) {
                let i = parent.widgets._array.indexOf(object);

                rect.left += parent.editor.rect.left + SelectWidgetEditor.EDITOR_PADDING;
                rect.top +=
                    parent.editor.rect.top +
                    SelectWidgetEditor.EDITOR_PADDING +
                    i * (parent.height + SelectWidgetEditor.EDITOR_PADDING);

                break;
            }

            rect.left += parent.x;
            rect.top += parent.y;

            if (!(parent instanceof Widget)) {
                break;
            }

            object = parent;
        }

        return rect;
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

    renderSvg(): React.ReactNode {
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
        }
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
        }
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
        }
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

    // Returns array of edges (as Position[]) that Select Widget touches.
    // It can return 0, 1, 2, 3 or 4 positions.
    //
    // For example, in this case it will return ["left", "top"].
    //
    //                top
    //                 ^
    //                 |
    //             +-------------------------+
    //    left <---+      |                  |
    //             |      |                  |
    //             +------+                  |
    //             |  |                      |
    //             |  |                      |
    //             |  +-->  Select widget    |
    //             |                         |
    //             |                         |
    //             +-------------------------+
    //                          |
    //                          |
    //                          +-->  Anchor
    @computed
    get selectWidgetPosition(): Position[] {
        const result: Position[] = [];

        const anchorBoundingRect = this.parent.anchorParent.boundingRect;
        const selectWidgetBoundingRect = this.parent.boundingRect;

        if (anchorBoundingRect.left === selectWidgetBoundingRect.left) {
            result.push("left");
        }

        if (anchorBoundingRect.top === selectWidgetBoundingRect.top) {
            result.push("top");
        }

        if (
            anchorBoundingRect.left + anchorBoundingRect.width ===
            selectWidgetBoundingRect.left + selectWidgetBoundingRect.width
        ) {
            result.push("right");
        }

        if (
            anchorBoundingRect.top + anchorBoundingRect.height ===
            selectWidgetBoundingRect.top + selectWidgetBoundingRect.height
        ) {
            result.push("bottom");
        }

        return result;
    }

    // Returns position of Select Widget Editor relative to Select Widget.
    //
    // For example, in this case it will return "right" since Select Widget Editor is on the right side of Select Widget.
    //
    //                                       Select Widget Editor
    //
    //                                       +-----------------+
    //                                       |                 |
    //                                       | +-------------+ |
    //                                       | |             | |
    // +---------------+---------+           | |             | |
    // |               |         |           | +-------------+ |
    // |               +---------------+     |                 |
    // +---------------+         |     |     | +-------------+ |
    // |                         |     |     | |             | |
    // |  Select Widget          |     +-----> |             | |
    // |                         |           | +-------------+ |
    // |                         |           |                 |
    // |                         |           | +-------------+ |
    // +-------------------------+           | |             | |
    //                                       | |             | |
    //          Anchor                       | +-------------+ |
    //                                       |                 |
    //                                       +-----------------+
    @computed
    get relativePosition(): Position {
        const positions: Position[] = [];

        if (this.x < this.parent.boundingRect.left) {
            positions.push("left");
        }
        if (this.y < this.parent.boundingRect.top) {
            positions.push("top");
        }
        if (this.x > this.parent.boundingRect.left + this.parent.boundingRect.width) {
            positions.push("right");
        }
        if (this.y > this.parent.boundingRect.top + this.parent.boundingRect.height) {
            positions.push("bottom");
        }

        const selectWidgetPosition = this.selectWidgetPosition;

        if (selectWidgetPosition.length === 1) {
            if (positions.indexOf(selectWidgetPosition[0]) !== -1) {
                return selectWidgetPosition[0];
            }
        } else if (selectWidgetPosition.length === 2) {
            if (
                positions.indexOf(selectWidgetPosition[0]) !== -1 &&
                positions.indexOf(selectWidgetPosition[1]) === -1
            ) {
                return selectWidgetPosition[0];
            }
            if (
                positions.indexOf(selectWidgetPosition[0]) === -1 &&
                positions.indexOf(selectWidgetPosition[1]) !== -1
            ) {
                return selectWidgetPosition[1];
            }
        }

        const dx = this.x - (this.parent.boundingRect.left + this.parent.boundingRect.width / 2);
        const dy = this.y - (this.parent.boundingRect.top + this.parent.boundingRect.height / 2);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        if (angle > -135 && angle <= -45) {
            return "top";
        }

        if (angle > -45 && angle <= 45) {
            return "right";
        }

        if (angle > 45 && angle <= 135) {
            return "bottom";
        }

        return "left";
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
        }
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

        defaultValue: { type: "LayoutView", x: 0, y: 0, width: 64, height: 32, style: "default" }
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
        let selectedWidgetId = this.selectWidgetToSelectedWidget[widget._id];
        if (selectedWidgetId) {
            selectedWidgetItem = getDisplayItemFromObjectId(this, selectedWidgetId);
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

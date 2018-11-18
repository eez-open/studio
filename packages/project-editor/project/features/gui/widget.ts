import { observable, computed, action } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    getChildOfObject,
    loadObject,
    objectToJS,
    addObject,
    replaceObject,
    replaceObjects,
    updateObject,
    cloneObject,
    getProperty,
    ProjectStore,
    isArray
} from "project-editor/core/store";
import {
    EezObject,
    PropertyInfo,
    registerClass,
    EezArrayObject,
    PropertyType,
    makeDerivedClassInfo,
    findClass,
    getClassesDerivedFrom
} from "project-editor/core/metaData";
import { Rect, htmlEncode } from "project-editor/core/util";
import * as output from "project-editor/core/output";

import * as data from "project-editor/project/features/data/data";
import { findActionIndex } from "project-editor/project/features/action/action";

import { Page } from "project-editor/project/features/gui/page";
import { GeometryProperties, ObjectGeometryChange } from "project-editor/components/CanvasEditor";

import { findStyle, findBitmap, Gui, findPage } from "project-editor/project/features/gui/gui";
import { PageResolution } from "project-editor/project/features/gui/page";
import * as draw from "project-editor/project/features/gui/draw";

const { MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

export type WidgetParent = PageResolution | Widget;

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

    static classInfo = {
        getClass: function(jsObject: any) {
            return findClass(jsObject.type + "Widget");
        },
        label: (widget: Widget) => {
            if (widget.data) {
                return `${widget.type}: ${widget.data}`;
            }

            if (widget instanceof TextWidget || widget instanceof MultilineTextWidget) {
                if (widget.text) {
                    return `${widget.type}: "${widget.text}"`;
                }
            }

            if (widget instanceof BitmapWidget) {
                if (widget.bitmap) {
                    return `${widget.type}: ${widget.bitmap}`;
                }
            }

            if (widget instanceof LayoutViewWidget) {
                if (widget.layout) {
                    return `${widget.type}: ${widget.layout}`;
                }
            }

            return widget.type;
        },
        properties: (widget: Widget) => {
            return widgetSharedProperties;
        }
    };

    @computed
    get styleObject() {
        if (this.style) {
            return findStyle(this.style);
        }
        return undefined;
    }

    @computed
    get activeStyleObject() {
        if (this.activeStyle) {
            return findStyle(this.activeStyle);
        }
        return undefined;
    }

    // Return immediate parent, which can be of type PageResolutionProperties, WidgetTyperProperties
    // or WidgetProperties (i.e. ContainerWidgetProperties, ListWidgetProperties, GridWidgetProperties, SelectWidgetPropertis)
    get parent(): WidgetParent {
        let parent = this._parent!;
        if (isArray(parent)) {
            parent = parent._parent!;
        }
        return parent as WidgetParent;
    }

    // Return first ancestor of type:
    //   - PageResolutionProperties or
    //   - WidgetTyperProperties or
    //   - WidgetProperties, if that ancestor parent is SelectWidgetProperties
    get anchorParent() {
        let widget: Widget = this;

        while (true) {
            let parent = widget.parent;

            if (parent instanceof PageResolution) {
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

            if (parent instanceof PageResolution) {
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
            let dataIndex = data.findDataItemIndex(this.data);
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
            let actionIndex = findActionIndex(this.action);
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

    extendContextMenu(objects: EezObject[], menuItems: Electron.MenuItem[]): void {
        var additionalMenuItems: Electron.MenuItem[] = [];

        if (objects.length === 1) {
            additionalMenuItems.push(
                new MenuItem({
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
                new MenuItem({
                    label: "Put in Container",
                    click: () => Widget.putInContainer(objects as Widget[])
                })
            );
        }

        if (objects.length === 1) {
            additionalMenuItems.push(
                new MenuItem({
                    label: "Create Layout",
                    click: () => (objects[0] as Widget).createLayout()
                })
            );

            additionalMenuItems.push(
                new MenuItem({
                    label: "Replace with Layout",
                    click: () => (objects[0] as Widget).replaceWithLayout()
                })
            );

            let parent = objects[0]._parent;
            if (parent && parent._parent instanceof SelectWidget) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Replace Parent",
                        click: () => (objects[0] as Widget).replaceParent()
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

        replaceObject(this, loadObject(undefined, selectWidgetJsObject, Widget.classInfo));
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

        replaceObjects(widgets, loadObject(undefined, containerWidgetJsObject, Widget.classInfo));
    }

    async createLayout() {
        const layouts = (getProperty(ProjectStore.project, "gui") as Gui).pages;

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Layou name",
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

            addObject(
                layouts,
                loadObject(
                    undefined,
                    {
                        name: layoutName,
                        resolutions: [
                            {
                                x: 0,
                                y: 0,
                                width: this.width,
                                height: this.height,
                                style: "default",
                                widgets: [thisWidgetJS]
                            }
                        ]
                    },
                    Page.classInfo
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
                Widget.classInfo
            );

            replaceObject(this, newWidget);
        } catch (error) {
            console.error(error);
        }
    }

    async replaceWithLayout() {
        const layouts = (getProperty(ProjectStore.project, "gui") as Gui).pages;

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
                Widget.classInfo
            );

            replaceObject(this, newWidget);
        } catch (error) {
            console.error(error);
        }
    }

    replaceParent() {
        let parent = this._parent;
        if (parent) {
            let selectWidget = parent._parent;
            if (selectWidget instanceof SelectWidget) {
                replaceObject(selectWidget, cloneObject(undefined, this));
            }
        }
    }

    @action
    applyGeometryChange(
        geometryProperties: GeometryProperties,
        geometryChanges: ObjectGeometryChange[]
    ) {
        let changedGeometryProperties: Partial<GeometryProperties> = {};

        if (geometryProperties.x !== this.x) {
            changedGeometryProperties.x = geometryProperties.x;
        }
        if (geometryProperties.y !== this.y) {
            changedGeometryProperties.y = geometryProperties.y;
        }
        if (geometryProperties.width !== this.width) {
            changedGeometryProperties.width = geometryProperties.width;
        }
        if (geometryProperties.height !== this.height) {
            changedGeometryProperties.height = geometryProperties.height;
        }

        updateObject(this, changedGeometryProperties);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return undefined;
    }
}

registerClass(Widget);

////////////////////////////////////////////////////////////////////////////////

export const widgetSharedProperties: PropertyInfo[] = [
    {
        name: "type",
        type: PropertyType.Enum
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
];

////////////////////////////////////////////////////////////////////////////////

export class ContainerWidget extends Widget {
    @observable
    widgets: EezArrayObject<Widget>;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "widgets",
                    type: PropertyType.Array,
                    typeClassInfo: Widget.classInfo,
                    hideInPropertyGrid: true
                }
            ]),

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

        updateObject(this, changedProperties);

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
        return draw.drawDefaultWidget(this, rect);
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
        properties: () =>
            widgetSharedProperties.concat([
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
                    typeClassInfo: Widget.classInfo,
                    hideInPropertyGrid: true,
                    isOptional: true
                }
            ]),

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
        updateObject(this, changedProperties);

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
        return draw.drawDefaultWidget(this, rect);
    }
}

registerClass(ListWidget);

////////////////////////////////////////////////////////////////////////////////

export class GridWidget extends Widget {
    @observable
    itemWidget?: Widget;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "itemWidget",
                    type: PropertyType.Object,
                    typeClassInfo: Widget.classInfo,
                    hideInPropertyGrid: true,
                    isOptional: true
                }
            ]),

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
        return draw.drawDefaultWidget(this, rect);
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

    static classInfo = {
        getClass: function(jsObject: any) {
            return SelectWidgetEditor;
        },

        label: (selectWidgetEditor: SelectWidgetEditor) => {
            const parent = selectWidgetEditor._parent!;
            return parent._classInfo.label(parent) + " Editor";
        },

        properties: () => [
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
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "widgets",
                    type: PropertyType.Array,
                    typeClassInfo: Widget.classInfo,
                    hideInPropertyGrid: true,
                    childLabel: (childObject: EezObject, childLabel: string) => {
                        let label;

                        if (childObject._parent) {
                            let selectWidgetProperties = childObject._parent!
                                ._parent as SelectWidget;

                            label = selectWidgetProperties.getChildLabel(childObject as Widget);
                        }

                        return `${label || "???"} ➔ ${childLabel}`;
                    }
                },
                {
                    name: "editor",
                    type: PropertyType.Object,
                    typeClassInfo: SelectWidgetEditor.classInfo,
                    enumerable: false
                }
            ]),

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
            let dataItem = data.findDataItem(this.data);
            if (dataItem) {
                let enumItems: string[] = [];

                if (dataItem.type == "enum") {
                    try {
                        enumItems = JSON.parse(dataItem.enumItems);
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
        updateObject(this, changedProperties);

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
                    let dataItem = data.findDataItem(this.data);
                    if (dataItem) {
                        if (dataItem.type == "enum") {
                            let enumItems: string[];
                            try {
                                enumItems = JSON.parse(dataItem.enumItems);
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
        return draw.drawDefaultWidget(this, rect);
    }
}

registerClass(SelectWidget);

////////////////////////////////////////////////////////////////////////////////

export class DisplayDataWidget extends Widget {
    @observable
    focusStyle?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "focusStyle",
                    type: PropertyType.ObjectReference,
                    referencedObjectCollectionPath: ["gui", "styles"]
                }
            ]),

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

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "text",
                    type: PropertyType.String
                },
                {
                    name: "ignoreLuminocity",
                    type: PropertyType.Boolean,
                    defaultValue: false
                }
            ]),

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

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "text",
                    type: PropertyType.String
                }
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "bitmap",
                    type: PropertyType.ObjectReference,
                    referencedObjectCollectionPath: ["gui", "bitmaps"]
                }
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "text1",
                    type: PropertyType.String
                },
                {
                    name: "text2",
                    type: PropertyType.String
                }
            ]),

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
        properties: () => widgetSharedProperties.concat([]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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
        properties: () =>
            widgetSharedProperties.concat([
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
            ]),

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

export class LayoutViewWidget extends Widget {
    @observable
    layout: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () =>
            widgetSharedProperties.concat([
                {
                    name: "layout",
                    type: PropertyType.ObjectReference,
                    referencedObjectCollectionPath: ["gui", "pages"]
                }
            ]),

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
                let layout = findPage(this.layout);
                if (!layout) {
                    messages.push(output.propertyNotFoundMessage(this, "layout"));
                }
            }
        }

        return super.check().concat(messages);
    }

    draw(rect: Rect): HTMLCanvasElement | undefined {
        return draw.drawLayoutViewWidget(this, rect);
    }
}

registerClass(LayoutViewWidget);

////////////////////////////////////////////////////////////////////////////////

export class AppViewWidget extends Widget {
    @observable
    page: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: () => widgetSharedProperties.concat([]),
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

////////////////////////////////////////////////////////////////////////////////

export const widgetClasses = getClassesDerivedFrom(Widget);

export function getWidgetType(widgetClass: typeof EezObject) {
    if (widgetClass.name.endsWith('Widget')) {
        return widgetClass.name.substring(0, widgetClass.name.length - "Widget".length);
    }
    return widgetClass.name;
}

const typeProperty = widgetSharedProperties.find(propertyInfo => propertyInfo.name == "type")!;
typeProperty.enumItems = widgetClasses.map(widgetClass => ({
    id: getWidgetType(widgetClass)
}));


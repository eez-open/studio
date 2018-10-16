import { observable, computed, action } from "mobx";

import { validators } from "shared/model/validation";

import { showGenericDialog } from "shared/ui/generic-dialog";

import {
    getChildOfObject,
    loadObject,
    objectToJS,
    addObject,
    replaceObject,
    replaceObjects,
    updateObject,
    cloneObject,
    getParent,
    getMetaData,
    getProperty,
    ProjectStore,
    isArray
} from "project-editor/core/store";
import {
    EnumItem,
    EezObject,
    PropertyMetaData,
    registerMetaData
} from "project-editor/core/metaData";
import { isEqual, Rect, htmlEncode } from "project-editor/core/util";
import * as output from "project-editor/core/output";

import * as data from "project-editor/project/features/data/data";
import { findActionIndex } from "project-editor/project/features/action/action";

import { GeometryProperties, ObjectGeometryChange } from "project-editor/components/CanvasEditor";

import { findStyle, findBitmapIndex, GuiProperties } from "project-editor/project/features/gui/gui";
import { PageOrientationProperties } from "project-editor/project/features/gui/page";
import {
    widgetTypeMetaData,
    WidgetTypeProperties
} from "project-editor/project/features/gui/widgetType";
import * as draw from "project-editor/project/features/gui/draw";

const { MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

var widgetTypeClasses: any;

function getWidgetTypeClass() {
    if (!widgetTypeClasses) {
        widgetTypeClasses = {
            Container: ContainerWidgetProperties,
            List: ListWidgetProperties,
            Select: SelectWidgetProperties,
            DisplayData: DisplayDataWidgetProperties,
            Text: TextWidgetProperties,
            MultilineText: MultilineTextWidgetProperties,
            Rectangle: RectangleWidgetProperties,
            Bitmap: BitmapWidgetProperties,
            Button: ButtonWidgetProperties,
            ToggleButton: ToggleButtonWidgetProperties,
            ButtonGroup: ButtonGroupWidgetProperties,
            Scale: ScaleWidgetProperties,
            BarGraph: BarGraphWidgetProperties,
            YTGraph: YTGraphWidgetProperties,
            UpDown: UpDownWidgetProperties,
            ListGraph: ListGraphWidgetProperties
        };
    }

    return widgetTypeClasses;
}

////////////////////////////////////////////////////////////////////////////////

export type WidgetParent = PageOrientationProperties | WidgetTypeProperties | WidgetProperties;

export class WidgetProperties extends EezObject {
    // shared properties
    @observable
    type: string;
    @observable
    style?: string;
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

    @computed
    get styleObject() {
        if (this.style) {
            return findStyle(this.style);
        }
        return undefined;
    }

    // Return immediate parent, which can be of type PageOrientationProperties, WidgetTyperProperties
    // or WidgetProperties (i.e. ContainerWidgetProperties, ListWidgetProperties, SelectWidgetPropertis)
    get parent(): WidgetParent {
        let parent = getParent(this)!;
        if (isArray(parent)) {
            parent = getParent(parent)!;
        }
        return parent as WidgetParent;
    }

    // Return first ancestor of type:
    //   - PageOrientationProperties or
    //   - WidgetTyperProperties or
    //   - WidgetProperties, if that ancestor parent is SelectWidgetProperties
    get anchorParent() {
        let widget: WidgetProperties = this;

        while (true) {
            let parent = widget.parent;

            if (
                parent instanceof PageOrientationProperties ||
                parent instanceof WidgetTypeProperties
            ) {
                return parent;
            }

            if (parent instanceof SelectWidgetProperties) {
                return widget;
            }

            widget = parent;
        }
    }

    // If this widget is immediate child of SelectWidgetProperties parent return that parent.
    get selectParent(): SelectWidgetProperties | undefined {
        const parent = this.parent;
        if (parent instanceof SelectWidgetProperties) {
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

        let object: WidgetProperties = this;

        while (true) {
            let parent = object.parent;

            if (parent instanceof SelectWidgetProperties) {
                let i = parent.widgets.indexOf(object);

                rect.left += parent.editor.rect.left + SelectWidgetEditorProperties.EDITOR_PADDING;
                rect.top +=
                    parent.editor.rect.top +
                    SelectWidgetEditorProperties.EDITOR_PADDING +
                    i * (parent.height + SelectWidgetEditorProperties.EDITOR_PADDING);

                break;
            }

            if (parent instanceof WidgetTypeProperties) {
                break;
            }

            rect.left += parent.x;
            rect.top += parent.y;

            if (parent instanceof PageOrientationProperties) {
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

        if (this.data) {
            let dataIndex = data.findDataItemIndex(this.data);
            if (dataIndex == -1) {
                messages.push(output.propertyNotFoundMessage(this, "data"));
            } else if (dataIndex >= 255) {
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
            } else if (actionIndex >= 255) {
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
                    click: () => (objects[0] as WidgetProperties).putInSelect()
                })
            );
        }

        let i: number;
        for (i = 1; i < objects.length; i++) {
            if (getParent(objects[i]) !== getParent(objects[0])) {
                break;
            }
        }
        if (i == objects.length) {
            additionalMenuItems.push(
                new MenuItem({
                    label: "Put in Container",
                    click: () => WidgetProperties.putInContainer(objects as WidgetProperties[])
                })
            );
        }

        if (objects.length === 1) {
            additionalMenuItems.push(
                new MenuItem({
                    label: "Create Local Widget Type",
                    click: () => (objects[0] as WidgetProperties).createLocalWidgetType()
                })
            );

            additionalMenuItems.push(
                new MenuItem({
                    label: "Replace with Local Widget Type",
                    click: () => (objects[0] as WidgetProperties).replaceWithLocalWidgetType()
                })
            );

            let parent = getParent(objects[0]);
            if (parent && getParent(parent) instanceof SelectWidgetProperties) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Replace Parent",
                        click: () => (objects[0] as WidgetProperties).replaceParent()
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
        let selectWidgetType = getWidgetTypesMap().get("Select") as WidgetType;
        let thisWidgetJsObject = objectToJS(this);

        var selectWidgetJsObject = selectWidgetType.create() as SelectWidgetProperties;

        selectWidgetJsObject.x = thisWidgetJsObject.x;
        selectWidgetJsObject.y = thisWidgetJsObject.y;
        selectWidgetJsObject.width = thisWidgetJsObject.width;
        selectWidgetJsObject.height = thisWidgetJsObject.height;

        thisWidgetJsObject.x = 0;
        thisWidgetJsObject.y = 0;

        selectWidgetJsObject.widgets = [thisWidgetJsObject];

        replaceObject(this, loadObject(undefined, selectWidgetJsObject, widgetMetaData));
    }

    static putInContainer(widgets: WidgetProperties[]) {
        let containerWidgetType = getWidgetTypesMap().get("Container") as WidgetType;

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

        var containerWidgetJsObject = containerWidgetType.create() as SelectWidgetProperties;

        containerWidgetJsObject.x = x1;
        containerWidgetJsObject.y = y1;
        containerWidgetJsObject.width = x2 - x1;
        containerWidgetJsObject.height = y2 - y1;

        for (let i = 0; i < widgets.length; i++) {
            let widget = widgets[i];
            let widgetJsObject = objectToJS(widget);

            widgetJsObject.x -= x1;
            widgetJsObject.y -= y1;

            containerWidgetJsObject.widgets.push(widgetJsObject);
        }

        replaceObjects(widgets, loadObject(undefined, containerWidgetJsObject, widgetMetaData));
    }

    async createLocalWidgetType() {
        const widgets = (getProperty(ProjectStore.projectProperties, "gui") as GuiProperties)
            .widgets;

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Local widget type name",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [validators.required, validators.unique({}, widgets)]
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            // create a new local widget type
            const localWidgetTypeName = result.values.name;

            const thisWidgetJS = objectToJS(this);
            thisWidgetJS.x = 0;
            thisWidgetJS.y = 0;

            addObject(
                widgets,
                loadObject(
                    undefined,
                    {
                        name: localWidgetTypeName,
                        width: this.width,
                        height: this.height,
                        style: "default",
                        widgets: [thisWidgetJS]
                    },
                    widgetTypeMetaData
                )
            );

            // replace this widget with new local widget of type "Local." + localWidgetTypeName
            const newWidget = loadObject(
                undefined,
                {
                    type: "Local." + localWidgetTypeName,
                    style: "default",
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height
                },
                widgetMetaData
            );

            replaceObject(this, newWidget);
        } catch (error) {
            console.error(error);
        }
    }

    async replaceWithLocalWidgetType() {
        const widgets = (getProperty(ProjectStore.projectProperties, "gui") as GuiProperties)
            .widgets;

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: "Local widget type",
                    fields: [
                        {
                            name: "name",
                            type: "enum",
                            enumItems: widgets.map(widget => widget.name)
                        }
                    ]
                },
                values: {
                    name: ""
                }
            });

            const localWidgetTypeName = result.values.name;

            // replace this widget with local widget of type "Local." + widgetName
            const newWidget = loadObject(
                undefined,
                {
                    type: "Local." + localWidgetTypeName,
                    style: "default",
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height
                },
                widgetMetaData
            );

            replaceObject(this, newWidget);
        } catch (error) {
            console.error(error);
        }
    }

    replaceParent() {
        let parent = getParent(this);
        if (parent) {
            let selectWidget = getParent(parent);
            if (selectWidget instanceof SelectWidgetProperties) {
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
}

export class ContainerWidgetProperties extends WidgetProperties {
    @observable
    widgets: WidgetProperties[];

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

        for (let j = 0; j < this.widgets.length; j++) {
            let childWidget = this.widgets[j];
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
}

export class ListWidgetProperties extends WidgetProperties {
    @observable
    itemWidget?: WidgetProperties;
    @observable
    listType?: string;

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
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
}

export type Position = "left" | "right" | "top" | "bottom";

export class SelectWidgetEditorProperties extends EezObject {
    static readonly EDITOR_PADDING = 10;

    @observable
    x: number;
    @observable
    y: number;

    get parent() {
        return getParent(this) as SelectWidgetProperties;
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

        const count = this.parent.widgets.length;

        if (this.editorOrientation === "vertical") {
            width = this.parent.width + 2 * SelectWidgetEditorProperties.EDITOR_PADDING;

            height =
                (this.parent.height + SelectWidgetEditorProperties.EDITOR_PADDING) * count +
                SelectWidgetEditorProperties.EDITOR_PADDING;
        } else {
            width =
                (this.parent.width + SelectWidgetEditorProperties.EDITOR_PADDING) * count +
                SelectWidgetEditorProperties.EDITOR_PADDING;

            height = this.parent.height + 2 * SelectWidgetEditorProperties.EDITOR_PADDING;
        }

        return {
            left: this.x - Math.round(width / 2),
            top: this.y - Math.round(height / 2),
            width,
            height
        };
    }
}

export const selectWidgetEditorMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return SelectWidgetEditorProperties;
    },
    className: "SelectWidgetEditor",

    label: (selectWidgetEditor: SelectWidgetEditorProperties) => {
        const parent = getParent(selectWidgetEditor)!;
        return getMetaData(parent).label(parent) + " Editor";
    },

    properties: () => [
        {
            name: "x",
            type: "number"
        },
        {
            name: "y",
            type: "number"
        }
    ],

    defaultValue: {
        x: 350,
        y: 0
    }
});

export class SelectWidgetProperties extends WidgetProperties {
    @observable
    widgets: WidgetProperties[];
    @observable
    editor: SelectWidgetEditorProperties;

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

                if (enumItems.length > this.widgets.length) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Some select children are missing",
                            this
                        )
                    );
                } else if (enumItems.length < this.widgets.length) {
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

        for (let j = 0; j < this.widgets.length; j++) {
            let childWidget = this.widgets[j];
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

    getChildLabel(childObject: WidgetProperties) {
        if (this.widgets) {
            let index = this.widgets.indexOf(childObject);
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
}

export class DisplayDataWidgetProperties extends WidgetProperties {
    @observable
    activeStyle?: string;

    @computed
    get activeStyleObject() {
        if (this.activeStyle) {
            return findStyle(this.activeStyle);
        }
        return undefined;
    }

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        if (this.activeStyle) {
            if (!this.activeStyleObject) {
                messages.push(output.propertyNotFoundMessage(this, "activeStyle"));
            }
        }

        return super.check().concat(messages);
    }
}

export class TextWidgetProperties extends WidgetProperties {
    @observable
    text?: string;
    @observable
    ignoreLuminocity: boolean;

    check() {
        let messages: output.Message[] = [];

        if (!this.text && !this.data) {
            messages.push(output.propertyNotSetMessage(this, "text"));
        }

        return super.check().concat(messages);
    }
}

export class MultilineTextWidgetProperties extends WidgetProperties {
    @observable
    text?: string;

    check() {
        let messages: output.Message[] = [];

        if (!this.text && !this.data) {
            messages.push(output.propertyNotSetMessage(this, "text"));
        }

        return super.check().concat(messages);
    }
}

export class RectangleWidgetProperties extends WidgetProperties {
    @observable
    ignoreLuminocity: boolean;
    @observable
    invertColors: boolean;

    check() {
        let messages: output.Message[] = [];

        if (this.data) {
            messages.push(output.propertySetButNotUsedMessage(this, "data"));
        }

        return super.check().concat(messages);
    }
}

export class BitmapWidgetProperties extends WidgetProperties {
    @observable
    bitmap?: string;

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
                let bitmapIndex = findBitmapIndex(this.bitmap);
                if (bitmapIndex == -1) {
                    messages.push(output.propertyNotFoundMessage(this, "bitmap"));
                } else if (bitmapIndex >= 255) {
                    messages.push(
                        new output.Message(
                            output.Type.ERROR,
                            "Bitmap ignored",
                            getChildOfObject(this, "bitmap")
                        )
                    );
                }
            }
        }

        return super.check().concat(messages);
    }
}

export class ButtonWidgetProperties extends WidgetProperties {
    @observable
    text?: string;
    @observable
    enabled?: string;
    @observable
    disabledStyle?: string;

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
            } else if (dataIndex >= 255) {
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
}

export class ToggleButtonWidgetProperties extends WidgetProperties {
    @observable
    text1?: string;
    @observable
    text2?: string;

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
}

export class ButtonGroupWidgetProperties extends WidgetProperties {
    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }
}

export class ScaleWidgetProperties extends WidgetProperties {
    @observable
    needlePosition: string;
    @observable
    needleWidth: number;
    @observable
    needleHeight: number;

    check() {
        let messages: output.Message[] = [];

        if (!this.data) {
            messages.push(output.propertyNotSetMessage(this, "data"));
        }

        return super.check().concat(messages);
    }
}

export class BarGraphWidgetProperties extends WidgetProperties {
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
            } else if (dataIndex >= 255) {
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
            } else if (dataIndex >= 255) {
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
}

export class YTGraphWidgetProperties extends WidgetProperties {
    @observable
    y1Style?: string;
    @observable
    y2Data?: string;
    @observable
    y2Style?: string;

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
            } else if (dataIndex >= 255) {
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
}

export class UpDownWidgetProperties extends WidgetProperties {
    @observable
    buttonsStyle?: string;
    @observable
    downButtonText?: string;
    @observable
    upButtonText?: string;

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
}

export class ListGraphWidgetProperties extends WidgetProperties {
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
            } else if (dataIndex >= 255) {
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
            } else if (dataIndex >= 255) {
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
            } else if (dataIndex >= 255) {
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
            } else if (dataIndex >= 255) {
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
}

export class LocalWidgetProperties extends WidgetProperties {}

////////////////////////////////////////////////////////////////////////////////

export const widgetMetaData = registerMetaData({
    className: "Widget",
    getClass: function(jsObject: any) {
        return getWidgetTypeClass()[jsObject.type] || LocalWidgetProperties;
    },
    label: (widget: WidgetProperties) => {
        if (widget.data) {
            return `${widget.type}: ${widget.data}`;
        }

        if (
            widget instanceof TextWidgetProperties ||
            widget instanceof MultilineTextWidgetProperties
        ) {
            if (widget.text) {
                return `${widget.type}: "${widget.text}"`;
            }
        }

        if (widget instanceof BitmapWidgetProperties) {
            if (widget.bitmap) {
                return `${widget.type}: ${widget.bitmap}`;
            }
        }

        return widget.type;
    },
    properties: (widget: WidgetProperties) => {
        if (widget.type.startsWith("Local.")) {
            return widgetSharedProperties;
        }

        let widgetType = getWidgetTypesMap().get(widget.type);
        if (widgetType) {
            return widgetType.properties;
        }

        return widgetSharedProperties;
    }
});

////////////////////////////////////////////////////////////////////////////////

export const widgetSharedProperties: PropertyMetaData[] = [
    {
        name: "type",
        type: "enum",
        matchObjectReference: (object: EezObject, path: (string | number)[], value: string) => {
            if (isEqual(path, ["gui", "widgets"])) {
                let type = (object as WidgetProperties).type;
                if (type && type.startsWith("Local.")) {
                    return type.substring("Local.".length) == value;
                }
            }
            return false;
        },
        replaceObjectReference: (value: string) => {
            return "Local." + value;
        }
    },
    {
        name: "data",
        type: "object-reference",
        referencedObjectCollectionPath: ["data"]
    },
    {
        name: "action",
        type: "object-reference",
        referencedObjectCollectionPath: ["actions"]
    },
    {
        name: "x",
        type: "number"
    },
    {
        name: "y",
        type: "number"
    },
    {
        name: "width",
        type: "number"
    },
    {
        name: "height",
        type: "number"
    },
    {
        name: "style",
        type: "object-reference",
        referencedObjectCollectionPath: ["gui", "styles"]
    }
];

////////////////////////////////////////////////////////////////////////////////

export interface WidgetType extends EnumItem {
    create(): WidgetProperties;
    properties: PropertyMetaData[];
    draw?: (widget: WidgetProperties, rect: Rect) => HTMLCanvasElement | undefined;
    isOpaque: boolean;
}

////////////////////////////////////////////////////////////////////////////////

let _widgetTypes: WidgetType[];

export function getWidgetTypes() {
    if (!_widgetTypes) {
        _widgetTypes = [
            {
                id: "Container",
                create() {
                    return <any>{
                        type: "Container",
                        widgets: [],
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "widgets",
                        type: "array",
                        typeMetaData: widgetMetaData,
                        hideInPropertyGrid: true
                    }
                ]),
                isOpaque: false
            },
            {
                id: "List",
                create() {
                    return <any>{
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
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "listType",
                        type: "enum",
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
                        type: "object",
                        typeMetaData: widgetMetaData,
                        hideInPropertyGrid: true,
                        isOptional: true
                    }
                ]),
                isOpaque: false
            },
            {
                id: "Select",
                create() {
                    return <any>{
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
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "widgets",
                        type: "array",
                        typeMetaData: widgetMetaData,
                        hideInPropertyGrid: true,
                        childLabel: (childObject: EezObject, childLabel: string) => {
                            let label;

                            if (getParent(childObject)) {
                                let selectWidgetProperties = getParent(
                                    getParent(childObject)!
                                )! as SelectWidgetProperties;

                                label = selectWidgetProperties.getChildLabel(
                                    childObject as WidgetProperties
                                );
                            }

                            return `${label || "???"} ➔ ${childLabel}`;
                        }
                    },
                    {
                        name: "editor",
                        type: "object",
                        typeMetaData: selectWidgetEditorMetaData,
                        enumerable: false
                    }
                ]),
                isOpaque: false
            },
            {
                id: "DisplayData",
                create() {
                    return <any>{
                        type: "DisplayData",
                        data: "data",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "activeStyle",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    }
                ]),
                draw: draw.drawDisplayDataWidget,
                isOpaque: true
            },
            {
                id: "Text",
                create() {
                    return <any>{
                        type: "Text",
                        text: "Text",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "text",
                        type: "string"
                    },
                    {
                        name: "ignoreLuminocity",
                        type: "boolean",
                        defaultValue: false
                    }
                ]),
                draw: draw.drawTextWidget,
                isOpaque: true
            },
            {
                id: "MultilineText",
                create() {
                    return <any>{
                        type: "MultilineText",
                        text: "Multiline text",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "text",
                        type: "string"
                    }
                ]),
                draw: draw.drawMultilineTextWidget,
                isOpaque: true
            },
            {
                id: "Rectangle",
                create() {
                    return <any>{
                        type: "Rectangle",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "invertColors",
                        type: "boolean",
                        defaultValue: false
                    },
                    {
                        name: "ignoreLuminocity",
                        type: "boolean",
                        defaultValue: false
                    }
                ]),
                draw: draw.drawRectangleWidget,
                isOpaque: true
            },
            {
                id: "Bitmap",
                create() {
                    return <any>{
                        type: "Bitmap",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "bitmap",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "bitmaps"]
                    }
                ]),
                draw: draw.drawBitmapWidget,
                isOpaque: true
            },
            {
                id: "Button",
                create() {
                    return <any>{
                        type: "Button",
                        x: 0,
                        y: 0,
                        width: 32,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "text",
                        type: "string"
                    },
                    {
                        name: "enabled",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "disabledStyle",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    }
                ]),
                draw: draw.drawButtonWidget,
                isOpaque: true
            },
            {
                id: "ToggleButton",
                create() {
                    return <any>{
                        type: "ToggleButton",
                        x: 0,
                        y: 0,
                        width: 32,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "text1",
                        type: "string"
                    },
                    {
                        name: "text2",
                        type: "string"
                    }
                ]),
                draw: draw.drawToggleButtonWidget,
                isOpaque: true
            },
            {
                id: "ButtonGroup",
                create() {
                    return <any>{
                        type: "ButtonGroup",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([]),
                draw: draw.drawButtonGroupWidget,
                isOpaque: true
            },
            {
                id: "Scale",
                create() {
                    return <any>{
                        type: "Scale",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        needlePostion: "right",
                        needleWidth: 19,
                        needleHeight: 11,
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "needlePosition",
                        type: "enum",
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
                        type: "number"
                    },
                    {
                        name: "needleHeight",
                        type: "number"
                    }
                ]),
                draw: draw.drawScaleWidget,
                isOpaque: true
            },
            {
                id: "BarGraph",
                create() {
                    return <any>{
                        type: "BarGraph",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        orientation: "left-right",
                        style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "orientation",
                        type: "enum",
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
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    },
                    {
                        name: "line1Data",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "line1Style",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    },
                    {
                        name: "line2Data",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "line2Style",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    }
                ]),
                draw: draw.drawBarGraphWidget,
                isOpaque: true
            },
            {
                id: "YTGraph",
                create() {
                    return <any>{
                        type: "YTGraph",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default",
                        y1Style: "default",
                        y2Style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "y1Style",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    },
                    {
                        name: "y2Data",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "y2Style",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    }
                ]),
                draw: draw.drawYTGraphWidget,
                isOpaque: true
            },
            {
                id: "UpDown",
                create() {
                    return <any>{
                        type: "UpDown",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default",
                        buttonsStyle: "default",
                        upButtonText: ">",
                        downButtonText: "<"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "buttonsStyle",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    },
                    {
                        name: "downButtonText",
                        type: "string"
                    },
                    {
                        name: "upButtonText",
                        type: "string"
                    }
                ]),
                draw: draw.drawUpDownWidget,
                isOpaque: true
            },
            {
                id: "ListGraph",
                create() {
                    return <any>{
                        type: "ListGraph",
                        x: 0,
                        y: 0,
                        width: 64,
                        height: 32,
                        style: "default",
                        y1Style: "default",
                        y2Style: "default"
                    };
                },
                properties: widgetSharedProperties.concat([
                    {
                        name: "dwellData",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "y1Data",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "y1Style",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    },
                    {
                        name: "y2Data",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "y2Style",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    },
                    {
                        name: "cursorData",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["data"]
                    },
                    {
                        name: "cursorStyle",
                        type: "object-reference",
                        referencedObjectCollectionPath: ["gui", "styles"]
                    }
                ]),
                draw: draw.drawListGraphWidget,
                isOpaque: true
            }
        ];
    }

    return _widgetTypes;
}

let _widgetTypesMap: Map<string, WidgetType> = new Map<string, WidgetType>();

function getWidgetTypesMap() {
    if (!_widgetTypesMap.size) {
        getWidgetTypes().forEach(widgetType =>
            _widgetTypesMap.set(widgetType.id.toString(), widgetType)
        );

        (<PropertyMetaData>(
            widgetSharedProperties.find(propertyMetaData => propertyMetaData.name == "type")
        )).enumItems = getWidgetTypes();
    }
    return _widgetTypesMap;
}

export function getWidgetType(widget: WidgetProperties) {
    return getWidgetTypesMap().get(widget.type);
}

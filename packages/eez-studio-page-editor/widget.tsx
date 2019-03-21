import React from "react";
import { observable, computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find, _range } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";
import { Rect } from "eez-studio-shared/geometry";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";

import {
    EezObject,
    registerClass,
    EezArrayObject,
    ClassInfo,
    PropertyType,
    makeDerivedClassInfo,
    findClass,
    isArray,
    getChildOfObject,
    objectToJS,
    cloneObject,
    geometryGroup,
    styleGroup,
    IPropertyGridGroupDefinition,
    areAllChildrenOfTheSameParent,
    isAncestor
} from "eez-studio-shared/model/object";
import { loadObject } from "eez-studio-shared/model/serialization";
import {
    DocumentStore,
    IMenuItem,
    UIElementsFactory,
    NavigationStore,
    UndoManager
} from "eez-studio-shared/model/store";
import * as output from "eez-studio-shared/model/output";

import { IResizeHandler, IDesignerContext } from "eez-studio-designer/designer-interfaces";
import { PageInitContext } from "eez-studio-page-editor/page-init-context";
import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { Page } from "eez-studio-page-editor/page";
import { IResizing, resizingProperty } from "eez-studio-page-editor/resizing-widget-property";
import { WidgetContainerComponent, WidgetComponent } from "eez-studio-page-editor/render";
import { EditorObject } from "eez-studio-page-editor/editor";

import { PropertyProps } from "eez-studio-shared/model/components/PropertyGrid";

import {
    withResolutionDependableProperties,
    unsetAllResolutionDependablePropertiesForLowerResolutions
} from "eez-studio-page-editor/resolution-dependable-properties";

////////////////////////////////////////////////////////////////////////////////

export function makeDataPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
) {
    if (PageInitContext) {
        return PageInitContext.makeDataPropertyInfo(name, displayName, propertyGridGroup);
    } else {
        return {
            name,
            displayName,
            type: PropertyType.String
        };
    }
}

export function makeActionPropertyInfo(
    name: string,
    displayName?: string,
    propertyGridGroup?: IPropertyGridGroupDefinition
) {
    if (PageInitContext) {
        return PageInitContext.makeActionPropertyInfo(name, displayName, propertyGridGroup);
    } else {
        return {
            name,
            displayName,
            type: PropertyType.String
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

function htmlEncode(value: string) {
    const el = document.createElement("div");
    el.innerText = value;
    return el.innerHTML;
}

function hideIfNotGridLayout(object: EezObject) {
    return !(
        object._parent &&
        object._parent._parent instanceof ContainerWidget &&
        object._parent._parent.layout === "grid"
    );
}

////////////////////////////////////////////////////////////////////////////////

@observer
class UnsetAllResolutionDependablePropertiesForLowerResolutionsPropertyGridUI extends React.Component<
    PropertyProps
> {
    @bind
    reset() {
        unsetAllResolutionDependablePropertiesForLowerResolutions(this.props.object);
    }

    render() {
        return (
            <UIElementsFactory.Button
                variant="text"
                color="primary"
                size="small"
                onClick={this.reset}
                style={{ margin: 5 }}
            >
                Unset All Resolution Dependable Properties for Lower Resolutions
            </UIElementsFactory.Button>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export type WidgetParent = Page | Widget;

export class Widget extends EezObject {
    // shared properties
    @observable type: string;
    @observable style?: string;
    @observable activeStyle?: string;
    @observable data?: string;
    @observable action?: string;

    // resolution dependandable properties
    display: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    resizing: IResizing;
    css: string;
    className: string;
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;

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

            return humanize(widget.type);
        },

        properties: [
            {
                name: "type",
                type: PropertyType.Enum,
                hideInPropertyGrid: true
            },
            {
                name: "display",
                type: PropertyType.Boolean,
                defaultValue: true,
                propertyGridGroup: geometryGroup
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
            resizingProperty,
            makeDataPropertyInfo("data"),
            makeActionPropertyInfo("action"),
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
            },
            {
                name: "css",
                type: PropertyType.CSS,
                propertyGridGroup: styleGroup
            },
            {
                name: "className",
                type: PropertyType.String,
                propertyGridGroup: styleGroup
            },
            {
                name: "row",
                type: PropertyType.Number,
                hideInPropertyGrid: hideIfNotGridLayout
            },
            {
                name: "col",
                displayName: "Column",
                type: PropertyType.Number,
                hideInPropertyGrid: hideIfNotGridLayout
            },
            {
                name: "rowSpan",
                type: PropertyType.Number,
                hideInPropertyGrid: hideIfNotGridLayout
            },
            {
                name: "colSpan",
                displayName: "Column span",
                type: PropertyType.Number,
                hideInPropertyGrid: hideIfNotGridLayout
            },
            {
                name: "unsetAllResolutionDependablePropertiesForLowerResolutions",
                type: PropertyType.Any,
                computed: true,
                propertyGridComponent: UnsetAllResolutionDependablePropertiesForLowerResolutionsPropertyGridUI,
                hideInPropertyGrid: () =>
                    PageContext.resolution === PageContext.allResolutions.length - 1
            }
        ],

        isPropertyMenuSupported: true
    };

    @computed
    get rect() {
        return {
            left: this.x,
            top: this.y,
            width: this.width,
            height: this.height
        };
    }

    get contentRect() {
        return this.rect;
    }

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

        if (isNaN(this.x)) {
            messages.push(output.propertyNotSetMessage(this, "x"));
        }

        if (isNaN(this.y)) {
            messages.push(output.propertyNotSetMessage(this, "y"));
        }

        if (isNaN(this.width)) {
            messages.push(output.propertyNotSetMessage(this, "width"));
        }

        if (isNaN(this.height)) {
            messages.push(output.propertyNotSetMessage(this, "height"));
        }

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
            let dataIndex = PageContext.findDataItemIndex(this.data);
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

        if (areAllChildrenOfTheSameParent(objects)) {
            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: "Put in Container",
                    click: () => Widget.putInContainer(objects as Widget[])
                })
            );

            additionalMenuItems.push(
                UIElementsFactory.createMenuItem({
                    label: `Create ${PageContext.layoutConceptName}`,
                    click: () => Widget.createLayout(objects as Widget[])
                })
            );
        }

        if (objects.length === 1) {
            const object = objects[0];

            if (object instanceof LayoutViewWidget) {
                additionalMenuItems.push(
                    UIElementsFactory.createMenuItem({
                        label: "Replace with Container",
                        click: () => object.replaceWithContainer()
                    })
                );
            }

            let parent = object._parent;
            if (parent && parent._parent instanceof SelectWidget) {
                additionalMenuItems.push(
                    UIElementsFactory.createMenuItem({
                        label: "Replace Parent",
                        click: () => (object as Widget).replaceParent()
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

        var selectWidgetJsObject = Object.assign({}, SelectWidget.classInfo.defaultValue);

        selectWidgetJsObject.x = thisWidgetJsObject.x;
        selectWidgetJsObject.y = thisWidgetJsObject.y;
        selectWidgetJsObject.width = thisWidgetJsObject.width;
        selectWidgetJsObject.height = thisWidgetJsObject.height;

        thisWidgetJsObject.x = 0;
        thisWidgetJsObject.y = 0;

        selectWidgetJsObject.widgets = [thisWidgetJsObject];

        DocumentStore.replaceObject(this, loadObject(this._parent, selectWidgetJsObject, Widget));
    }

    static createWidgets(fromWidgets: Widget[]) {
        let x1 = fromWidgets[0].x;
        let y1 = fromWidgets[0].y;
        let x2 = fromWidgets[0].x + fromWidgets[0].width;
        let y2 = fromWidgets[0].y + fromWidgets[0].height;
        for (let i = 1; i < fromWidgets.length; i++) {
            let widget = fromWidgets[i];
            x1 = Math.min(widget.x, x1);
            y1 = Math.min(widget.y, y1);
            x2 = Math.max(widget.x + widget.width, x2);
            y2 = Math.max(widget.y + widget.height, y2);
        }

        const widgets = [];

        for (let i = 0; i < fromWidgets.length; i++) {
            let widget = fromWidgets[i];
            let widgetJsObject = objectToJS(widget);

            widgetJsObject.x -= x1;
            widgetJsObject.y -= y1;

            widgets.push(widgetJsObject);
        }

        return {
            widgets,
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    static putInContainer(fromWidgets: Widget[]) {
        var containerWidgetJsObject = Object.assign({}, ContainerWidget.classInfo.defaultValue);

        const createWidgetsResult = Widget.createWidgets(fromWidgets);

        containerWidgetJsObject.widgets = createWidgetsResult.widgets;

        containerWidgetJsObject.x = createWidgetsResult.x;
        containerWidgetJsObject.y = createWidgetsResult.y;
        containerWidgetJsObject.width = createWidgetsResult.width;
        containerWidgetJsObject.height = createWidgetsResult.height;

        DocumentStore.replaceObjects(
            fromWidgets,
            loadObject(fromWidgets[0]._parent, containerWidgetJsObject, Widget)
        );
    }

    static async createLayout(fromWidgets: Widget[]) {
        const layouts = PageContext.getLayouts();

        try {
            const result = await showGenericDialog({
                dialogDefinition: {
                    title: `${PageContext.layoutConceptName} name`,
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
                        x: 0,
                        y: 0,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        style: "default",
                        widgets: createWidgetsResult.widgets
                    },
                    findClass("Page")!
                )
            );

            DocumentStore.replaceObjects(
                fromWidgets,
                loadObject(
                    fromWidgets[0]._parent,
                    {
                        type: "LayoutView",
                        style: "default",
                        x: createWidgetsResult.x,
                        y: createWidgetsResult.y,
                        width: createWidgetsResult.width,
                        height: createWidgetsResult.height,
                        layout: layoutName
                    },
                    Widget
                )
            );
        } catch (error) {
            console.error(error);
        }
    }

    replaceParent() {
        let parent = this._parent;
        if (parent) {
            let selectWidget = parent._parent;
            if (selectWidget instanceof SelectWidget) {
                DocumentStore.replaceObject(selectWidget, cloneObject(selectWidget._parent, this));
            }
        }
    }

    draw(rect: Rect, dataContext: IDataContext): HTMLCanvasElement | undefined {
        return undefined;
    }

    render(
        rect: Rect,
        dataContext: IDataContext,
        designerContext?: IDesignerContext
    ): React.ReactNode {
        return undefined;
    }

    getResizeHandlers(): IResizeHandler[] | undefined | false {
        return false;
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

    getClassNameStr(dataContext: IDataContext) {
        const widgetClassName = this._class.name;

        if (this.className) {
            let className = dataContext.get(this.className);
            if (className) {
                return widgetClassName + " " + className;
            }
        }

        return widgetClassName;
    }

    styleHook(style: React.CSSProperties) {}

    get divAttributes(): { [key: string]: any } | undefined {
        return undefined;
    }
}

registerClass(
    withResolutionDependableProperties(Widget, [
        "display",
        "x",
        "y",
        "width",
        "height",
        "resizing",
        "css",
        "className",
        "row",
        "col",
        "rowSpan",
        "colSpan"
    ])
);

////////////////////////////////////////////////////////////////////////////////

const CONF_DEFAULT_PADDING = 20;
const CONF_DEFAULT_GAP = 20;

@observer
class ResizeWidgetsPropertyGridUI extends React.Component<PropertyProps> {
    @bind
    resizeWidgets(after: boolean) {
        const containerWidget = this.props.object as ContainerWidget;
        const widgetRects = containerWidget.getWidgetRects(containerWidget.rect);
        UndoManager.setCombineCommands(true);

        DocumentStore.updateObject(containerWidget, {
            height:
                2 * (containerWidget.padding || CONF_DEFAULT_PADDING) +
                (widgetRects.length > 0
                    ? widgetRects[widgetRects.length - 1].top +
                      widgetRects[widgetRects.length - 1].height -
                      widgetRects[0].top
                    : 0)
        });

        for (
            let widgetIndex = 0;
            widgetIndex < containerWidget.widgets._array.length;
            widgetIndex++
        ) {
            DocumentStore.updateObject(containerWidget.widgets._array[widgetIndex], {
                x: widgetRects[widgetIndex].left,
                y: widgetRects[widgetIndex].top,
                width: widgetRects[widgetIndex].width,
                height: widgetRects[widgetIndex].height
            });
        }
        UndoManager.setCombineCommands(false);
    }

    render() {
        return (
            <UIElementsFactory.Button
                variant="contained"
                color="primary"
                size="small"
                onClick={this.resizeWidgets}
                style={{ margin: 5 }}
            >
                Resize Widgets
            </UIElementsFactory.Button>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const containerPropertiesGroup: IPropertyGridGroupDefinition = {
    id: "containerProperties",
    title: "Container properties"
};

export class ContainerWidget extends Widget {
    @observable
    widgets: EezArrayObject<Widget>;

    @observable
    scrollable: boolean;

    // resolution dependandable properties
    layout: "free" | "grid";
    cols: number;
    padding: number;
    gap: number;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "widgets",
                type: PropertyType.Array,
                typeClass: Widget,
                hideInPropertyGrid: true
            },
            {
                name: "layout",
                type: PropertyType.Enum,
                enumItems: [{ id: "free" }, { id: "grid" }],
                propertyGridGroup: containerPropertiesGroup
            },
            {
                name: "scrollable",
                type: PropertyType.Boolean,
                propertyGridGroup: containerPropertiesGroup
            },
            {
                name: "cols",
                displayName: "Columns",
                type: PropertyType.Number,
                propertyGridGroup: containerPropertiesGroup,
                hideInPropertyGrid: (object: ContainerWidget) => object.layout !== "grid"
            },
            {
                name: "padding",
                type: PropertyType.Number,
                propertyGridGroup: containerPropertiesGroup,
                hideInPropertyGrid: (object: ContainerWidget) => object.layout !== "grid"
            },
            {
                name: "gap",
                type: PropertyType.Number,
                propertyGridGroup: containerPropertiesGroup,
                hideInPropertyGrid: (object: ContainerWidget) => object.layout !== "grid"
            },
            {
                name: "customUI",
                type: PropertyType.Any,
                computed: true,
                propertyGridComponent: ResizeWidgetsPropertyGridUI,
                propertyGridGroup: containerPropertiesGroup,
                hideInPropertyGrid: (object: ContainerWidget) => object.layout !== "grid"
            }
        ],

        defaultValue: {
            type: "Container",
            widgets: [],
            x: 0,
            y: 0,
            width: 64,
            height: 32,
            style: "default",
            layout: "free"
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

    @computed get grid() {
        function setCell(rowIndex: number, colIndex: number, widgetIndex: number) {
            while (rowIndex >= grid.length) {
                grid.push([]);
                for (let colIndex = 0; colIndex < cols; colIndex++) {
                    grid[rowIndex].push(0);
                }
            }

            while (colIndex >= grid[rowIndex].length) {
                grid[rowIndex].push(0);
            }

            grid[rowIndex][colIndex] = widgetIndex + 1;
        }

        function set(
            rowIndex: number,
            colIndex: number,
            rowSpan: number,
            colSpan: number,
            widgetIndex: number
        ) {
            rowSpan = rowSpan || 1;

            for (let i = rowIndex; i < rowIndex + rowSpan; i++) {
                setCell(i, colIndex, widgetIndex);
            }

            colSpan = colSpan || 1;

            for (let i = colIndex + 1; i < colIndex + colSpan; i++) {
                setCell(rowIndex, i, widgetIndex);
            }

            widgetLocations[widgetIndex].rowIndex = rowIndex;
            widgetLocations[widgetIndex].colIndex = colIndex;
            widgetLocations[widgetIndex].rowSpan = rowSpan;
            widgetLocations[widgetIndex].colSpan = colSpan;
        }

        function isAvailable(rowIndex: number, colIndex: number, rowSpan: number, colSpan: number) {
            if (rowIndex + rowSpan > grid.length) {
                return false;
            }

            if (colIndex + colSpan > grid[rowIndex].length) {
                return false;
            }

            for (let i = rowIndex; i < rowIndex + rowSpan; i++) {
                if (grid[i][colIndex] !== 0) {
                    return false;
                }
            }

            for (let i = colIndex + 1; i < colIndex + colSpan; i++) {
                if (grid[rowIndex][i] != 0) {
                    return false;
                }
            }

            return true;
        }

        function findPlace(rowSpan: number, colSpan: number) {
            rowSpan = rowSpan || 1;
            colSpan = colSpan || 1;

            for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
                for (let colIndex = 0; colIndex < grid[rowIndex].length; colIndex++) {
                    if (isAvailable(rowIndex, colIndex, rowSpan, colSpan)) {
                        return [rowIndex, colIndex];
                    }
                }
            }

            return [grid.length, 0];
        }

        const grid: number[][] = [];

        const widgetLocations: {
            rowIndex: number;
            colIndex: number;
            rowSpan: number;
            colSpan: number;
        }[] = [];

        for (let widgetIndex = 0; widgetIndex < this.widgets._array.length; widgetIndex++) {
            widgetLocations.push({
                rowIndex: 0,
                colIndex: 0,
                rowSpan: 0,
                colSpan: 0
            });
        }

        const cols = this.cols || 1;

        for (let widgetIndex = 0; widgetIndex < this.widgets._array.length; widgetIndex++) {
            const widget = this.widgets._array[widgetIndex];
            if (widget.row != undefined && widget.col != undefined) {
                set(widget.row, widget.col, widget.rowSpan, widget.colSpan, widgetIndex);
            }
        }

        for (let widgetIndex = 0; widgetIndex < this.widgets._array.length; widgetIndex++) {
            const widget = this.widgets._array[widgetIndex];
            if (!(widget.row != undefined && widget.col != undefined)) {
                const [rowIndex, colIndex] = findPlace(widget.rowSpan, widget.colSpan);
                set(rowIndex, colIndex, widget.rowSpan, widget.colSpan, widgetIndex);
            }
        }

        let maxCols = cols;
        for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
            maxCols = Math.max(maxCols, grid[rowIndex].length);
        }

        return {
            grid,
            widgetLocations,
            maxCols
        };
    }

    getWidgetRects(rect: Rect) {
        const { grid, widgetLocations, maxCols } = this.grid;

        const padding = this.padding || CONF_DEFAULT_PADDING;
        const gap = this.gap || CONF_DEFAULT_GAP;

        const availableColWidth = Math.max(rect.width - 2 * padding - (maxCols - 1) * gap, 0);

        const colWidth = Math.floor(availableColWidth / maxCols);

        const colWidths = [];
        for (let colIndex = 0; colIndex < maxCols - 1; colIndex++) {
            colWidths.push(colWidth);
        }
        colWidths.push(availableColWidth - (maxCols - 1) * colWidth);

        const rowHeights = [];
        for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
            let maxHeight = 0;
            for (let colIndex = 0; colIndex < grid[rowIndex].length; colIndex++) {
                if (grid[rowIndex][colIndex] != 0) {
                    const widget = this.widgets._array[grid[rowIndex][colIndex] - 1];
                    const rowSpan = widget.rowSpan || 1;
                    maxHeight = Math.max(
                        (widget.height - (rowSpan - 1) * gap) / rowSpan,
                        maxHeight
                    );
                }
            }
            rowHeights.push(maxHeight);
        }

        const widgetRects = [];
        for (let widgetIndex = 0; widgetIndex < this.widgets._array.length; widgetIndex++) {
            let left = padding;
            for (let colIndex = 0; colIndex < widgetLocations[widgetIndex].colIndex; colIndex++) {
                left += colWidths[colIndex] + gap;
            }

            let top = padding;
            for (let rowIndex = 0; rowIndex < widgetLocations[widgetIndex].rowIndex; rowIndex++) {
                top += rowHeights[rowIndex] + gap;
            }

            let width = 0;
            for (
                let colIndex = widgetLocations[widgetIndex].colIndex;
                colIndex <
                widgetLocations[widgetIndex].colIndex + widgetLocations[widgetIndex].colSpan;
                colIndex++
            ) {
                width += colWidths[colIndex] + gap;
            }
            width -= gap;

            let height = 0;
            for (
                let rowIndex = widgetLocations[widgetIndex].rowIndex;
                rowIndex <
                widgetLocations[widgetIndex].rowIndex + widgetLocations[widgetIndex].rowSpan;
                rowIndex++
            ) {
                height += rowHeights[rowIndex] + gap;
            }
            height -= gap;

            widgetRects.push({
                left,
                top,
                width,
                height
            });
        }

        return widgetRects;
    }

    render(rect: Rect, dataContext: IDataContext) {
        let widgetRects: Rect[] | undefined;

        if (this.layout === "grid") {
            widgetRects = this.getWidgetRects(rect);
        }

        return (
            <WidgetContainerComponent
                containerWidget={this}
                rectContainer={rect}
                widgets={this.widgets._array}
                dataContext={dataContext}
                widgetRects={widgetRects}
            />
        );
    }

    styleHook(style: React.CSSProperties) {
        style.overflow = PageContext.inEditor ? "visible" : this.scrollable ? "auto" : "visible";
    }

    get divAttributes() {
        return !PageContext.inEditor && this.scrollable ? { "data-simplebar": 1 } : undefined;
    }
}

registerClass(
    withResolutionDependableProperties(ContainerWidget, ["layout", "cols", "padding", "gap"])
);

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

    renderItems(dataContext: IDataContext) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        const itemRect = itemWidget.rect;

        const listItemsCount = this.data ? dataContext.count(this.data) : 0;

        return _range(listItemsCount).map(i => {
            let xListItem = 0;
            let yListItem = 0;

            if (this.listType === "horizontal") {
                xListItem += i * itemRect.width;
            } else {
                yListItem += i * itemRect.height;
            }

            return (
                <WidgetComponent
                    key={i}
                    widget={itemWidget}
                    rect={{
                        left: xListItem,
                        top: yListItem,
                        width: itemRect.width,
                        height: itemRect.height
                    }}
                    dataContext={dataContext}
                />
            );
        });
    }

    render(rect: Rect, dataContext: IDataContext) {
        return this.renderItems(dataContext);
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

    renderItems(rect: Rect, dataContext: IDataContext) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        const gridRect = rect;
        const itemRect = itemWidget.rect;

        const gridItemsCount = this.data ? dataContext.count(this.data) : 0;

        return _range(gridItemsCount).map(i => {
            const rows = Math.floor(gridRect.width / itemRect.width);
            const cols = Math.floor(gridRect.height / itemRect.height);

            const row = i % rows;
            const col = Math.floor(i / rows);

            if (col >= cols) {
                return undefined;
            }

            let xListItem = row * itemRect.width;
            let yListItem = col * itemRect.height;

            return (
                <WidgetComponent
                    key={i}
                    widget={itemWidget}
                    rect={{
                        left: xListItem,
                        top: yListItem,
                        width: itemRect.width,
                        height: itemRect.height
                    }}
                    dataContext={dataContext}
                />
            );
        });
    }

    render(rect: Rect, dataContext: IDataContext) {
        return this.renderItems(rect, dataContext);
    }
}

registerClass(GridWidget);

////////////////////////////////////////////////////////////////////////////////

export class SelectWidget extends Widget {
    @observable
    widgets: EezArrayObject<Widget>;

    @observable transition: "none" | "horizontal" | "vertical" = "none";

    _lastSelectedIndexInSelectWidget: number | undefined;

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
                },

                interceptAddObject: (widgets: EezArrayObject<Widget>, object: Widget) => {
                    console.log("intercept");
                    object.x = 0;
                    object.y = 0;
                    object.width = (widgets._parent as SelectWidget).width;
                    object.height = (widgets._parent as SelectWidget).height;
                    return object;
                }
            }
        ],

        defaultValue: {
            type: "Select",
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
            let dataItem = PageContext.findDataItem(this.data);
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

    getChildLabel(childObject: Widget) {
        if (this.widgets) {
            let index = this.widgets._array.indexOf(childObject);
            if (index != -1) {
                if (this.data) {
                    let dataItem = PageContext.findDataItem(this.data);
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

    getSelectedWidget(dataContext: IDataContext) {
        if (this.data) {
            let index: number = PageContext.rootDataContext.getEnumValue(this.data);
            if (index >= 0 && index < this.widgets._array.length) {
                return this.widgets._array[index];
            }
        }
        return undefined;
    }

    getSelectedIndex(dataContext?: IDataContext, designerContext?: IDesignerContext) {
        if (designerContext) {
            const selectedObjects = designerContext.viewState.selectedObjects;

            for (let i = 0; i < this.widgets._array.length; ++i) {
                if (
                    selectedObjects.find(selectedObject =>
                        isAncestor((selectedObject as EditorObject).object, this.widgets._array[i])
                    )
                ) {
                    this._lastSelectedIndexInSelectWidget = i;
                    return i;
                }
            }

            if (this._lastSelectedIndexInSelectWidget !== undefined) {
                return this._lastSelectedIndexInSelectWidget;
            }

            if (this.widgets._array.length > 0) {
                this._lastSelectedIndexInSelectWidget = 0;
                return this._lastSelectedIndexInSelectWidget;
            }
        } else {
            if (this._lastSelectedIndexInSelectWidget !== undefined) {
                return this._lastSelectedIndexInSelectWidget;
            }

            if (dataContext) {
                const selectedWidget = this.getSelectedWidget(dataContext);
                if (selectedWidget) {
                    return this.widgets._array.indexOf(selectedWidget);
                }
            }
        }

        return -1;
    }

    render(rect: Rect, dataContext: IDataContext, designerContext?: IDesignerContext) {
        const index = this.getSelectedIndex(dataContext, designerContext);
        if (index === -1) {
            return null;
        }

        const selectedWidget = this.widgets._array[index];

        if (designerContext || !this.transition || this.transition === "none") {
            return (
                <WidgetContainerComponent
                    containerWidget={this}
                    rectContainer={rect}
                    widgets={[selectedWidget]}
                    dataContext={dataContext}
                />
            );
        }

        let widgetComponents: React.ReactNode = this.widgets._array.map((widget, i) => {
            let rectWidget;

            if (this.transition === "horizontal") {
                rectWidget = {
                    left: i * rect.width,
                    top: 0,
                    width: rect.width,
                    height: rect.height
                };
            } else {
                rectWidget = {
                    left: 0,
                    top: i * rect.height,
                    width: rect.width,
                    height: rect.height
                };
            }
            return (
                <WidgetComponent
                    key={widget._id}
                    widget={widget}
                    rect={rectWidget}
                    dataContext={dataContext}
                />
            );
        });

        const CONF_SLIDE_TRANSITION = "transform 0.15s ease-out";

        const style: React.CSSProperties = {
            transition: CONF_SLIDE_TRANSITION
        };

        if (this.transition === "horizontal") {
            style.transform = `translateX(${-index * rect.width}px)`;
        } else {
            style.transform = `translateY(${-index * rect.height}px)`;
        }

        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden"
                }}
            >
                <div style={style}>{widgetComponents}</div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class LayoutViewPropertyGridUI extends React.Component<PropertyProps> {
    @bind
    showLayout(after: boolean) {
        (this.props.object as LayoutViewWidget).open();
    }

    render() {
        return (
            <UIElementsFactory.Button
                variant="contained"
                color="primary"
                size="small"
                onClick={this.showLayout}
                style={{ margin: 5 }}
            >
                Show {PageContext.layoutConceptName}
            </UIElementsFactory.Button>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LayoutViewWidget extends Widget {
    @observable
    layout: string;

    @observable
    dataContext: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "layout",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: PageInitContext
                    ? PageInitContext.layoutCollectionPath
                    : []
            },
            makeDataPropertyInfo("dataContext"),
            {
                name: "customUI",
                type: PropertyType.Any,
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
                let layout = PageContext.findLayout(this.layout);
                if (!layout) {
                    messages.push(output.propertyNotFoundMessage(this, "layout"));
                }
            }
        }

        return super.check().concat(messages);
    }

    render(rect: Rect, dataContext: IDataContext): React.ReactNode {
        if (this.dataContext) {
            dataContext = dataContext.push(dataContext.get(this.dataContext));
        }

        const layout = PageContext.findLayout(this.layout);
        if (!layout || isAncestor(this, layout)) {
            return null;
        }

        return layout.render(rect, dataContext, false);
    }

    open() {
        const layout = PageContext.findLayout(this.layout);
        if (layout) {
            NavigationStore.showObject(layout);
        }
    }

    replaceWithContainer() {
        const layout = PageContext.findLayout(this.layout);
        if (layout) {
            var containerWidgetJsObject = Object.assign({}, ContainerWidget.classInfo.defaultValue);

            containerWidgetJsObject.widgets = layout.widgets._array.map(widget =>
                objectToJS(widget)
            );

            containerWidgetJsObject.x = this.x;
            containerWidgetJsObject.y = this.y;
            containerWidgetJsObject.width = this.width;
            containerWidgetJsObject.height = this.height;

            DocumentStore.replaceObject(
                this,
                loadObject(this._parent, containerWidgetJsObject, Widget)
            );
        }
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

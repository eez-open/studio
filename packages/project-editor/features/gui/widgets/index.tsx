import React from "react";
import { observable, computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _find, _range } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    IEezObject,
    registerClass,
    PropertyInfo,
    PropertyType,
    makeDerivedClassInfo,
    generalGroup,
    specificGroup,
    IPropertyGridGroupDefinition,
    isAncestor,
    getParent,
    PropertyProps
} from "project-editor/core/object";
import { loadObject, objectToJS } from "project-editor/core/serialization";
import {
    getDocumentStore,
    IContextMenuContext
} from "project-editor/core/store";
import * as output from "project-editor/core/output";

import {
    checkObjectReference,
    getProject
} from "project-editor/project/project";

import type {
    IFlowContext,
    IDataContext
} from "project-editor/features/gui/flow-interfaces";
import {
    ComponentsContainerEnclosure,
    ComponentEnclosure
} from "project-editor/features/gui/flow-editor/render";

import { Page, findPage } from "project-editor/features/gui/page";
import { findBitmap } from "project-editor/features/gui/bitmap";
import { Style } from "project-editor/features/gui/style";
import { findDataItem } from "project-editor/features/data/data";
import {
    drawText,
    styleGetBorderRadius,
    styleIsHorzAlignLeft,
    styleIsHorzAlignRight,
    styleIsVertAlignTop,
    styleIsVertAlignBottom,
    styleGetFont,
    drawStr
} from "project-editor/features/gui/draw";
import * as draw from "project-editor/features/gui/draw";
import { Font } from "project-editor/features/gui/font";

import { BootstrapButton } from "project-editor/components/BootstrapButton";

import {
    Widget,
    makeDataPropertyInfo,
    makeStylePropertyInfo,
    makeTextPropertyInfo,
    migrateStyleProperty
} from "project-editor/features/gui/component";

const { MenuItem } = EEZStudio.remote || {};

////////////////////////////////////////////////////////////////////////////////

export class ContainerWidget extends Widget {
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
        },

        icon: "../home/_images/widgets/Container.png",

        check: (object: ContainerWidget) => {
            let messages: output.Message[] = [];

            checkObjectReference(object, "overlay", messages);

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        const w = this.width;
        const h = this.height;
        const style = this.style;

        if (w > 0 && h > 0) {
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
                draw.setColor(style.borderColorProperty);
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

            draw.setColor(style.backgroundColorProperty);
            draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
        }
    };

    render(designerContext: IFlowContext, dataContext: IDataContext) {
        return (
            <ComponentsContainerEnclosure
                components={this.widgets}
                designerContext={designerContext}
                dataContext={dataContext}
            />
        );
    }

    styleHook(
        style: React.CSSProperties,
        designerContext: IFlowContext | undefined
    ) {
        super.styleHook(style, designerContext);
        if (this.overlay) {
            if (this.shadow) {
                style.boxShadow = "1px 1px 8px 1px rgba(0,0,0,0.5)";
            }
            style.opacity = this.style.opacityProperty / 255;
        }
    }
}

registerClass(ContainerWidget);

////////////////////////////////////////////////////////////////////////////////

export class ListWidget extends Widget {
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

        icon: "../home/_images/widgets/List.png",

        check: (object: ListWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.itemWidget) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "List item widget is missing",
                        object
                    )
                );
            }

            return messages;
        }
    });

    render(designerContext: IFlowContext, dataContext: IDataContext) {
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
                <ComponentEnclosure
                    key={i}
                    component={itemWidget}
                    designerContext={designerContext}
                    dataContext={dataContext.create(dataValue[i])}
                    left={xListItem}
                    top={yListItem}
                />
            );
        });
    }
}

registerClass(ListWidget);

////////////////////////////////////////////////////////////////////////////////

export class GridWidget extends Widget {
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

        icon: "../home/_images/widgets/Grid.png",

        check: (object: GridWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.itemWidget) {
                messages.push(
                    new output.Message(
                        output.Type.ERROR,
                        "Grid item widget is missing",
                        object
                    )
                );
            }

            return messages;
        }
    });

    render(designerContext: IFlowContext, dataContext: IDataContext) {
        const itemWidget = this.itemWidget;
        if (!itemWidget) {
            return null;
        }

        const dataValue = this.data ? dataContext.get(this.data) : 0;

        if (!dataValue || !Array.isArray(dataValue)) {
            return null;
        }

        return _range(dataValue.length).map(i => {
            const rows = Math.floor(this.width / itemWidget.width);
            const cols = Math.floor(this.height / itemWidget.height);

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
                <ComponentEnclosure
                    key={i}
                    component={itemWidget}
                    designerContext={designerContext}
                    dataContext={dataContext.create(dataValue[i])}
                    left={xListItem}
                    top={yListItem}
                />
            );
        });
    }
}

registerClass(GridWidget);

////////////////////////////////////////////////////////////////////////////////

export function htmlEncode(value: string) {
    const el = document.createElement("div");
    el.innerText = value;
    return el.innerHTML;
}

export class SelectWidget extends Widget {
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

                        label = selectWidgetProperties.getChildLabel(
                            childObject as Widget
                        );
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
            widgets: [],
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/Select.png",

        check: (object: SelectWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            } else {
                let dataItem = findDataItem(getProject(object), object.data);
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

            object.widgets.forEach(childObject => {
                if (childObject.width != object.width) {
                    messages.push(
                        new output.Message(
                            output.Type.WARNING,
                            "Child of Select widget has different width",
                            childObject
                        )
                    );
                }

                if (childObject.height != object.height) {
                    messages.push(
                        new output.Message(
                            output.Type.WARNING,
                            "Child of Select widget has different height",
                            childObject
                        )
                    );
                }
            });

            return messages;
        }
    });

    getChildLabel(childObject: Widget) {
        if (this.widgets) {
            let index = this.widgets.indexOf(childObject);
            if (index != -1) {
                if (this.data) {
                    let dataItem = findDataItem(getProject(this), this.data);
                    if (dataItem) {
                        if (dataItem.type == "enum") {
                            let enumItems: string[];
                            try {
                                enumItems = JSON.parse(
                                    dataItem.enumItems || "[]"
                                );
                            } catch (err) {
                                enumItems = [];
                                console.error(
                                    "Invalid enum items",
                                    dataItem,
                                    err
                                );
                            }

                            if (index < enumItems.length) {
                                let enumItemLabel = htmlEncode(
                                    enumItems[index]
                                );
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
            let index: number = dataContext.getEnumValue(this.data);
            if (index >= 0 && index < this.widgets.length) {
                return this.widgets[index];
            }
        }
        return undefined;
    }

    getSelectedIndex(
        dataContext: IDataContext,
        designerContext?: IFlowContext
    ) {
        if (designerContext) {
            const selectedObjects = designerContext.viewState.selectedObjects;

            for (let i = 0; i < this.widgets.length; ++i) {
                if (
                    selectedObjects.find(selectedObject =>
                        isAncestor(selectedObject.object, this.widgets[i])
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

    render(designerContext: IFlowContext, dataContext: IDataContext) {
        const index = this.getSelectedIndex(dataContext, designerContext);
        if (index === -1) {
            return null;
        }

        const selectedWidget = this.widgets[index];

        return (
            <ComponentsContainerEnclosure
                components={[selectedWidget]}
                designerContext={designerContext}
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
            <BootstrapButton
                color="primary"
                size="small"
                onClick={this.showLayout}
            >
                Show Layout
            </BootstrapButton>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class LayoutViewWidget extends Widget {
    @observable layout: string;
    @observable context?: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "layout",
                type: PropertyType.ObjectReference,
                propertyGridGroup: specificGroup,
                referencedObjectCollectionPath: "gui/pages"
            },
            makeDataPropertyInfo("context"),
            {
                name: "customUI",
                type: PropertyType.Any,
                propertyGridGroup: specificGroup,
                computed: true,
                propertyGridComponent: LayoutViewPropertyGridUI,
                hideInPropertyGrid: (widget: LayoutViewWidget) => {
                    if (!widget.layout) {
                        return true;
                    }

                    const project = getProject(widget);

                    const layout = findPage(project, widget.layout);
                    if (!layout) {
                        return true;
                    }

                    return false;
                }
            }
        ],

        label: (widget: LayoutViewWidget) => {
            if (widget.layout) {
                return `${widget.type}: ${widget.layout}`;
            }

            return humanize(widget.type);
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/LayoutView.png",

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
                    let layout = findPage(getProject(object), object.layout);
                    if (!layout) {
                        messages.push(
                            output.propertyNotFoundMessage(object, "layout")
                        );
                    }
                }
            }

            checkObjectReference(object, "context", messages);

            return messages;
        },

        open: (object: LayoutViewWidget) => {
            object.open();
        },

        extendContextMenu: (
            thisObject: Widget,
            context: IContextMenuContext,
            objects: IEezObject[],
            menuItems: Electron.MenuItem[]
        ): void => {
            TextWidget.classInfo.parentClassInfo!.extendContextMenu!(
                thisObject,
                context,
                objects,
                menuItems
            );

            if (objects.length === 1) {
                const object = objects[0];
                if (object instanceof LayoutViewWidget) {
                    menuItems.push(
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
            }
        }
    });

    get layoutPage() {
        return this.getLayoutPage(getDocumentStore(this).dataContext);
    }

    getLayoutPage(dataContext: IDataContext) {
        let layout;

        const project = getProject(this);

        if (this.data) {
            const layoutName = dataContext.get(this.data);
            if (layoutName) {
                layout = findPage(project, layoutName);
            }
        }

        if (!layout) {
            layout = findPage(project, this.layout);
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

    // This is for prevention of circular rendering of layouts, i.e Layout A is using Layout B and Layout B is using Layout A.
    static renderedLayoutPages: Page[] = [];
    static clearRenderedLayoutPagesFrameRequestId: number | undefined;
    static clearRenderedLayoutPages() {
        LayoutViewWidget.renderedLayoutPages = [];
        LayoutViewWidget.clearRenderedLayoutPagesFrameRequestId = undefined;
    }

    render(
        designerContext: IFlowContext,
        dataContext: IDataContext
    ): React.ReactNode {
        const layoutPage = this.getLayoutPage(dataContext);
        if (!layoutPage) {
            return null;
        }

        if (!LayoutViewWidget.clearRenderedLayoutPagesFrameRequestId) {
            LayoutViewWidget.clearRenderedLayoutPagesFrameRequestId = window.requestAnimationFrame(
                LayoutViewWidget.clearRenderedLayoutPages
            );
        }
        if (LayoutViewWidget.renderedLayoutPages.indexOf(layoutPage) != -1) {
            // circular rendering prevented
            return null;
        }

        LayoutViewWidget.renderedLayoutPages.push(layoutPage);

        const element = (
            <ComponentEnclosure
                component={layoutPage}
                designerContext={designerContext}
                dataContext={dataContext}
            />
        );

        LayoutViewWidget.renderedLayoutPages.pop();

        return element;
    }

    open() {
        if (this.layoutPage) {
            getDocumentStore(this).NavigationStore.showObject(this.layoutPage);
        }
    }

    replaceWithContainer() {
        if (this.layoutPage) {
            var containerWidgetJsObject = Object.assign(
                {},
                ContainerWidget.classInfo.defaultValue
            );

            containerWidgetJsObject.widgets = this.layoutPage.components.map(
                widget => objectToJS(widget)
            );

            containerWidgetJsObject.left = this.left;
            containerWidgetJsObject.top = this.top;
            containerWidgetJsObject.width = this.width;
            containerWidgetJsObject.height = this.height;

            const DocumentStore = getDocumentStore(this);

            return DocumentStore.replaceObject(
                this,
                loadObject(
                    DocumentStore,
                    getParent(this),
                    containerWidgetJsObject,
                    Widget
                )
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
    hideInPropertyGrid: (object: IEezObject) =>
        getProject(object).settings.general.projectVersion !== "v1"
};

export class DisplayDataWidget extends Widget {
    @observable focusStyle: Style;
    @observable displayOption: DisplayOption;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            Object.assign(
                makeStylePropertyInfo("focusStyle"),
                hideIfNotProjectVersion1,
                {
                    isOptional: true
                }
            ),
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
            data: "data",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            displayOption: 0
        },

        icon: "../home/_images/widgets/Data.png",

        check: (object: DisplayDataWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (object.displayOption === undefined) {
                if (
                    getProject(object).settings.general.projectVersion !== "v1"
                ) {
                    messages.push(
                        output.propertyNotSetMessage(object, "displayOption")
                    );
                }
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let text = (this.data && (dataContext.get(this.data) as string)) || "";

        function findStartOfFraction() {
            let i;
            for (
                i = 0;
                text[i] &&
                (text[i] == "<" ||
                    text[i] == " " ||
                    text[i] == "-" ||
                    (text[i] >= "0" && text[i] <= "9"));
                i++
            ) {}
            return i;
        }

        function findStartOfUnit(i: number) {
            for (
                i = 0;
                text[i] &&
                (text[i] == "<" ||
                    text[i] == " " ||
                    text[i] == "-" ||
                    (text[i] >= "0" && text[i] <= "9") ||
                    text[i] == ".");
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

        if (typeof text === "string") {
            text = text.trim();
        }

        drawText(ctx, text, 0, 0, this.width, this.height, this.style, false);
    };
}

registerClass(DisplayDataWidget);

////////////////////////////////////////////////////////////////////////////////

export class TextWidget extends Widget {
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
            Object.assign(
                makeStylePropertyInfo("focusStyle"),
                hideIfNotProjectVersion1,
                {
                    isOptional: true
                }
            )
        ],

        defaultValue: {
            text: "Text",
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/Text.png",

        check: (object: TextWidget) => {
            let messages: output.Message[] = [];

            if (!object.text && !object.data) {
                messages.push(output.propertyNotSetMessage(object, "text"));
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let text = this.text
            ? this.text
            : this.data
            ? (dataContext.get(this.data) as string)
            : "";
        drawText(ctx, text, 0, 0, this.width, this.height, this.style, false);
    };
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
                    x =
                        this.x1 +
                        Math.floor(
                            (this.x2 - this.x1 + 1 - this.lineWidth) / 2
                        );
                }

                if (this.inverse) {
                    draw.setBackColor(this.style.colorProperty);
                    draw.setColor(this.style.backgroundColorProperty);
                } else {
                    draw.setBackColor(this.style.backgroundColorProperty);
                    draw.setColor(this.style.colorProperty);
                }

                drawStr(
                    this.ctx,
                    this.line,
                    x + this.lineIndent,
                    y,
                    x + this.lineWidth - 1,
                    y + this.font.height - 1,
                    this.font
                );
            } else {
                this.textHeight = Math.max(
                    this.textHeight,
                    y + this.lineHeight - this.y1
                );
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
            while (
                i < this.text.length &&
                this.text[i] != " " &&
                this.text[i] != "\n"
            ) {
                word += this.text[i++];
            }

            let width = draw.measureStr(word, this.font, 0);

            while (
                this.lineWidth +
                    (this.line != "" ? this.spaceWidth : 0) +
                    width >
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

                let extraHeightBetweenParagraphs = Math.floor(
                    0.2 * this.lineHeight
                );

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
            draw.setColor(this.style.borderColorProperty);
            draw.fillRect(
                this.ctx,
                this.x1,
                this.y1,
                this.x2,
                this.y2,
                borderRadius
            );
            this.x1 += borderSize.left;
            this.y1 += borderSize.top;
            this.x2 -= borderSize.right;
            this.y2 -= borderSize.bottom;
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

        let backgroundColor = this.inverse
            ? this.style.colorProperty
            : this.style.backgroundColorProperty;
        draw.setColor(backgroundColor);
        draw.fillRect(
            this.ctx,
            this.x1,
            this.y1,
            this.x2,
            this.y2,
            borderRadius
        );

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

export class MultilineTextWidget extends Widget {
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
            text: "Multiline text",
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            firstLineIndent: 0,
            hangingIndent: 0
        },

        icon: "../home/_images/widgets/MultilineText.png",

        check: (object: MultilineTextWidget) => {
            let messages: output.Message[] = [];

            if (!object.text && !object.data) {
                messages.push(output.propertyNotSetMessage(object, "text"));
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let text = this.text
            ? this.text
            : this.data
            ? (dataContext.get(this.data) as string)
            : "";

        const w = this.width;
        const h = this.height;
        const style = this.style;
        const inverse = false;

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
    };
}

registerClass(MultilineTextWidget);

////////////////////////////////////////////////////////////////////////////////

export class RectangleWidget extends Widget {
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
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/Rectangle.png",

        check: (object: RectangleWidget) => {
            let messages: output.Message[] = [];

            if (object.data) {
                messages.push(
                    output.propertySetButNotUsedMessage(object, "data")
                );
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        const w = this.width;
        const h = this.height;
        const style = this.style;
        const inverse = this.invertColors;

        if (w > 0 && h > 0) {
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
                draw.setColor(style.borderColorProperty);
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
                inverse ? style.backgroundColorProperty : style.colorProperty
            );
            draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
        }
    };
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
        getDocumentStore(this).updateObject(this.props.objects[0], {
            width: this.bitmapWidget.bitmapObject!.imageElement!.width,
            height: this.bitmapWidget.bitmapObject!.imageElement!.height
        });
    }

    render() {
        if (this.props.readOnly) {
            return null;
        }

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
            <BootstrapButton
                color="primary"
                size="small"
                onClick={this.resizeToFitBitmap}
            >
                Resize to Fit Bitmap
            </BootstrapButton>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class BitmapWidget extends Widget {
    @observable bitmap?: string;

    get label() {
        return this.bitmap ? `${this.type}: ${this.bitmap}` : this.type;
    }

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            {
                name: "bitmap",
                type: PropertyType.ObjectReference,
                referencedObjectCollectionPath: "gui/bitmaps",
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

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/Bitmap.png",

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
                    let bitmap = findBitmap(getProject(object), object.bitmap);
                    if (!bitmap) {
                        messages.push(
                            output.propertyNotFoundMessage(object, "bitmap")
                        );
                    }
                }
            }

            return messages;
        }
    });

    @computed
    get bitmapObject() {
        return this.getBitmapObject(getDocumentStore(this).dataContext);
    }

    getBitmapObject(dataContext: IDataContext) {
        return this.bitmap
            ? findBitmap(getProject(this), this.bitmap)
            : this.data
            ? findBitmap(getProject(this), dataContext.get(this.data) as string)
            : undefined;
    }

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        const w = this.width;
        const h = this.height;
        const style = this.style;

        const bitmap = this.getBitmapObject(dataContext);

        const inverse = false;

        if (bitmap) {
            const imageElement = bitmap.imageElement;
            if (!imageElement) {
                return;
            }

            let x1 = 0;
            let y1 = 0;
            let x2 = w - 1;
            let y2 = h - 1;

            if (bitmap.bpp !== 32) {
                let backgroundColor = inverse
                    ? style.colorProperty
                    : style.backgroundColorProperty;
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
                draw.setBackColor(style.colorProperty);
                draw.setColor(style.backgroundColorProperty);
            } else {
                draw.setBackColor(style.backgroundColorProperty);
                draw.setColor(style.colorProperty);
            }

            draw.drawBitmap(
                ctx,
                imageElement,
                x_offset,
                y_offset,
                width,
                height
            );
        }
    };
}

registerClass(BitmapWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonWidget extends Widget {
    @observable text?: string;
    @observable enabled?: string;
    @observable disabledStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            makeTextPropertyInfo("text"),
            makeDataPropertyInfo("enabled"),
            makeStylePropertyInfo("disabledStyle")
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "disabledStyle");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 32,
            height: 32
        },

        icon: "../home/_images/widgets/Button.png",

        check: (object: ButtonWidget) => {
            let messages: output.Message[] = [];

            if (!object.text && !object.data) {
                messages.push(output.propertyNotSetMessage(object, "text"));
            }

            checkObjectReference(object, "enabled", messages, true);

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let text = this.data && dataContext.get(this.data);
        if (!text) {
            text = this.text;
        }
        let style =
            this.enabled && dataContext.getBool(this.enabled)
                ? this.style
                : this.disabledStyle;
        drawText(ctx, text, 0, 0, this.width, this.height, style, false);
    };

    onClick = () => {
        getDocumentStore(this).RuntimeStore.executeWidgetAction(this);
    };
}

registerClass(ButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ToggleButtonWidget extends Widget {
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
            left: 0,
            top: 0,
            width: 32,
            height: 32
        },

        icon: "../home/_images/widgets/ToggleButton.png",

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

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        drawText(
            ctx,
            this.text1 || "",
            0,
            0,
            this.width,
            this.height,
            this.style,
            false
        );
    };
}

registerClass(ToggleButtonWidget);

////////////////////////////////////////////////////////////////////////////////

export class ButtonGroupWidget extends Widget {
    @observable selectedStyle: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [makeStylePropertyInfo("selectedStyle")],

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/ButtonGroup.png",

        check: (object: ButtonGroupWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let buttonLabels =
            (this.data && dataContext.getValueList(this.data)) || [];
        let selectedButton = (this.data && dataContext.get(this.data)) || 0;

        let x = 0;
        let y = 0;
        let w = this.width;
        let h = this.height;

        if (w > h) {
            // horizontal orientation
            let buttonWidth = Math.floor(w / buttonLabels.length);
            x += Math.floor((w - buttonWidth * buttonLabels.length) / 2);
            let buttonHeight = h;
            for (let i = 0; i < buttonLabels.length; i++) {
                if (i == selectedButton) {
                    drawText(
                        ctx,
                        buttonLabels[i],
                        x,
                        y,
                        buttonWidth,
                        buttonHeight,
                        this.selectedStyle,
                        false
                    );
                } else {
                    drawText(
                        ctx,
                        buttonLabels[i],
                        x,
                        y,
                        buttonWidth,
                        buttonHeight,
                        this.style,
                        false
                    );
                }
                x += buttonWidth;
            }
        } else {
            // vertical orientation
            let buttonWidth = w;
            let buttonHeight = Math.floor(h / buttonLabels.length);

            y += Math.floor((h - buttonHeight * buttonLabels.length) / 2);

            let labelHeight = Math.min(buttonWidth, buttonHeight);
            let yOffset = Math.floor((buttonHeight - labelHeight) / 2);

            y += yOffset;

            for (let i = 0; i < buttonLabels.length; i++) {
                if (i == selectedButton) {
                    drawText(
                        ctx,
                        buttonLabels[i],
                        x,
                        y,
                        buttonWidth,
                        labelHeight,
                        this.selectedStyle,
                        false
                    );
                } else {
                    drawText(
                        ctx,
                        buttonLabels[i],
                        x,
                        y,
                        buttonWidth,
                        labelHeight,
                        this.style,
                        false
                    );
                }
                y += buttonHeight;
            }
        }
    };
}

registerClass(ButtonGroupWidget);

////////////////////////////////////////////////////////////////////////////////

export class BarGraphWidget extends Widget {
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
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            orientation: "left-right"
        },

        icon: "../home/_images/widgets/BarGraph.png",

        check: (object: BarGraphWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            const project = getProject(object);

            if (object.line1Data) {
                if (!findDataItem(project, object.line1Data)) {
                    messages.push(
                        output.propertyNotFoundMessage(object, "line1Data")
                    );
                }
            } else {
                messages.push(
                    output.propertyNotSetMessage(object, "line1Data")
                );
            }

            if (object.line2Data) {
                if (!findDataItem(project, object.line2Data)) {
                    messages.push(
                        output.propertyNotFoundMessage(object, "line2Data")
                    );
                }
            } else {
                messages.push(
                    output.propertyNotSetMessage(object, "line2Data")
                );
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let barGraphWidget = this;
        let style = barGraphWidget.style;

        let min =
            (barGraphWidget.data && dataContext.getMin(barGraphWidget.data)) ||
            0;
        let max =
            (barGraphWidget.data && dataContext.getMax(barGraphWidget.data)) ||
            0;
        let valueText =
            (barGraphWidget.data && dataContext.get(barGraphWidget.data)) ||
            "0";
        let value = parseFloat(valueText);
        if (isNaN(value)) {
            value = 0;
        }
        let horizontal =
            barGraphWidget.orientation == "left-right" ||
            barGraphWidget.orientation == "right-left";

        let d = horizontal ? this.width : this.height;

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
            draw.setColor(style.colorProperty);
            draw.fillRect(ctx, 0, 0, pos - 1, this.height - 1);
            draw.setColor(style.backgroundColorProperty);
            draw.fillRect(ctx, pos, 0, this.width - 1, this.height - 1);
        } else if (barGraphWidget.orientation == "right-left") {
            draw.setColor(style.backgroundColorProperty);
            draw.fillRect(ctx, 0, 0, this.width - pos - 1, this.height - 1);
            draw.setColor(style.colorProperty);
            draw.fillRect(
                ctx,
                this.width - pos,
                0,
                this.width - 1,
                this.height - 1
            );
        } else if (barGraphWidget.orientation == "top-bottom") {
            draw.setColor(style.colorProperty);
            draw.fillRect(ctx, 0, 0, this.width - 1, pos - 1);
            draw.setColor(style.backgroundColorProperty);
            draw.fillRect(ctx, 0, pos, this.width - 1, this.height - 1);
        } else {
            draw.setColor(style.backgroundColorProperty);
            draw.fillRect(ctx, 0, 0, this.width - 1, this.height - pos - 1);
            draw.setColor(style.colorProperty);
            draw.fillRect(
                ctx,
                0,
                this.height - pos,
                this.width - 1,
                this.height - 1
            );
        }

        if (horizontal) {
            let textStyle = barGraphWidget.textStyle;
            const font = styleGetFont(textStyle);
            if (font) {
                let w = draw.measureStr(valueText, font, this.width);
                w += style.paddingRect.left;

                if (w > 0 && this.height > 0) {
                    let backgroundColor: string;
                    let x: number;

                    if (pos + w <= this.width) {
                        backgroundColor = style.backgroundColorProperty;
                        x = pos;
                    } else {
                        backgroundColor = style.colorProperty;
                        x = pos - w - style.paddingRect.right;
                    }

                    drawText(
                        ctx,
                        valueText,
                        x,
                        0,
                        w,
                        this.height,
                        textStyle,
                        false,
                        backgroundColor
                    );
                }
            }
        }

        function drawLine(lineData: string | undefined, lineStyle: Style) {
            let value =
                (lineData && parseFloat(dataContext.get(lineData))) || 0;
            if (isNaN(value)) {
                value = 0;
            }
            let pos = calcPos(value);
            if (pos == d) {
                pos = d - 1;
            }
            draw.setColor(lineStyle.colorProperty);
            if (barGraphWidget.orientation == "left-right") {
                draw.drawVLine(ctx, pos, 0, widget.height - 1);
            } else if (barGraphWidget.orientation == "right-left") {
                draw.drawVLine(ctx, widget.width - pos, 0, widget.height - 1);
            } else if (barGraphWidget.orientation == "top-bottom") {
                draw.drawHLine(ctx, 0, pos, widget.width - 1);
            } else {
                draw.drawHLine(ctx, 0, widget.height - pos, widget.width - 1);
            }
        }

        const widget = this;

        drawLine(barGraphWidget.line1Data, barGraphWidget.line1Style);
        drawLine(barGraphWidget.line2Data, barGraphWidget.line2Style);
    };
}

registerClass(BarGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class YTGraphWidget extends Widget {
    @observable y1Style: Style;
    @observable y2Data?: string;
    @observable y2Style: Style;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        properties: [
            Object.assign(
                makeStylePropertyInfo("y1Style"),
                hideIfNotProjectVersion1
            ),
            Object.assign(
                makeStylePropertyInfo("y2Style"),
                hideIfNotProjectVersion1
            ),
            Object.assign(
                makeDataPropertyInfo("y2Data"),
                hideIfNotProjectVersion1
            )
        ],

        beforeLoadHook: (object: IEezObject, jsObject: any) => {
            migrateStyleProperty(jsObject, "y1Style");
            migrateStyleProperty(jsObject, "y2Style");
        },

        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/YTGraph.png",

        check: (object: YTGraphWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            const project = getProject(object);

            if (project.settings.general.projectVersion === "v1") {
                if (object.y2Data) {
                    if (!findDataItem(project, object.y2Data)) {
                        messages.push(
                            output.propertyNotFoundMessage(object, "y2Data")
                        );
                    }
                } else {
                    messages.push(
                        output.propertyNotSetMessage(object, "y2Data")
                    );
                }
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let ytGraphWidget = this;
        let style = ytGraphWidget.style;

        let x1 = 0;
        let y1 = 0;
        let x2 = this.width - 1;
        let y2 = this.height - 1;

        const borderSize = style.borderSizeRect;
        let borderRadius = styleGetBorderRadius(style) || 0;
        if (
            borderSize.top > 0 ||
            borderSize.right > 0 ||
            borderSize.bottom > 0 ||
            borderSize.left > 0
        ) {
            draw.setColor(style.borderColorProperty);
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

        draw.setColor(style.backgroundColorProperty);
        draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
    };
}

registerClass(YTGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class UpDownWidget extends Widget {
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
            left: 0,
            top: 0,
            width: 64,
            height: 32,
            upButtonText: ">",
            downButtonText: "<"
        },

        icon: "../home/_images/widgets/UpDown.png",

        check: (object: UpDownWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.downButtonText) {
                messages.push(
                    output.propertyNotSetMessage(object, "downButtonText")
                );
            }

            if (!object.upButtonText) {
                messages.push(
                    output.propertyNotSetMessage(object, "upButtonText")
                );
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let upDownWidget = this;
        let style = upDownWidget.style;
        let buttonsStyle = upDownWidget.buttonsStyle;

        const buttonsFont = styleGetFont(buttonsStyle);
        if (!buttonsFont) {
            return;
        }

        drawText(
            ctx,
            upDownWidget.downButtonText || "<",
            0,
            0,
            buttonsFont.height,
            this.height,
            buttonsStyle,
            false
        );

        let text = upDownWidget.data
            ? (dataContext.get(upDownWidget.data) as string)
            : "";
        drawText(
            ctx,
            text,
            buttonsFont.height,
            0,
            this.width - 2 * buttonsFont.height,
            this.height,
            style,
            false
        );

        drawText(
            ctx,
            upDownWidget.upButtonText || ">",
            this.width - buttonsFont.height,
            0,
            buttonsFont.height,
            this.height,
            buttonsStyle,
            false
        );
    };
}

registerClass(UpDownWidget);

////////////////////////////////////////////////////////////////////////////////

export class ListGraphWidget extends Widget {
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
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/ListGraph.png",

        check: (object: ListGraphWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            const project = getProject(object);

            if (object.dwellData) {
                if (!findDataItem(project, object.dwellData)) {
                    messages.push(
                        output.propertyNotFoundMessage(object, "dwellData")
                    );
                }
            } else {
                messages.push(
                    output.propertyNotSetMessage(object, "dwellData")
                );
            }

            if (object.y1Data) {
                if (!findDataItem(project, object.y1Data)) {
                    messages.push(
                        output.propertyNotFoundMessage(object, "y1Data")
                    );
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "y1Data"));
            }

            if (object.y2Data) {
                if (!findDataItem(project, object.y2Data)) {
                    messages.push(
                        output.propertyNotFoundMessage(object, "y2Data")
                    );
                }
            } else {
                messages.push(output.propertyNotSetMessage(object, "y2Data"));
            }

            if (object.cursorData) {
                if (!findDataItem(project, object.cursorData)) {
                    messages.push(
                        output.propertyNotFoundMessage(object, "cursorData")
                    );
                }
            } else {
                messages.push(
                    output.propertyNotSetMessage(object, "cursorData")
                );
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let listGraphWidget = this;
        let style = listGraphWidget.style;

        let x1 = 0;
        let y1 = 0;
        let x2 = this.width - 1;
        let y2 = this.height - 1;

        const borderSize = style.borderSizeRect;
        let borderRadius = styleGetBorderRadius(style) || 0;
        if (
            borderSize.top > 0 ||
            borderSize.right > 0 ||
            borderSize.bottom > 0 ||
            borderSize.left > 0
        ) {
            draw.setColor(style.borderColorProperty);
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

        draw.setColor(style.backgroundColorProperty);
        draw.fillRect(ctx, x1, y1, x2, y2, borderRadius);
    };
}

registerClass(ListGraphWidget);

////////////////////////////////////////////////////////////////////////////////

export class AppViewWidget extends Widget {
    @observable page: string;

    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/AppView.png",

        check: (object: AppViewWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            return messages;
        }
    });

    render(designerContext: IFlowContext, dataContext: IDataContext) {
        if (!this.data) {
            return null;
        }

        const pageName = dataContext.get(this.data);
        if (!pageName) {
            return null;
        }

        const page = findPage(getProject(this), pageName);
        if (!page) {
            return null;
        }

        return page.render(designerContext, dataContext);
    }
}

registerClass(AppViewWidget);

////////////////////////////////////////////////////////////////////////////////

export class ScrollBarWidget extends Widget {
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
            left: 0,
            top: 0,
            width: 128,
            height: 32,
            leftButtonText: "<",
            rightButtonText: ">"
        },

        icon: "../home/_images/widgets/UpDown.png",

        check: (object: ScrollBarWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            if (!object.leftButtonText) {
                messages.push(
                    output.propertyNotSetMessage(object, "leftButtonText")
                );
            }

            if (!object.rightButtonText) {
                messages.push(
                    output.propertyNotSetMessage(object, "rightButtonText")
                );
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let widget = this;

        const buttonsFont = styleGetFont(widget.buttonsStyle);
        if (!buttonsFont) {
            return;
        }

        let isHorizontal = this.width > this.height;

        let buttonSize = isHorizontal ? this.height : this.width;

        // draw left button
        drawText(
            ctx,
            widget.leftButtonText || "<",
            0,
            0,
            isHorizontal ? buttonSize : this.width,
            isHorizontal ? this.height : buttonSize,
            widget.buttonsStyle,
            false
        );

        // draw track
        let x;
        let y;
        let width;
        let height;

        if (isHorizontal) {
            x = buttonSize;
            y = 0;
            width = this.width - 2 * buttonSize;
            height = this.height;
        } else {
            x = 0;
            y = buttonSize;
            width = this.width;
            height = this.height - 2 * buttonSize;
        }

        draw.setColor(this.style.colorProperty);
        draw.fillRect(ctx, x, y, x + width - 1, y + height - 1, 0);

        // draw thumb
        const [size, position, pageSize] = (widget.data &&
            dataContext.get(widget.data)) || [100, 25, 20];

        let xThumb;
        let widthThumb;
        let yThumb;
        let heightThumb;

        if (isHorizontal) {
            xThumb = Math.floor((position * width) / size);
            widthThumb = Math.max(
                Math.floor((pageSize * width) / size),
                buttonSize
            );
            yThumb = y;
            heightThumb = height;
        } else {
            xThumb = x;
            widthThumb = width;
            yThumb = Math.floor((position * height) / size);
            heightThumb = Math.max(
                Math.floor((pageSize * height) / size),
                buttonSize
            );
        }

        draw.setColor(this.thumbStyle.colorProperty);
        draw.fillRect(
            ctx,
            xThumb,
            yThumb,
            xThumb + widthThumb - 1,
            yThumb + heightThumb - 1,
            0
        );

        // draw right button
        drawText(
            ctx,
            widget.rightButtonText || ">",
            isHorizontal ? this.width - buttonSize : 0,
            isHorizontal ? 0 : this.height - buttonSize,
            isHorizontal ? buttonSize : this.width,
            isHorizontal ? this.height : buttonSize,
            widget.buttonsStyle,
            false
        );
    };
}

registerClass(ScrollBarWidget);

////////////////////////////////////////////////////////////////////////////////

export class ProgressWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: {
            left: 0,
            top: 0,
            width: 128,
            height: 32
        },

        icon: "../home/_images/widgets/Progress.png"
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let widget = this;

        let isHorizontal = this.width > this.height;

        draw.setColor(this.style.backgroundColorProperty);
        draw.fillRect(ctx, 0, 0, this.width - 1, this.height - 1, 0);

        // draw thumb
        const percent = (widget.data && dataContext.get(widget.data)) || 25;
        draw.setColor(this.style.colorProperty);
        if (isHorizontal) {
            draw.fillRect(
                ctx,
                0,
                0,
                (percent * this.width) / 100 - 1,
                this.height - 1,
                0
            );
        } else {
            draw.fillRect(
                ctx,
                0,
                this.height - (percent * this.height) / 100,
                this.width - 1,
                this.height - 1,
                0
            );
        }
    };
}

registerClass(ProgressWidget);

////////////////////////////////////////////////////////////////////////////////

export class CanvasWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        defaultValue: {
            left: 0,
            top: 0,
            width: 64,
            height: 32
        },

        icon: "../home/_images/widgets/Canvas.png",

        check: (object: DisplayDataWidget) => {
            let messages: output.Message[] = [];

            if (!object.data) {
                messages.push(output.propertyNotSetMessage(object, "data"));
            }

            return messages;
        }
    });

    draw = (
        ctx: CanvasRenderingContext2D,
        designerContext: IFlowContext,
        dataContext: IDataContext
    ) => {
        let widget = this;
        let style = widget.style;

        let x1 = 0;
        let y1 = 0;
        let x2 = this.width - 1;
        let y2 = this.height - 1;

        draw.setColor(style.backgroundColorProperty);
        draw.fillRect(ctx, x1, y1, x2, y2, 0);
    };
}

registerClass(CanvasWidget);

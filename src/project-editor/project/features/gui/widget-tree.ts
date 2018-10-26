import {
    isObjectInstanceOf,
    isArray,
    asArray,
    getProperty,
    getMetaData
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";
import {
    DisplayItem,
    DisplayItemChildrenObject,
    DisplayItemChildrenArray,
    DisplayItemChildren
} from "project-editor/core/objectAdapter";

import { TreeNode } from "project-editor/components/CanvasEditorTreeNode";

import * as data from "project-editor/project/features/data/data";

import {
    PageResolutionProperties,
    pageResolutionMetaData,
    isWidgetOpaque,
    IWidgetContainerDisplayItem
} from "project-editor/project/features/gui/page";
import {
    WidgetProperties,
    ListWidgetProperties,
    SelectWidgetProperties
} from "project-editor/project/features/gui/widget";
import {
    widgetTypeMetaData,
    WidgetTypeProperties
} from "project-editor/project/features/gui/widgetType";
import { drawWidget, drawPageFrame } from "project-editor/project/features/gui/draw";

////////////////////////////////////////////////////////////////////////////////

class DummyWidgetContainerDisplayItem implements DisplayItem, IWidgetContainerDisplayItem {
    selected: boolean;

    constructor(public object: EezObject) {}

    get children(): DisplayItemChildren {
        if (isArray(this.object)) {
            return asArray(this.object).map(child => new DummyWidgetContainerDisplayItem(child));
        } else {
            let properties = getMetaData(this.object)
                .properties(this.object)
                .filter(
                    propertyMetaData =>
                        (propertyMetaData.type == "object" || propertyMetaData.type == "array") &&
                        !(
                            propertyMetaData.enumerable !== undefined &&
                            !propertyMetaData.enumerable
                        ) &&
                        getProperty(this.object, propertyMetaData.name)
                );

            if (properties.length == 1 && properties[0].type == "array") {
                return asArray(getProperty(this.object, properties[0].name)).map(
                    child => new DummyWidgetContainerDisplayItem(child)
                );
            }

            return properties.reduce(
                (children, propertyMetaData, i) => {
                    children[propertyMetaData.name] = new DummyWidgetContainerDisplayItem(
                        getProperty(this.object, propertyMetaData.name)
                    );
                    return children;
                },
                {} as DisplayItemChildrenObject
            );
        }
    }

    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined {
        let widget = item.object as SelectWidgetProperties;
        if (widget.data && widget.widgets) {
            let index: number = data.getEnumValue(widget.data);
            if (index >= 0 && index < widget.widgets.length) {
                let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                return widgetsItemChildren[index];
            }
        }
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

function drawPageFrameForTreeNode(
    node: TreeNode,
    ctx: CanvasRenderingContext2D,
    scale: number,
    callback: () => void
) {
    if (isObjectInstanceOf(node.item.object, pageResolutionMetaData)) {
        let pageResolution = node.item.object as PageResolutionProperties;
        drawPageFrame(ctx, pageResolution, scale, pageResolution.style || "default");
    } else if (isObjectInstanceOf(node.item.object, widgetTypeMetaData)) {
        let widgetType = node.item.object as WidgetTypeProperties;
        drawPageFrame(
            ctx,
            {
                x: 0,
                y: 0,
                width: widgetType.width,
                height: widgetType.height
            },
            scale,
            widgetType.style
        );
    }
}

export function createWidgetTree(
    widgetContainerDisplayItemOrObject: IWidgetContainerDisplayItem | EezObject,
    draw: boolean
) {
    function enumWidgets(widgetContainerDisplayItem: IWidgetContainerDisplayItem) {
        function enumWidget(
            parentNode: TreeNode | undefined,
            item: DisplayItem,
            x: number,
            y: number
        ) {
            let object = item.object as
                | WidgetProperties
                | PageResolutionProperties
                | WidgetTypeProperties;

            if (object instanceof WidgetProperties || object instanceof PageResolutionProperties) {
                x += object.x || 0;
                y += object.y || 0;
            }

            let rect = {
                x: x,
                y: y,
                width: object.width,
                height: object.height
            };

            let treeNode: TreeNode = {
                parent: <TreeNode>parentNode,
                children: [],
                rect: rect,
                selected: object instanceof WidgetProperties && item.selected,
                resizable: true,
                movable: object instanceof WidgetProperties,
                selectable: object instanceof WidgetProperties,
                item: item,
                draw: object instanceof WidgetProperties ? undefined : drawPageFrameForTreeNode,
                image:
                    draw && object instanceof WidgetProperties
                        ? drawWidget(object, rect)
                        : undefined,
                isOpaque: object instanceof WidgetProperties && isWidgetOpaque(object)
            };

            if (parentNode) {
                parentNode.children.push(treeNode);
            }

            if (
                object instanceof PageResolutionProperties ||
                object instanceof WidgetTypeProperties
            ) {
                let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                widgetsItemChildren.forEach(child => {
                    enumWidget(treeNode, child, x, y);
                });
            } else {
                if (object.type == "Container") {
                    let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                    widgetsItemChildren.forEach(child => {
                        enumWidget(treeNode, child, x, y);
                    });
                } else if (object.type == "List") {
                    let widget = object as ListWidgetProperties;
                    let itemWidget = widget.itemWidget;
                    if (itemWidget) {
                        let itemWidgetItem = (item.children as DisplayItemChildrenObject)[
                            "itemWidget"
                        ];

                        for (let i = 0; i < data.count(<string>widget.data); i++) {
                            enumWidget(treeNode, itemWidgetItem, x, y);

                            if (widget.listType == "vertical") {
                                y += itemWidget.height;
                            } else {
                                x += itemWidget.width;
                            }
                        }
                    }
                } else if (object.type == "Select") {
                    let selectedWidgetItem = widgetContainerDisplayItem.getSelectedWidgetForSelectWidget(
                        item
                    );
                    if (selectedWidgetItem) {
                        enumWidget(treeNode, selectedWidgetItem, x, y);
                    }
                }
            }

            return treeNode;
        }

        return enumWidget(undefined, widgetContainerDisplayItem, 0, 0);
    }

    if (widgetContainerDisplayItemOrObject instanceof EezObject) {
        return enumWidgets(new DummyWidgetContainerDisplayItem(widgetContainerDisplayItemOrObject));
    } else {
        return enumWidgets(widgetContainerDisplayItemOrObject);
    }
}

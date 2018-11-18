import { isArray, asArray, getProperty } from "project-editor/core/store";
import { EezObject, PropertyType, isObjectInstanceOf } from "project-editor/core/metaData";
import {
    DisplayItem,
    DisplayItemChildrenObject,
    DisplayItemChildrenArray,
    DisplayItemChildren
} from "project-editor/core/objectAdapter";

import { TreeNode } from "project-editor/components/CanvasEditorTreeNode";

import * as data from "project-editor/project/features/data/data";

import {
    PageResolution,
    IWidgetContainerDisplayItem
} from "project-editor/project/features/gui/page";
import {
    Widget,
    ListWidget,
    GridWidget,
    SelectWidget
} from "project-editor/project/features/gui/widget";
import { drawWidget, drawPageFrame } from "project-editor/project/features/gui/draw";

////////////////////////////////////////////////////////////////////////////////

class DummyWidgetContainerDisplayItem implements DisplayItem, IWidgetContainerDisplayItem {
    selected: boolean;

    constructor(public object: EezObject) {}

    get children(): DisplayItemChildren {
        if (isArray(this.object)) {
            return asArray(this.object).map(child => new DummyWidgetContainerDisplayItem(child));
        } else {
            let properties = this.object._classInfo
                .properties(this.object)
                .filter(
                    propertyInfo =>
                        (propertyInfo.type === PropertyType.Object ||
                            propertyInfo.type === PropertyType.Array) &&
                        !(propertyInfo.enumerable !== undefined && !propertyInfo.enumerable) &&
                        getProperty(this.object, propertyInfo.name)
                );

            if (properties.length == 1 && properties[0].type === PropertyType.Array) {
                return asArray(getProperty(this.object, properties[0].name)).map(
                    child => new DummyWidgetContainerDisplayItem(child)
                );
            }

            return properties.reduce(
                (children, propertyInfo, i) => {
                    children[propertyInfo.name] = new DummyWidgetContainerDisplayItem(
                        getProperty(this.object, propertyInfo.name)
                    );
                    return children;
                },
                {} as DisplayItemChildrenObject
            );
        }
    }

    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined {
        let widget = item.object as SelectWidget;
        if (widget.data && widget.widgets) {
            let index: number = data.getEnumValue(widget.data);
            if (index >= 0 && index < widget.widgets._array.length) {
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
    if (isObjectInstanceOf(node.item.object, PageResolution.classInfo)) {
        let pageResolution = node.item.object as PageResolution;
        drawPageFrame(ctx, pageResolution, scale, pageResolution.style || "default");
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
            let object = item.object as Widget | PageResolution;

            if (object instanceof Widget || object instanceof PageResolution) {
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
                selected: object instanceof Widget && item.selected,
                resizable: true,
                movable: object instanceof Widget,
                selectable: object instanceof Widget,
                item: item,
                draw: object instanceof Widget ? undefined : drawPageFrameForTreeNode,
                image: draw && object instanceof Widget ? drawWidget(object, rect) : undefined
            };

            if (parentNode) {
                parentNode.children.push(treeNode);
            }

            if (object instanceof PageResolution) {
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
                    let widget = object as ListWidget;
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
                } else if (object.type == "Grid") {
                    let widget = object as GridWidget;
                    let itemWidget = widget.itemWidget;
                    if (itemWidget) {
                        let itemWidgetItem = (item.children as DisplayItemChildrenObject)[
                            "itemWidget"
                        ];

                        for (let i = 0; i < data.count(<string>widget.data); i++) {
                            enumWidget(treeNode, itemWidgetItem, x, y);

                            if (x + itemWidget.width < widget.width) {
                                x += itemWidget.width;
                            } else {
                                if (y + itemWidget.height < widget.height) {
                                    y += itemWidget.height;
                                    x = rect.x;
                                } else {
                                    break;
                                }
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

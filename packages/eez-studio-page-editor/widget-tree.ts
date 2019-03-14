import { _find } from "eez-studio-shared/algorithm";
import { Rect } from "eez-studio-shared/geometry";

import {
    DisplayItem,
    DisplayItemChildrenObject,
    DisplayItemChildrenArray,
    TreeObjectAdapter,
    ITreeObjectAdapter
} from "eez-studio-shared/model/objectAdapter";

import { PageContext, IDataContext } from "eez-studio-page-editor/page-context";
import { Page } from "eez-studio-page-editor/page";
import { Widget, ListWidget, GridWidget, SelectWidget } from "eez-studio-page-editor/widget";

////////////////////////////////////////////////////////////////////////////////

interface TreeNode {
    object: Page | Widget;
    rect: Rect;
    children: TreeNode[];
}

function getSelectedWidgetForSelectWidget(item: DisplayItem, dataContext: IDataContext) {
    let widget = item.object as SelectWidget;
    let widgetsItemChildren = item.children as DisplayItemChildrenArray;

    let selectedWidgetItem: DisplayItem | undefined;

    if (!selectedWidgetItem) {
        // if not found then select default for enum data
        if (widget.data && widget.widgets) {
            let index: number = dataContext.getEnumValue(widget.data);
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

function enumWidgets(widgetContainerDisplayItem: ITreeObjectAdapter, dataContext: IDataContext) {
    function enumWidget(parentNode: TreeNode | undefined, item: DisplayItem, x: number, y: number) {
        let object = item.object as Widget | Page;

        x += object.x || 0;
        y += object.y || 0;

        let rect = {
            left: x,
            top: y,
            width: object.width,
            height: object.height
        };

        let treeNode: TreeNode = {
            object: item.object as Page | Widget,
            rect,
            children: []
        };

        if (parentNode) {
            parentNode.children.push(treeNode);
        }

        if (object instanceof Widget) {
            if (object.type == "Container") {
                let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                widgetsItemChildren.forEach(child => {
                    enumWidget(treeNode, child, x, y);
                });
            } else if (object.type == "List") {
                let widget = object as ListWidget;
                let itemWidget = widget.itemWidget;
                if (itemWidget) {
                    let itemWidgetItem = (item.children as DisplayItemChildrenObject)["itemWidget"];

                    for (let i = 0; i < dataContext.count(<string>widget.data); i++) {
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
                    let itemWidgetItem = (item.children as DisplayItemChildrenObject)["itemWidget"];

                    for (let i = 0; i < dataContext.count(<string>widget.data); i++) {
                        enumWidget(treeNode, itemWidgetItem, x, y);

                        if (x + itemWidget.width < widget.width) {
                            x += itemWidget.width;
                        } else {
                            if (y + itemWidget.height < widget.height) {
                                y += itemWidget.height;
                                x = rect.left;
                            } else {
                                break;
                            }
                        }
                    }
                }
            } else if (object.type == "Select") {
                let selectedWidgetItem = getSelectedWidgetForSelectWidget(item, dataContext);
                if (selectedWidgetItem) {
                    enumWidget(treeNode, selectedWidgetItem, x, y);
                }
            }
        } else {
            let widgetsItemChildren = item.children as DisplayItemChildrenArray;

            widgetsItemChildren.forEach(child => {
                enumWidget(treeNode, child, x, y);
            });
        }

        return treeNode;
    }

    return enumWidget(undefined, widgetContainerDisplayItem, 0, 0);
}

function traverseTree(node: TreeNode, callback: (node: TreeNode) => void) {
    callback(node);
    for (let i = 0; i < node.children.length; i++) {
        traverseTree(node.children[i], callback);
    }
}

export function drawTree(ctx: CanvasRenderingContext2D, page: Page, dataContext: IDataContext) {
    const tree: TreeNode = enumWidgets(new TreeObjectAdapter(page), dataContext);

    traverseTree(tree, node => {
        if (node.object instanceof Page) {
            let page = node.object;

            ctx.save();

            ctx.shadowColor = "#999";
            ctx.shadowBlur = Math.max(5, Math.ceil(20));
            ctx.shadowOffsetX = Math.max(2, Math.ceil(5));
            ctx.shadowOffsetY = Math.max(2, Math.ceil(5));

            const style = PageContext.findStyle(page.style || "default");

            ctx.fillStyle = (style && style.backgroundColor) || "red";

            const rect = {
                left: page.x,
                top: page.y,
                width: page.width,
                height: page.height
            };

            ctx.fillRect(
                rect.left,
                rect.top,
                rect.left + rect.width - 1,
                rect.top + rect.height - 1
            );

            ctx.restore();
        } else {
            const image = node.object.draw(node.rect, dataContext);
            if (image && image.width && image.height) {
                ctx.drawImage(image, node.rect.left, node.rect.top);
            }
        }
    });
}

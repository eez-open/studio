import { objectClone } from "eez-studio-shared/util";
import { Rect } from "eez-studio-shared/geometry";

import { EezObject } from "project-editor/core/object";

import {
    DisplayItem,
    DisplayItemChildrenArray,
    DisplayItemChildrenObject,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";

import * as data from "project-editor/features/data/data";

import { Widget, ListWidget, SelectWidget } from "project-editor/features/gui/widget";
import { Page } from "project-editor/features/gui/page";

////////////////////////////////////////////////////////////////////////////////

export interface TreeNode {
    parent: TreeNode;
    children: TreeNode[];

    rect: Rect;

    item: DisplayItem;
    custom?: any;
    isOpaque?: boolean;
}

enum TraverseTreeContinuation {
    CONTINUE,
    SKIP_CHILDREN,
    BREAK
}

function traverseTree(
    node: TreeNode,
    callback: (node: TreeNode) => TraverseTreeContinuation | void
) {
    let result = callback(node);
    if (result == undefined || result === TraverseTreeContinuation.CONTINUE) {
        for (let i = 0; i < node.children.length; i++) {
            if (traverseTree(node.children[i], callback) == TraverseTreeContinuation.BREAK) {
                return TraverseTreeContinuation.BREAK;
            }
        }
    }

    return result;
}

export function isWidgetOpaque(widgetObj: Widget) {
    return !(
        widgetObj.type === "Container" ||
        widgetObj.type === "List" ||
        widgetObj.type === "Select"
    );
}

function getSelectedWidgetForSelectWidget(
    widgetContainerDisplayItem: DisplayItem,
    item: DisplayItem
): DisplayItem | undefined {
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

export function createWidgetTree(
    widgetContainerDisplayItemOrObject: DisplayItem | EezObject,
    draw: boolean
) {
    function enumWidgets(widgetContainerDisplayItem: DisplayItem) {
        function enumWidget(
            parentNode: TreeNode | undefined,
            item: DisplayItem,
            x: number,
            y: number
        ) {
            let object = item.object as Widget | Page;

            x += object.left || 0;
            y += object.top || 0;

            let rect = {
                left: x,
                top: y,
                width: object.width,
                height: object.height
            };

            let treeNode: TreeNode = {
                parent: <TreeNode>parentNode,
                children: [],
                rect: rect,
                item: item,
                isOpaque: object instanceof Widget && isWidgetOpaque(object)
            };

            if (parentNode) {
                parentNode.children.push(treeNode);
            }

            if (!(object instanceof Widget)) {
                let widgetsItemChildren = item.children;

                if (!Array.isArray(widgetsItemChildren)) {
                    widgetsItemChildren = widgetsItemChildren["widgets"].children;
                }

                (widgetsItemChildren as DisplayItemChildrenArray).forEach(child => {
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
                } else if (object.type == "Select") {
                    let selectedWidgetItem = getSelectedWidgetForSelectWidget(
                        widgetContainerDisplayItem,
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
        return enumWidgets(new TreeObjectAdapter(widgetContainerDisplayItemOrObject));
    } else {
        return enumWidgets(widgetContainerDisplayItemOrObject);
    }
}

////////////////////////////////////////////////////////////////////////////////

class PageTransparencyGrid {
    cols: {
        x: number;
        width: number;
        rows: {
            y: number;
            height: number;
            opaque: boolean;
        }[];
    }[];

    constructor(rect: Rect) {
        this.cols = [
            {
                x: rect.left,
                width: rect.width,
                rows: [
                    {
                        y: rect.top,
                        height: rect.height,
                        opaque: false
                    }
                ]
            }
        ];
    }

    private addCol(x: number) {
        for (let iCol = 0; iCol < this.cols.length; iCol++) {
            let col = this.cols[iCol];

            if (x <= col.x) {
                return;
            }

            if (x < col.x + col.width) {
                let newCol = objectClone(col);

                newCol.x = x;
                newCol.width = col.x + col.width - x;

                col.width = x - col.x;

                this.cols.splice(iCol + 1, 0, newCol);

                return;
            }
        }
    }

    private addRow(y: number) {
        for (let iCol = 0; iCol < this.cols.length; iCol++) {
            let col = this.cols[iCol];

            for (let iRow = 0; iRow < col.rows.length; iRow++) {
                let row = col.rows[iRow];

                if (y <= row.y) {
                    break;
                }

                if (y < row.y + row.height) {
                    let newRow = objectClone(row);

                    newRow.y = y;
                    newRow.height = row.y + row.height - y;

                    row.height = y - row.y;

                    col.rows.splice(iRow + 1, 0, newRow);

                    break;
                }
            }
        }
    }

    private addRect(rect: Rect) {
        this.addCol(rect.left);
        this.addCol(rect.left + rect.width);
        this.addRow(rect.top);
        this.addRow(rect.top + rect.height);
    }

    addOpaqueRect(rect: Rect) {
        if (rect.width > 0 || rect.height > 0) {
            this.addRect(rect);

            // mark as opaque
            for (let iCol = 0; iCol < this.cols.length; iCol++) {
                let col = this.cols[iCol];
                if (col.x >= rect.left && col.x + col.width <= rect.left + rect.width) {
                    for (let iRow = 0; iRow < col.rows.length; iRow++) {
                        let row = col.rows[iRow];
                        if (row.y >= rect.top && row.y + row.height <= rect.top + rect.height) {
                            row.opaque = true;
                        }
                    }
                }
            }
        }
    }

    getMaxRectAtCell(iColStart: number, iRowStart: number): Rect {
        let colStart = this.cols[iColStart];

        let iColEnd: number;
        for (iColEnd = iColStart + 1; iColEnd < this.cols.length; iColEnd++) {
            let row = this.cols[iColEnd].rows[iRowStart];
            if (row.opaque) {
                break;
            }
            row.opaque = true;
        }
        iColEnd--;
        let colEnd = this.cols[iColEnd];

        let rowStart = colStart.rows[iRowStart];

        let iRowEnd: number;
        for (iRowEnd = iRowStart + 1; iRowEnd < colStart.rows.length; iRowEnd++) {
            let opaque = false;

            for (let iCol = iColStart; iCol <= iColEnd; iCol++) {
                if (this.cols[iCol].rows[iRowEnd].opaque) {
                    opaque = true;
                    break;
                }
            }

            if (opaque) {
                break;
            }

            for (let iCol = iColStart; iCol <= iColEnd; iCol++) {
                this.cols[iCol].rows[iRowEnd].opaque = true;
            }
        }
        iRowEnd--;
        let rowEnd = colEnd.rows[iRowEnd];

        return {
            left: colStart.x,
            top: rowStart.y,
            width: colEnd.x + colEnd.width - colStart.x,
            height: rowEnd.y + rowEnd.height - rowStart.y
        };
    }

    getTransparentRectangles(): Rect[] {
        let rects: Rect[] = [];

        for (let iCol = 0; iCol < this.cols.length; iCol++) {
            let col = this.cols[iCol];
            for (let iRow = 0; iRow < col.rows.length; iRow++) {
                let row = col.rows[iRow];
                if (!row.opaque) {
                    let rect = this.getMaxRectAtCell(iCol, iRow);
                    rects.push(rect);
                }
            }
        }

        return rects;
    }
}

export function findPageTransparentRectanglesInTree(tree: TreeNode): Rect[] {
    let grid = new PageTransparencyGrid(tree.rect);

    traverseTree(tree, node => {
        if (node.isOpaque) {
            grid.addOpaqueRect(node.rect);
        }
    });

    return grid.getTransparentRectangles();
}

export function findPageTransparentRectanglesInContainer(container: EezObject) {
    return findPageTransparentRectanglesInTree(createWidgetTree(container, false));
}

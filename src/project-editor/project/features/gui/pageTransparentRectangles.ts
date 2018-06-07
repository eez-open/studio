import { objectClone } from "shared/util";

import { Rect } from "project-editor/core/util";
import { EezObject } from "project-editor/core/metaData";

import { TreeNode, traverseTree } from "project-editor/components/CanvasEditorTreeNode";

import { createWidgetTree } from "project-editor/project/features/gui/widget-tree";

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
                x: rect.x,
                width: rect.width,
                rows: [
                    {
                        y: rect.y,
                        height: rect.height,
                        opaque: false
                    }
                ]
            }
        ];
    }

    private addCol(x: number) {
        for (let iCol = 0; iCol < this.cols.length; ++iCol) {
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
        for (let iCol = 0; iCol < this.cols.length; ++iCol) {
            let col = this.cols[iCol];

            for (let iRow = 0; iRow < col.rows.length; ++iRow) {
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
        this.addCol(rect.x);
        this.addCol(rect.x + rect.width);
        this.addRow(rect.y);
        this.addRow(rect.y + rect.height);
    }

    addOpaqueRect(rect: Rect) {
        if (rect.width > 0 || rect.height > 0) {
            this.addRect(rect);

            // mark as opaque
            for (let iCol = 0; iCol < this.cols.length; ++iCol) {
                let col = this.cols[iCol];
                if (col.x >= rect.x && col.x + col.width <= rect.x + rect.width) {
                    for (let iRow = 0; iRow < col.rows.length; ++iRow) {
                        let row = col.rows[iRow];
                        if (row.y >= rect.y && row.y + row.height <= rect.y + rect.height) {
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
        for (iColEnd = iColStart + 1; iColEnd < this.cols.length; ++iColEnd) {
            let row = this.cols[iColEnd].rows[iRowStart];
            if (row.opaque) {
                break;
            }
            row.opaque = true;
        }
        --iColEnd;
        let colEnd = this.cols[iColEnd];

        let rowStart = colStart.rows[iRowStart];

        let iRowEnd: number;
        for (iRowEnd = iRowStart + 1; iRowEnd < colStart.rows.length; ++iRowEnd) {
            let opaque = false;

            for (let iCol = iColStart; iCol <= iColEnd; ++iCol) {
                if (this.cols[iCol].rows[iRowEnd].opaque) {
                    opaque = true;
                    break;
                }
            }

            if (opaque) {
                break;
            }

            for (let iCol = iColStart; iCol <= iColEnd; ++iCol) {
                this.cols[iCol].rows[iRowEnd].opaque = true;
            }
        }
        --iRowEnd;
        let rowEnd = colEnd.rows[iRowEnd];

        return {
            x: colStart.x,
            y: rowStart.y,
            width: colEnd.x + colEnd.width - colStart.x,
            height: rowEnd.y + rowEnd.height - rowStart.y
        };
    }

    getTransparentRectangles(): Rect[] {
        let rects: Rect[] = [];

        for (let iCol = 0; iCol < this.cols.length; ++iCol) {
            let col = this.cols[iCol];
            for (let iRow = 0; iRow < col.rows.length; ++iRow) {
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

export function debugDrawPageTransparentRectangles(ctx: CanvasRenderingContext2D, tree: TreeNode) {
    ctx.fillStyle = "white";
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1;

    var rects = findPageTransparentRectanglesInTree(tree);
    for (let i = 0; i < rects.length; ++i) {
        let rect = rects[i];

        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.fill();
        ctx.stroke();
    }
}

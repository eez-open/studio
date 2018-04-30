import * as React from "react";
import { action } from "mobx";

import { getDebugOptions } from "project-editor/core/debug";
import { Point, Rect, boundingRect } from "project-editor/core/util";
import { updateObject, UndoManager, objectToString } from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";
import { DisplayItem, DisplayItemSelection } from "project-editor/core/objectAdapter";

import { findSnapLines, drawSnapLines } from "project-editor/components/CanvasEditorSnapLines";
import {
    CanvasEditorScrollBars,
    ScrollBarsHitRegion
} from "project-editor/components/CanvasEditorScrollBars";
import {
    TreeNode,
    LineConnecting,
    traverseTree
} from "project-editor/components/CanvasEditorTreeNode";
import {
    HitRegion,
    HitTestResult,
    hitTestSelectionRect
} from "project-editor/components/CanvasEditorHitTest";
import { MouseDrag, RubberBandSelection } from "project-editor/components/CanvasEditorMouseDrag";
import {
    drawTree,
    drawSelectedDecoration,
    drawSelection,
    debugDrawPageTransparentRectangles,
    nodesFromPoint
} from "project-editor/components/CanvasEditorUtil";

const { Menu, MenuItem } = EEZStudio.electron.remote;

////////////////////////////////////////////////////////////////////////////////

const BOUNDING_RECT_MARGIN = 100;

const CENTER_LINES_COLOR = "rgba(255, 0, 0, 0.2)";
const CENTER_LINES_WIDTH = 1;

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

export interface CanvasEditorProps {
    displaySelection: DisplayItemSelection;
}

export class CanvasEditorUIState {
    documentTranslate: Point;
    scale: number;

    constructor(scale: number) {
        this.documentTranslate = {
            x: 0,
            y: 0
        };
        this.scale = scale;
    }
}

export abstract class CanvasEditor extends React.Component<CanvasEditorProps, {}> {
    refs: {
        [key: string]: Element;
        canvas: HTMLCanvasElement;
    };

    contentTree: TreeNode;
    tree: TreeNode;

    scale: number;

    deviceTranslate: Point;
    documentTranslate: Point;

    nonTranslatedDeviceRect: Rect;
    deviceRect: Rect;
    documentRect: Rect;

    selectionRect?: Rect;
    selectionRectMovable: boolean;
    selectionRectResizable: boolean;

    scrollBars: CanvasEditorScrollBars = new CanvasEditorScrollBars(this);

    mouseDrag?: MouseDrag;

    rubberBandSelection?: RubberBandSelection;

    lineConnecting?: LineConnecting;

    showPageTransparentRectangles: boolean;

    drawCallback = this.draw.bind(this);

    centerOffset: Point;

    constructor(
        props: CanvasEditorProps,
        private canvasEditorUIState: CanvasEditorUIState,
        private defaultScale: number
    ) {
        super(props, "StoryboardCanvasEditor");

        this.documentTranslate = canvasEditorUIState.documentTranslate;
        this.scale = canvasEditorUIState.scale;

        this.state = {};
    }

    translateOffsetFromEventTargetToCanvas(event: any) {
        let targetRect = event.target.getBoundingClientRect();
        let canvasRect = this.refs.canvas.getBoundingClientRect();
        return {
            offsetX: event.offsetX + targetRect.left - canvasRect.left,
            offsetY: event.offsetY + targetRect.top - canvasRect.top,
            buttons: event.buttons,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey
        };
    }

    componentDidMount() {
        document.addEventListener(
            "mousemove",
            event => {
                if (this.isDragging() && event.target != this.refs.canvas) {
                    this.onMouseMove(this.translateOffsetFromEventTargetToCanvas(event));
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true
        );

        document.addEventListener(
            "mouseup",
            event => {
                if (this.isDragging() && event.target != this.refs.canvas) {
                    this.onMouseUp(this.translateOffsetFromEventTargetToCanvas(event));
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true
        );

        $(this.refs.canvas)
            .parent()
            .on("autoLayout:resize", () => {
                this.redraw();
            });

        $(this.refs.canvas).on("contextmenu", event => {
            this.scrollBars.stopDragging();
            this.props.displaySelection.showSelectionContextMenu();
            event.preventDefault();
        });

        this.redraw();
    }

    componentDidUpdate() {
        this.redraw();
    }

    componentWillUnmount() {
        $(this.refs.canvas)
            .parent()
            .off("autoLayout:resize");
    }

    getDeviceTranslate() {
        return {
            x: this.refs.canvas.width / 2 + this.centerOffset.x * this.scale,
            y: this.refs.canvas.height / 2 + this.centerOffset.y * this.scale
        };
    }

    getDeviceRect() {
        let topLeft = this.deviceToDocument({ x: 0, y: 0 });
        let bottomRight = this.deviceToDocument({
            x: this.refs.canvas.width,
            y: this.refs.canvas.height
        });
        return {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
        };
    }

    getNonTranslatedDeviceRect() {
        let documentTranslateSaved = this.documentTranslate;
        this.documentTranslate = {
            x: 0,
            y: 0
        };

        let nonTranslatedDeviceRect = this.getDeviceRect();

        this.documentTranslate = documentTranslateSaved;

        return nonTranslatedDeviceRect;
    }

    getDocumentRect() {
        let x1: number = this.nonTranslatedDeviceRect.x;
        let y1: number = this.nonTranslatedDeviceRect.y;
        let x2: number = this.nonTranslatedDeviceRect.x + this.nonTranslatedDeviceRect.width;
        let y2: number = this.nonTranslatedDeviceRect.y + this.nonTranslatedDeviceRect.height;

        traverseTree(this.tree, node => {
            if (node.rect) {
                let x = node.rect.x - BOUNDING_RECT_MARGIN;
                if (x < x1) {
                    x1 = x;
                }

                x = node.rect.x + node.rect.width + BOUNDING_RECT_MARGIN;
                if (x > x2) {
                    x2 = x;
                }

                let y = node.rect.y - BOUNDING_RECT_MARGIN;
                if (y < y1) {
                    y1 = y;
                }

                y = node.rect.y + node.rect.height + BOUNDING_RECT_MARGIN;
                if (y > y2) {
                    y2 = y;
                }
            }
        });

        return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1
        };
    }

    deviceToDocument(pos: Point) {
        return {
            x: (pos.x - this.deviceTranslate.x) / this.scale + this.documentTranslate.x,
            y: (pos.y - this.deviceTranslate.y) / this.scale + this.documentTranslate.y
        };
    }

    mouseToDocument(event: any) {
        return this.deviceToDocument({
            x: event.offsetX,
            y: event.offsetY
        });
    }

    documentToDevice(pos: Point) {
        return {
            x: (pos.x - this.documentTranslate.x) * this.scale + this.deviceTranslate.x,
            y: (pos.y - this.documentTranslate.y) * this.scale + this.deviceTranslate.y
        };
    }

    redrawAnimationFrameId: any;

    redraw() {
        if (!this.redrawAnimationFrameId) {
            this.redrawAnimationFrameId = window.requestAnimationFrame(() => {
                this.redrawAnimationFrameId = undefined;

                if (!this.refs.canvas) {
                    return;
                }

                this.refs.canvas.width = $(this.refs.canvas)
                    .parent()
                    .width()!;
                this.refs.canvas.height = $(this.refs.canvas)
                    .parent()
                    .height()!;

                this.deviceTranslate = this.getDeviceTranslate();
                this.nonTranslatedDeviceRect = this.getNonTranslatedDeviceRect();
                this.deviceRect = this.getDeviceRect();
                this.documentRect = this.getDocumentRect();

                this.calculateSelectionRect();

                this.scrollBars.update();

                this.draw();
            });
        }
    }

    draw() {
        if (!this.refs.canvas) {
            return;
        }

        const ctx = this.refs.canvas.getContext("2d");
        if (ctx == null) {
            return;
        }

        ctx.clearRect(0, 0, this.refs.canvas.width, this.refs.canvas.height);

        ctx.save();

        (ctx as any).imageSmoothingEnabled = this.scale < 1;

        ctx.translate(this.deviceTranslate.x, this.deviceTranslate.y);
        ctx.scale(this.scale, this.scale);
        ctx.translate(-this.documentTranslate.x, -this.documentTranslate.y);

        // draw center
        ctx.strokeStyle = CENTER_LINES_COLOR;
        ctx.lineWidth = CENTER_LINES_WIDTH / this.scale;
        // draw vertical line
        ctx.beginPath();
        ctx.moveTo(0, this.deviceRect.y);
        ctx.lineTo(0, this.deviceRect.y + this.deviceRect.height);
        ctx.stroke();
        // draw horizontal line
        ctx.beginPath();
        ctx.moveTo(this.deviceRect.x, 0);
        ctx.lineTo(this.deviceRect.x + this.deviceRect.width, 0);
        ctx.stroke();

        // draw nodes
        drawTree(ctx, this.tree, this.scale, this.drawCallback);
        traverseTree(this.tree, node => {
            if (node.selected) {
                if (node.drawSelectedDecoration) {
                    node.drawSelectedDecoration(node, ctx, this.scale);
                } else if (node.rect) {
                    drawSelectedDecoration(ctx, node.rect);
                }
            }
        });

        // draw selection
        if (this.selectionRect) {
            drawSelection(ctx, this.selectionRect, this.selectionRectResizable);
        }

        // draw snap lines
        if (
            this.mouseDrag &&
            this.mouseDrag.snapToLines &&
            this.mouseDrag.snapLines &&
            this.selectionRect
        ) {
            drawSnapLines(
                ctx,
                this.deviceRect,
                {
                    x: this.deviceRect.x + this.deviceRect.width,
                    y: this.deviceRect.y + this.deviceRect.height
                },
                this.mouseDrag.snapLines,
                this.selectionRect,
                this.scale
            );
        }

        // draw rubber band selection rectangle
        if (this.rubberBandSelection) {
            let r = this.rubberBandSelection.rect;
            if (r) {
                ctx.beginPath();

                ctx.rect(r.x, r.y, r.width, r.height);

                ctx.fillStyle = "rgba(51, 122, 183, 0.5)";
                ctx.fill();

                ctx.strokeStyle = "#337ab7";
                ctx.stroke();
            }
        }

        //
        if (this.lineConnecting) {
            this.lineConnecting.draw(ctx, this.scale);
        }

        if (this.showPageTransparentRectangles) {
            debugDrawPageTransparentRectangles(ctx, this.tree);
        }

        ctx.restore();

        this.scrollBars.draw(ctx);
    }

    changeCursor(hitRegion?: HitRegion) {
        if (hitRegion) {
            if (hitRegion == HitRegion.NW) {
                $(this.refs.canvas).css("cursor", "nw-resize");
            } else if (hitRegion == HitRegion.N) {
                $(this.refs.canvas).css("cursor", "n-resize");
            } else if (hitRegion == HitRegion.NE) {
                $(this.refs.canvas).css("cursor", "ne-resize");
            } else if (hitRegion == HitRegion.W) {
                $(this.refs.canvas).css("cursor", "w-resize");
            } else if (hitRegion == HitRegion.E) {
                $(this.refs.canvas).css("cursor", "e-resize");
            } else if (hitRegion == HitRegion.SW) {
                $(this.refs.canvas).css("cursor", "sw-resize");
            } else if (hitRegion == HitRegion.S) {
                $(this.refs.canvas).css("cursor", "s-resize");
            } else if (hitRegion == HitRegion.SE) {
                $(this.refs.canvas).css("cursor", "se-resize");
            } else if (hitRegion == HitRegion.INSIDE) {
                $(this.refs.canvas).css("cursor", "move");
            } else {
                $(this.refs.canvas).css("cursor", "default");
            }
        } else {
            $(this.refs.canvas).css("cursor", "default");
        }
    }

    setRubberBandSelection(rubberBandSelection?: RubberBandSelection) {
        this.rubberBandSelection = rubberBandSelection;
        this.redraw();
    }

    @action
    transform(documentTranslate: Point, scale?: number) {
        this.documentTranslate = documentTranslate;
        this.canvasEditorUIState.documentTranslate = documentTranslate;

        if (scale !== undefined) {
            this.scale = scale;
            this.canvasEditorUIState.scale = scale;
        }

        this.redraw();
    }

    selectNodeFromNodes(nodes: TreeNode[], callback: (node: TreeNode) => void) {
        let menuItems: Electron.MenuItem[] = [];

        nodes.forEach(node => {
            menuItems.unshift(
                new MenuItem({
                    label: objectToString(node.item.object),
                    click: () => {
                        callback(node);
                    }
                })
            );
        });

        const menu = new Menu();
        menuItems.forEach(menuItem => menu.append(menuItem));
        menu.popup({});
    }

    hitTest(event: any, p: Point): HitTestResult | undefined {
        let node: TreeNode | undefined;
        let nodes: TreeNode[] | undefined;

        if (!event.altKey) {
            let nodesAtPoint = nodesFromPoint(this.tree, p);

            nodesAtPoint = this.hitTestFilter(nodesAtPoint);

            if (nodesAtPoint.length == 1) {
                node = nodesAtPoint[0];
            } else if (nodesAtPoint.length > 1) {
                nodes = nodesAtPoint;
            }
        }

        let region =
            (this.selectionRect &&
                hitTestSelectionRect(this.selectionRect, p, this.selectionRectResizable)) ||
            HitRegion.OUTSIDE;

        if (node || nodes || region != HitRegion.OUTSIDE) {
            return {
                region: region,
                node: node,
                nodes: nodes
            };
        }

        return undefined;
    }

    isDragging(): boolean {
        return (
            this.mouseDrag != undefined ||
            this.rubberBandSelection != undefined ||
            this.scrollBars.isDragging() ||
            this.lineConnecting != undefined
        );
    }

    stopDragging(success: boolean) {
        if (this.mouseDrag) {
            this.mouseDrag = undefined;
            UndoManager.setCombineCommands(false);
        }

        if (this.rubberBandSelection) {
            this.rubberBandSelection = undefined;
        }

        if (this.scrollBars.isDragging()) {
            this.scrollBars.stopDragging();
        }

        if (this.lineConnecting) {
            if (success) {
                this.lineConnecting.commit();
            }
            this.lineConnecting = undefined;
        }

        this.redraw();
    }

    deselectAll() {
        this.replaceSelection(undefined);
    }

    toggleSelection(item: DisplayItem) {
        this.props.displaySelection.toggleSelected(item);
    }

    selectItemsInsideRect(r: Rect) {
        this.replaceSelection(this.getItemsInsideRect(r));
    }

    getHitRegion(p: Point) {
        return (
            this.selectionRect &&
            hitTestSelectionRect(this.selectionRect, p, this.selectionRectResizable)
        );
    }

    onMouseDown(event: any) {
        if (event.nativeEvent) {
            event = event.nativeEvent;
        }

        if (this.isDragging()) {
            this.stopDragging(false);
        }

        if (event.buttons == 1) {
            // left button
            if (this.scrollBars.onMouseDown(event)) {
                return;
            }
        }

        let p = this.mouseToDocument(event);

        const hitTestResult = this.hitTest(event, p);
        if (hitTestResult) {
            if (event.buttons == 1) {
                if (hitTestResult) {
                    if (event.shiftKey || event.ctrlKey) {
                        if (hitTestResult.node) {
                            if (event.ctrlKey && hitTestResult.node.startLineConnecting) {
                                this.lineConnecting = hitTestResult.node.startLineConnecting(
                                    hitTestResult.node,
                                    p
                                );
                            } else {
                                this.toggleSelection(hitTestResult.node.item);
                            }
                        } else if (hitTestResult.nodes) {
                            this.selectNodeFromNodes(hitTestResult.nodes, node => {
                                this.toggleSelection(node.item);
                            });
                        }
                    } else {
                        if (hitTestResult.region === HitRegion.OUTSIDE) {
                            if (hitTestResult.node) {
                                this.replaceSelection([hitTestResult.node.item]);
                            } else if (hitTestResult.nodes) {
                                this.selectNodeFromNodes(hitTestResult.nodes, node => {
                                    this.replaceSelection([node.item]);
                                });
                                return;
                            } else {
                                this.replaceSelection(undefined);
                            }
                        }

                        if (this.selectionRectMovable) {
                            this.mouseDrag = new MouseDrag(
                                p,
                                !event.shiftKey,
                                hitTestResult.region !== HitRegion.OUTSIDE
                                    ? hitTestResult.region
                                    : HitRegion.INSIDE
                            );
                            this.changeCursor(this.mouseDrag.hitRegion);
                            UndoManager.setCombineCommands(true);
                        }
                    }
                }
            } else if (event.buttons == 2) {
                // right button
                if (hitTestResult.region !== HitRegion.OUTSIDE) {
                } else {
                    if (hitTestResult.node) {
                        if (!hitTestResult.node.selected) {
                            this.replaceSelection([hitTestResult.node.item]);
                        }
                    } else if (hitTestResult.nodes) {
                        this.selectNodeFromNodes(hitTestResult.nodes, node => {
                            this.replaceSelection([node.item]);
                        });
                    } else {
                        this.replaceSelection(undefined);
                    }
                }
            }
        } else {
            if (event.buttons == 1) {
                // start rubber band selection
                this.deselectAll();
                this.setRubberBandSelection({
                    fromPoint: p
                });
            } else if (event.buttons == 2) {
                this.replaceSelection(undefined);
            }
        }
    }

    onMouseMove(event: any) {
        if (event.nativeEvent) {
            event = event.nativeEvent;
        }

        if (this.scrollBars.isDragging()) {
            this.scrollBars.onMouseMove(event);
            return;
        }

        let p = this.mouseToDocument(event);

        if (event.buttons == 1) {
            // left mouse button is pressed
            if (this.mouseDrag && this.selectionRect) {
                if (!this.mouseDrag.nodes) {
                    let nodes = this.findSelectedTreeNodes();
                    this.mouseDrag.nodes = nodes.map(node => {
                        return {
                            node: node,
                            nodeRect: Object.assign({}, node.rect),
                            object: node.item.object,
                            objectStartingPosition: {
                                x: (node.item.object as any).x || 0,
                                y: (node.item.object as any).y || 0
                            }
                        };
                    });
                    this.mouseDrag.savedSelectionRect = Object.assign({}, this.selectionRect);
                    this.mouseDrag.offset.x = this.selectionRect.x - this.mouseDrag.offset.x;
                    this.mouseDrag.offset.y = this.selectionRect.y - this.mouseDrag.offset.y;
                    this.mouseDrag.snapLines = findSnapLines(
                        this.tree,
                        nodes,
                        this.findSnapLinesFilter.bind(this)
                    );
                }

                this.mouseDrag.snapToLines = !event.shiftKey;

                let rect = Object.assign({}, this.selectionRect);

                this.mouseDrag.move(rect, p);

                if (
                    rect.x != this.selectionRect.x ||
                    rect.y != this.selectionRect.y ||
                    rect.width != this.selectionRect.width ||
                    rect.height != this.selectionRect.height
                ) {
                    const savedSelectionRect = this.mouseDrag.savedSelectionRect;

                    var geometryChanges: ObjectGeometryChange[] = this.mouseDrag.nodes.map(
                        mouseDragNode => {
                            let updatedGeometryProperties: GeometryProperties = {
                                x:
                                    mouseDragNode.objectStartingPosition.x +
                                    Math.round(
                                        rect.x +
                                            (mouseDragNode.nodeRect.x - savedSelectionRect.x) *
                                                rect.width /
                                                savedSelectionRect.width -
                                            mouseDragNode.nodeRect.x
                                    ),
                                y:
                                    mouseDragNode.objectStartingPosition.y +
                                    Math.round(
                                        rect.y +
                                            (mouseDragNode.nodeRect.y - savedSelectionRect.y) *
                                                rect.height /
                                                savedSelectionRect.height -
                                            mouseDragNode.nodeRect.y
                                    )
                            };

                            if (
                                mouseDragNode.node.resizable &&
                                (rect.width != savedSelectionRect.width ||
                                    rect.height != savedSelectionRect.height)
                            ) {
                                updatedGeometryProperties.width = Math.round(
                                    mouseDragNode.nodeRect.width *
                                        rect.width /
                                        savedSelectionRect.width
                                );
                                updatedGeometryProperties.height = Math.round(
                                    mouseDragNode.nodeRect.height *
                                        rect.height /
                                        savedSelectionRect.height
                                );
                            } else {
                                updatedGeometryProperties.width = mouseDragNode.nodeRect.width;
                                updatedGeometryProperties.height = mouseDragNode.nodeRect.height;
                            }

                            return {
                                object: mouseDragNode.object,
                                changedProperties: updatedGeometryProperties
                            };
                        }
                    );

                    this.applyGeometryChanges(geometryChanges);
                }
            } else if (this.rubberBandSelection) {
                let p1 = this.rubberBandSelection.fromPoint;
                let p2 = p;

                let x: number;
                let w: number;

                if (p1.x < p2.x) {
                    x = p1.x;
                    w = p2.x - p1.x;
                } else {
                    x = p2.x;
                    w = p1.x - p2.x;
                }

                let y: number;
                let h: number;

                if (p1.y < p2.y) {
                    y = p1.y;
                    h = p2.y - p1.y;
                } else {
                    y = p2.y;
                    h = p1.y - p2.y;
                }

                let r = { x: x, y: y, width: w, height: h };

                this.setRubberBandSelection({
                    fromPoint: this.rubberBandSelection.fromPoint,
                    rect: r
                });

                this.selectItemsInsideRect(r);
            } else if (this.lineConnecting) {
                let hitTestResult = this.hitTest(event, p);
                this.lineConnecting.move(hitTestResult && hitTestResult.node, p);
                this.draw();
            }
        } else {
            if (this.isDragging()) {
                this.stopDragging(false);
            }

            this.changeCursor(this.getHitRegion(p));

            if (this.rubberBandSelection) {
                this.setRubberBandSelection(undefined);
            }
        }
    }

    onMouseUp(event: any) {
        this.stopDragging(true);
        this.changeCursor(HitRegion.OUTSIDE);
    }

    onMouseWheel(event: any) {
        if (event.nativeEvent) {
            event = event.nativeEvent;
        }

        this.scrollBars.onMouseWheel(event);
    }

    onDoubleClick(event: any) {
        if (event.nativeEvent) {
            event = event.nativeEvent;
        }

        if (this.scrollBars.hitTest(event) != ScrollBarsHitRegion.OUTSIDE) {
            return;
        }

        let p = this.mouseToDocument(event);

        let hitTestResult = this.hitTest(event, p);
        if (hitTestResult) {
            if (hitTestResult.node) {
                this.onNodeDoubleClicked(hitTestResult.node);
            }
        } else {
            // back to the center
            this.transform(
                {
                    x: 0,
                    y: 0
                },
                this.defaultScale
            );
        }
    }

    calculateSelectionRect() {
        let rect: Rect | undefined = undefined;
        let movable = true;
        let resizable = true;

        this.findSelectedTreeNodes().forEach(node => {
            if (node.rect) {
                rect = boundingRect(rect, node.rect);
            }

            if (!node.movable) {
                movable = false;
            }

            if (!node.resizable) {
                resizable = false;
            }
        });

        this.selectionRect = rect;
        this.selectionRectMovable = movable;
        this.selectionRectResizable = resizable;
    }

    replaceSelection(items: DisplayItem[] | undefined) {
        if (items && items.length > 0) {
            this.props.displaySelection.selectItems(items);
        } else {
            this.props.displaySelection.selectItems([]);
        }
    }

    onKeyDown(event: any) {
        if (this.mouseDrag) {
            this.mouseDrag.snapToLines = !event.shiftKey;
            this.redraw();
        }

        if (event.altKey) {
        } else if (event.shiftKey) {
        } else if (event.ctrlKey) {
            if (event.keyCode == "X".charCodeAt(0)) {
                this.props.displaySelection.cutSelection();
            } else if (event.keyCode == "C".charCodeAt(0)) {
                this.props.displaySelection.copySelection();
            } else if (event.keyCode == "V".charCodeAt(0)) {
                this.props.displaySelection.pasteSelection();
            } else if (event.keyCode == "A".charCodeAt(0)) {
                this.selectAllItems();
            }
        } else if (event.keyCode == 46) {
            // delete
            this.props.displaySelection.deleteSelection();
        } else {
            let nodes = this.findSelectedTreeNodes();
            if (nodes.length > 0) {
                if (this.selectionRect) {
                    let rect = Object.assign({}, this.selectionRect);

                    if (event.keyCode == 37) {
                        // left
                        --rect.x;
                    } else if (event.keyCode == 39) {
                        // right
                        ++rect.x;
                    } else if (event.keyCode == 38) {
                        // up
                        --rect.y;
                    } else if (event.keyCode == 40) {
                        // down
                        ++rect.y;
                    } else if (event.keyCode == 36) {
                        // home
                        rect.x = 0;
                        rect.y = 0;
                    } else if (event.keyCode == 35) {
                        // end
                    }

                    let dx = rect.x - this.selectionRect.x;
                    let dy = rect.y - this.selectionRect.y;
                    if (dx || dy) {
                        for (let i = 0; i < nodes.length; ++i) {
                            let nodeObj = nodes[i].item.object as any;
                            updateObject(nodeObj, {
                                x: nodeObj.x + dx,
                                y: nodeObj.y + dy
                            });
                        }
                    }
                }
            }
        }
    }

    onKeyUp(event: any) {
        if (this.mouseDrag) {
            this.mouseDrag.snapToLines = !event.shiftKey;
            this.redraw();
        }
    }

    findSelectedTreeNodes(): TreeNode[] {
        let foundNodes: TreeNode[] = [];

        traverseTree(this.tree, node => {
            if (
                node.selected &&
                !foundNodes.find(foundNode => foundNode.item.object == node.item.object)
            ) {
                foundNodes.push(node);
            }
        });

        return foundNodes;
    }

    render() {
        this.showPageTransparentRectangles = getDebugOptions().showPageTransparentRectangles;

        this.tree = this.createTree();

        this.centerOffset = {
            x: -320 / 2,
            y: -240 / 2
        };

        return (
            <canvas
                tabIndex={0}
                ref="canvas"
                onMouseDown={this.onMouseDown.bind(this)}
                onMouseMove={this.onMouseMove.bind(this)}
                onMouseUp={this.onMouseUp.bind(this)}
                onWheel={this.onMouseWheel.bind(this)}
                onDoubleClick={this.onDoubleClick.bind(this)}
                onDragEnter={this.onDragEnter.bind(this)}
                onDragOver={this.onDragOver.bind(this)}
                onDrop={this.onDrop.bind(this)}
                onDragLeave={this.onDragLeave.bind(this)}
                onKeyDown={this.onKeyDown.bind(this)}
                onKeyUp={this.onKeyUp.bind(this)}
            />
        );
    }

    abstract createTree(): TreeNode;
    applyGeometryChanges(geometryChanges: ObjectGeometryChange[]) {
        geometryChanges.forEach(geometryChange =>
            updateObject(geometryChange.object, geometryChange.changedProperties)
        );
    }
    abstract getItemsInsideRect(r: Rect): DisplayItem[];
    abstract hitTestFilter(nodes: TreeNode[]): TreeNode[];
    abstract findSnapLinesFilter(node: TreeNode): boolean;
    abstract selectAllItems(): void;
    abstract onNodeDoubleClicked(node: TreeNode): void;
    abstract onDragEnter(event: any): void;
    abstract onDragOver(event: any): void;
    abstract onDrop(event: any): void;
    abstract onDragLeave(event: any): void;
}

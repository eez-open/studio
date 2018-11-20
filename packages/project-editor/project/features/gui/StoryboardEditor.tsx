import { action } from "mobx";
import { observer } from "mobx-react";
import React from "react";

import { _each } from "eez-studio-shared/algorithm";
import {
    Point,
    Rect,
    rectContains,
    rectCenter,
    rectSegmentIntersection,
    pointSegmentDistance
} from "eez-studio-shared/geometry";

import { Splitter } from "eez-studio-ui/splitter";

import {
    EezObject,
    EditorComponent,
    isObjectInstanceOf,
    loadObject,
    getAncestorOfType
} from "project-editor/core/object";
import { getEezStudioDataFromDragEvent } from "project-editor/core/clipboard";
import { UIStateStore, EditorsStore, ProjectStore } from "project-editor/core/store";
import {
    DisplayItemChildrenObject,
    DisplayItemChildrenArray
} from "project-editor/core/objectAdapter";

import { Panel } from "project-editor/components/Panel";
import { TreeNode, LineConnecting } from "project-editor/components/CanvasEditorTreeNode";
import {
    CanvasEditor,
    CanvasEditorProps,
    CanvasEditorUIState
} from "project-editor/components/CanvasEditor";

import {
    StoryboardPage,
    Storyboard,
    StoryboardLine,
    StoryboardTabState
} from "project-editor/project/features/gui/storyboard";
import { getPages, findPage } from "project-editor/project/features/gui/gui";
import { Page } from "project-editor/project/features/gui/page";
import {
    drawPageFrame,
    drawNotFoundPageFrame,
    drawPage
} from "project-editor/project/features/gui/draw";
import { PagesPalette } from "project-editor/project/features/gui/PagesPalette";

const TITLE_FONT = "24px Segoe UI";

////////////////////////////////////////////////////////////////////////////////

const MAX_DRAW_CACHE_SIZE = 1000;

let cache: string[] = [];
let cacheMap: Map<string, HTMLCanvasElement> = new Map<string, HTMLCanvasElement>();

function getCacheId(object: EezObject) {
    let modificationTime = object._modificationTime;
    if (modificationTime != undefined) {
        return object._id + "-" + modificationTime;
    } else {
        return object._id;
    }
}

////////////////////////////////////////////////////////////////////////////////

class RenderTask {
    callbacks: (() => void)[] = [];

    constructor(public id: string, public page: Page) {}

    addCallback(callback: () => void) {
        for (var i = 0; i < this.callbacks.length; i++) {
            if (this.callbacks[i] == callback) {
                return;
            }
        }
        this.callbacks.push(callback);
    }

    render() {
        return drawPage(this.page);
    }

    callCallbacks() {
        this.callbacks.map(callback => {
            callback();
        });
        this.callbacks = [];
    }
}

let renderQueue: RenderTask[] = [];

function renderLoop() {
    let startTime = new Date().getTime();
    while (true) {
        const renderTask = renderQueue.pop();
        if (!renderTask) {
            break;
        }

        let canvas = renderTask.render();

        if (cache.length == MAX_DRAW_CACHE_SIZE) {
            let cacheKey = cache.shift();
            if (cacheKey) {
                cacheMap.delete(cacheKey);
            }
        }
        cache.push(renderTask.id);
        cacheMap.set(renderTask.id, canvas);

        renderTask.callCallbacks();

        let currentTime = new Date().getTime();
        if (currentTime - startTime > 10) {
            break;
        }
    }

    requestAnimationFrame(renderLoop);
}

function createRenderTask(id: string, page: Page, callback: () => void) {
    let renderTask = renderQueue.find(renderTask => renderTask.id == id);

    if (!renderTask) {
        renderTask = new RenderTask(id, page);
        renderQueue.push(renderTask);
    }

    renderTask.addCallback(callback);
}

renderLoop();

////////////////////////////////////////////////////////////////////////////////

function drawPageFromCache(ctx: CanvasRenderingContext2D, page: Page, callback: () => void) {
    let id = getCacheId(page);
    let canvas = cacheMap.get(id);
    if (canvas) {
        ctx.drawImage(canvas, 0, 0);
    } else {
        createRenderTask(id, page, callback);
    }
}

function drawPageNode(
    node: TreeNode,
    ctx: CanvasRenderingContext2D,
    scale: number,
    callback: () => void
) {
    let storyboardPage = node.item.object as StoryboardPage;
    let page = node.custom.page;

    ctx.save();

    let DISTANCE_BETWEEN_TITLE_AND_PAGE = 8;

    ctx.translate(node.rect.left, node.rect.top - DISTANCE_BETWEEN_TITLE_AND_PAGE);

    ctx.font = TITLE_FONT;
    let tm = ctx.measureText(storyboardPage.page);

    if (page) {
        ctx.fillStyle = "black";
    } else {
        ctx.fillStyle = "red";
    }

    ctx.fillText(storyboardPage.page, (node.rect.width - tm.width) / 2, 0);

    ctx.translate(0, DISTANCE_BETWEEN_TITLE_AND_PAGE);

    if (page) {
        drawPageFrame(ctx, page, scale, page.style);
        drawPageFromCache(ctx, node.custom.page, callback);
    } else {
        drawNotFoundPageFrame(
            ctx,
            {
                left: 0,
                top: 0,
                width: node.rect.width,
                height: node.rect.height
            },
            scale
        );
    }

    ctx.restore();
}

////////////////////////////////////////////////////////////////////////////////

class StoryboardLineConnecting implements LineConnecting {
    private source: TreeNode;
    private target: TreeNode | undefined;
    private targetPoint: Point;

    constructor(source: TreeNode, p: Point) {
        this.source = source;
    }

    move(target: TreeNode, p: Point) {
        console.log(target && target.custom);
        if (target && target.custom && target.custom.page) {
            this.target = target;
        } else {
            this.target = undefined;
        }
        this.targetPoint = p;
    }

    draw(ctx: CanvasRenderingContext2D, scale: number) {
        if (!this.targetPoint) {
            return;
        }

        ctx.lineWidth = 2 / scale;
        ctx.lineCap = "round";

        let p1: Point | undefined;
        let p2: Point | undefined;

        let sourceCenter = rectCenter(this.source.rect);

        if (this.target) {
            ctx.strokeStyle = "green";
            ctx.shadowColor = "lightgreen";
            ctx.shadowBlur = Math.max(5, Math.ceil(50 * scale));
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            if (this.source.item.object == this.target.item.object) {
                p1 = sourceCenter;
                p2 = this.targetPoint;
            } else {
                let targetCenter = rectCenter(this.target.rect);
                p1 = rectSegmentIntersection(this.source.rect, {
                    p1: sourceCenter,
                    p2: targetCenter
                });
                if (!p1) {
                    p1 = sourceCenter;
                }
                p2 = rectSegmentIntersection(this.target.rect, {
                    p1: targetCenter,
                    p2: sourceCenter
                });
                if (!p2) {
                    p2 = targetCenter;
                }
            }
        } else {
            ctx.strokeStyle = "darkred";

            p1 = rectSegmentIntersection(this.source.rect, {
                p1: sourceCenter,
                p2: this.targetPoint
            });
            if (!p1) {
                p1 = sourceCenter;
            }
            p2 = this.targetPoint;
        }

        // draw source rect
        ctx.beginPath();
        ctx.rect(
            this.source.rect.left,
            this.source.rect.top,
            this.source.rect.width,
            this.source.rect.height
        );
        ctx.stroke();

        if (this.target) {
            // draw target rect
            ctx.beginPath();
            ctx.rect(
                this.target.rect.left,
                this.target.rect.top,
                this.target.rect.width,
                this.target.rect.height
            );
            ctx.stroke();
        }

        // draw line
        ctx.beginPath();

        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        var headlen = 10 / scale; // length of head in pixels
        var angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.lineTo(
            p2.x - headlen * Math.cos(angle - Math.PI / 6),
            p2.y - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
            p2.x - headlen * Math.cos(angle + Math.PI / 6),
            p2.y - headlen * Math.sin(angle + Math.PI / 6)
        );

        ctx.stroke();
    }

    commit() {
        if (this.target) {
            let storyboard = getAncestorOfType(
                this.source.item.object,
                Storyboard.classInfo
            ) as Storyboard;
            let storyboardLines = storyboard.lines;

            let line = {
                source: {
                    page: (this.source.item.object as StoryboardPage).page
                },
                target: {
                    page: (this.target.item.object as StoryboardPage).page
                }
            };
            let lineObject = loadObject(storyboardLines, line, StoryboardLine);

            ProjectStore.addObject(storyboardLines, lineObject);
        }
    }
}

function startLineConnecting(node: TreeNode, p: Point): LineConnecting {
    return new StoryboardLineConnecting(node, p);
}

////////////////////////////////////////////////////////////////////////////////

function lineHitTest(node: TreeNode, p: Point): boolean {
    return (
        pointSegmentDistance(p, {
            p1: node.custom.p1,
            p2: node.custom.p2
        }) < 10
    );
}

function drawLine(
    node: TreeNode,
    ctx: CanvasRenderingContext2D,
    scale: number,
    callback: () => void
) {
    let source = node.custom.source;
    let target = node.custom.target;

    if (!source || !target || source == target) {
        return;
    }

    let sourceCenter = rectCenter(source.rect);
    let targetCenter = rectCenter(target.rect);
    let p1 = rectSegmentIntersection(source.rect, { p1: sourceCenter, p2: targetCenter });
    let p2 = rectSegmentIntersection(target.rect, { p1: targetCenter, p2: sourceCenter });

    if (p1 && p2) {
        // draw line
        ctx.beginPath();

        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        var headlen = 10 / scale; // length of head in pixels
        var angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

        ctx.lineTo(
            p2.x - headlen * Math.cos(angle - Math.PI / 6),
            p2.y - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(
            p2.x - headlen * Math.cos(angle + Math.PI / 6),
            p2.y - headlen * Math.sin(angle + Math.PI / 6)
        );

        ctx.lineWidth = 2 / scale;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#666";
        ctx.stroke();
    }

    node.custom.p1 = p1;
    node.custom.p2 = p2;
}

function drawSelectedLineDecoration(node: TreeNode, ctx: CanvasRenderingContext2D, scale: number) {
    let p1 = node.custom.p1;
    let p2 = node.custom.p2;

    ctx.beginPath();

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);

    var headlen = 10 / scale; // length of head in pixels
    var angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    ctx.lineTo(
        p2.x - headlen * Math.cos(angle - Math.PI / 6),
        p2.y - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(
        p2.x - headlen * Math.cos(angle + Math.PI / 6),
        p2.y - headlen * Math.sin(angle + Math.PI / 6)
    );

    ctx.lineWidth = 4 / scale;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(51, 122, 183, 0.5)";
    ctx.stroke();
}

////////////////////////////////////////////////////////////////////////////////

@observer
class StoryboardCanvasEditor extends CanvasEditor {
    constructor(props: CanvasEditorProps) {
        super(
            props,
            UIStateStore.getFeatureParam<CanvasEditorUIState>(
                "gui",
                "StoryboardCanvasEditor",
                new CanvasEditorUIState(0.5)
            ),
            0.5
        );
    }

    createTree(): TreeNode {
        let tree: TreeNode = {
            parent: null,
            children: null,

            rect: null,
            selected: false,
            resizable: false,
            movable: false,
            selectable: false,

            item: this.props.displaySelection,
            custom: {},

            draw: () => {}
        } as any;

        // pages
        let pageNodes: TreeNode[] = [];

        _each(
            (this.props.displaySelection.children as DisplayItemChildrenObject)["pages"].children,
            (storyboardPageItem: any) => {
                let storyboardPage = storyboardPageItem.object as StoryboardPage;
                let page = findPage(storyboardPage.page);

                pageNodes.push({
                    parent: tree,
                    children: [],

                    rect: {
                        left: storyboardPage.x,
                        top: storyboardPage.y,
                        width: page ? page.width : 480,
                        height: page ? page.height : 272
                    },
                    selected: storyboardPageItem.selected,
                    resizable: false,
                    movable: true,
                    selectable: true,

                    item: storyboardPageItem,

                    custom: {
                        page
                    },

                    draw: drawPageNode,
                    startLineConnecting: startLineConnecting
                });
            }
        );

        // lines
        let lineNodes: TreeNode[] = [];
        _each(
            (this.props.displaySelection.children as DisplayItemChildrenObject)["lines"].children,
            (storyboardLineItem: any) => {
                function findPageNode(page: string) {
                    return pageNodes.find(node => {
                        return (node.item.object as StoryboardPage).page == page;
                    });
                }

                let storyboardLine = storyboardLineItem.object as StoryboardLine;

                let source = findPageNode(storyboardLine.source.page);
                let target = findPageNode(storyboardLine.target.page);

                if (source && target && source != target) {
                    lineNodes.push({
                        parent: tree,
                        children: [],

                        rect: { left: 0, top: 0, width: 0, height: 0 },
                        selected: false,
                        resizable: false,
                        movable: false,
                        selectable: true,

                        item: storyboardLineItem,

                        custom: {
                            source: source,
                            target: target
                        },

                        hitTest: lineHitTest,
                        draw: drawLine,
                        drawSelectedDecoration: drawSelectedLineDecoration
                    });
                }
            }
        );

        tree.children = pageNodes.concat(lineNodes);

        return tree;
    }

    getItemsInsideRect(r: Rect) {
        return this.tree.children
            .filter((node: TreeNode) => {
                return node.rect && rectContains(r, node.rect);
            })
            .map((node: TreeNode) => node.item);
    }

    hitTestFilter(nodes: TreeNode[]): TreeNode[] {
        return nodes;
    }

    findSnapLinesFilter(node: TreeNode): boolean {
        return true;
    }

    selectAllItems() {
        this.replaceSelection((this.props.displaySelection.children as DisplayItemChildrenObject)[
            "pages"
        ].children as DisplayItemChildrenArray);
    }

    onNodeDoubleClicked(node: TreeNode) {
        if (node.custom.page) {
            EditorsStore.makeActiveEditorPermanent();
            EditorsStore.openPermanentEditor(node.custom.page);
        }
    }

    dropItem: TreeNode | undefined;

    onDragEnter(event: any) {
        let data = getEezStudioDataFromDragEvent(event);
        const object = data && data.object;
        if (object) {
            if (
                isObjectInstanceOf(object, StoryboardPage.classInfo) &&
                event.dataTransfer.effectAllowed == "copy"
            ) {
                event.preventDefault();
                event.stopPropagation();

                let p = this.mouseToDocument(event.nativeEvent);

                this.props.displaySelection.selectItems([]);

                let storyboardPage = object as StoryboardPage;

                let page = findPage(storyboardPage.page);

                let rect = {
                    left: Math.round(p.x),
                    top: Math.round(p.y),
                    width: page ? page.width : 480,
                    height: page ? page.height : 272
                };

                setTimeout(() => {
                    this.dropItem = {
                        parent: this.tree,
                        children: [],

                        rect: rect,
                        selected: true,
                        selectable: true,
                        movable: true,
                        resizable: true,

                        item: {
                            object: object,
                            selected: true,
                            children: []
                        },

                        custom: {
                            page
                        },

                        draw: drawPageNode,
                        startLineConnecting: startLineConnecting
                    };

                    this.tree.children.push(this.dropItem);

                    this.redraw();
                });
            }
        }
    }

    onDragOverRequestAnimationFrameId: any;

    onDragOver(event: any) {
        if (this.dropItem) {
            event.preventDefault();
            event.stopPropagation();

            let p = this.mouseToDocument(event.nativeEvent);

            this.dropItem.rect.left = Math.round(p.x);
            this.dropItem.rect.top = Math.round(p.y);

            this.redraw();
        }
    }

    @action
    onDrop(event: any) {
        if (this.dropItem) {
            let dropItemObj = this.dropItem.item.object as StoryboardPage;

            dropItemObj.x = this.dropItem.rect.left;
            dropItemObj.y = this.dropItem.rect.top;

            ProjectStore.addObject(
                (this.props.displaySelection.object as Storyboard).pages,
                dropItemObj
            );
        }
    }

    onDragLeave(event: any) {
        if (this.dropItem) {
            this.tree.children.splice(this.tree.children.indexOf(this.dropItem), 1);
            this.dropItem = undefined;
            this.redraw();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class StoryboardEditor extends EditorComponent {
    canvasEditor: CanvasEditor;

    get storyboard(): Storyboard {
        return getAncestorOfType(this.props.editor.object, Storyboard.classInfo) as Storyboard;
    }

    get storyboardPages() {
        return this.storyboard && (this.storyboard as Storyboard).pages;
    }

    getMissingPages() {
        return getPages()._array.filter(page => {
            let storyboardPages = this.storyboardPages;
            if (storyboardPages) {
                return !storyboardPages._array.find(storyboardPage => {
                    return (storyboardPage as StoryboardPage).page == page.name;
                });
            } else {
                return false;
            }
        });
    }

    render() {
        let storyboardTabState = this.props.editor.state as StoryboardTabState;

        return (
            <Splitter
                type="horizontal"
                persistId="project-editor/storyboard"
                sizes={`100%|240px`}
                className="EezStudio_ProjectEditor_storyboard-editor"
            >
                <Panel
                    id="storyboard-editor"
                    title="Storyboard"
                    body={
                        <StoryboardCanvasEditor
                            displaySelection={storyboardTabState.storyboardAdapter}
                            pageWidth={0}
                            pageHeight={0}
                        />
                    }
                />
                <Panel
                    id="pages-palette"
                    title="Pages Palette"
                    body={<PagesPalette storyboard={this.storyboard} />}
                />
            </Splitter>
        );
    }
}

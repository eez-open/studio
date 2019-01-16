import React from "react";
import { observable, computed, action, toJS } from "mobx";
import { observer, inject, Provider } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
import { bind } from "bind-decorator";

import { _range } from "eez-studio-shared/algorithm";
import { Point, Rect, ITransform, pointInRect, isRectInsideRect } from "eez-studio-shared/geometry";

import { SvgLabel } from "eez-studio-ui/svg-label";
import {
    IBaseObject,
    IDocument,
    IViewStatePersistantState,
    IDesignerContext
} from "eez-studio-designer/designer-interfaces";
import { DesignerContext } from "eez-studio-designer/context";
import { Canvas } from "eez-studio-designer/canvas";
import { selectToolHandler } from "eez-studio-designer/select-tool";
import styled from "eez-studio-ui/styled-components";

import { EezObject, isObjectInstanceOf, isAncestor } from "eez-studio-shared/model/object";
import {
    DocumentStore,
    NavigationStore,
    deleteItems,
    UndoManager,
    UIStateStore,
    UIElementsFactory
} from "eez-studio-shared/model/store";
import { DragAndDropManager } from "eez-studio-shared/model/dd";

import { INode } from "eez-studio-shared/snap-lines";
import { SnapLines } from "eez-studio-designer/select-tool";

import { PageContext } from "eez-studio-page-editor/context";
import { Page } from "eez-studio-page-editor/page";
import {
    Widget,
    ContainerWidget,
    ListWidget,
    GridWidget,
    SelectWidget,
    SelectWidgetEditor,
    WidgetContainerDisplayItem
} from "eez-studio-page-editor/widget";
import { createWidgetTree, drawTree } from "eez-studio-page-editor/widget-tree";

////////////////////////////////////////////////////////////////////////////////

const SELECT_WIDGET_LINES_COLOR = "rgba(255, 128, 128, 0.9)";

type Position = "left" | "right" | "top" | "bottom";

////////////////////////////////////////////////////////////////////////////////

function findSelectWidgetEditors(rootObject: Widget | Page) {
    const result: SelectWidgetEditor[] = [];

    function doFind(object: Widget | Page) {
        if (!(object instanceof Widget) || object instanceof ContainerWidget) {
            object.widgets._array.forEach(doFind);
        } else if (object instanceof ListWidget || object instanceof GridWidget) {
            if (object.itemWidget) {
                doFind(object.itemWidget);
            }
        } else if (object instanceof SelectWidget) {
            result.push(object.editor);
            object.widgets._array.forEach(doFind);
        }
    }

    doFind(rootObject);

    return result;
}

////////////////////////////////////////////////////////////////////////////////

class EditorObject implements IBaseObject {
    parent: EditorObject;

    constructor(
        public object: EezObject,
        private pageEditorContext: PageEditorContext,
        private transformer: ITransformer<EezObject, EditorObject>
    ) {}

    get id() {
        return this.object._id;
    }

    @computed
    get rect() {
        if (this.object instanceof Widget || this.object instanceof Page) {
            return {
                left: this.object.x,
                top: this.object.y,
                width: this.object.width,
                height: this.object.height
            };
        } else if (this.object instanceof SelectWidgetEditor) {
            return this.object.rect;
        } else {
            console.error("Unknown object type");
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }
    }

    set rect(value: Rect) {
        if (this.object instanceof Widget) {
            this.object.applyGeometryChange(
                {
                    x: value.left,
                    y: value.top,
                    width: value.width,
                    height: value.height
                },
                []
            );
        } else if (this.object instanceof Page) {
            DocumentStore.updateObject(this.object, {
                x: value.left,
                y: value.top,
                width: value.width,
                height: value.height
            });
        } else if (this.object instanceof SelectWidgetEditor) {
            DocumentStore.updateObject(this.object, {
                x: value.left + Math.round(this.rect.width / 2),
                y: value.top + Math.round(this.rect.height / 2)
            });
        } else {
            console.error("Unknown object type");
        }
    }

    @computed
    get children(): EditorObject[] {
        let childrenObjects: EezObject[] | undefined;

        if (this.object instanceof ContainerWidget) {
            childrenObjects = (this.object as ContainerWidget).widgets._array;
        } else if (this.object instanceof ListWidget || this.object instanceof GridWidget) {
            if (this.object.itemWidget) {
                childrenObjects = [this.object.itemWidget];
            }
        } else if (this.object instanceof SelectWidget) {
            childrenObjects = this.object.widgets._array;
        } else if (this.object instanceof SelectWidgetEditor) {
            childrenObjects = (this.object.parent! as SelectWidget).widgets._array;
        } else if (this.object instanceof Page) {
            childrenObjects = this.object.widgets._array;

            if (this.pageEditorContext.dragWidget) {
                childrenObjects = [...childrenObjects, this.pageEditorContext.dragWidget];
            }

            if (this.pageEditorContext.options.showStructure) {
                childrenObjects = childrenObjects.concat(findSelectWidgetEditors(this.object));
            }
        }

        return childrenObjects
            ? childrenObjects.map(object => {
                  const child = this.transformer(object);
                  child.parent = this;
                  return child;
              })
            : [];
    }

    @computed
    get boundingRect() {
        if (this.object instanceof Widget) {
            const rect = {
                left: this.object.x,
                top: this.object.y,
                width: this.object.width,
                height: this.object.height
            };

            let object: Widget = this.object;

            while (true) {
                let parent = object.parent;

                if (this.pageEditorContext.options.showStructure) {
                    if (parent instanceof SelectWidget) {
                        let i = parent.widgets._array.indexOf(object);

                        rect.left += parent.editor.rect.left + SelectWidgetEditor.EDITOR_PADDING;
                        rect.top +=
                            parent.editor.rect.top +
                            SelectWidgetEditor.EDITOR_PADDING +
                            i * (parent.height + SelectWidgetEditor.EDITOR_PADDING);

                        break;
                    }
                }

                rect.left += parent.x;
                rect.top += parent.y;

                if (!(parent instanceof Widget)) {
                    break;
                }

                object = parent;
            }

            return rect;
        } else if (this.object instanceof Page) {
            return this.rect;
        } else if (this.object instanceof SelectWidgetEditor) {
            return this.object.rect;
        } else {
            console.error("Unknown object type");
            return {
                left: 0,
                top: 0,
                width: 0,
                height: 0
            };
        }
    }

    @computed
    get selectionRects() {
        if (this.object instanceof Widget) {
            let rects = [this.boundingRect];

            let listWidget = this.object._parent;
            while (
                !(listWidget instanceof ListWidget || listWidget instanceof GridWidget) &&
                listWidget instanceof Widget
            ) {
                listWidget = listWidget._parent;
            }

            if (!(listWidget instanceof ListWidget || listWidget instanceof GridWidget)) {
                return rects;
            }

            const itemWidget = listWidget.itemWidget;
            if (itemWidget) {
                let count = listWidget.data ? PageContext.data.count(listWidget.data) : 0;

                if (listWidget instanceof ListWidget) {
                    for (let i = 1; i < count; i++) {
                        if (listWidget.listType === "horizontal") {
                            rects.push({
                                left: this.boundingRect.left + i * itemWidget.width,
                                top: this.boundingRect.top,
                                width: this.boundingRect.width,
                                height: this.boundingRect.height
                            });
                        } else {
                            rects.push({
                                left: this.boundingRect.left,
                                top: this.boundingRect.top + i * itemWidget.height,
                                width: this.boundingRect.width,
                                height: this.boundingRect.height
                            });
                        }
                    }
                } else {
                    const rows = Math.floor(listWidget.width / itemWidget.width);
                    const cols = Math.floor(listWidget.height / itemWidget.height);
                    for (let i = 1; i < count; i++) {
                        const row = i % rows;
                        const col = Math.floor(i / rows);

                        if (col >= cols) {
                            break;
                        }

                        rects.push({
                            left: this.boundingRect.left + row * itemWidget.width,
                            top: this.boundingRect.top + col * itemWidget.height,
                            width: this.boundingRect.width,
                            height: this.boundingRect.height
                        });
                    }
                }
            }

            return rects;
        } else if (this.object instanceof Page) {
            return [this.rect];
        } else if (this.object instanceof SelectWidgetEditor) {
            return [this.rect];
        } else {
            console.error("Unknown object type");
            return [];
        }
    }

    get isSelectable() {
        if (this.object instanceof Page) {
            return false;
        } else {
            return true;
        }
    }

    get isResizable() {
        if (this.object instanceof Page) {
            return false;
        } else {
            return true;
        }
    }

    open() {}

    findObjectById(id: string): EditorObject | undefined {
        if (this.id === id) {
            return this;
        }

        for (const child of this.children) {
            const object = child && child.findObjectById(id);
            if (object) {
                return object;
            }
        }

        return undefined;
    }

    objectFromPoint(point: Point): EditorObject | undefined {
        let foundObject: EditorObject | undefined = undefined;

        if (this.children.length > 0) {
            if (
                !this.pageEditorContext.options.showStructure &&
                this.object instanceof SelectWidget
            ) {
                const child = this.children[this.selectedIndexInSelectWidget];
                let result = child.objectFromPoint(point);
                if (result) {
                    foundObject = result;
                }
            } else {
                for (const child of this.children) {
                    let result = child.objectFromPoint(point);
                    if (result) {
                        foundObject = result;
                    }
                }
            }
        }

        if (foundObject) {
            return foundObject;
        }

        for (let i = 0; i < this.selectionRects.length; i++) {
            if (pointInRect(point, this.selectionRects[i])) {
                return this;
            }
        }

        return undefined;
    }

    @computed
    get selectedIndexInSelectWidget() {
        const selectWidget = this.object as SelectWidget;

        const selectedObjects = this.pageEditorContext.viewState.selectedObjects;
        for (let i = 0; i < selectWidget.widgets._array.length; ++i) {
            if (
                selectedObjects.find((selectedObject: EditorObject) =>
                    isAncestor(selectedObject.object, selectWidget.widgets._array[i])
                )
            ) {
                return i;
            }
        }

        if (selectWidget.data) {
            let index: number = PageContext.data.getEnumValue(selectWidget.data);
            if (index >= 0 && index < selectWidget.widgets._array.length) {
                return index;
            }
        }

        if (selectWidget.widgets._array.length > 0) {
            return 0;
        }

        return -1;
    }

    // Return first ancestor which object type is:
    //   - Page
    //   - Widget, if that ancestor parent is SelectWidget
    get anchorParent() {
        let anchor: EditorObject = this;

        while (true) {
            let parent = anchor.parent;

            if (!parent) {
                return anchor;
            }

            if (!(parent.object instanceof Widget)) {
                return parent;
            }

            if (parent.object instanceof SelectWidget) {
                return anchor;
            }

            anchor = parent;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function createObjectToEditorObjectTransformer(designerContext: PageEditorContext) {
    const transformer = createTransformer(
        (object: EezObject): EditorObject => {
            return new EditorObject(object, designerContext, transformer);
        }
    );
    return transformer;
}

////////////////////////////////////////////////////////////////////////////////

@inject("designerContext")
@observer
class ObjectComponent extends React.Component<{
    designerContext?: IDesignerContext;
    object: EditorObject;
}> {
    renderChildren(children: EditorObject[]) {
        return (
            <div
                style={{
                    transform: `translate(${this.props.object.rect.left}px, ${
                        this.props.object.rect.top
                    }px)`,
                    transformOrigin: "0 0"
                }}
            >
                {children.map((child, i) => {
                    return <ObjectComponent key={child.id} object={child} />;
                })}
            </div>
        );
    }

    renderBackgroundRect() {
        const rect = this.props.object.rect;
        const widget = this.props.object.object as Widget;
        const style = PageContext.findStyleOrGetDefault(widget.style);

        return (
            <div
                style={{
                    position: "absolute",
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: style.backgroundColor
                }}
            />
        );
    }

    get listWidget() {
        return this.props.object.object as ListWidget;
    }

    get listItemWidget() {
        return this.listWidget.itemWidget;
    }

    get listItemsCount() {
        if (this.listItemWidget && this.listWidget.data) {
            return PageContext.data.count(this.listWidget.data);
        } else {
            return 0;
        }
    }

    @action
    renderListItems() {
        const itemWidgetEditorObject = this.props.object.children[0];
        if (!itemWidgetEditorObject) {
            return null;
        }

        const itemRect = itemWidgetEditorObject.rect;

        return _range(this.listItemsCount).map(i => {
            let xListItem = this.props.object.rect.left;
            let yListItem = this.props.object.rect.top;

            if (this.listWidget.listType === "horizontal") {
                xListItem += i * itemRect.width;
            } else {
                yListItem += i * itemRect.height;
            }

            return (
                <div
                    key={i}
                    style={{
                        transform: `translate(${xListItem}px, ${yListItem}px)`,
                        transformOrigin: "0 0"
                    }}
                >
                    {<ObjectComponent object={itemWidgetEditorObject} />}
                </div>
            );
        });
    }

    get gridWidget() {
        return this.props.object.object as GridWidget;
    }

    get gridItemWidget() {
        return this.gridWidget.itemWidget;
    }

    get gridItemsCount() {
        if (this.gridItemWidget && this.gridWidget.data) {
            return PageContext.data.count(this.gridWidget.data);
        } else {
            return 0;
        }
    }

    @action
    renderGridItems() {
        const itemWidgetEditorObject = this.props.object.children[0];
        if (!itemWidgetEditorObject) {
            return null;
        }

        const gridRect = this.props.object.rect;
        const itemRect = itemWidgetEditorObject.rect;

        return _range(this.gridItemsCount)
            .map(i => {
                const rows = Math.floor(gridRect.width / itemRect.width);
                const cols = Math.floor(gridRect.height / itemRect.height);

                const row = i % rows;
                const col = Math.floor(i / rows);

                if (col >= cols) {
                    return undefined;
                }

                let xListItem = gridRect.left + row * itemRect.width;
                let yListItem = gridRect.top + col * itemRect.height;

                return (
                    <div
                        key={i}
                        style={{
                            transform: `translate(${xListItem}px, ${yListItem}px)`,
                            transformOrigin: "0 0"
                        }}
                    >
                        {<ObjectComponent object={itemWidgetEditorObject} />}
                    </div>
                );
            })
            .filter(item => !!item);
    }

    getChildOffsetX(child: EezObject) {
        return SelectWidgetEditor.EDITOR_PADDING;
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

        const selectWidget = this.props.object.parent;

        const anchorBoundingRect = selectWidget.anchorParent.boundingRect;
        const selectWidgetBoundingRect = selectWidget.boundingRect;

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

        const selectWidgetEditor = this.props.object.object as SelectWidgetEditor;
        const selectWidget = this.props.object.parent;

        if (selectWidgetEditor.x < selectWidget.boundingRect.left) {
            positions.push("left");
        }
        if (selectWidgetEditor.y < selectWidget.boundingRect.top) {
            positions.push("top");
        }
        if (
            selectWidgetEditor.x >
            selectWidget.boundingRect.left + selectWidget.boundingRect.width
        ) {
            positions.push("right");
        }
        if (
            selectWidgetEditor.y >
            selectWidget.boundingRect.top + selectWidget.boundingRect.height
        ) {
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

        const dx =
            selectWidgetEditor.x -
            (selectWidget.boundingRect.left + selectWidget.boundingRect.width / 2);
        const dy =
            selectWidgetEditor.y -
            (selectWidget.boundingRect.top + selectWidget.boundingRect.height / 2);
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

    @action
    renderSelectChildren() {
        const selectWidget = this.props.object.object._parent! as SelectWidget;

        return this.props.object.children.map((child, i) => {
            let x = this.props.object.rect.left + SelectWidgetEditor.EDITOR_PADDING;
            let y =
                this.props.object.rect.top +
                SelectWidgetEditor.EDITOR_PADDING +
                i * (selectWidget.height + SelectWidgetEditor.EDITOR_PADDING);

            let xLabel =
                this.relativePosition === "left"
                    ? this.props.object.boundingRect.left +
                      this.props.object.boundingRect.width +
                      SelectWidgetEditor.EDITOR_PADDING
                    : this.props.object.boundingRect.left - SelectWidgetEditor.EDITOR_PADDING;
            let yLabel = y + selectWidget.height / 2;
            let textAnchor = this.relativePosition === "left" ? "begin" : "end";

            let label = selectWidget.getChildLabel(child.object as Widget);

            const transform = this.props.designerContext!.viewState.transform;
            const modelRect = transform.clientToModelRect(transform.clientRect);

            return (
                <React.Fragment key={child.id}>
                    <svg
                        width={modelRect.width}
                        height={modelRect.height}
                        style={{
                            position: "absolute",
                            left: modelRect.left,
                            top: modelRect.top
                        }}
                        viewBox={`${modelRect.left}, ${modelRect.top}, ${modelRect.width}, ${
                            modelRect.height
                        }`}
                    >
                        <text
                            x={xLabel}
                            y={yLabel}
                            textAnchor={textAnchor}
                            alignmentBaseline="middle"
                        >
                            {label}
                        </text>
                        <g transform={`translate(${x} ${y})`}>
                            <rect
                                x={1}
                                y={1}
                                width={selectWidget.width - 2}
                                height={selectWidget.height - 2}
                                fill="transparent"
                                stroke={SELECT_WIDGET_LINES_COLOR}
                                strokeDasharray="4 2"
                                strokeWidth="1"
                            />
                        </g>
                    </svg>
                    <div
                        style={{
                            transform: `translate(${x}px, ${y}px)`,
                            transformOrigin: "0 0"
                        }}
                    >
                        <ObjectComponent object={this.props.object.children[i]} />
                    </div>
                </React.Fragment>
            );
        });
    }

    render() {
        if (this.props.object.object instanceof ContainerWidget) {
            return this.renderChildren(this.props.object.children);
        } else if (this.props.object.object instanceof ListWidget) {
            return (
                <React.Fragment>
                    {this.renderBackgroundRect()}
                    {this.renderListItems()}
                </React.Fragment>
            );
        } else if (this.props.object.object instanceof GridWidget) {
            return (
                <React.Fragment>
                    {this.renderBackgroundRect()}
                    {this.renderGridItems()}
                </React.Fragment>
            );
        } else if (this.props.object.object instanceof SelectWidget) {
            const selectedChild = this.props.object.children[
                this.props.object.selectedIndexInSelectWidget
            ];

            if (this.props.designerContext!.options.showStructure) {
                let canvas = document.createElement("canvas");

                const rect = this.props.object.rect;

                canvas.width = rect.width;
                canvas.height = rect.height;

                let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

                let tree = createWidgetTree(selectedChild.object, true);
                drawTree(ctx, tree, 1, () => {});

                return (
                    <img
                        style={{
                            position: "absolute",
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            imageRendering: "pixelated"
                        }}
                        src={canvas.toDataURL()}
                    />
                );
            } else if (selectedChild) {
                return this.renderChildren([selectedChild]);
            } else {
                return null;
            }
        } else if (this.props.object.object instanceof Widget) {
            const rect = this.props.object.rect;

            const canvas = this.props.object.object.draw(rect);
            if (canvas) {
                return (
                    <img
                        style={{
                            position: "absolute",
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height,
                            imageRendering: "pixelated"
                        }}
                        src={canvas.toDataURL()}
                    />
                );
            }

            const node = this.props.object.object.render();
            if (node) {
                return (
                    <div
                        style={{
                            position: "absolute",
                            left: rect.left,
                            top: rect.top,
                            width: rect.width,
                            height: rect.height
                        }}
                    >
                        {node}
                    </div>
                );
            }

            return this.renderBackgroundRect();
        } else if (this.props.object.object instanceof Page) {
            return (
                <React.Fragment>
                    {this.props.object.object.render()}
                    {this.renderChildren(this.props.object.children)}
                </React.Fragment>
            );
        } else if (this.props.object.object instanceof SelectWidgetEditor) {
            const selectWidget = this.props.object.parent;

            const boundingRect = this.props.object.boundingRect;

            let x1: number;
            let y1: number;
            let x2: number;
            let y2: number;

            if (this.relativePosition === "left") {
                x1 = selectWidget.boundingRect.left;
                y1 = selectWidget.boundingRect.top + selectWidget.boundingRect.height / 2;

                x2 = boundingRect.left + boundingRect.width;
                y2 = boundingRect.top + boundingRect.height / 2;
            } else if (this.relativePosition === "right") {
                x1 = selectWidget.boundingRect.left + selectWidget.boundingRect.width;
                y1 = selectWidget.boundingRect.top + selectWidget.boundingRect.height / 2;

                x2 = boundingRect.left;
                y2 = boundingRect.top + boundingRect.height / 2;
            } else if (this.relativePosition === "top") {
                x1 = selectWidget.boundingRect.left + selectWidget.boundingRect.width / 2;
                y1 = selectWidget.boundingRect.top;

                x2 = boundingRect.left + boundingRect.width / 2;
                y2 = boundingRect.top + boundingRect.height;
            } else {
                x1 = selectWidget.boundingRect.left + selectWidget.boundingRect.width / 2;
                y1 = selectWidget.boundingRect.top + selectWidget.boundingRect.height;

                x2 = boundingRect.left + boundingRect.width / 2;
                y2 = boundingRect.top;
            }

            let c1x;
            let c1y;
            let c2x;
            let c2y;

            const K = 0.8;

            if (this.relativePosition === "left" || this.relativePosition === "right") {
                c1x = x1 + (x2 - x1) * K;
                c1y = y1;
                c2x = x2 - (x2 - x1) * K;
                c2y = y2;
            } else {
                c1x = x1;
                c1y = y1 + (y2 - y1) * K;
                c2x = x2;
                c2y = y2 - (y2 - y1) * K;
            }

            const label = (selectWidget.object as Widget).data;

            const transform = this.props.designerContext!.viewState.transform;
            const modelRect = transform.clientToModelRect(transform.clientRect);

            return (
                <React.Fragment>
                    <svg
                        width={modelRect.width}
                        height={modelRect.height}
                        style={{
                            position: "absolute",
                            left: modelRect.left,
                            top: modelRect.top
                        }}
                        viewBox={`${modelRect.left}, ${modelRect.top}, ${modelRect.width}, ${
                            modelRect.height
                        }`}
                    >
                        <rect
                            x={selectWidget.boundingRect.left + 0.5}
                            y={selectWidget.boundingRect.top + 0.5}
                            width={selectWidget.boundingRect.width}
                            height={selectWidget.boundingRect.height}
                            fill="transparent"
                            stroke={SELECT_WIDGET_LINES_COLOR}
                        />

                        <circle cx={x1} cy={y1} r={2} fill={SELECT_WIDGET_LINES_COLOR} />

                        <path
                            d={`M${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                            stroke={SELECT_WIDGET_LINES_COLOR}
                            fill="transparent"
                        />

                        <circle cx={x2} cy={y2} r={3} fill={SELECT_WIDGET_LINES_COLOR} />

                        {label && (
                            <SvgLabel
                                text={label}
                                x={Math.round((x1 + x2) / 2) + 0.5}
                                y={Math.round((y1 + y2) / 2) + 0.5}
                                horizontalAlignement="center"
                                verticalAlignment="center"
                                backgroundColor="white"
                                textColor="#333"
                                border={{
                                    color: SELECT_WIDGET_LINES_COLOR
                                }}
                            />
                        )}

                        <rect
                            x={boundingRect.left + 0.5}
                            y={boundingRect.top + 0.5}
                            width={boundingRect.width}
                            height={boundingRect.height}
                            fill="transparent"
                            stroke={SELECT_WIDGET_LINES_COLOR}
                        />
                    </svg>
                    {this.renderSelectChildren()}
                </React.Fragment>
            );
        } else {
            console.error("Unknown object type");
            return null;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable
    snapLines: SnapLines | undefined;

    pageEditorContext: PageEditorContext | undefined;
    dragWidget: Widget | undefined;

    start(pageEditorContext: PageEditorContext) {
        this.snapLines = new SnapLines();
        this.pageEditorContext = pageEditorContext;
        this.dragWidget = pageEditorContext.dragWidget;

        this.snapLines.find(
            pageEditorContext,
            (node: INode) => node.id !== pageEditorContext.dragWidget!._id
        );
    }

    clear() {
        this.snapLines = undefined;
        this.pageEditorContext = undefined;
        this.dragWidget = undefined;
    }
}

const dragSnapLines = new DragSnapLines();

@observer
class DragSnapLinesOverlay extends React.Component {
    get dragWidgetRect() {
        return {
            left: dragSnapLines.dragWidget!.x,
            top: dragSnapLines.dragWidget!.y,
            width: dragSnapLines.dragWidget!.width,
            height: dragSnapLines.dragWidget!.height
        };
    }

    render() {
        if (!dragSnapLines.snapLines) {
            return null;
        }

        return (
            dragSnapLines.snapLines && (
                <div style={{ left: 0, top: 0, pointerEvents: "none" }}>
                    {dragSnapLines.snapLines.render(
                        dragSnapLines.pageEditorContext!.viewState.transform,
                        this.dragWidgetRect
                    )}
                </div>
            )
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class PageEditorContext extends DesignerContext {
    @observable
    dragWidget: Widget | undefined;
}

////////////////////////////////////////////////////////////////////////////////

class PageDocument implements IDocument {
    rootObject: EditorObject;

    constructor(page: Page, pageEditorContext: PageEditorContext) {
        const transformer = createObjectToEditorObjectTransformer(pageEditorContext);
        this.rootObject = transformer(page);
    }

    get rootObjects() {
        return [this.rootObject];
    }

    findObjectById(id: string) {
        return this.rootObject.findObjectById(id);
    }

    createObject(params: any) {
        // TODO ???
    }

    deleteObjects(objects: EditorObject[]) {
        deleteItems(objects.map(editorObject => editorObject.object));
    }

    get boundingRect() {
        return this.rootObject.boundingRect;
    }

    objectFromPoint(point: Point) {
        return this.rootObject.objectFromPoint(point);
    }

    resetTransform(transform: ITransform) {
        const page = this.rootObject.object as Page;
        transform.translate = {
            x: -page.width / 2,
            y: -page.height / 2
        };
        transform.scale = 1;
    }

    getObjectsInsideRect(rect: Rect) {
        return this.rootObject.children.filter(object =>
            isRectInsideRect(object.boundingRect, rect)
        );
    }

    createContextMenu(objects: IBaseObject[]) {
        return UIElementsFactory.createMenu();
    }

    onDragStart(op: "move" | "resize"): void {
        UndoManager.setCombineCommands(true);
    }

    onDragEnd(op: "move" | "resize", changed: boolean, objects: IBaseObject[]): void {
        UndoManager.setCombineCommands(false);
    }
}

////////////////////////////////////////////////////////////////////////////////

const PageEditorCanvasContainer = styled.div`
    flex-grow: 1;
    overflow: hidden;
    display: flex;
    position: relative;

    .EezStudio_DesignerSelection_SelectedObject {
        border: 1px solid #333;
    }

    .EezStudio_DesignerSelection_BoundingRect {
        border: 2px solid black;
        background-color: rgba(255, 255, 255, 0.3);
    }

    .EezStudio_DesignerSelection_Handle.Side {
        background-color: rgba(0, 0, 0, 0.6);
    }

    .EezStudio_DesignerSelection_Handle.Corner {
        background-color: rgba(0, 0, 0, 0.6);
    }
`;

const PageEditorCanvas = styled(Canvas)`
    flex-grow: 1;
    position: relative;
`;

interface PageEditorProps {
    widgetContainer: WidgetContainerDisplayItem;
    showStructure?: boolean;
}

@observer
export class PageEditor extends React.Component<
    PageEditorProps,
    {
        hasError: boolean;
    }
> {
    pageEditorContext: PageEditorContext;

    constructor(props: PageEditorProps) {
        super(props);

        this.state = { hasError: false };

        this.pageEditorContext = new PageEditorContext();
    }

    @computed
    get selectedObject() {
        const selectedObject =
            this.pageEditorContext.viewState.selectedObjects.length === 1 &&
            this.pageEditorContext.viewState.selectedObjects[0];

        if (selectedObject) {
            return (selectedObject as EditorObject).object;
        }

        return undefined;
    }

    @bind
    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    @computed
    get viewStatePersistantState(): IViewStatePersistantState {
        const uiState = UIStateStore.getObjectUIState(this.props.widgetContainer.object);

        let transform: ITransform;
        if (uiState && uiState.pageEditorCanvasViewState) {
            transform = uiState.pageEditorCanvasViewState.transform;
        } else {
            transform = {
                translate: {
                    x: 0,
                    y: 0
                },
                scale: 1
            };
        }

        return {
            transform,
            selectedObjects: this.props.widgetContainer.selectedItems.map(item => item.object._id)
        };
    }

    @bind
    onSavePersistantState(viewState: IViewStatePersistantState) {
        if (!this.pageEditorContext.dragWidget) {
            UIStateStore.updateObjectUIState(this.props.widgetContainer.object, {
                pageEditorCanvasViewState: {
                    transform: viewState.transform
                }
            });

            this.props.widgetContainer.selectObjectIds(viewState.selectedObjects);
        }
    }

    getDragWidget(event: React.DragEvent) {
        if (
            DragAndDropManager.dragObject &&
            isObjectInstanceOf(DragAndDropManager.dragObject, Widget.classInfo) &&
            event.dataTransfer.effectAllowed === "copy"
        ) {
            return DragAndDropManager.dragObject as Widget;
        }
        return undefined;
    }

    @action.bound
    onDragOver(event: React.DragEvent) {
        const widget = this.getDragWidget(event);
        if (widget) {
            event.preventDefault();
            event.stopPropagation();

            const page = this.props.widgetContainer.object as Page;

            const widget = DragAndDropManager.dragObject as Widget;

            if (!this.pageEditorContext.dragWidget) {
                this.pageEditorContext.dragWidget = widget;
                this.pageEditorContext.dragWidget._parent = page.widgets;

                // select only dragWidget
                setTimeout(() => {
                    this.pageEditorContext.viewState.selectObjects([
                        this.pageEditorContext.document.findObjectById("WidgetPaletteItem")!
                    ]);
                });

                dragSnapLines.start(this.pageEditorContext);
            }

            dragSnapLines.snapLines!.enabled = !event.shiftKey;

            const transform = this.pageEditorContext.viewState.transform;

            const p = transform.clientToModelPoint({
                x: event.nativeEvent.clientX - (widget.width * transform.scale) / 2,
                y: event.nativeEvent.clientY - (widget.height * transform.scale) / 2
            });

            const { left, top } = dragSnapLines.snapLines!.dragSnap(
                p.x,
                p.y,
                widget.width,
                widget.height
            );

            widget.x = Math.round(left - page.x);
            widget.y = Math.round(top - page.y);
        }
    }

    @action.bound
    onDrop(event: React.DragEvent) {
        if (this.pageEditorContext.dragWidget) {
            const page = this.props.widgetContainer.object as Page;

            const object = DocumentStore.addObject(
                page.widgets,
                toJS(this.pageEditorContext.dragWidget)
            );

            this.pageEditorContext.dragWidget = undefined;
            dragSnapLines.clear();

            setTimeout(() => {
                const objectAdapter = this.pageEditorContext.document.findObjectById(object._id);
                if (objectAdapter) {
                    const viewState = this.pageEditorContext.viewState;
                    viewState.selectObjects([objectAdapter]);
                }
            }, 0);
        }
    }

    @action.bound
    onDragLeave(event: React.DragEvent) {
        if (this.pageEditorContext.dragWidget) {
            this.pageEditorContext.dragWidget = undefined;

            // deselect dragWidget
            this.pageEditorContext.viewState.deselectAllObjects();

            dragSnapLines.clear();
        }
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.keyCode == 46) {
            // delete
            this.props.widgetContainer.deleteSelection();
        }
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, info: any) {
        console.error(error, info);
    }

    componentWillUnmount() {
        this.pageEditorContext.destroy();
    }

    render() {
        if (this.state.hasError) {
            // TODO better error presentatin
            return <div>Error!</div>;
        }

        this.pageEditorContext.set(
            new PageDocument(this.props.widgetContainer.object as Page, this.pageEditorContext),
            this.viewStatePersistantState,
            this.onSavePersistantState,
            {
                center: {
                    x: 0,
                    y: 0
                },
                showStructure: this.props.showStructure || false
            }
        );

        return (
            <Provider designerContext={this.pageEditorContext}>
                <PageEditorCanvasContainer
                    tabIndex={0}
                    onFocus={this.focusHander}
                    onDragOver={this.onDragOver}
                    onDrop={this.onDrop}
                    onDragLeave={this.onDragLeave}
                    onKeyDown={this.onKeyDown}
                >
                    <PageEditorCanvas
                        toolHandler={selectToolHandler}
                        customOverlay={<DragSnapLinesOverlay />}
                    >
                        {this.pageEditorContext.document.rootObjects.map(
                            (rootObject: EditorObject) => (
                                <ObjectComponent key={rootObject.id} object={rootObject} />
                            )
                        )}
                    </PageEditorCanvas>
                </PageEditorCanvasContainer>
            </Provider>
        );
    }
}

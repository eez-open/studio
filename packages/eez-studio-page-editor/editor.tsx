import React from "react";
import { observable, computed, action, toJS } from "mobx";
import { observer, inject, IWrappedComponent } from "mobx-react";
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

import { EezObject, isObjectInstanceOf } from "eez-studio-shared/model/object";
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

function getObjectComponentClass(object: EezObject): typeof BaseObjectComponent {
    if (object instanceof SelectWidgetEditor) {
        return SelectWidgetEditorObjectComponent;
    } else if (object instanceof ContainerWidget) {
        return ContainerWidgetObjectComponent;
    } else if (object instanceof ListWidget) {
        return ListWidgetObjectComponent;
    } else if (object instanceof GridWidget) {
        return GridWidgetObjectComponent;
    } else if (object instanceof SelectWidget) {
        return SelectWidgetObjectComponent;
    } else {
        return WidgetObjectComponent;
    }
}

////////////////////////////////////////////////////////////////////////////////

abstract class BaseObjectComponent
    extends React.Component<{
        designerContext?: IDesignerContext;
        object: EezObject;
        dragWidget?: Widget;
    }>
    implements IBaseObject {
    children: BaseObjectComponent[] = [];

    abstract get rect(): Rect;
    abstract get boundingRect(): Rect;
    abstract get selectionRects(): Rect[];

    get isResizable() {
        return true;
    }

    get id() {
        return this.props.object._id;
    }

    findObjectById(id: string): IBaseObject | undefined {
        if (this.id === id) {
            return this;
        }

        for (const child of this.children) {
            const object = child.findObjectById(id);
            if (object) {
                return object;
            }
        }

        return undefined;
    }

    objectFromPoint(point: Point): BaseObjectComponent | undefined {
        let foundObject: BaseObjectComponent | undefined = undefined;

        for (const child of this.children) {
            let result = child.objectFromPoint(point);
            if (result) {
                foundObject = result;
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

    open() {}

    renderChildren(childrenObjects: EezObject[]) {
        this.children = new Array(childrenObjects.length);
        return (
            <div
                style={{
                    transform: `translate(${this.rect.left}px, ${this.rect.top}px)`,
                    transformOrigin: "0 0"
                }}
            >
                {childrenObjects.map((child, i) => {
                    const ChildObjectComponent = getObjectComponentClass(child);
                    return (
                        <ChildObjectComponent
                            ref={ref => {
                                if (ref) {
                                    // careful, ref could be ...
                                    if (ref instanceof BaseObjectComponent) {
                                        this.children[i] = ref;
                                    } else {
                                        // ... injector
                                        this.children[i] = (ref as IWrappedComponent<
                                            BaseObjectComponent
                                        >).wrappedInstance as BaseObjectComponent;
                                    }
                                }
                            }}
                            key={child._id}
                            object={child}
                        />
                    );
                })}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

abstract class BaseWidgetObjectComponent extends BaseObjectComponent {
    get widget() {
        return this.props.object as Widget;
    }

    @computed
    get rect() {
        return {
            left: this.widget.x,
            top: this.widget.y,
            width: this.widget.width,
            height: this.widget.height
        };
    }

    set rect(value: Rect) {
        this.widget.applyGeometryChange(
            {
                x: value.left,
                y: value.top,
                width: value.width,
                height: value.height
            },
            []
        );
    }

    @computed
    get boundingRect(): Rect {
        return this.widget.boundingRect;
    }

    @computed
    get selectionRects() {
        let rects = [this.boundingRect];

        let listWidget = this.widget._parent;
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
    }

    renderBackgroundRect() {
        const style = PageContext.findStyleOrGetDefault(this.widget.style);

        return (
            <div
                style={{
                    position: "absolute",
                    left: this.rect.left,
                    top: this.rect.top,
                    width: this.rect.width,
                    height: this.rect.height,
                    backgroundColor: style.backgroundColor
                }}
            />
        );
    }

    render(): React.ReactNode {
        const canvas = this.widget.draw(this.rect);
        if (canvas) {
            return (
                <img
                    style={{
                        position: "absolute",
                        left: this.rect.left,
                        top: this.rect.top,
                        width: this.rect.width,
                        height: this.rect.height,
                        imageRendering: "pixelated"
                    }}
                    src={canvas.toDataURL()}
                />
            );
        }

        const svg = this.widget.renderSvg();
        if (svg) {
            return (
                <svg
                    width={this.rect.width}
                    height={this.rect.height}
                    style={{
                        position: "absolute",
                        left: this.rect.left,
                        top: this.rect.top
                    }}
                >
                    {svg}
                </svg>
            );
        }

        const node = this.widget.render();
        if (node) {
            return (
                <div
                    style={{
                        position: "absolute",
                        left: this.rect.left,
                        top: this.rect.top,
                        width: this.rect.width,
                        height: this.rect.height
                    }}
                >
                    {node}
                </div>
            );
        }

        return this.renderBackgroundRect();
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class WidgetObjectComponent extends BaseWidgetObjectComponent {}

////////////////////////////////////////////////////////////////////////////////

@observer
class ContainerWidgetObjectComponent extends BaseWidgetObjectComponent {
    get containerWidget() {
        return this.widget as ContainerWidget;
    }

    render() {
        return this.renderChildren(this.containerWidget.widgets._array);
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ListWidgetObjectComponent extends BaseWidgetObjectComponent {
    get listWidget() {
        return this.widget as ListWidget;
    }

    get itemWidget() {
        return this.listWidget.itemWidget;
    }

    get count() {
        if (this.itemWidget && this.listWidget.data) {
            return PageContext.data.count(this.listWidget.data);
        } else {
            return 0;
        }
    }

    renderItems() {
        this.children = [];

        if (!this.itemWidget) {
            return null;
        }

        const itemWidget = this.itemWidget;
        const ItemWidgetComponent = getObjectComponentClass(this.itemWidget);

        return _range(this.count).map(i => {
            let xListItem = this.rect.left;
            let yListItem = this.rect.top;

            if (this.listWidget.listType === "horizontal") {
                xListItem += i * itemWidget.width;
            } else {
                yListItem += i * itemWidget.height;
            }

            return (
                <div
                    key={i}
                    style={{
                        transform: `translate(${xListItem}px, ${yListItem}px)`,
                        transformOrigin: "0 0"
                    }}
                >
                    {
                        <ItemWidgetComponent
                            ref={ref => {
                                if (i === 0 && ref) {
                                    this.children.push(ref);
                                }
                            }}
                            object={itemWidget}
                        />
                    }
                </div>
            );
        });
    }

    render() {
        return (
            <React.Fragment>
                {this.renderBackgroundRect()}
                {this.renderItems()}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GridWidgetObjectComponent extends BaseWidgetObjectComponent {
    get gridWidget() {
        return this.widget as GridWidget;
    }

    get itemWidget() {
        return this.gridWidget.itemWidget;
    }

    get count() {
        if (this.itemWidget && this.gridWidget.data) {
            return PageContext.data.count(this.gridWidget.data);
        } else {
            return 0;
        }
    }

    renderItems() {
        this.children = [];

        if (!this.itemWidget) {
            return null;
        }

        const itemWidget = this.itemWidget;
        const ItemWidgetComponent = getObjectComponentClass(this.itemWidget);

        return _range(this.count)
            .map(i => {
                const rows = Math.floor(this.rect.width / itemWidget.width);
                const cols = Math.floor(this.rect.height / itemWidget.height);

                const row = i % rows;
                const col = Math.floor(i / rows);

                if (col >= cols) {
                    return undefined;
                }

                let xListItem = this.rect.left + row * itemWidget.width;
                let yListItem = this.rect.top + col * itemWidget.height;

                return (
                    <div
                        key={i}
                        style={{
                            transform: `translate(${xListItem}px, ${yListItem}px)`,
                            transformOrigin: "0 0"
                        }}
                    >
                        {
                            <ItemWidgetComponent
                                ref={ref => {
                                    if (i === 0 && ref) {
                                        this.children.push(ref);
                                    }
                                }}
                                object={itemWidget}
                            />
                        }
                    </div>
                );
            })
            .filter(item => !!item);
    }

    render() {
        return (
            <React.Fragment>
                {this.renderBackgroundRect()}
                {this.renderItems()}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class SelectWidgetObjectComponent extends BaseWidgetObjectComponent {
    get selectWidget() {
        return this.widget as SelectWidget;
    }

    get count() {
        return this.selectWidget.widgets._array.length;
    }

    get index() {
        if (this.selectWidget.data) {
            let index: number = PageContext.data.getEnumValue(this.selectWidget.data);
            if (index >= 0 && index < this.count) {
                return index;
            }
        }
        return -1;
    }

    render() {
        const index = this.index;
        if (index === -1) {
            return null;
        }

        let canvas = document.createElement("canvas");

        canvas.width = this.rect.width;
        canvas.height = this.rect.height;

        let ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        let tree = createWidgetTree(this.selectWidget.widgets._array[index], true);
        drawTree(ctx, tree, 1, () => {});

        return (
            <img
                style={{
                    position: "absolute",
                    left: this.rect.left,
                    top: this.rect.top,
                    width: this.rect.width,
                    height: this.rect.height,
                    imageRendering: "pixelated"
                }}
                src={canvas.toDataURL()}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const SELECT_WIDGET_LINES_COLOR = "rgba(255, 128, 128, 0.9)";

@inject("designerContext")
@observer
class SelectWidgetEditorObjectComponent extends BaseObjectComponent {
    get selectWidgetEditor() {
        return this.props.object as SelectWidgetEditor;
    }

    get selectWidget() {
        return this.props.object._parent! as SelectWidget;
    }

    get rect() {
        return this.selectWidgetEditor.rect;
    }

    set rect(value: Rect) {
        DocumentStore.updateObject(this.selectWidgetEditor, {
            x: value.left + Math.round(this.rect.width / 2),
            y: value.top + Math.round(this.rect.height / 2)
        });
    }

    @computed
    get boundingRect(): Rect {
        return this.rect;
    }

    @computed
    get selectionRects() {
        return [this.rect];
    }

    getChildOffsetX(child: EezObject) {
        return SelectWidgetEditor.EDITOR_PADDING;
    }

    renderSelectChildren() {
        this.children = new Array(this.selectWidget.widgets._array.length);

        return this.selectWidget.widgets._array.map((child, i) => {
            let x = this.rect.left + SelectWidgetEditor.EDITOR_PADDING;
            let y =
                this.rect.top +
                SelectWidgetEditor.EDITOR_PADDING +
                i * (this.selectWidget.height + SelectWidgetEditor.EDITOR_PADDING);

            let xLabel =
                this.selectWidgetEditor.relativePosition === "left"
                    ? this.boundingRect.left +
                      this.boundingRect.width +
                      SelectWidgetEditor.EDITOR_PADDING
                    : this.boundingRect.left - SelectWidgetEditor.EDITOR_PADDING;
            let yLabel = y + this.selectWidget.height / 2;
            let textAnchor = this.selectWidgetEditor.relativePosition === "left" ? "begin" : "end";

            let label = this.selectWidget.getChildLabel(child);

            const ChildObjectComponent = getObjectComponentClass(child);

            const transform = this.props.designerContext!.viewState.transform;
            const modelRect = transform.clientToModelRect(transform.clientRect);

            return (
                <React.Fragment key={child._id}>
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
                                width={this.selectWidget.width - 2}
                                height={this.selectWidget.height - 2}
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
                        <ChildObjectComponent
                            ref={ref => {
                                if (ref) {
                                    this.children[i] = ref;
                                }
                            }}
                            object={child}
                        />
                    </div>
                </React.Fragment>
            );
        });
    }

    render() {
        let x1: number;
        let y1: number;
        let x2: number;
        let y2: number;

        if (this.selectWidgetEditor.relativePosition === "left") {
            x1 = this.selectWidget.boundingRect.left;
            y1 = this.selectWidget.boundingRect.top + this.selectWidget.boundingRect.height / 2;

            x2 = this.boundingRect.left + this.boundingRect.width;
            y2 = this.boundingRect.top + this.boundingRect.height / 2;
        } else if (this.selectWidgetEditor.relativePosition === "right") {
            x1 = this.selectWidget.boundingRect.left + this.selectWidget.boundingRect.width;
            y1 = this.selectWidget.boundingRect.top + this.selectWidget.boundingRect.height / 2;

            x2 = this.boundingRect.left;
            y2 = this.boundingRect.top + this.boundingRect.height / 2;
        } else if (this.selectWidgetEditor.relativePosition === "top") {
            x1 = this.selectWidget.boundingRect.left + this.selectWidget.boundingRect.width / 2;
            y1 = this.selectWidget.boundingRect.top;

            x2 = this.boundingRect.left + this.boundingRect.width / 2;
            y2 = this.boundingRect.top + this.boundingRect.height;
        } else {
            x1 = this.selectWidget.boundingRect.left + this.selectWidget.boundingRect.width / 2;
            y1 = this.selectWidget.boundingRect.top + this.selectWidget.boundingRect.height;

            x2 = this.boundingRect.left + this.boundingRect.width / 2;
            y2 = this.boundingRect.top;
        }

        let c1x;
        let c1y;
        let c2x;
        let c2y;

        const K = 0.8;

        if (
            this.selectWidgetEditor.relativePosition === "left" ||
            this.selectWidgetEditor.relativePosition === "right"
        ) {
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

        const label = this.selectWidget.data;

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
                        x={this.selectWidget.boundingRect.left + 0.5}
                        y={this.selectWidget.boundingRect.top + 0.5}
                        width={this.selectWidget.boundingRect.width}
                        height={this.selectWidget.boundingRect.height}
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
                        x={this.boundingRect.left + 0.5}
                        y={this.boundingRect.top + 0.5}
                        width={this.boundingRect.width}
                        height={this.boundingRect.height}
                        fill="transparent"
                        stroke={SELECT_WIDGET_LINES_COLOR}
                    />
                </svg>
                {this.renderSelectChildren()}
            </React.Fragment>
        );
    }
}

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

@observer
class RootObjectComponent extends BaseObjectComponent {
    get isSelectable() {
        return false;
    }

    get isResizable() {
        return false;
    }

    get rootObject() {
        return this.props.object as Page;
    }

    get childrenObjects() {
        let childrenObjects = this.rootObject.widgets._array as EezObject[];
        if (this.props.dragWidget) {
            childrenObjects = [...childrenObjects, this.props.dragWidget];
        }
        return childrenObjects.concat(findSelectWidgetEditors(this.rootObject));
    }

    @computed
    get rect() {
        return {
            left: this.rootObject.x,
            top: this.rootObject.y,
            width: this.rootObject.width,
            height: this.rootObject.height
        };
    }

    set rect(value: Rect) {
        this.rootObject.x = value.left;
        this.rootObject.y = value.top;
        this.rootObject.width = value.width;
        this.rootObject.height = value.height;
    }

    @computed
    get boundingRect(): Rect {
        return this.rect;
    }

    @computed
    get selectionRects() {
        return [this.rect];
    }

    render() {
        return (
            <React.Fragment>
                {this.rootObject.render()}
                {this.renderChildren(this.childrenObjects)}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class DragSnapLines {
    @observable
    snapLines: SnapLines | undefined;
    context: IDesignerContext | undefined;
    dragWidget: Widget | undefined;

    start(context: IDesignerContext, dragWidget: Widget) {
        this.snapLines = new SnapLines();
        this.context = context;
        this.dragWidget = dragWidget;

        this.snapLines.find(context, (node: INode) => node.id !== dragWidget._id);
    }

    clear() {
        this.snapLines = undefined;
        this.context = undefined;
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
                        dragSnapLines.context!.viewState.transform,
                        this.dragWidgetRect
                    )}
                </div>
            )
        );
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

interface PageEditorPrope {
    widgetContainer: WidgetContainerDisplayItem;
}

@observer
export class PageEditor extends React.Component<PageEditorPrope> implements IDocument {
    rootObjectComponent: RootObjectComponent;
    designerContextComponent: DesignerContext | null;

    @observable
    dragWidget: Widget | undefined;

    get rootObjects() {
        return [this.rootObjectComponent];
    }

    get page() {
        return this.props.widgetContainer.object as Page;
    }

    findObjectById(id: string) {
        return this.rootObjectComponent && this.rootObjectComponent.findObjectById(id);
    }

    createObject(params: any) {
        // TODO ???
    }

    getObjectsInsideRect(rect: Rect) {
        return this.rootObjectComponent.children.filter(object =>
            isRectInsideRect(object.boundingRect, rect)
        );
    }

    resetTransform(transform: ITransform) {
        transform.translate = {
            x: -this.page.width / 2,
            y: -this.page.height / 2
        };
        transform.scale = 1;
    }

    deleteObjects(objects: BaseObjectComponent[]) {
        deleteItems(
            objects.map(objectComponent => (objectComponent as BaseObjectComponent).props.object)
        );
    }

    onDragStart(op: "move" | "resize"): void {
        UndoManager.setCombineCommands(true);
    }

    onDragEnd(op: "move" | "resize", changed: boolean, objects: IBaseObject[]): void {
        UndoManager.setCombineCommands(false);
    }

    createContextMenu(objects: IBaseObject[]) {
        return UIElementsFactory.createMenu();
    }

    get boundingRect() {
        return this.rootObjectComponent && this.rootObjectComponent.boundingRect;
    }

    objectFromPoint(point: Point) {
        return this.rootObjectComponent.objectFromPoint(point);
    }

    @computed
    get selectedObject() {
        const selectedObject =
            this.designerContextComponent &&
            this.designerContextComponent.designerContext.viewState.selectedObjects.length === 1 &&
            this.designerContextComponent.designerContext.viewState.selectedObjects[0];

        if (selectedObject && selectedObject instanceof BaseObjectComponent) {
            return selectedObject.props.object;
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
            this.resetTransform(transform);
        }

        return {
            transform,
            selectedObjects: this.props.widgetContainer.selectedItems.map(item => item.object._id)
        };
    }

    @bind
    onSavePersistantState(viewState: IViewStatePersistantState) {
        UIStateStore.updateObjectUIState(this.props.widgetContainer.object, {
            pageEditorCanvasViewState: {
                transform: viewState.transform
            }
        });

        this.props.widgetContainer.selectObjectIds(viewState.selectedObjects);
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
    onDragEnter(event: React.DragEvent) {
        const widget = this.getDragWidget(event);
        if (widget) {
            this.dragWidget = widget;
        }
    }

    @action.bound
    onDragOver(event: React.DragEvent) {
        const widget = this.getDragWidget(event);
        if (widget) {
            event.preventDefault();
            event.stopPropagation();

            const widget = DragAndDropManager.dragObject as Widget;

            const transform = this.designerContextComponent!.designerContext.viewState.transform;

            this.dragWidget = widget;

            if (!dragSnapLines.snapLines) {
                dragSnapLines.start(
                    this.designerContextComponent!.designerContext,
                    this.dragWidget
                );
            }
            dragSnapLines.snapLines!.enabled = !event.shiftKey;

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

            widget.x = Math.round(left - this.page.x);
            widget.y = Math.round(top - this.page.y);
        }
    }

    @action.bound
    onDrop(event: React.DragEvent) {
        const widget = this.getDragWidget(event);
        if (widget) {
            const object = DocumentStore.addObject(this.page.widgets, toJS(widget));
            this.dragWidget = undefined;
            dragSnapLines.clear();

            setTimeout(() => {
                const objectAdapter = this.findObjectById(object._id);
                if (objectAdapter) {
                    const viewState = this.designerContextComponent!.designerContext.viewState;
                    viewState.selectObjects([objectAdapter]);
                }
            }, 0);
        }
    }

    @action.bound
    onDragLeave(event: React.DragEvent) {
        this.dragWidget = undefined;
        dragSnapLines.clear();
    }

    @bind
    onKeyDown(event: React.KeyboardEvent) {
        if (event.keyCode == 46) {
            // delete
            this.props.widgetContainer.deleteSelection();
        }
    }

    render() {
        return (
            <DesignerContext
                document={this}
                viewStatePersistantState={this.viewStatePersistantState}
                onSavePersistantState={this.onSavePersistantState}
                options={{
                    center: {
                        x: 0,
                        y: 0
                    }
                }}
                ref={ref => (this.designerContextComponent = ref)}
            >
                <PageEditorCanvasContainer
                    tabIndex={0}
                    onFocus={this.focusHander}
                    onDragEnter={this.onDragEnter}
                    onDragOver={this.onDragOver}
                    onDrop={this.onDrop}
                    onDragLeave={this.onDragLeave}
                    onKeyDown={this.onKeyDown}
                >
                    <PageEditorCanvas
                        toolHandler={selectToolHandler}
                        customOverlay={<DragSnapLinesOverlay />}
                    >
                        <RootObjectComponent
                            ref={ref => {
                                if (ref) {
                                    this.rootObjectComponent = ref;
                                }
                            }}
                            object={this.props.widgetContainer.object}
                            dragWidget={this.dragWidget}
                        />
                    </PageEditorCanvas>
                </PageEditorCanvasContainer>
            </DesignerContext>
        );
    }
}

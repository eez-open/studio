import React from "react";
import { computed } from "mobx";
import { observer, inject } from "mobx-react";
import { bind } from "bind-decorator";

import { _range } from "eez-studio-shared/algorithm";
import { Point, Rect, ITransform, pointInRect, isRectInsideRect } from "eez-studio-shared/geometry";

import { SvgLabel } from "eez-studio-ui/svg-label";
import {
    IBaseObject,
    IDocument,
    IContextMenu,
    IContextMenuItem,
    IContextMenuPopupOptions,
    IViewStatePersistantState
} from "eez-studio-designer/designer-interfaces";
import { DesignerContext } from "eez-studio-designer/context";
import { Canvas } from "eez-studio-designer/canvas";
import { selectToolHandler } from "eez-studio-designer/select-tool";
import styled from "eez-studio-ui/styled-components";

import { EezObject } from "eez-studio-shared/model/object";
import {
    DocumentStore,
    NavigationStore,
    deleteItems,
    UndoManager,
    UIStateStore,
    UIElementsFactory
} from "eez-studio-shared/model/store";

import { Page, WidgetContainerDisplayItem } from "project-editor/project/features/gui/page";
import {
    Widget,
    ContainerWidget,
    ListWidget,
    GridWidget,
    SelectWidget,
    SelectWidgetEditor
} from "project-editor/project/features/gui/widget";
import { createWidgetTree, drawTree } from "project-editor/project/features/gui/widget-tree";

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

interface IData {
    count(dataItemId: string): number;
    getEnumValue(dataItemId: string): number;
}

interface IStyle {
    backgroundColor: string;
}

interface IStyleProvider {
    findStyleOrGetDefault(styleName: any): IStyle;
}

////////////////////////////////////////////////////////////////////////////////

abstract class BaseObjectComponent
    extends React.Component<{
        object: EezObject;
        data?: IData;
        style?: IStyleProvider;
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
            <g transform={`translate(${this.rect.left} ${this.rect.top})`}>
                {childrenObjects.map((child, i) => {
                    const ChildObjectComponent = getObjectComponentClass(child);
                    return (
                        <ChildObjectComponent
                            ref={ref => {
                                if (ref) {
                                    this.children[i] = ref;
                                }
                            }}
                            key={child._id}
                            object={child}
                        />
                    );
                })}
            </g>
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
            let count = listWidget.data ? this.props.data!.count(listWidget.data) : 0;

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
        const style = this.props.style!.findStyleOrGetDefault(this.widget.style);

        return (
            <rect
                x={this.rect.left}
                y={this.rect.top}
                width={this.rect.width}
                height={this.rect.height}
                fill={style.backgroundColor}
            />
        );
    }

    render(): React.ReactNode {
        const canvas = this.widget.draw(this.rect);

        if (canvas) {
            return (
                <image
                    x={this.rect.left}
                    y={this.rect.top}
                    width={this.rect.width}
                    height={this.rect.height}
                    xlinkHref={canvas.toDataURL()}
                />
            );
        } else {
            return this.renderBackgroundRect();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@inject("data")
@inject("style")
@observer
class WidgetObjectComponent extends BaseWidgetObjectComponent {}

////////////////////////////////////////////////////////////////////////////////

@inject("data")
@inject("style")
@observer
class ContainerWidgetObjectComponent extends BaseWidgetObjectComponent {
    get containerWidget() {
        return this.widget as ContainerWidget;
    }

    render() {
        return (
            <React.Fragment>
                {this.renderChildren(this.containerWidget.widgets._array)}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@inject("data")
@inject("style")
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
            return this.props.data!.count(this.listWidget.data);
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
                <g key={i} transform={`translate(${xListItem} ${yListItem})`}>
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
                </g>
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

@inject("data")
@inject("style")
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
            return this.props.data!.count(this.gridWidget.data);
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
                    <g key={i} transform={`translate(${xListItem} ${yListItem})`}>
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
                    </g>
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

@inject("data")
@inject("style")
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
            let index: number = this.props.data!.getEnumValue(this.selectWidget.data);
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
            <image
                x={this.rect.left}
                y={this.rect.top}
                width={this.rect.width}
                height={this.rect.height}
                xlinkHref={canvas.toDataURL()}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const SELECT_WIDGET_LINES_COLOR = "rgba(255, 128, 128, 0.9)";

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

            return (
                <React.Fragment key={child._id}>
                    <text x={xLabel} y={yLabel} textAnchor={textAnchor} alignmentBaseline="middle">
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
                        <ChildObjectComponent
                            ref={ref => {
                                if (ref) {
                                    this.children[i] = ref;
                                }
                            }}
                            object={child}
                        />
                    </g>
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

        return (
            <React.Fragment>
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

                {this.renderSelectChildren()}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

function findSelectWidgetEditors(rootObject: Widget | Page) {
    const result: SelectWidgetEditor[] = [];

    function doFind(object: Widget | Page) {
        if (object instanceof Page || object instanceof ContainerWidget) {
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

@inject("style")
@observer
class RootObjectComponent extends BaseObjectComponent {
    get rootObject() {
        return this.props.object as Page;
    }

    get childrenObjects() {
        const childrenObjects = this.rootObject.widgets._array as EezObject[];
        return childrenObjects.concat(findSelectWidgetEditors(this.rootObject));
    }

    @computed
    get rect() {
        return {
            left: this.rootObject instanceof Page ? this.rootObject.x : 0,
            top: this.rootObject instanceof Page ? this.rootObject.y : 0,
            width: this.rootObject.width,
            height: this.rootObject.height
        };
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
        const style = this.props.style!.findStyleOrGetDefault(this.rootObject.style);
        return (
            <React.Fragment>
                <rect
                    x={this.rect.left}
                    y={this.rect.top}
                    width={this.rect.width}
                    height={this.rect.height}
                    fill={style.backgroundColor}
                />
                {this.renderChildren(this.childrenObjects)}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const ExperimentalCanvasContainer = styled.div`
    flex-grow: 1;
    overflow: hidden;
    display: flex;

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

    svg {
        image-rendering: pixelated;
    }
`;

const ExperimentalCanvas = styled(Canvas)`
    flex-grow: 1;
    position: relative;
`;

interface ExperimentalWidgetContainerEditorProps {
    widgetContainer: WidgetContainerDisplayItem;
}

@observer
export class ExperimentalWidgetContainerEditor
    extends React.Component<ExperimentalWidgetContainerEditorProps>
    implements IDocument {
    rootObjectComponent: RootObjectComponent;
    designerContextComponent: DesignerContext | null;

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
            x: -(this.props.widgetContainer.object as Page).width / 2,
            y: -(this.props.widgetContainer.object as Page).height / 2
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

    createContextMenu(objects: IBaseObject[]): IContextMenu {
        const menu = UIElementsFactory.createMenu();
        return {
            appendMenuItem: (menuItem: IContextMenuItem) => {
                menu.append(UIElementsFactory.createMenuItem(menuItem));
            },
            popup: (options: IContextMenuPopupOptions) => {
                menu.popup(options);
            }
        };
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

        if (selectedObject && selectedObject instanceof WidgetObjectComponent) {
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
        if (uiState && uiState.experimentalCanvasViewState1) {
            transform = uiState.experimentalCanvasViewState1.transform;
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
            experimentalCanvasViewState1: {
                transform: viewState.transform
            }
        });

        this.props.widgetContainer.selectObjectIds(viewState.selectedObjects);
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
                <ExperimentalCanvasContainer tabIndex={0} onFocus={this.focusHander}>
                    <ExperimentalCanvas toolHandler={selectToolHandler}>
                        <RootObjectComponent
                            ref={ref => {
                                if (ref) {
                                    this.rootObjectComponent = ref;
                                }
                            }}
                            object={this.props.widgetContainer.object}
                        />
                    </ExperimentalCanvas>
                </ExperimentalCanvasContainer>
            </DesignerContext>
        );
    }
}

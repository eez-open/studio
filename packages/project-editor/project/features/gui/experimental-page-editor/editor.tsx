import React from "react";
import { observable, computed, action, runInAction, autorun } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

const { Menu, MenuItem } = EEZStudio.electron.remote;

import { _range } from "eez-studio-shared/algorithm";
import { Point, Rect, pointInRect, isRectInsideRect } from "eez-studio-shared/geometry";

import { SvgLabel } from "eez-studio-ui/svg-label";
import {
    IBaseObject,
    IDocument,
    IContextMenu,
    IContextMenuItem,
    IContextMenuPopupOptions
} from "eez-studio-designer/designer-interfaces";
import { DesignerContext } from "eez-studio-designer/context";
import { Canvas } from "eez-studio-designer/canvas";
import { selectToolHandler } from "eez-studio-designer/select-tool";
import styled from "eez-studio-ui/styled-components";

import {
    NavigationStore,
    updateObject,
    deleteItems,
    UndoManager,
    UIStateStore,
    isObjectExists
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

import * as data from "project-editor/project/features/data/data";

import { findStyleOrGetDefault } from "project-editor/project/features/gui/gui";
import { Page } from "project-editor/project/features/gui/page";
import {
    Widget,
    ContainerWidget,
    ListWidget,
    GridWidget,
    SelectWidget,
    SelectWidgetEditor
} from "project-editor/project/features/gui/widget";
import { createWidgetTree } from "project-editor/project/features/gui/widget-tree";
import { drawWidget } from "project-editor/project/features/gui/draw";

import { drawTree } from "project-editor/components/CanvasEditorUtil";

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

abstract class BaseObjectComponent extends React.Component<{ object: EezObject }>
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

@observer
class WidgetObjectComponent extends BaseObjectComponent {
    get widgetProperties() {
        return this.props.object as Widget;
    }

    @computed
    get rect() {
        return {
            left: this.widgetProperties.x,
            top: this.widgetProperties.y,
            width: this.widgetProperties.width,
            height: this.widgetProperties.height
        };
    }

    set rect(value: Rect) {
        this.widgetProperties.applyGeometryChange(
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
        return this.widgetProperties.boundingRect;
    }

    @computed
    get selectionRects() {
        let rects = [this.boundingRect];

        let listWidget = this.widgetProperties._parent;
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
            let count = listWidget.data ? data.count(listWidget.data) : 0;

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
        const style = findStyleOrGetDefault(this.widgetProperties.style);

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
        const canvas = drawWidget(this.widgetProperties, {
            x: this.rect.left,
            y: this.rect.top,
            width: this.rect.width,
            height: this.rect.height
        });

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

@observer
class ContainerWidgetObjectComponent extends WidgetObjectComponent {
    get containerWidgetProperties() {
        return this.widgetProperties as ContainerWidget;
    }

    render() {
        return (
            <React.Fragment>
                {this.renderChildren(this.containerWidgetProperties.widgets._array)}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ListWidgetObjectComponent extends WidgetObjectComponent {
    get listWidgetProperties() {
        return this.widgetProperties as ListWidget;
    }

    get itemWidget() {
        return this.listWidgetProperties.itemWidget;
    }

    get count() {
        if (this.itemWidget && this.listWidgetProperties.data) {
            return data.count(this.listWidgetProperties.data);
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

            if (this.listWidgetProperties.listType === "horizontal") {
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

@observer
class GridWidgetObjectComponent extends WidgetObjectComponent {
    get gridWidgetProperties() {
        return this.widgetProperties as GridWidget;
    }

    get itemWidget() {
        return this.gridWidgetProperties.itemWidget;
    }

    get count() {
        if (this.itemWidget && this.gridWidgetProperties.data) {
            return data.count(this.gridWidgetProperties.data);
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

@observer
class SelectWidgetObjectComponent extends WidgetObjectComponent {
    get selectWidgetProperties() {
        return this.widgetProperties as SelectWidget;
    }

    get count() {
        return this.selectWidgetProperties.widgets._array.length;
    }

    get index() {
        if (this.selectWidgetProperties.data) {
            let index: number = data.getEnumValue(this.selectWidgetProperties.data);
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

        let tree = createWidgetTree(this.selectWidgetProperties.widgets._array[index], true);
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
        updateObject(this.selectWidgetEditor, {
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

        const COLOR = "rgba(255, 128, 128, 0.9)";

        return (
            <React.Fragment>
                <rect
                    x={this.selectWidget.boundingRect.left + 0.5}
                    y={this.selectWidget.boundingRect.top + 0.5}
                    width={this.selectWidget.boundingRect.width}
                    height={this.selectWidget.boundingRect.height}
                    fill="transparent"
                    stroke={COLOR}
                />

                <circle cx={x1} cy={y1} r={2} fill={COLOR} />

                <path
                    d={`M${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`}
                    stroke={COLOR}
                    fill="transparent"
                />

                <circle cx={x2} cy={y2} r={3} fill={COLOR} />

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
                            color: COLOR
                        }}
                    />
                )}

                <rect
                    x={this.boundingRect.left + 0.5}
                    y={this.boundingRect.top + 0.5}
                    width={this.boundingRect.width}
                    height={this.boundingRect.height}
                    fill="transparent"
                    stroke={COLOR}
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
        const style = findStyleOrGetDefault(this.rootObject.style);
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
    container: Page;
}

@observer
export class ExperimentalWidgetContainerEditor
    extends React.Component<ExperimentalWidgetContainerEditorProps>
    implements IDocument {
    container: Page;
    @observable
    _selectedObjects: BaseObjectComponent[] = [];
    rootObjectComponent: RootObjectComponent;

    constructor(props: ExperimentalWidgetContainerEditorProps) {
        super(props);

        this.loadContainer(this.props.container);
    }

    componentWillMount() {
        autorun(() => {
            const selectedObjects = this._selectedObjects.filter(objectComponent =>
                isObjectExists(objectComponent.props.object)
            );

            if (selectedObjects.length !== this._selectedObjects.length) {
                runInAction(() => (this._selectedObjects = selectedObjects));
            }
        });
    }

    componentWillReceiveProps(props: ExperimentalWidgetContainerEditorProps) {
        this.loadContainer(props.container);
    }

    @action
    loadContainer(container: Page) {
        this.container = container;
        this._selectedObjects = [];
    }

    findObjectById(id: string) {
        return this.rootObjectComponent.findObjectById(id);
    }

    createObject(params: any) {
        // TODO ???
    }

    get selectedObjects() {
        return this._selectedObjects;
    }

    getObjectsInsideRect(rect: Rect) {
        return this.rootObjectComponent.children.filter(object =>
            isRectInsideRect(object.boundingRect, rect)
        );
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
        const menu = new Menu();
        return {
            appendMenuItem: (menuItem: IContextMenuItem) => {
                menu.append(new MenuItem(menuItem));
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
        if (this.selectedObjects.length === 1) {
            return this.selectedObjects[0].props.object;
        }
        return undefined;
    }

    @bind
    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    @bind
    loadViewState() {
        const uiState = UIStateStore.getObjectUIState(this.container);

        if (uiState && uiState.experimentalCanvasViewState) {
            return uiState.experimentalCanvasViewState;
        }

        return {
            transform: {
                translate: {
                    x: -160,
                    y: -120
                },
                scale: 1
            }
        };
    }

    @bind
    saveViewState(viewState: any) {
        UIStateStore.updateObjectUIState(this.container, {
            experimentalCanvasViewState: viewState
        });
    }

    render() {
        return (
            <DesignerContext
                document={this}
                viewStatePersistanceHandler={{
                    load: this.loadViewState,
                    save: this.saveViewState
                }}
            >
                <ExperimentalCanvasContainer tabIndex={0} onFocus={this.focusHander}>
                    <ExperimentalCanvas toolHandler={selectToolHandler}>
                        <RootObjectComponent
                            ref={ref => {
                                if (ref) {
                                    this.rootObjectComponent = ref;
                                }
                            }}
                            object={this.props.container}
                        />
                    </ExperimentalCanvas>
                </ExperimentalCanvasContainer>
            </DesignerContext>
        );
    }
}

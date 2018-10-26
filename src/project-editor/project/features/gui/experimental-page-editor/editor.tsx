import * as React from "react";
import { observable, computed, action, runInAction, reaction, autorun } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { _range } from "shared/algorithm";
import {
    Point,
    Rect,
    Transform,
    pointInRect,
    BoundingRectBuilder,
    isRectInsideRect
} from "shared/geometry";

import { SvgLabel } from "shared/ui/svg-label";
import { IBaseObject, IDocument } from "shared/ui/designer/designer-interfaces";
import { Canvas } from "shared/ui/designer/canvas";
import { selectToolHandler } from "shared/ui/designer/select-tool";

import {
    NavigationStore,
    updateObject,
    deleteItems,
    UndoManager,
    getId,
    getParent,
    UIStateStore,
    isObjectExists
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

import * as data from "project-editor/project/features/data/data";

import { findStyleOrGetDefault } from "project-editor/project/features/gui/gui";
import { PageResolutionProperties } from "project-editor/project/features/gui/page";
import { WidgetTypeProperties } from "project-editor/project/features/gui/widgetType";
import {
    WidgetProperties,
    ContainerWidgetProperties,
    ListWidgetProperties,
    SelectWidgetProperties,
    SelectWidgetEditorProperties,
    getWidgetType
} from "project-editor/project/features/gui/widget";
import { createWidgetTree } from "project-editor/project/features/gui/widget-tree";
import { drawWidget } from "project-editor/project/features/gui/draw";

import { drawTree } from "project-editor/components/CanvasEditorUtil";

////////////////////////////////////////////////////////////////////////////////

function getObjectComponentClass(object: EezObject): typeof BaseObjectComponent {
    if (object instanceof SelectWidgetEditorProperties) {
        return SelectWidgetEditorObjectComponent;
    } else if (object instanceof ContainerWidgetProperties) {
        return ContainerWidgetObjectComponent;
    } else if (object instanceof ListWidgetProperties) {
        return ListWidgetObjectComponent;
    } else if (object instanceof SelectWidgetProperties) {
        return SelectWidgetObjectComponent;
    } else {
        return WidgetObjectComponent;
    }
}

////////////////////////////////////////////////////////////////////////////////

abstract class BaseObjectComponent extends React.Component<{ object: EezObject }>
    implements IBaseObject {
    children: BaseObjectComponent[] = [];

    @observable
    selected: boolean;

    abstract get rect(): Rect;
    abstract get boundingRect(): Rect;
    abstract get selectionRects(): Rect[];

    get id() {
        return getId(this.props.object);
    }

    objectFromPoint(point: Point): BaseObjectComponent | undefined {
        let foundObject: BaseObjectComponent | undefined = undefined;

        for (let i = 0; i < this.children.length; i++) {
            let result = this.children[i].objectFromPoint(point);
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
                            key={getId(child)}
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
        return this.props.object as WidgetProperties;
    }

    get widgetType() {
        return getWidgetType(this.widgetProperties);
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

        let listWidget = getParent(this.widgetProperties);
        while (
            !(listWidget instanceof ListWidgetProperties) &&
            listWidget instanceof WidgetProperties
        ) {
            listWidget = getParent(listWidget);
        }

        if (!(listWidget instanceof ListWidgetProperties)) {
            return rects;
        }

        let count = listWidget.data ? data.count(listWidget.data) : 0;

        for (let i = 1; i < count; i++) {
            if (listWidget.listType === "horizontal") {
                rects.push({
                    left: this.boundingRect.left + i * listWidget.itemWidget!.width,
                    top: this.boundingRect.top,
                    width: this.boundingRect.width,
                    height: this.boundingRect.height
                });
            } else {
                rects.push({
                    left: this.boundingRect.left,
                    top: this.boundingRect.top + i * listWidget.itemWidget!.height,
                    width: this.boundingRect.width,
                    height: this.boundingRect.height
                });
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
        return this.widgetProperties as ContainerWidgetProperties;
    }

    render() {
        return (
            <React.Fragment>
                {this.renderChildren(this.containerWidgetProperties.widgets)}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class ListWidgetObjectComponent extends WidgetObjectComponent {
    get listWidgetProperties() {
        return this.widgetProperties as ListWidgetProperties;
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
class SelectWidgetObjectComponent extends WidgetObjectComponent {
    get selectWidgetProperties() {
        return this.widgetProperties as SelectWidgetProperties;
    }

    get count() {
        return this.selectWidgetProperties.widgets.length;
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

        let tree = createWidgetTree(this.selectWidgetProperties.widgets[index], true);
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
        return this.props.object as SelectWidgetEditorProperties;
    }

    get selectWidget() {
        return getParent(this.props.object)! as SelectWidgetProperties;
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
        return SelectWidgetEditorProperties.EDITOR_PADDING;
    }

    renderSelectChildren() {
        this.children = new Array(this.selectWidget.widgets.length);

        return this.selectWidget.widgets.map((child, i) => {
            let x = this.rect.left + SelectWidgetEditorProperties.EDITOR_PADDING;
            let y =
                this.rect.top +
                SelectWidgetEditorProperties.EDITOR_PADDING +
                i * (this.selectWidget.height + SelectWidgetEditorProperties.EDITOR_PADDING);

            let xLabel =
                this.selectWidgetEditor.relativePosition === "left"
                    ? this.boundingRect.left +
                      this.boundingRect.width +
                      SelectWidgetEditorProperties.EDITOR_PADDING
                    : this.boundingRect.left - SelectWidgetEditorProperties.EDITOR_PADDING;
            let yLabel = y + this.selectWidget.height / 2;
            let textAnchor = this.selectWidgetEditor.relativePosition === "left" ? "begin" : "end";

            let label = this.selectWidget.getChildLabel(child);

            const ChildObjectComponent = getObjectComponentClass(child);

            return (
                <React.Fragment key={getId(child)}>
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

function findSelectWidgetEditors(
    rootObject: WidgetProperties | PageResolutionProperties | WidgetTypeProperties
) {
    const result: SelectWidgetEditorProperties[] = [];

    function doFind(object: WidgetProperties | PageResolutionProperties | WidgetTypeProperties) {
        if (
            object instanceof PageResolutionProperties ||
            object instanceof WidgetTypeProperties ||
            object instanceof ContainerWidgetProperties
        ) {
            object.widgets.forEach(doFind);
        } else if (object instanceof ListWidgetProperties) {
            if (object.itemWidget) {
                doFind(object.itemWidget);
            }
        } else if (object instanceof SelectWidgetProperties) {
            result.push(object.editor);
            object.widgets.forEach(doFind);
        }
    }

    doFind(rootObject);

    return result;
}

////////////////////////////////////////////////////////////////////////////////

@observer
class RootObjectComponent extends BaseObjectComponent {
    get rootObject() {
        return this.props.object as PageResolutionProperties | WidgetTypeProperties;
    }

    get childrenObjects() {
        const childrenObjects = this.rootObject.widgets as EezObject[];
        return childrenObjects.concat(findSelectWidgetEditors(this.rootObject));
    }

    @computed
    get rect() {
        return {
            left: this.rootObject instanceof PageResolutionProperties ? this.rootObject.x : 0,
            top: this.rootObject instanceof PageResolutionProperties ? this.rootObject.y : 0,
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

interface ExperimentalWidgetContainerEditorProps {
    container: PageResolutionProperties | WidgetTypeProperties;
}

@observer
export class ExperimentalWidgetContainerEditor
    extends React.Component<ExperimentalWidgetContainerEditorProps>
    implements IDocument {
    container: PageResolutionProperties | WidgetTypeProperties;
    transform: Transform;
    saveTransformDisposer: any;
    @observable
    _selectionVisible: boolean;
    @observable
    _rubberBendRect: Rect | undefined;
    @observable
    _selectedObjects: BaseObjectComponent[] = [];
    selectionResizable: boolean = true;
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

    componentWillUnmount() {
        this.unloadContainer();
    }

    unloadContainer() {
        this.saveTransformDisposer();
    }

    @action
    loadContainer(container: PageResolutionProperties | WidgetTypeProperties) {
        if (this.container) {
            this.unloadContainer();
        }

        this.container = container;

        const pageResolutionUIState = UIStateStore.getObjectUIState(container);

        if (pageResolutionUIState) {
            this.transform = new Transform(pageResolutionUIState.transform);
        } else {
            this.transform = new Transform({
                translate: {
                    x: -160,
                    y: -120
                },
                scale: 1
            });
        }

        this.saveTransformDisposer = reaction(
            () => ({
                translate: this.transform.translate,
                scale: this.transform.scale
            }),
            transform => UIStateStore.updateObjectUIState(container, { transform })
        );

        this._selectionVisible = true;
        this._rubberBendRect = undefined;
        this._selectedObjects = [];
        this.selectionResizable = true;
    }

    @action
    resetTransform() {
        this.transform.scale = 1;
        this.transform.translate = {
            x: -160,
            y: -120
        };
    }

    createObject(params: any): void {}

    selectDefaultTool(): void {
        console.log("selectDefaultTool");
    }

    @computed
    get selectedObjects() {
        return this._selectedObjects;
    }

    selectObject(object: IBaseObject): void {
        runInAction(() => {
            object.selected = true;
            this._selectedObjects.push(object as BaseObjectComponent);
        });
    }

    selectObjectsInsideRect(rect: Rect): void {
        this.deselectAllObjects();

        this.rootObjectComponent.children.forEach(child => {
            if (isRectInsideRect(child.boundingRect, rect)) {
                this.selectObject(child);
            }
        });
    }

    deselectAllObjects() {
        runInAction(() => {
            this.selectedObjects.forEach(object => (object.selected = false));
            this._selectedObjects = [];
        });
    }

    deleteSelectedObjects(): void {
        deleteItems(this.selectedObjects.map(objectComponent => objectComponent.props.object));
    }

    get rubberBendRect() {
        return this._rubberBendRect;
    }

    set rubberBendRect(value: Rect | undefined) {
        runInAction(() => (this._rubberBendRect = value));
    }

    get selectionVisible() {
        return this._selectionVisible;
    }

    set selectionVisible(value: boolean) {
        runInAction(() => (this._selectionVisible = value));
    }

    get selectedObjectsBoundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();
        for (let i = 0; i < this.selectedObjects.length; i++) {
            boundingRectBuilder.addRect(this.selectedObjects[i].boundingRect);
        }
        return boundingRectBuilder.getRect();
    }

    onDragStart(op: "move" | "resize"): void {
        UndoManager.setCombineCommands(true);
    }

    onDragEnd(op: "move" | "resize", changed: boolean): void {
        UndoManager.setCombineCommands(false);
    }

    initContextMenu(menu: Electron.Menu) {}

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

    render() {
        return (
            <div
                className="layoutCenter EezStudio_ExperimentalPageEditor"
                tabIndex={0}
                onFocus={this.focusHander}
            >
                <Canvas className="layoutCenter" document={this} toolHandler={selectToolHandler}>
                    <RootObjectComponent
                        ref={ref => {
                            if (ref) {
                                this.rootObjectComponent = ref;
                            }
                        }}
                        object={this.props.container}
                    />
                </Canvas>
            </div>
        );
    }
}

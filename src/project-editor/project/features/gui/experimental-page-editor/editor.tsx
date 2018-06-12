import * as React from "react";
import { observable, computed, action, runInAction, reaction } from "mobx";
import { observer } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
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
    UIStateStore
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

import * as data from "project-editor/project/features/data/data";

import { findStyleOrGetDefault } from "project-editor/project/features/gui/gui";
import { PageOrientationProperties } from "project-editor/project/features/gui/page";
import { WidgetTypeProperties } from "project-editor/project/features/gui/widgetType";
import {
    WidgetProperties,
    ContainerWidgetProperties,
    ListWidgetProperties,
    SelectWidgetProperties,
    SelectWidgetEditorProperties,
    WidgetType,
    getWidgetType
} from "project-editor/project/features/gui/widget";
import { createWidgetTree } from "project-editor/project/features/gui/widget-tree";
import { drawWidget } from "project-editor/project/features/gui/draw";

import { drawTree } from "project-editor/components/CanvasEditorUtil";

////////////////////////////////////////////////////////////////////////////////

abstract class ObjectAdapter implements IBaseObject {
    parent: ObjectAdapter | undefined = undefined;
    children: ObjectAdapter[] = [];
    @observable selected: boolean;

    constructor(public object: EezObject) {}

    abstract get rect(): Rect;
    abstract get boundingRect(): Rect;
    abstract get selectionRects(): Rect[];

    getChildOffsetX(child: ObjectAdapter) {
        return 0;
    }

    getChildOffsetY(child: ObjectAdapter) {
        return 0;
    }

    get id() {
        return getId(this.object);
    }

    open() {}

    abstract render(): () => JSX.Element | null;

    renderChildren() {
        return (
            <g transform={`translate(${this.rect.left} ${this.rect.top})`}>
                {this.children.map(child => {
                    const Child = child.render();
                    return <Child key={child.id} />;
                })}
            </g>
        );
    }

    objectFromPoint(point: Point): ObjectAdapter | undefined {
        let foundObject: ObjectAdapter | undefined = undefined;

        for (let i = 0; i < this.children.length; ++i) {
            let result = this.children[i].objectFromPoint(point);
            if (result) {
                foundObject = result;
            }
        }

        if (foundObject) {
            return foundObject;
        }

        for (let i = 0; i < this.selectionRects.length; ++i) {
            if (pointInRect(point, this.selectionRects[i])) {
                return this;
            }
        }

        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class WidgetObjectAdapter extends ObjectAdapter {
    widgetType: WidgetType | undefined = undefined;

    constructor(public widgetProperties: WidgetProperties) {
        super(widgetProperties);

        this.widgetType = getWidgetType(widgetProperties);
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
        if (this.parent) {
            const parentRect = this.parent.boundingRect;

            return {
                left: parentRect.left + this.parent.getChildOffsetX(this) + this.rect.left,
                top: parentRect.top + this.parent.getChildOffsetY(this) + this.rect.top,
                width: this.rect.width,
                height: this.rect.height
            };
        }
        return this.rect;
    }

    @computed
    get selectionRects() {
        function findListWidget(object: ObjectAdapter): ListWidgetObjectAdapter | undefined {
            if (object instanceof ListWidgetObjectAdapter) {
                return object;
            }
            if (object.parent) {
                return findListWidget(object.parent);
            }
            return undefined;
        }

        let listWidget: ListWidgetObjectAdapter | undefined = undefined;
        if (this.parent) {
            listWidget = findListWidget(this.parent);
        }

        if (!listWidget) {
            return [this.boundingRect];
        }

        let rects = [this.boundingRect];

        for (let i = 1; i < listWidget.count; ++i) {
            if (listWidget.listWidgetProperties.listType === "horizontal") {
                rects.push({
                    left:
                        this.boundingRect.left +
                        i * listWidget.listItemWidget.widgetProperties.width,
                    top: this.boundingRect.top,
                    width: this.boundingRect.width,
                    height: this.boundingRect.height
                });
            } else {
                rects.push({
                    left: this.boundingRect.left,
                    top:
                        this.boundingRect.top +
                        i * listWidget.listItemWidget.widgetProperties.height,
                    width: this.boundingRect.width,
                    height: this.boundingRect.height
                });
            }
        }

        return rects;
    }

    render(): () => JSX.Element | null {
        return observer(() => {
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
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

class ContainerWidgetObjectAdapter extends WidgetObjectAdapter {
    constructor(
        public containerWidgetProperties: ContainerWidgetProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(containerWidgetProperties);

        this.children = this.containerWidgetProperties.widgets.map(widget => {
            const child = transformer(widget) as WidgetObjectAdapter;
            child.parent = this;
            return child;
        });
    }

    render(): () => JSX.Element | null {
        const This = super.render();

        return observer(() => (
            <React.Fragment>
                {<This />}
                {this.renderChildren()}
            </React.Fragment>
        ));
    }
}

////////////////////////////////////////////////////////////////////////////////

class ListWidgetObjectAdapter extends WidgetObjectAdapter {
    count: number;

    constructor(
        public listWidgetProperties: ListWidgetProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(listWidgetProperties);

        if (listWidgetProperties.itemWidget && this.listWidgetProperties.data) {
            const listItemWidget = transformer(
                listWidgetProperties.itemWidget
            ) as WidgetObjectAdapter;
            this.children.push(listItemWidget);
            listItemWidget.parent = this;

            this.count = data.count(this.listWidgetProperties.data);
        } else {
            this.count = 0;
        }
    }

    @computed
    get listItemWidget() {
        return this.children[0] as WidgetObjectAdapter;
    }

    render(): () => JSX.Element | null {
        const This = super.render();
        return observer(() => (
            <React.Fragment>
                {<This />}

                {_range(this.count).map(i => {
                    let xListItem = this.rect.left;
                    let yListItem = this.rect.top;

                    if (this.listWidgetProperties.listType === "horizontal") {
                        xListItem += i * this.listItemWidget.rect.width;
                    } else {
                        yListItem += i * this.listItemWidget.rect.height;
                    }

                    const Item = this.listItemWidget.render();

                    return (
                        <g key={i} transform={`translate(${xListItem} ${yListItem})`}>
                            {<Item />}
                        </g>
                    );
                })}
            </React.Fragment>
        ));
    }
}

////////////////////////////////////////////////////////////////////////////////

class SelectWidgetObjectAdapter extends WidgetObjectAdapter {
    constructor(
        public selectWidgetProperties: SelectWidgetProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(selectWidgetProperties);
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

    render(): () => JSX.Element | null {
        return observer(() => {
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
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function createWidget(
    widget: WidgetProperties,
    transformer: ITransformer<EezObject, ObjectAdapter>
) {
    if (widget instanceof ContainerWidgetProperties) {
        return new ContainerWidgetObjectAdapter(widget, transformer);
    } else if (widget instanceof ListWidgetProperties) {
        return new ListWidgetObjectAdapter(widget, transformer);
    } else if (widget instanceof SelectWidgetProperties) {
        return new SelectWidgetObjectAdapter(widget, transformer);
    } else {
        return new WidgetObjectAdapter(widget);
    }
}

////////////////////////////////////////////////////////////////////////////////

type Position = "left" | "right" | "top" | "bottom";

class SelectWidgetEditorObjectAdapter extends ObjectAdapter {
    selectWidgetObjectAdapter: SelectWidgetObjectAdapter;

    static readonly PADDING = 10;

    constructor(
        public selectWidgetEditor: SelectWidgetEditorProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(selectWidgetEditor);

        const selectWidget = getParent(selectWidgetEditor)! as SelectWidgetProperties;

        this.selectWidgetObjectAdapter = transformer(selectWidget) as SelectWidgetObjectAdapter;

        this.children = selectWidget.widgets.map(widget => {
            const child = transformer(widget) as WidgetObjectAdapter;
            child.parent = this;
            return child;
        });
    }

    @computed
    get selectWidgetPosition(): Position[] {
        let parent = this.selectWidgetObjectAdapter.parent!;
        while (parent.parent) {
            parent = parent.parent;
        }

        const rect1 = parent.boundingRect;
        const rect2 = this.selectWidgetObjectAdapter.boundingRect;

        const result: Position[] = [];

        if (rect1.left === rect2.left) {
            result.push("left");
        }

        if (rect1.top === rect2.top) {
            result.push("top");
        }

        if (rect1.left + rect1.width === rect2.left + rect2.width) {
            result.push("right");
        }

        if (rect1.top + rect1.height === rect2.top + rect2.height) {
            result.push("bottom");
        }

        return result;
    }

    @computed
    get relativePosition(): Position {
        const positions: Position[] = [];

        if (this.selectWidgetEditor.x < this.selectWidgetObjectAdapter.boundingRect.left) {
            positions.push("left");
        }
        if (this.selectWidgetEditor.y < this.selectWidgetObjectAdapter.boundingRect.top) {
            positions.push("top");
        }
        if (
            this.selectWidgetEditor.x >
            this.selectWidgetObjectAdapter.boundingRect.left +
                this.selectWidgetObjectAdapter.boundingRect.width
        ) {
            positions.push("right");
        }
        if (
            this.selectWidgetEditor.y >
            this.selectWidgetObjectAdapter.boundingRect.top +
                this.selectWidgetObjectAdapter.boundingRect.height
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
            this.selectWidgetEditor.x -
            (this.selectWidgetObjectAdapter.boundingRect.left +
                this.selectWidgetObjectAdapter.boundingRect.width / 2);

        const dy =
            this.selectWidgetEditor.y -
            (this.selectWidgetObjectAdapter.boundingRect.top +
                this.selectWidgetObjectAdapter.boundingRect.height / 2);

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

    @computed
    get rect() {
        let width;
        let height;

        if (
            this.relativePosition === "left" ||
            this.relativePosition === "right" ||
            this.relativePosition === "top" ||
            this.relativePosition === "bottom"
        ) {
            width =
                this.selectWidgetObjectAdapter.rect.width +
                2 * SelectWidgetEditorObjectAdapter.PADDING;

            height =
                (this.selectWidgetObjectAdapter.rect.height +
                    SelectWidgetEditorObjectAdapter.PADDING) *
                    this.selectWidgetObjectAdapter.count +
                SelectWidgetEditorObjectAdapter.PADDING;
        } else {
            width =
                (this.selectWidgetObjectAdapter.rect.width +
                    SelectWidgetEditorObjectAdapter.PADDING) *
                    this.selectWidgetObjectAdapter.count +
                SelectWidgetEditorObjectAdapter.PADDING;

            height =
                this.selectWidgetObjectAdapter.rect.height +
                2 * SelectWidgetEditorObjectAdapter.PADDING;
        }

        return {
            left: this.selectWidgetEditor.x - Math.round(width / 2),
            top: this.selectWidgetEditor.y - Math.round(height / 2),
            width,
            height
        };
    }

    set rect(value: Rect) {
        updateObject(this.object, {
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

    getChildOffsetX(child: ObjectAdapter) {
        if (
            this.relativePosition === "left" ||
            this.relativePosition === "right" ||
            this.relativePosition === "top" ||
            this.relativePosition === "bottom"
        ) {
            return SelectWidgetEditorObjectAdapter.PADDING;
        } else {
            let i = this.children.indexOf(child);
            return (
                SelectWidgetEditorObjectAdapter.PADDING +
                i *
                    (this.selectWidgetObjectAdapter.rect.width +
                        SelectWidgetEditorObjectAdapter.PADDING)
            );
        }
    }

    getChildOffsetY(child: ObjectAdapter) {
        if (
            this.relativePosition === "left" ||
            this.relativePosition === "right" ||
            this.relativePosition === "top" ||
            this.relativePosition === "bottom"
        ) {
            let i = this.children.indexOf(child);
            return (
                SelectWidgetEditorObjectAdapter.PADDING +
                i *
                    (this.selectWidgetObjectAdapter.rect.height +
                        SelectWidgetEditorObjectAdapter.PADDING)
            );
        } else {
            return SelectWidgetEditorObjectAdapter.PADDING;
        }
    }

    render(): () => JSX.Element | null {
        return observer(() => {
            let x1: number;
            let y1: number;
            let x2: number;
            let y2: number;

            if (this.relativePosition === "left") {
                x1 = this.selectWidgetObjectAdapter.boundingRect.left;
                y1 =
                    this.selectWidgetObjectAdapter.boundingRect.top +
                    this.selectWidgetObjectAdapter.boundingRect.height / 2;

                x2 = this.boundingRect.left + this.boundingRect.width;
                y2 = this.boundingRect.top + this.boundingRect.height / 2;
            } else if (this.relativePosition === "right") {
                x1 =
                    this.selectWidgetObjectAdapter.boundingRect.left +
                    this.selectWidgetObjectAdapter.boundingRect.width;
                y1 =
                    this.selectWidgetObjectAdapter.boundingRect.top +
                    this.selectWidgetObjectAdapter.boundingRect.height / 2;

                x2 = this.boundingRect.left;
                y2 = this.boundingRect.top + this.boundingRect.height / 2;
            } else if (this.relativePosition === "top") {
                x1 =
                    this.selectWidgetObjectAdapter.boundingRect.left +
                    this.selectWidgetObjectAdapter.boundingRect.width / 2;
                y1 = this.selectWidgetObjectAdapter.boundingRect.top;

                x2 = this.boundingRect.left + this.boundingRect.width / 2;
                y2 = this.boundingRect.top + this.boundingRect.height;
            } else {
                x1 =
                    this.selectWidgetObjectAdapter.boundingRect.left +
                    this.selectWidgetObjectAdapter.boundingRect.width / 2;
                y1 =
                    this.selectWidgetObjectAdapter.boundingRect.top +
                    this.selectWidgetObjectAdapter.boundingRect.height;

                x2 = this.boundingRect.left + this.boundingRect.width / 2;
                y2 = this.boundingRect.top;
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

            const label = (this.selectWidgetObjectAdapter.object as SelectWidgetProperties).data;

            const COLOR = "rgba(255, 128, 128, 0.9)";

            return (
                <React.Fragment>
                    <rect
                        x={this.selectWidgetObjectAdapter.boundingRect.left + 0.5}
                        y={this.selectWidgetObjectAdapter.boundingRect.top + 0.5}
                        width={this.selectWidgetObjectAdapter.boundingRect.width}
                        height={this.selectWidgetObjectAdapter.boundingRect.height}
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

                    {this.children.map((child, i) => {
                        let x = this.rect.left + this.getChildOffsetX(child);
                        let y = this.rect.top + this.getChildOffsetY(child);

                        const Child = child.render();

                        let xLabel =
                            this.relativePosition === "left"
                                ? this.boundingRect.left +
                                  this.boundingRect.width +
                                  SelectWidgetEditorObjectAdapter.PADDING
                                : this.boundingRect.left - SelectWidgetEditorObjectAdapter.PADDING;
                        let yLabel = y + this.selectWidgetObjectAdapter.rect.height / 2;
                        let textAnchor = this.relativePosition === "left" ? "begin" : "end";

                        let label = (this.selectWidgetObjectAdapter
                            .object as SelectWidgetProperties).getChildLabel(
                            child.object as WidgetProperties
                        );

                        return (
                            <React.Fragment key={child.id}>
                                <text
                                    x={xLabel}
                                    y={yLabel}
                                    textAnchor={textAnchor}
                                    alignmentBaseline="middle"
                                >
                                    {label}
                                </text>
                                <g transform={`translate(${x} ${y})`}>
                                    <Child />
                                </g>
                            </React.Fragment>
                        );
                    })}
                </React.Fragment>
            );
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

function findSelectWidgetEditors(
    rootObject: WidgetProperties | PageOrientationProperties | WidgetTypeProperties,
    transformer: ITransformer<EezObject, ObjectAdapter>
) {
    const children: ObjectAdapter[] = [];

    function doFind(object: WidgetProperties | PageOrientationProperties | WidgetTypeProperties) {
        if (
            object instanceof PageOrientationProperties ||
            object instanceof WidgetTypeProperties ||
            object instanceof ContainerWidgetProperties
        ) {
            object.widgets.forEach(doFind);
        } else if (object instanceof ListWidgetProperties) {
            if (object.itemWidget) {
                doFind(object.itemWidget);
            }
        } else if (object instanceof SelectWidgetProperties) {
            children.push(transformer(object.editor));
            object.widgets.forEach(doFind);
        }
    }

    doFind(rootObject);

    return children;
}

////////////////////////////////////////////////////////////////////////////////

class PageOrientationObjectAdapter extends ObjectAdapter {
    constructor(
        public pageOrientation: PageOrientationProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(pageOrientation);

        const children1 = this.pageOrientation.widgets.map(widget => {
            const child = transformer(widget);
            child.parent = this;
            return child;
        });

        const children2 = findSelectWidgetEditors(this.pageOrientation, transformer);

        this.children = children1.concat(children2);
    }

    @computed
    get rect() {
        return {
            left: this.pageOrientation.x,
            top: this.pageOrientation.y,
            width: this.pageOrientation.width,
            height: this.pageOrientation.height
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

    render(): () => JSX.Element | null {
        return observer(() => {
            const style = findStyleOrGetDefault(this.pageOrientation.style);
            return (
                <React.Fragment>
                    <rect
                        x={this.rect.left}
                        y={this.rect.top}
                        width={this.rect.width}
                        height={this.rect.height}
                        fill={style.backgroundColor}
                    />
                    {this.renderChildren()}
                </React.Fragment>
            );
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

class WidgetTypeObjectAdapter extends ObjectAdapter {
    constructor(
        public widgetType: WidgetTypeProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(widgetType);

        const children1 = this.widgetType.widgets.map(widget => {
            const child = transformer(widget);
            child.parent = this;
            return child;
        });

        const children2 = findSelectWidgetEditors(this.widgetType, transformer);

        this.children = children1.concat(children2);
    }

    @computed
    get rect() {
        return {
            left: 0,
            top: 0,
            width: this.widgetType.width,
            height: this.widgetType.height
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

    render(): () => JSX.Element | null {
        return observer(() => {
            const style = findStyleOrGetDefault(this.widgetType.style);
            return (
                <React.Fragment>
                    <rect
                        x={this.rect.left}
                        y={this.rect.top}
                        width={this.rect.width}
                        height={this.rect.height}
                        fill={style.backgroundColor}
                    />
                    {this.renderChildren()}
                </React.Fragment>
            );
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

class WidgetContainerDocument implements IDocument {
    transform: Transform;
    saveTransformDisposer: any;

    transformer: ITransformer<EezObject, ObjectAdapter>;

    constructor(public container: PageOrientationProperties | WidgetTypeProperties) {
        const pageOrientationUIState = UIStateStore.getObjectUIState(container);

        if (pageOrientationUIState) {
            this.transform = new Transform(pageOrientationUIState.transform);
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

        this.transformer = createTransformer((object: EezObject) => {
            if (object instanceof PageOrientationProperties) {
                return new PageOrientationObjectAdapter(object, this.transformer);
            }

            if (object instanceof WidgetTypeProperties) {
                return new WidgetTypeObjectAdapter(object, this.transformer);
            }

            if (object instanceof SelectWidgetEditorProperties) {
                return new SelectWidgetEditorObjectAdapter(object, this.transformer);
            }

            if (!(object instanceof WidgetProperties)) {
                console.error("assert: object is not instanceof WidgetProperties");
            }

            return createWidget(object as WidgetProperties, this.transformer);
        });
    }

    destroy() {
        this.saveTransformDisposer();
    }

    @computed
    get rootObject() {
        const rootObject = this.transformer(this.container);
        return rootObject;
    }

    @observable _selectionVisible: boolean = true;
    @observable _rubberBendRect: Rect | undefined;

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

    @observable _selectedObjects: EezObject[] = [];

    @computed
    get selectedObjects() {
        return this._selectedObjects.map(object => this.transformer(object));
    }

    selectionResizable: boolean = true;

    selectObject(objectAdapter: IBaseObject): void {
        runInAction(() => {
            objectAdapter.selected = true;
            this._selectedObjects.push((objectAdapter as ObjectAdapter).object);
        });
    }

    selectObjectsInsideRect(rect: Rect): void {
        this.deselectAllObjects();

        this.rootObject.children.forEach(object => {
            if (isRectInsideRect(object.boundingRect, rect)) {
                this.selectObject(object);
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
        deleteItems(
            this.selectedObjects.map((widget: WidgetObjectAdapter) => widget.widgetProperties)
        );
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
        for (let i = 0; i < this.selectedObjects.length; ++i) {
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
        return this.rootObject && this.rootObject.objectFromPoint(point);
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ExperimentalWidgetContainerEditorProps {
    container: PageOrientationProperties | WidgetTypeProperties;
}

@observer
export class ExperimentalWidgetContainerEditor extends React.Component<
    ExperimentalWidgetContainerEditorProps
> {
    constructor(props: ExperimentalWidgetContainerEditorProps) {
        super(props);

        this.pageDocument = new WidgetContainerDocument(props.container);
    }

    pageDocument: WidgetContainerDocument;

    @computed
    get selectedObject() {
        if (this.pageDocument.selectedObjects.length === 1) {
            return (this.pageDocument.selectedObjects[0] as WidgetObjectAdapter).widgetProperties;
        }
        return undefined;
    }

    componentWillReceiveProps(props: ExperimentalWidgetContainerEditorProps) {
        if (this.pageDocument) {
            this.pageDocument.destroy();
        }
        this.pageDocument = new WidgetContainerDocument(props.container);
    }

    @bind
    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    componentWillUnmount() {
        if (this.pageDocument) {
            this.pageDocument.destroy();
        }
    }

    render() {
        const RootObject = this.pageDocument.rootObject.render();

        return (
            <div
                className="layoutCenter EezStudio_ExperimentalPageEditor"
                tabIndex={0}
                onFocus={this.focusHander}
            >
                <Canvas
                    className="layoutCenter"
                    document={this.pageDocument}
                    toolHandler={selectToolHandler}
                >
                    <RootObject />
                </Canvas>
            </div>
        );
    }
}

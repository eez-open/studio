import * as React from "react";
import { observable, computed, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import { createTransformer, ITransformer } from "mobx-utils";
import { bind } from "bind-decorator";

import { _range } from "shared/algorithm";
import { Point, Rect, Transform, pointInRect, BoundingRectBuilder } from "shared/geometry";

import { IBaseObject, IDocument } from "shared/ui/designer/designer-interfaces";
import { CanvasParent } from "shared/ui/designer/canvas";
import { selectToolHandler } from "shared/ui/designer/select-tool";

import {
    NavigationStore,
    updateObject,
    deleteItems,
    UndoManager,
    getId
} from "project-editor/core/store";
import { EezObject } from "project-editor/core/metaData";

import * as data from "project-editor/project/features/data/data";

import { findStyleOrGetDefault } from "project-editor/project/features/gui/gui";
import { PageOrientationProperties } from "project-editor/project/features/gui/page";
import {
    WidgetProperties,
    ContainerWidgetProperties,
    ListWidgetProperties,
    SelectWidgetProperties,
    SelectWidgetEditorProperties,
    WidgetType,
    getWidgetType
} from "project-editor/project/features/gui/widget";

////////////////////////////////////////////////////////////////////////////////

abstract class ObjectAdapter implements IBaseObject {
    parent: ObjectAdapter | undefined = undefined;
    children: ObjectAdapter[] = [];
    @observable selected: boolean;

    constructor(public object: EezObject) {}

    abstract get rect(): Rect;
    abstract get boundingRect(): Rect;
    abstract get selectionRects(): Rect[];

    get id() {
        return getId(this.object);
    }

    open() {}

    abstract render(): JSX.Element | undefined;

    renderChildren() {
        return (
            <g transform={`translate(${this.rect.left} ${this.rect.top})`}>
                {this.children.map(child => child.render())}
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
                left: parentRect.left + this.rect.left,
                top: parentRect.top + this.rect.top,
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

    render() {
        if (this.widgetType && this.widgetType.draw) {
            const canvas = this.widgetType.draw(this.widgetProperties, {
                x: this.rect.left,
                y: this.rect.top,
                width: this.rect.width,
                height: this.rect.height
            });

            if (canvas) {
                return (
                    <image
                        key={this.id}
                        x={this.rect.left}
                        y={this.rect.top}
                        width={this.rect.width}
                        height={this.rect.height}
                        xlinkHref={canvas.toDataURL()}
                    />
                );
            }
        }

        const style = findStyleOrGetDefault(this.widgetProperties.style);

        return (
            <rect
                key={this.id}
                x={this.rect.left}
                y={this.rect.top}
                width={this.rect.width}
                height={this.rect.height}
                fill={style.backgroundColor}
            />
        );
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

    render() {
        return (
            <React.Fragment key={this.id}>
                {super.render()}
                {this.renderChildren()}
            </React.Fragment>
        );
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

    render() {
        return (
            <React.Fragment key={this.id}>
                {super.render()}

                {_range(this.count).map(i => {
                    let xListItem = this.rect.left;
                    let yListItem = this.rect.top;

                    if (this.listWidgetProperties.listType === "horizontal") {
                        xListItem += i * this.listItemWidget.rect.width;
                    } else {
                        yListItem += i * this.listItemWidget.rect.height;
                    }

                    return (
                        <g key={i} transform={`translate(${xListItem} ${yListItem})`}>
                            {this.listItemWidget.render()}
                        </g>
                    );
                })}
            </React.Fragment>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class SelectWidgetObjectAdapter extends WidgetObjectAdapter {
    constructor(
        public selectWidgetProperties: SelectWidgetProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(selectWidgetProperties);

        const index = this.index;
        if (index != -1) {
            const childWidget = transformer(
                this.selectWidgetProperties.widgets[index]
            ) as WidgetObjectAdapter;
            this.children.push(childWidget);
            childWidget.parent = this;
        }
    }

    get index() {
        if (this.selectWidgetProperties.data) {
            let index: number = data.getEnumValue(this.selectWidgetProperties.data);
            if (index >= 0 && index < this.selectWidgetProperties.widgets.length) {
                return index;
            }
        }
        return -1;
    }

    render(): JSX.Element {
        return (
            <React.Fragment key={this.id}>
                {super.render()}
                {this.renderChildren()}
            </React.Fragment>
        );
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

class PageOrientationObjectAdapter extends ObjectAdapter {
    constructor(
        public pageOrientation: PageOrientationProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(pageOrientation);

        this.children = this.pageOrientation.widgets.map(widget => {
            const child = transformer(widget);
            child.parent = this;
            return child;
        });
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

        return pointInRect(point, this.boundingRect) ? this : undefined;
    }

    render() {
        const style = findStyleOrGetDefault(this.pageOrientation.style);
        return (
            <React.Fragment key={this.id}>
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
    }
}

////////////////////////////////////////////////////////////////////////////////

class SelectWidgetEditorObjectAdapter extends ObjectAdapter {
    constructor(
        public selectWidgetEditor: SelectWidgetEditorProperties,
        transformer: ITransformer<EezObject, ObjectAdapter>
    ) {
        super(selectWidgetEditor);
    }

    @computed
    get rect() {
        return {
            left: this.selectWidgetEditor.x,
            top: this.selectWidgetEditor.y,
            width: 100,
            height: 100
        };
    }

    set rect(value: Rect) {
        updateObject(this.object, {
            x: value.left,
            y: value.top
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

    objectFromPoint(point: Point): ObjectAdapter | undefined {
        return pointInRect(point, this.boundingRect) ? this : undefined;
    }

    render() {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

class PageDocument implements IDocument {
    transform = new Transform(
        {
            x: -160,
            y: -120
        },
        1
    );

    transformer: ITransformer<EezObject, ObjectAdapter>;

    constructor(public pageOrientation: PageOrientationProperties) {
        this.transformer = createTransformer((object: EezObject) => {
            if (object instanceof PageOrientationProperties) {
                return new PageOrientationObjectAdapter(object, this.transformer);
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

    @computed
    get rootObject() {
        const rootObject = this.transformer(this.pageOrientation);
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

    @observable _selectedObjects: WidgetProperties[] = [];

    @computed
    get selectedObjects() {
        return this._selectedObjects.map(object => this.transformer(object));
    }

    selectionResizable: boolean = true;

    selectObject(object: IBaseObject): void {
        runInAction(() => {
            object.selected = true;
            this._selectedObjects.push((object as WidgetObjectAdapter).widgetProperties);
        });
    }

    selectObjectsInsideRect(rect: Rect): void {
        // @TODO
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

interface ExperimentalPageEditorProps {
    pageOrientation: PageOrientationProperties;
}

@observer
export class ExperimentalPageEditor extends React.Component<ExperimentalPageEditorProps> {
    constructor(props: ExperimentalPageEditorProps) {
        super(props);

        this.pageEditorCanvas = new PageDocument(props.pageOrientation);
    }

    pageEditorCanvas: PageDocument;

    @computed
    get selectedObject() {
        if (this.pageEditorCanvas.selectedObjects.length === 1) {
            return (this.pageEditorCanvas.selectedObjects[0] as WidgetObjectAdapter)
                .widgetProperties;
        }
        return undefined;
    }

    componentWillReceiveProps(props: ExperimentalPageEditorProps) {
        this.pageEditorCanvas = new PageDocument(props.pageOrientation);
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
                <CanvasParent
                    className="layoutCenter"
                    document={this.pageEditorCanvas}
                    toolHandler={selectToolHandler}
                >
                    {this.pageEditorCanvas.rootObject.render()}
                </CanvasParent>
            </div>
        );
    }
}

import { observable, computed, action, values } from "mobx";

import { Rect, Point, BoundingRectBuilder, pointInRect, isRectInsideRect } from "shared/geometry";
import { beginTransaction, commitTransaction } from "shared/store";
import { IBaseObject } from "shared/model/base-object";
import { ICanvas, ITool, IToolboxGroup, IToolbarButton } from "shared/ui/designer";
import { extensionsToolboxGroups, extensionsToolbarButtons } from "shared/extensions/extensions";
import { BOUNCE_ENTRANCE_TRANSITION_DURATION } from "shared/ui/transitions";

import {
    store,
    workbenchObjects,
    findWorkbenchObjectById,
    deleteWorkbenchObject,
    WorkbenchObject
} from "home/store";

import { Transform } from "home/designer/transform";
import { selectToolHandler } from "home/designer/select-tool";

////////////////////////////////////////////////////////////////////////////////

export interface IDocument {}

export type ITransform = Transform;

export interface IPage extends ICanvas {
    layers: ILayer[];
    transform: ITransform;
    selectionResizable: boolean;
    toolbarButtons: IToolbarButton[];
    toolboxGroups: IToolboxGroup[];
    rubberBendRect: Rect | undefined;
    selectionVisible: boolean;
    boundingRect: Rect | undefined;
}

export interface ILayer {
    id: string;
    objects: IBaseObject[];
    selectedObjects: IBaseObject[];
    page: IPage;
    boundingRect: Rect | undefined;
    selectObjectsInsideRect(rect: Rect): void;
}

////////////////////////////////////////////////////////////////////////////////

class Layer {
    constructor(public id: string, public page: IPage) {}

    @computed
    get objects() {
        return Array.from(workbenchObjects.values());
    }

    @computed
    get selectedObjects() {
        return values(workbenchObjects).filter(object => object.selected);
    }

    @computed
    get boundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (let i = 0; i < this.objects.length; ++i) {
            boundingRectBuilder.addRect(this.objects[i].rect);
        }

        return boundingRectBuilder.getRect();
    }

    selectObjectsInsideRect(rect: Rect) {
        for (let i = 0; i < this.objects.length; ++i) {
            let object = this.objects[i];
            action(() => (object.selected = isRectInsideRect(object.rect, rect)))();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class Page implements IPage {
    constructor() {
        this.selectDefaultTool = this.selectDefaultTool.bind(this);
    }

    @computed
    get toolboxGroups() {
        return toolboxGroups.get();
    }

    @computed
    get toolbarButtons() {
        return extensionsToolbarButtons.get();
    }

    @observable selectedTool: ITool | undefined;

    @computed
    get defaultTool() {
        return this.toolboxGroups[0].tools[0];
    }

    @action
    selectTool(tool: ITool | undefined) {
        if (tool !== this.selectedTool) {
            if (this.selectedTool) {
                this.selectedTool.selected = false;
            }

            this.selectedTool = tool || this.defaultTool;

            if (this.selectedTool) {
                this.selectedTool.selected = true;
            }
        }
    }

    selectDefaultTool() {
        this.selectTool(this.defaultTool);
    }

    createObject(type: string, oid: string, rect: Rect) {
        let objectId = store.createObject({ type, oid, rect });
        setTimeout(() => {
            let object = findWorkbenchObjectById(objectId);
            if (object) {
                this.selectObject(object);
            }
        }, BOUNCE_ENTRANCE_TRANSITION_DURATION);
        this.selectDefaultTool();
    }

    @observable rubberBendRect: Rect | undefined;

    @action
    setRubberBendRect(rect: Rect | undefined) {
        this.rubberBendRect = rect;
    }

    get activeLayer() {
        return this.layers[0];
    }

    selectObjectsInsideRect(rect: Rect) {
        this.activeLayer.selectObjectsInsideRect(rect);
    }

    @observable selectionVisible: boolean = true;

    @action
    showSelection() {
        this.selectionVisible = true;
    }

    @action
    hideSelection() {
        this.selectionVisible = false;
    }

    get centerPoint() {
        return this.transform.centerPoint;
    }

    @action
    translateBy(translate: Point) {
        this.transform.translate = {
            x: this.transform.translate.x + translate.x,
            y: this.transform.translate.y + translate.y
        };
    }

    mouseEventToOffsetPoint(event: MouseEvent) {
        return this.transform.mouseEventToOffsetPoint(event);
    }

    mouseEventToModelPoint(event: MouseEvent) {
        return this.transform.mouseEventToModelPoint(event);
    }

    offsetToModelRect(rect: Rect) {
        return this.transform.offsetToModelRect(rect);
    }

    objectFromPoint(point: Point) {
        let objects = this.activeLayer.objects;
        for (let i = objects.length - 1; i >= 0; --i) {
            let object = objects[i];
            if (pointInRect(point, object.rect)) {
                return object;
            }
        }

        return undefined;
    }

    getScale() {
        return this.transform.scale;
    }

    layers: ILayer[] = [];

    transform = new Transform();

    @computed
    get boundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (let i = 0; i < this.layers.length; ++i) {
            boundingRectBuilder.addRect(this.layers[i].boundingRect);
        }

        return boundingRectBuilder.getRect();
    }

    get selectedObjects() {
        return this.layers[0].selectedObjects;
    }

    get selectedObjectsBoundingRect() {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (let i = 0; i < this.selectedObjects.length; ++i) {
            boundingRectBuilder.addRect(this.selectedObjects[i].boundingRect);
        }

        return boundingRectBuilder.getRect();
    }

    get selectionResizable() {
        for (let i = 0; i < this.selectedObjects.length; ++i) {
            if (!this.selectedObjects[i].isResizable) {
                return false;
            }
        }
        return true;
    }

    deselectAllObjects() {
        action(() => {
            this.selectedObjects.forEach(object => (object.selected = false));
        })();
    }

    selectObject(object: IBaseObject) {
        this.deselectAllObjects();

        action(() => (object.selected = true))();
    }

    deleteSelectedObjects() {
        if (this.selectedObjects.length > 0) {
            beginTransaction("Delete workbench items");
        } else {
            beginTransaction("Delete workbench item");
        }

        this.selectedObjects.forEach(object => deleteWorkbenchObject(object as WorkbenchObject));

        commitTransaction();
    }
}

////////////////////////////////////////////////////////////////////////////////

const standardToolboxGroup = {
    id: "standard",
    label: undefined,
    title: "Standard",
    tools: [
        observable({
            id: "select",
            icon: "_images/select.svg",
            iconSize: 24,
            label: undefined,
            title: "Select",
            selected: false,
            toolHandler: selectToolHandler
        })
    ]
};

const toolboxGroups = computed(() => {
    return observable([standardToolboxGroup as IToolboxGroup]).concat(
        extensionsToolboxGroups.get() as IToolboxGroup[]
    );
});

export const page = new Page();
const layer = new Layer("1", page);
page.layers.push(layer);

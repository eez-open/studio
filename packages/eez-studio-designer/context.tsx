import {
    observable,
    computed,
    action,
    reaction,
    runInAction,
    IReactionDisposer,
    autorun
} from "mobx";

import { Rect, Transform, BoundingRectBuilder } from "eez-studio-shared/geometry";

import {
    IBaseObject,
    IDocument,
    IViewState,
    IViewStatePersistantState,
    IDesignerContext,
    IDesignerOptions,
    IResizeHandler
} from "eez-studio-designer/designer-interfaces";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    document: IDocument;

    @observable
    transform = new Transform({
        scale: 1,
        translate: { x: 0, y: 0 }
    });

    @observable
    isIdle: boolean = true;

    @observable
    _selectedObjects: IBaseObject[] = [];

    persistentStateReactionDisposer: IReactionDisposer;
    selectedObjectsReactionDisposer: IReactionDisposer;

    constructor() {
        // make sure selected object is still part of the document
        this.selectedObjectsReactionDisposer = autorun(() => {
            const selectedObjects = this._selectedObjects.filter(
                selectedObject => !!this.document.findObjectById(selectedObject.id)
            );

            if (selectedObjects.length !== this._selectedObjects.length) {
                runInAction(() => {
                    this._selectedObjects = selectedObjects;
                });
            }
        });
    }

    @action
    set(
        document: IDocument,
        viewStatePersistantState: IViewStatePersistantState,
        onSavePersistantState: (viewStatePersistantState: IViewStatePersistantState) => void,
        lastViewState?: ViewState
    ) {
        if (this.persistentStateReactionDisposer) {
            this.persistentStateReactionDisposer();
        }

        this.document = document;

        if (viewStatePersistantState) {
            if (viewStatePersistantState.transform) {
                this.transform.scale = viewStatePersistantState.transform.scale;
                this.transform.translate = viewStatePersistantState.transform.translate;
            } else {
                this.resetTransform();
            }

            if (viewStatePersistantState.selectedObjects) {
                const selectedObjects: IBaseObject[] = [];
                for (const id of viewStatePersistantState.selectedObjects) {
                    const object = document.findObjectById(id);
                    if (object) {
                        selectedObjects.push(object);
                    }
                }
                this._selectedObjects = selectedObjects;
            }
        }

        if (lastViewState) {
            this.transform.clientRect = lastViewState.transform.clientRect;
        }

        this.persistentStateReactionDisposer = reaction(
            () => this.persistentState,
            viewState => onSavePersistantState(viewState)
        );
    }

    get selectedObjects() {
        return this._selectedObjects;
    }

    @computed
    get persistentState(): IViewStatePersistantState {
        const selectedObjects = this._selectedObjects.map(object => object.id);
        selectedObjects.sort();

        return {
            transform: {
                translate: this.transform.translate,
                scale: this.transform.scale
            },
            selectedObjects
        };
    }

    @action
    resetTransform() {
        if (this.document.resetTransform) {
            this.document.resetTransform(this.transform);
        } else {
            this.transform.scale = 1;
            this.transform.translate = {
                x: 0,
                y: 0
            };
        }
    }

    getResizeHandlers(): IResizeHandler[] | undefined {
        if (!(this.selectedObjects.length === 1 && this.selectedObjects[0].isResizable === true)) {
            return undefined;
        }

        if (this.selectedObjects[0].getResizeHandlers) {
            const resizingHandlers = this.selectedObjects[0].getResizeHandlers();
            if (resizingHandlers !== false) {
                return resizingHandlers;
            }
        }

        return [
            {
                x: 0,
                y: 0,
                type: "nw-resize"
            },
            {
                x: 50,
                y: 0,
                type: "n-resize"
            },
            {
                x: 100,
                y: 0,
                type: "ne-resize"
            },
            {
                x: 0,
                y: 50,
                type: "w-resize"
            },
            {
                x: 100,
                y: 50,
                type: "e-resize"
            },
            {
                x: 0,
                y: 100,
                type: "sw-resize"
            },
            {
                x: 50,
                y: 100,
                type: "s-resize"
            },
            {
                x: 100,
                y: 100,
                type: "se-resize"
            }
        ];
    }

    get selectedObjectsBoundingRect(): Rect {
        let boundingRectBuilder = new BoundingRectBuilder();

        for (const object of this.selectedObjects) {
            boundingRectBuilder.addRect(object.boundingRect);
        }

        return boundingRectBuilder.getRect();
    }

    isObjectSelected(object: IBaseObject): boolean {
        return this.selectedObjects.indexOf(object) !== -1;
    }

    selectObject(object: IBaseObject) {
        runInAction(() => {
            this._selectedObjects.push(object);
        });
    }

    selectObjects(objects: IBaseObject[]) {
        if (
            JSON.stringify(objects.map(object => object.id).sort()) ===
            JSON.stringify(this._selectedObjects.map(object => object.id).sort())
        ) {
            // there is no change
            return;
        }

        this.deselectAllObjects();
        runInAction(() => {
            this._selectedObjects = objects;
        });
    }

    deselectAllObjects(): void {
        runInAction(() => {
            this._selectedObjects = [];
        });
    }

    destroy() {
        this.selectedObjectsReactionDisposer();
        this.persistentStateReactionDisposer();
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DesignerContext implements IDesignerContext {
    document: IDocument;
    viewState: ViewState = new ViewState();

    @observable
    options: IDesignerOptions = {
        showStructure: false
    };

    filterSnapLines: ((node: IBaseObject) => boolean) | undefined;

    @action
    set(
        document: IDocument,
        viewStatePersistantState: IViewStatePersistantState,
        onSavePersistantState: (viewStatePersistantState: IViewStatePersistantState) => void,
        options?: IDesignerOptions,
        filterSnapLines?: (node: IBaseObject) => boolean
    ) {
        this.document = document;

        this.viewState.set(document, viewStatePersistantState, onSavePersistantState);

        this.options = options || {
            showStructure: false
        };

        this.filterSnapLines = filterSnapLines;
    }

    destroy() {
        this.viewState.destroy();
    }
}

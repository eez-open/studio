import {
    observable,
    computed,
    action,
    reaction,
    IReactionDisposer
} from "mobx";
import stringify from "json-stable-stringify";

import { BoundingRectBuilder } from "eez-studio-shared/geometry";

import { getDocumentStore } from "project-editor/core/store";

import type {
    IDocument,
    IViewState,
    IViewStatePersistantState,
    IDesignerContext,
    IDesignerOptions,
    IResizeHandler
} from "project-editor/features/gui/page-editor/designer-interfaces";
import { Transform } from "project-editor/features/gui/page-editor/transform";

import { Widget, getWidgetParent } from "project-editor/features/gui/widget";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    @observable document?: IDocument;

    @observable transform = new Transform({
        scale: 1,
        translate: { x: 0, y: 0 }
    });

    @observable dxMouseDrag: number | undefined;
    @observable dyMouseDrag: number | undefined;

    persistentStateReactionDisposer: IReactionDisposer;

    constructor(public containerId: string) {}

    @action
    set(
        document: IDocument,
        viewStatePersistantState: IViewStatePersistantState,
        onSavePersistantState: (
            viewStatePersistantState: IViewStatePersistantState
        ) => void,
        lastViewState?: ViewState
    ) {
        if (this.persistentStateReactionDisposer) {
            this.persistentStateReactionDisposer();
        }

        this.document = document;

        if (viewStatePersistantState) {
            if (viewStatePersistantState.transform) {
                this.transform.scale = viewStatePersistantState.transform.scale;
                this.transform.translate =
                    viewStatePersistantState.transform.translate;
            } else {
                this.resetTransform();
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
        return this.document?.page.selectedItems ?? [];
    }

    @computed
    get persistentState(): IViewStatePersistantState {
        return {
            transform: {
                translate: this.transform.translate,
                scale: this.transform.scale
            }
        };
    }

    @action
    resetTransform() {
        if (this.document && this.document.resetTransform) {
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
        if (
            this.selectedObjects.length !== 1 ||
            !this.selectedObjects[0].getResizeHandlers
        ) {
            return undefined;
        }

        const resizingHandlers = this.selectedObjects[0].getResizeHandlers();
        if (resizingHandlers !== false) {
            return resizingHandlers;
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

    isObjectSelected(object: ITreeObjectAdapter): boolean {
        return this.selectedObjects.indexOf(object) !== -1;
    }

    isObjectIdSelected(id: string): boolean {
        return (
            this.selectedObjects
                .map(selectedObject => selectedObject.id)
                .indexOf(id) !== -1
        );
    }

    selectObject(object: ITreeObjectAdapter) {
        if (object.isSelectable) {
            this.document && this.document.page.selectItem(object);
        }
    }

    @action
    selectObjects(objects: ITreeObjectAdapter[]) {
        this.document &&
            this.document.page.selectItems(
                objects.filter(object => object.isSelectable)
            );
    }

    @action
    deselectAllObjects(): void {
        this.document && this.document.page.selectItems([]);
    }

    moveSelection(
        where:
            | "left"
            | "up"
            | "right"
            | "down"
            | "home-x"
            | "end-x"
            | "home-y"
            | "end-y"
    ) {
        const widgets =
            this.document &&
            (this.document.page.selectedObjects.filter(
                object => object instanceof Widget
            ) as Widget[]);

        if (!widgets || widgets.length === 0) {
            return;
        }

        const builder = new BoundingRectBuilder();
        widgets.forEach(widget => {
            builder.addRect({
                left: widget.left,
                top: widget.top,
                width: widget.width,
                height: widget.height
            });
        });
        const boundingRect = builder.getRect();

        const allWidgetsAreFromTheSameParent = !widgets.find(
            widget => getWidgetParent(widget) !== getWidgetParent(widgets[0])
        );

        const DocumentStore = getDocumentStore(widgets[0]);

        DocumentStore.UndoManager.setCombineCommands(true);

        widgets.forEach(widget => {
            if (where === "left") {
                DocumentStore.updateObject(widget, {
                    left: widget.left - 1
                });
            } else if (where === "up") {
                DocumentStore.updateObject(widget, {
                    top: widget.top - 1
                });
            } else if (where === "right") {
                DocumentStore.updateObject(widget, {
                    left: widget.left + 1
                });
            } else if (where === "down") {
                DocumentStore.updateObject(widget, {
                    top: widget.top + 1
                });
            } else if (allWidgetsAreFromTheSameParent) {
                if (where === "home-x") {
                    DocumentStore.updateObject(widget, {
                        left: 0 + widget.left - boundingRect.left
                    });
                } else if (where === "end-x") {
                    DocumentStore.updateObject(widget, {
                        left:
                            getWidgetParent(widget).width -
                            boundingRect.width +
                            widget.left -
                            boundingRect.left
                    });
                } else if (where === "home-y") {
                    DocumentStore.updateObject(widget, {
                        top: 0 + widget.top - boundingRect.top
                    });
                } else if (where === "end-y") {
                    DocumentStore.updateObject(widget, {
                        top:
                            getWidgetParent(widget).height -
                            boundingRect.height +
                            widget.top -
                            boundingRect.top
                    });
                }
            }
        });

        DocumentStore.UndoManager.setCombineCommands(false);
    }

    destroy() {
        this.persistentStateReactionDisposer();
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DesignerContext implements IDesignerContext {
    @observable document: IDocument;
    viewState: ViewState;
    @observable options: IDesignerOptions = {};
    filterSnapLines: ((node: ITreeObjectAdapter) => boolean) | undefined;
    @observable dragWidget: Widget | undefined;

    constructor(public containerId: string) {
        this.viewState = new ViewState(this.containerId);
    }

    @action
    set(
        document: IDocument,
        viewStatePersistantState: IViewStatePersistantState,
        onSavePersistantState: (
            viewStatePersistantState: IViewStatePersistantState
        ) => void,
        options?: IDesignerOptions,
        filterSnapLines?: (node: ITreeObjectAdapter) => boolean
    ) {
        const differentDocument = this.document !== document;
        this.document = document;

        this.viewState.set(
            document,
            viewStatePersistantState,
            onSavePersistantState
        );

        if (differentDocument) {
            this.viewState.deselectAllObjects();
        }

        const newOptions = options || {};
        if (stringify(newOptions) !== stringify(this.options)) {
            this.options = newOptions;
        }

        this.filterSnapLines = filterSnapLines;
    }

    destroy() {
        this.viewState.destroy();
    }
}

import { observable, computed, action, makeObservable } from "mobx";

import { BoundingRectBuilder } from "eez-studio-shared/geometry";

import { getDocumentStore } from "project-editor/store";

import {
    ITreeObjectAdapter,
    TreeObjectAdapter
} from "project-editor/core/objectAdapter";

import type {
    IViewState,
    IFlowContext,
    IEditorOptions,
    IResizeHandler,
    IDataContext,
    ObjectIdUnderPointer
} from "project-editor/flow/flow-interfaces";

import { Component, getWidgetParent } from "project-editor/flow/component";
import type { ConnectionLine, FlowTabState } from "project-editor/flow/flow";
import { FlowDocument } from "project-editor/flow/editor/flow-document";
import { Transform } from "project-editor/flow/editor/transform";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    get transform() {
        return this.flowContext.tabState.transform;
    }

    set transform(transform: Transform) {
        this.flowContext.tabState.transform = transform;
    }

    dxMouseDrag: number | undefined;
    dyMouseDrag: number | undefined;

    hoveredConnectionLines: ObjectIdUnderPointer | undefined;

    constructor(public flowContext: EditorFlowContext) {
        makeObservable(this, {
            dxMouseDrag: observable,
            dyMouseDrag: observable,
            hoveredConnectionLines: observable,
            resetTransform: action,
            selectedObjects: computed,
            selectObjects: action,
            deselectAllObjects: action,
            hoveredConnectionLinesComponent: computed
        });
    }

    get document() {
        return this.flowContext.document;
    }

    get containerId() {
        return this.flowContext.containerId;
    }

    resetTransform() {
        this.flowContext.tabState.resetTransform();
    }

    getResizeHandlers(): IResizeHandler[] | undefined {
        const isEditor = this.document && !this.document.DocumentStore.runtime;

        if (
            !isEditor ||
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

    get selectedObjects(): ITreeObjectAdapter[] {
        return this.flowContext.dragComponent
            ? [new TreeObjectAdapter(this.flowContext.dragComponent)]
            : this.document?.flow.selectedItems ?? [];
    }

    get connectionLine() {
        return undefined;
    }

    get sourceComponent() {
        return undefined;
    }

    get targetComponent() {
        return undefined;
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
        if (object.isSelectable && this.document) {
            this.document.flow.selectItem(object);
        }
    }

    deselectObject(object: ITreeObjectAdapter) {
        if (this.document) {
            this.document.flow.deselectItem(object);
        }
    }

    selectObjects(objects: ITreeObjectAdapter[]) {
        if (this.document) {
            this.document.flow.selectItems(
                objects.filter(object => object.isSelectable)
            );
        }
    }

    deselectAllObjects(): void {
        if (this.document) {
            this.document.flow.selectItems([]);
        }
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
            (this.document.flow.selectedObjects.filter(
                object => object instanceof Component
            ) as Component[]);

        if (!widgets || widgets.length === 0) {
            return;
        }

        const builder = new BoundingRectBuilder();
        widgets.forEach(widget => {
            builder.addRect(widget.rect);
        });
        const boundingRect = builder.getRect();

        const allWidgetsAreFromTheSameParent = !widgets.find(
            widget => getWidgetParent(widget) !== getWidgetParent(widgets[0])
        );

        const DocumentStore = getDocumentStore(widgets[0]);

        DocumentStore.undoManager.setCombineCommands(true);

        widgets.forEach(widget => {
            if (where === "left") {
                DocumentStore.updateObject(widget, {
                    left: widget.rect.left - 1
                });
            } else if (where === "up") {
                DocumentStore.updateObject(widget, {
                    top: widget.rect.top - 1
                });
            } else if (where === "right") {
                DocumentStore.updateObject(widget, {
                    left: widget.rect.left + 1
                });
            } else if (where === "down") {
                DocumentStore.updateObject(widget, {
                    top: widget.rect.top + 1
                });
            } else if (allWidgetsAreFromTheSameParent) {
                if (where === "home-x") {
                    DocumentStore.updateObject(widget, {
                        left: 0 + widget.rect.left - boundingRect.left
                    });
                } else if (where === "end-x") {
                    DocumentStore.updateObject(widget, {
                        left:
                            getWidgetParent(widget).width -
                            boundingRect.width +
                            widget.rect.left -
                            boundingRect.left
                    });
                } else if (where === "home-y") {
                    DocumentStore.updateObject(widget, {
                        top: 0 + widget.rect.top - boundingRect.top
                    });
                } else if (where === "end-y") {
                    DocumentStore.updateObject(widget, {
                        top:
                            getWidgetParent(widget).height -
                            boundingRect.height +
                            widget.rect.top -
                            boundingRect.top
                    });
                }
            }
        });

        DocumentStore.undoManager.setCombineCommands(false);
    }

    get hoveredConnectionLinesComponent() {
        if (!this.hoveredConnectionLines) {
            return undefined;
        }
        return this.flowContext.DocumentStore.getObjectFromObjectId(
            this.hoveredConnectionLines.id
        ) as Component;
    }

    isConnectionLineHovered(connectionLine: ConnectionLine) {
        if (!this.hoveredConnectionLines) {
            return false;
        }
        return (
            (connectionLine.sourceComponent ==
                this.hoveredConnectionLinesComponent &&
                connectionLine.output ==
                    this.hoveredConnectionLines.connectionOutput) ||
            (connectionLine.targetComponent ==
                this.hoveredConnectionLinesComponent &&
                connectionLine.input ==
                    this.hoveredConnectionLines.connectionInput)
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class EditorFlowContext implements IFlowContext {
    tabState: FlowTabState;
    document: FlowDocument;

    viewState: ViewState = new ViewState(this);
    editorOptions: IEditorOptions = {};
    dragComponent: Component | undefined;
    dataContext: IDataContext;

    constructor() {
        makeObservable(this, {
            dragComponent: observable
        });
    }

    get DocumentStore() {
        return this.document.DocumentStore;
    }

    get containerId() {
        return this.tabState.containerId;
    }

    get flow() {
        return this.tabState.flow;
    }

    get flowState() {
        return this.tabState.flowState;
    }

    get frontFace() {
        return this.tabState.frontFace;
    }

    overrideDataContext(dataContextOverridesObject: any): IFlowContext {
        if (!dataContextOverridesObject) {
            return this;
        }
        return Object.assign(new EditorFlowContext(), this, {
            dataContext: this.dataContext.createWithDefaultValueOverrides(
                dataContextOverridesObject
            )
        });
    }

    overrideFlowState(component: Component): IFlowContext {
        return this;
    }

    set(
        tabState: FlowTabState,
        options?: IEditorOptions,
        filterSnapLines?: (node: ITreeObjectAdapter) => boolean
    ) {
        this.tabState = tabState;

        this.document = new FlowDocument(tabState.widgetContainer, this);

        this.editorOptions = options || {
            center: {
                x: 0,
                y: 0
            }
        };

        this.editorOptions.filterSnapLines = filterSnapLines;

        this.dataContext =
            this.document.DocumentStore.dataContext.createWithLocalVariables(
                this.flow.localVariables
            );
    }
}

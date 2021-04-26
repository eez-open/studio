import {
    observable,
    computed,
    action,
    reaction,
    IReactionDisposer
} from "mobx";

import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

import type {
    IDocument,
    IViewState,
    IViewStatePersistantState,
    IFlowContext,
    IEditorOptions,
    IResizeHandler,
    IRunningFlow,
    IDataContext
} from "project-editor/flow/flow-interfaces";
import { Transform } from "project-editor/flow/flow-editor/transform";

import { Component } from "project-editor/flow/component";
import { getId } from "project-editor/core/object";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    @observable transform = new Transform({
        scale: 1,
        translate: { x: 0, y: 0 }
    });

    @observable dxMouseDrag: number | undefined;
    @observable dyMouseDrag: number | undefined;

    persistentStateReactionDisposer: IReactionDisposer;

    constructor(public flowContext: RuntimeFlowContext) {}

    get document() {
        return this.flowContext.document;
    }

    get containerId() {
        return this.flowContext.containerId;
    }

    @action
    set(
        viewStatePersistantState: IViewStatePersistantState | undefined,
        onSavePersistantState: (
            viewStatePersistantState: IViewStatePersistantState
        ) => void
    ) {
        if (this.persistentStateReactionDisposer) {
            this.persistentStateReactionDisposer();
        }

        if (viewStatePersistantState?.transform) {
            this.transform.scale = viewStatePersistantState.transform.scale;
            this.transform.translate =
                viewStatePersistantState.transform.translate;
        } else {
            this.resetTransform();
        }

        if (viewStatePersistantState?.clientRect) {
            this.transform.clientRect = viewStatePersistantState.clientRect;
        }

        this.persistentStateReactionDisposer = reaction(
            () => this.persistentState,
            viewState => onSavePersistantState(viewState)
        );
    }

    @computed
    get persistentState(): IViewStatePersistantState {
        return {
            transform: {
                translate: this.transform.translate,
                scale: this.transform.scale
            },
            clientRect: this.transform.clientRect
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
        return undefined;
    }

    get selectedObjects() {
        return this.document?.flow.selectedItems ?? [];
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

    selectObject(object: ITreeObjectAdapter) {}

    @action
    selectObjects(objects: ITreeObjectAdapter[]) {}

    @action
    deselectAllObjects(): void {}

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
    ) {}

    destroy() {
        this.persistentStateReactionDisposer();
    }
}

////////////////////////////////////////////////////////////////////////////////

export class RuntimeFlowContext implements IFlowContext {
    document: IDocument;
    viewState: ViewState = new ViewState(this);
    editorOptions: IEditorOptions = {};
    frontFace: boolean;
    dataContext: IDataContext;
    runningFlow: IRunningFlow | undefined;

    get containerId() {
        return this.document?.flow
            ? `eez-flow-viewer-${getId(this.document?.flow.object)}-${
                  this.frontFace ? "front" : "back"
              }`
            : "";
    }

    overrideDataContext(dataContextOverridesObject: any): IFlowContext {
        return Object.assign(new RuntimeFlowContext(), this, {
            dataContext: this.dataContext.createWithDefaultValueOverrides(
                dataContextOverridesObject
            )
        });
    }

    overrideRunningFlow(component: Component): IFlowContext {
        return Object.assign(new RuntimeFlowContext(), this, {
            runningFlow: this.runningFlow?.getRunningFlowByComponent(component)
        });
    }

    set(
        document: IDocument,
        viewStatePersistantState: IViewStatePersistantState | undefined,
        onSavePersistantState: (
            viewStatePersistantState: IViewStatePersistantState
        ) => void,
        frontFace: boolean,
        runningFlow: IRunningFlow | undefined
    ) {
        this.document = document;
        this.viewState.set(viewStatePersistantState, onSavePersistantState);
        this.editorOptions = {};
        this.frontFace = frontFace ?? false;
        this.runningFlow = runningFlow;
        this.dataContext = this.document.DocumentStore.dataContext;
    }

    destroy() {
        this.viewState.destroy();
    }
}

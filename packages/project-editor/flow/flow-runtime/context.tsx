import { observable, action } from "mobx";

import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

import type {
    IDocument,
    IViewState,
    IFlowContext,
    IEditorOptions,
    IResizeHandler,
    IDataContext
} from "project-editor/flow/flow-interfaces";
import { Transform } from "project-editor/flow/flow-editor/transform";

import { Component } from "project-editor/flow/component";
import { FlowTabState } from "../flow";
import { FlowDocument } from "./flow-document";

////////////////////////////////////////////////////////////////////////////////

class ViewState implements IViewState {
    get transform() {
        return this.flowContext.tabState.transform;
    }

    set transform(transform: Transform) {
        this.flowContext.tabState.transform = transform;
    }

    @observable dxMouseDrag: number | undefined;
    @observable dyMouseDrag: number | undefined;

    constructor(public flowContext: RuntimeFlowContext) {}

    get document() {
        return this.flowContext.document;
    }

    get containerId() {
        return this.flowContext.containerId;
    }

    @action
    resetTransform() {
        this.flowContext.tabState.resetTransform();
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
}

////////////////////////////////////////////////////////////////////////////////

export class RuntimeFlowContext implements IFlowContext {
    tabState: FlowTabState;
    document: IDocument;

    viewState: ViewState = new ViewState(this);
    editorOptions: IEditorOptions = {};
    dataContext: IDataContext;

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
        return Object.assign(new RuntimeFlowContext(), this, {
            dataContext: this.dataContext.createWithDefaultValueOverrides(
                dataContextOverridesObject
            )
        });
    }

    overrideFlowState(component: Component): IFlowContext {
        return Object.assign(new RuntimeFlowContext(), this, {
            flowState: this.flowState?.getFlowStateByComponent(component)
        });
    }

    set(tabState: FlowTabState) {
        this.tabState = tabState;
        this.document = new FlowDocument(tabState.widgetContainer, this);
        this.editorOptions = {};
        this.dataContext = this.document.DocumentStore.dataContext;
    }
}

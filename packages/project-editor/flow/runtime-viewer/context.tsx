import { observable, action, computed, makeObservable } from "mobx";

import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";

import type {
    IDocument,
    IViewState,
    IFlowContext,
    IEditorOptions,
    IResizeHandler,
    IDataContext
} from "project-editor/flow/flow-interfaces";
import { Transform } from "project-editor/flow/editor/transform";

import type { Component } from "project-editor/flow/component";
import type { ConnectionLine, FlowTabState } from "project-editor/flow/flow";
import { FlowDocument } from "project-editor/flow/runtime-viewer/flow-document";
import type { FlowState } from "project-editor/flow/runtime";
import { ProjectEditor } from "project-editor/project-editor-interface";

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

    constructor(public flowContext: RuntimeFlowContext) {
        makeObservable(this, {
            dxMouseDrag: observable,
            dyMouseDrag: observable,
            resetTransform: action,
            selectObjects: action,
            deselectAllObjects: action
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
        return undefined;
    }

    get selectedObjects() {
        return this.document?.flow.selectedItems ?? [];
    }

    get connectionLine() {
        const connectionLines = this.selectedObjects.filter(
            selectedObject =>
                selectedObject.object instanceof
                ProjectEditor.ConnectionLineClass
        );

        if (connectionLines.length == 1) {
            return connectionLines[0];
        }

        return undefined;
    }

    get sourceComponent() {
        const connectionLine = this.connectionLine;
        if (!connectionLine) {
            return undefined;
        }
        if (
            (connectionLine.object as ConnectionLine).sourceComponent ===
            this.selectedObjects[0].object
        ) {
            return this.selectedObjects[0];
        }

        if (
            (connectionLine.object as ConnectionLine).sourceComponent ===
            this.selectedObjects[1].object
        ) {
            return this.selectedObjects[1];
        }
        return undefined;
    }

    get targetComponent() {
        const connectionLine = this.connectionLine;
        if (!connectionLine) {
            return undefined;
        }
        if (
            (connectionLine.object as ConnectionLine).targetComponent ===
            this.selectedObjects[0].object
        ) {
            return this.selectedObjects[0];
        }

        if (
            (connectionLine.object as ConnectionLine).targetComponent ===
            this.selectedObjects[1].object
        ) {
            return this.selectedObjects[1];
        }
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
        if (object.isSelectable) {
            this.document && this.document.flow.selectItem(object);
        }
    }

    selectObjects(objects: ITreeObjectAdapter[]) {
        this.document &&
            this.document.flow.selectItems(
                objects.filter(object => object.isSelectable)
            );
    }

    deselectAllObjects(): void {
        this.document && this.document.flow.selectItems([]);
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
    ) {}
}

////////////////////////////////////////////////////////////////////////////////

export class RuntimeFlowContext implements IFlowContext {
    tabState: FlowTabState;
    document: IDocument;

    viewState: ViewState = new ViewState(this);
    editorOptions: IEditorOptions = {};
    _dataContext: IDataContext;

    _flowState: FlowState;

    constructor() {
        makeObservable(this, {
            flowState: computed
        });
    }

    get projectEditorStore() {
        return this.document.projectEditorStore;
    }

    get containerId() {
        return this.tabState.containerId;
    }

    get flow() {
        return this.tabState.flow;
    }

    get flowState() {
        return this._flowState || this.tabState.flowState;
    }

    get dataContext() {
        return (
            this._dataContext ||
            this.flowState?.dataContext ||
            this.document.projectEditorStore.dataContext
        );
    }

    get frontFace() {
        return this.tabState.frontFace;
    }

    overrideDataContext(dataContextOverridesObject: any): IFlowContext {
        if (!dataContextOverridesObject) {
            return this;
        }
        return Object.assign(new RuntimeFlowContext(), this, {
            _dataContext: this.dataContext.createWithDefaultValueOverrides(
                dataContextOverridesObject
            )
        });
    }

    overrideFlowState(component: Component): IFlowContext {
        const props: Partial<RuntimeFlowContext> = {
            _flowState: this.flowState?.getFlowStateByComponent(component)
        };
        return Object.assign(new RuntimeFlowContext(), this, props);
    }

    set(tabState: FlowTabState) {
        this.tabState = tabState;
        this.document = new FlowDocument(tabState.widgetContainer, this);
        this.editorOptions = {};
    }
}

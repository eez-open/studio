import { computed } from "mobx";
import { Point, Rect } from "eez-studio-shared/geometry";
import { IDocument } from "project-editor/flow/flow-interfaces";
import { ITransform } from "project-editor/flow/flow-editor/transform";
import { RuntimeFlowContext } from "project-editor/flow/flow-runtime/context";
import { getDocumentStore } from "project-editor/core/store";
import { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { ConnectionLine, Flow } from "project-editor/flow/flow";

export class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private flowContext: RuntimeFlowContext
    ) {}

    @computed get connectionLines(): ITreeObjectAdapter[] {
        return (this.flow.children as ITreeObjectAdapter[]).filter(
            editorObject => editorObject.object instanceof ConnectionLine
        );
    }

    @computed get selectedConnectionLines() {
        return this.connectionLines.filter(connectionLine =>
            this.flowContext.viewState.isObjectIdSelected(connectionLine.id)
        );
    }

    @computed get nonSelectedConnectionLines() {
        return this.connectionLines.filter(
            connectionLine =>
                !this.flowContext.viewState.isObjectIdSelected(
                    connectionLine.id
                )
        );
    }

    findObjectById(id: string) {
        return this.flow.getObjectAdapter(id);
    }

    findObjectParent(object: ITreeObjectAdapter) {
        return this.flow.getParent(object);
    }

    objectFromPoint(point: Point) {
        return undefined;
    }

    resetTransform(transform: ITransform) {
        const flow = this.flow.object as Flow;
        transform.translate = {
            x: -flow.pageRect.width / 2,
            y: -flow.pageRect.height / 2
        };
        transform.scale = 1;
    }

    getObjectsInsideRect(rect: Rect) {
        return [];
    }

    createContextMenu(objects: ITreeObjectAdapter[]) {
        return undefined;
    }

    duplicateSelection() {}

    pasteSelection() {}

    @computed get DocumentStore() {
        return getDocumentStore(this.flow.object);
    }

    onDragStart(): void {}

    onDragEnd(): void {}

    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean {
        return false;
    }

    connect(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ) {}
}

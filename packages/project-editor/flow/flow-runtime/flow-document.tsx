import { computed } from "mobx";
import { Point, Rect } from "eez-studio-shared/geometry";
import { IDocument } from "project-editor/flow/flow-interfaces";
import { RuntimeFlowContext } from "project-editor/flow/flow-runtime/context";
import { getDocumentStore } from "project-editor/core/store";
import { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { ConnectionLine } from "project-editor/flow/flow";
import { getObjectIdFromPoint } from "../flow-editor/bounding-rects";

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
        if (
            !this.DocumentStore.runtimeStore.isDebuggerActive ||
            !this.DocumentStore.runtimeStore.isPaused
        ) {
            return [];
        }

        return this.connectionLines.filter(connectionLine =>
            this.flowContext.viewState.isObjectIdSelected(connectionLine.id)
        );
    }

    @computed get nonSelectedConnectionLines() {
        if (
            !this.DocumentStore.runtimeStore.isDebuggerActive ||
            !this.DocumentStore.runtimeStore.isPaused
        ) {
            return this.connectionLines;
        }

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

    objectFromPoint(point: Point):
        | {
              id: string;
              connectionInput?: string;
              connectionOutput?: string;
          }
        | undefined {
        return getObjectIdFromPoint(this, this.flowContext.viewState, point);
    }

    getObjectsInsideRect(rect: Rect) {
        return [];
    }

    createContextMenu(objects: ITreeObjectAdapter[]) {
        return this.flow.createSelectionContextMenu();
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

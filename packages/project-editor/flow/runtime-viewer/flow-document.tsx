import { computed, makeObservable } from "mobx";
import { Point, Rect } from "eez-studio-shared/geometry";

import { getProjectStore } from "project-editor/store";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import { ProjectEditor } from "project-editor/project-editor-interface";

import type { IDocument } from "project-editor/flow/flow-interfaces";
import type { RuntimeFlowContext } from "project-editor/flow/runtime-viewer/context";

import { getObjectIdFromPoint } from "project-editor/flow/editor/bounding-rects";

export class FlowDocument implements IDocument {
    constructor(
        public flow: TreeObjectAdapter,
        private flowContext: RuntimeFlowContext
    ) {
        makeObservable(this, {
            connectionLines: computed,
            selectedConnectionLines: computed,
            nonSelectedConnectionLines: computed,
            projectStore: computed
        });
    }

    get connectionLines() {
        return (this.flow.children as TreeObjectAdapter[]).filter(
            editorObject =>
                editorObject.object instanceof ProjectEditor.ConnectionLineClass
        );
    }

    get selectedConnectionLines() {
        if (
            this.projectStore.runtime &&
            (!this.projectStore.runtime.isDebuggerActive ||
                !(
                    this.projectStore.runtime.isPaused ||
                    this.projectStore.runtime.isStopped
                ))
        ) {
            return [];
        }

        return this.connectionLines.filter(connectionLine =>
            this.flowContext.viewState.isObjectIdSelected(connectionLine.id)
        );
    }

    get nonSelectedConnectionLines() {
        if (
            this.projectStore.runtime &&
            (!this.projectStore.runtime.isDebuggerActive ||
                !(
                    this.projectStore.runtime.isPaused ||
                    this.projectStore.runtime.isStopped
                ))
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

    findObjectParent(object: TreeObjectAdapter) {
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

    createContextMenu(objects: TreeObjectAdapter[]) {
        return this.flow.createSelectionContextMenu(undefined, false);
    }

    duplicateSelection() {}

    pasteSelection() {}

    get projectStore() {
        return getProjectStore(this.flow.object);
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

    connectToNewTarget(
        sourceObjectId: string,
        connectionOutput: string,
        atPoint: Point
    ) {}
    connectToNewSource(
        targetObjectId: string,
        connectionInput: string,
        atPoint: Point
    ) {}
}

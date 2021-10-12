import { computed } from "mobx";
import { Point, Rect } from "eez-studio-shared/geometry";
import { IDocument } from "project-editor/flow/flow-interfaces";
import { EditorFlowContext } from "project-editor/flow/flow-editor/context";
import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/flow-editor/bounding-rects";
import { IEezObject, getParent } from "project-editor/core/object";
import { getDocumentStore } from "project-editor/core/store";
import { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";

export class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private flowContext: EditorFlowContext
    ) {}

    @computed get connectionLines(): ITreeObjectAdapter[] {
        return (this.flow.children as ITreeObjectAdapter[]).filter(
            editorObject => editorObject.object instanceof ConnectionLine
        );
    }

    @computed get selectedConnectionLines() {
        return this.connectionLines.filter(
            connectionLine =>
                this.flowContext.viewState.isObjectIdSelected(
                    connectionLine.id
                ) ||
                this.flowContext.viewState.isConnectionLineHovered(
                    connectionLine.object as ConnectionLine
                )
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
        const ids = getObjectIdsInsideRect(this.flowContext.viewState, rect);

        const editorObjectsGroupedByParent = new Map<
            IEezObject,
            ITreeObjectAdapter[]
        >();
        let maxLengthGroup: ITreeObjectAdapter[] | undefined;

        ids.forEach(id => {
            const editorObject = this.findObjectById(id);
            if (
                editorObject &&
                !(editorObject.object instanceof ConnectionLine)
            ) {
                const parent = getParent(editorObject.object);

                let group = editorObjectsGroupedByParent.get(parent);

                if (!group) {
                    group = [editorObject];
                    editorObjectsGroupedByParent.set(parent, group);
                } else {
                    group.push(editorObject);
                }

                if (!maxLengthGroup || group.length > maxLengthGroup.length) {
                    maxLengthGroup = group;
                }
            }
        });

        return maxLengthGroup ? maxLengthGroup : [];
    }

    createContextMenu(objects: ITreeObjectAdapter[]) {
        return this.flow.createSelectionContextMenu({
            duplicateSelection: this.duplicateSelection,
            pasteSelection: this.pasteSelection
        });
    }

    duplicateSelection = () => {
        this.DocumentStore.undoManager.setCombineCommands(true);

        this.flow.duplicateSelection();

        this.flowContext.viewState.selectedObjects.forEach(objectAdapter => {
            if (objectAdapter.object instanceof Component) {
                this.flowContext.DocumentStore.updateObject(
                    objectAdapter.object,
                    {
                        left: objectAdapter.object.left + 20,
                        top: objectAdapter.object.top + 20
                    }
                );
            }
        });

        this.DocumentStore.undoManager.setCombineCommands(false);
    };

    pasteSelection = () => {
        this.DocumentStore.undoManager.setCombineCommands(true);

        this.flow.pasteSelection();

        const rectBounding = getSelectedObjectsBoundingRect(
            this.flowContext.viewState
        );
        const rectPage = this.flowContext.viewState.transform.clientToPageRect(
            this.flowContext.viewState.transform.clientRect
        );

        const left = rectPage.left + (rectPage.width - rectBounding.width) / 2;
        const top = rectPage.top + (rectPage.height - rectBounding.height) / 2;

        this.flowContext.viewState.selectedObjects.forEach(objectAdapter => {
            if (objectAdapter.object instanceof Component) {
                this.flowContext.DocumentStore.updateObject(
                    objectAdapter.object,
                    {
                        left:
                            left +
                            (objectAdapter.object.left - rectBounding.left),
                        top: top + (objectAdapter.object.top - rectBounding.top)
                    }
                );
            }
        });

        this.DocumentStore.undoManager.setCombineCommands(false);
    };

    @computed get DocumentStore() {
        return getDocumentStore(this.flow.object);
    }

    onDragStart(): void {
        this.DocumentStore.undoManager.setCombineCommands(true);
    }

    onDragEnd(): void {
        this.DocumentStore.undoManager.setCombineCommands(false);
    }

    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean {
        const flow = this.flow.object as Flow;

        const sourceObject = this.DocumentStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.DocumentStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        return !!flow.connectionLines.find(
            connectionLine =>
                connectionLine.source == sourceObject.wireID &&
                connectionLine.output == connectionOutput &&
                connectionLine.target == targetObject.wireID &&
                connectionLine.input == connectionInput
        );
    }

    connect(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ) {
        const flow = this.flow.object as Flow;

        const sourceObject = this.DocumentStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.DocumentStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        this.DocumentStore.addObject(flow.connectionLines, {
            source: sourceObject.wireID,
            output: connectionOutput,
            target: targetObject.wireID,
            input: connectionInput
        });
    }
}

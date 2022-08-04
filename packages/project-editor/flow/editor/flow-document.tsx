import { computed, makeObservable } from "mobx";
import { Point, Rect } from "eez-studio-shared/geometry";
import type { IDocument } from "project-editor/flow/flow-interfaces";
import type { EditorFlowContext } from "project-editor/flow/editor/context";
import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/editor/bounding-rects";
import { IEezObject, getParent } from "project-editor/core/object";
import { createObject, getDocumentStore } from "project-editor/store";
import type { ITreeObjectAdapter } from "project-editor/core/objectAdapter";
import { ConnectionLine, Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";
import { _intersection } from "eez-studio-shared/algorithm";
import { ProjectEditor } from "project-editor/project-editor-interface";

export class FlowDocument implements IDocument {
    constructor(
        public flow: ITreeObjectAdapter,
        private flowContext: EditorFlowContext
    ) {
        makeObservable(this, {
            connectionLines: computed,
            selectedConnectionLines: computed,
            selectedAndHoveredConnectionLines: computed,
            nonSelectedConnectionLines: computed,
            projectEditorStore: computed
        });
    }

    get connectionLines(): ITreeObjectAdapter[] {
        return (this.flow.children as ITreeObjectAdapter[]).filter(
            editorObject =>
                editorObject.object instanceof ProjectEditor.ConnectionLineClass
        );
    }

    get selectedConnectionLines() {
        return this.connectionLines.filter(connectionLine =>
            this.flowContext.viewState.isObjectIdSelected(connectionLine.id)
        );
    }

    get selectedAndHoveredConnectionLines() {
        const selectedAndHoveredConnectionLines = this.connectionLines.filter(
            connectionLine =>
                this.flowContext.viewState.isObjectIdSelected(
                    connectionLine.id
                ) ||
                this.flowContext.viewState.isConnectionLineHovered(
                    connectionLine.object as ConnectionLine
                )
        );

        return _intersection(
            selectedAndHoveredConnectionLines,
            this.selectedConnectionLines
        ).length == 0
            ? selectedAndHoveredConnectionLines
            : this.selectedConnectionLines;
    }

    get nonSelectedConnectionLines() {
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
                !(
                    editorObject.object instanceof
                    ProjectEditor.ConnectionLineClass
                )
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
        this.projectEditorStore.undoManager.setCombineCommands(true);

        this.flow.duplicateSelection();

        this.flowContext.viewState.selectedObjects.forEach(objectAdapter => {
            if (objectAdapter.object instanceof Component) {
                this.flowContext.projectEditorStore.updateObject(
                    objectAdapter.object,
                    {
                        left: objectAdapter.object.left + 20,
                        top: objectAdapter.object.top + 20
                    }
                );
            }
        });

        this.projectEditorStore.undoManager.setCombineCommands(false);
    };

    pasteSelection = () => {
        this.projectEditorStore.undoManager.setCombineCommands(true);

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
                this.flowContext.projectEditorStore.updateObject(
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

        this.projectEditorStore.undoManager.setCombineCommands(false);
    };

    get projectEditorStore() {
        return getDocumentStore(this.flow.object);
    }

    onDragStart(): void {
        this.projectEditorStore.undoManager.setCombineCommands(true);
    }

    onDragEnd(): void {
        this.projectEditorStore.undoManager.setCombineCommands(false);
    }

    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean {
        const flow = this.flow.object as Flow;

        const sourceObject = this.projectEditorStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.projectEditorStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        return !!flow.connectionLines.find(
            connectionLine =>
                connectionLine.source == sourceObject.objID &&
                connectionLine.output == connectionOutput &&
                connectionLine.target == targetObject.objID &&
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

        const sourceObject = this.projectEditorStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.projectEditorStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        const connectionLine = createObject<ConnectionLine>(
            this.flowContext.projectEditorStore,
            {
                source: sourceObject.objID,
                output: connectionOutput,
                target: targetObject.objID,
                input: connectionInput
            },
            ConnectionLine
        );

        this.projectEditorStore.addObject(flow.connectionLines, connectionLine);
    }
}

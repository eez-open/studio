import { computed, makeObservable, runInAction } from "mobx";
import { intersection } from "lodash";
import { MenuItem } from "@electron/remote";

import type { Point, Rect } from "eez-studio-shared/geometry";
import type { IDocument } from "project-editor/flow/flow-interfaces";
import type { EditorFlowContext } from "project-editor/flow/editor/context";
import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect
} from "project-editor/flow/editor/bounding-rects";
import { IEezObject, getId, getParent } from "project-editor/core/object";
import {
    createObject,
    getAncestorOfType,
    getProjectStore
} from "project-editor/store";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import type { Flow } from "project-editor/flow/flow";
import { ConnectionLine } from "project-editor/flow/connection-line";
import { Component } from "project-editor/flow/component";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Page } from "project-editor/features/page/page";
import { canPasteWithDependencies } from "project-editor/store/paste-with-dependencies";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import { selectComponentDialog } from "project-editor/flow/editor/ComponentsPalette";
import {
    IsTrueActionComponent,
    LogActionComponent
} from "../components/actions";

export class FlowDocument implements IDocument {
    constructor(
        public flow: TreeObjectAdapter,
        private flowContext: EditorFlowContext
    ) {
        makeObservable(this, {
            connectionLines: computed,
            selectedConnectionLines: computed,
            selectedAndHoveredConnectionLines: computed,
            nonSelectedConnectionLines: computed,
            projectStore: computed
        });
    }

    get connectionLines(): TreeObjectAdapter[] {
        return (this.flow.children as TreeObjectAdapter[]).filter(
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

        return intersection(
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
        const ids = getObjectIdsInsideRect(this.flowContext.viewState, rect);

        const editorObjectsGroupedByParent = new Map<
            IEezObject,
            TreeObjectAdapter[]
        >();
        let maxLengthGroup: TreeObjectAdapter[] | undefined;

        ids.forEach(id => {
            const editorObject = this.findObjectById(id);
            if (
                editorObject &&
                !(
                    editorObject.object instanceof
                    ProjectEditor.ConnectionLineClass
                )
            ) {
                let parent = getParent(editorObject.object);

                // make sure we can select action components with the widgets that are immediate children of LVGLScreenWidget
                if (
                    editorObject.object instanceof ProjectEditor.LVGLWidgetClass
                ) {
                    const page = getAncestorOfType<Page>(
                        parent,
                        ProjectEditor.PageClass.classInfo
                    );

                    if (
                        page &&
                        page.lvglScreenWidget &&
                        parent == page.lvglScreenWidget.children
                    ) {
                        parent = page.components;
                    }
                }

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

    createContextMenu(
        objects: TreeObjectAdapter[],
        options?: {
            atPoint?: Point;
        }
    ) {
        const flow = this.flow.object;
        const isPage = flow instanceof ProjectEditor.PageClass;

        let additionalMenuItems: Electron.MenuItem[] = [];

        if (isPage && objects.length == 0) {
            additionalMenuItems.push(
                new MenuItem({
                    label: "Center View",
                    click: async () => {
                        this.flowContext.viewState.centerView();
                    }
                })
            );

            additionalMenuItems.push(
                new MenuItem({
                    label: "Center View on All Pages",
                    click: async () => {
                        this.flowContext.viewState.centerView();

                        for (const page of this.projectStore.project.pages) {
                            if (page != this.flow.object) {
                                const editor =
                                    this.projectStore.editorsStore.getEditorByObject(
                                        page
                                    );
                                if (editor?.state) {
                                    const pageTabState =
                                        editor.state as PageTabState;

                                    pageTabState.centerView();
                                } else {
                                    let uiState =
                                        this.projectStore.uiStateStore.getObjectUIState(
                                            page,
                                            "flow-state"
                                        );

                                    if (!uiState) {
                                        uiState = {};
                                    }

                                    uiState.transform = {
                                        translate: {
                                            x: this.flowContext.viewState
                                                .transform.translate.x,
                                            y: this.flowContext.viewState
                                                .transform.translate.y
                                        },
                                        scale:
                                            uiState.transform?.scale ??
                                            this.flowContext.viewState.transform
                                                .scale
                                    };

                                    runInAction(() => {
                                        this.projectStore.uiStateStore.updateObjectUIState(
                                            page,
                                            "flow-state",
                                            uiState
                                        );
                                    });
                                }
                            }
                        }
                    }
                })
            );

            if (!this.projectStore.uiStateStore.globalFlowZoom) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Set the Same Zoom for All Pages",
                        click: async () => {
                            for (const page of this.projectStore.project
                                .pages) {
                                if (page != this.flow.object) {
                                    let uiState =
                                        this.projectStore.uiStateStore.getObjectUIState(
                                            page,
                                            "flow-state"
                                        );

                                    if (!uiState) {
                                        uiState = {};
                                    }

                                    uiState.transform = {
                                        translate: {
                                            x: this.flowContext.viewState
                                                .transform.translate.x,
                                            y: this.flowContext.viewState
                                                .transform.translate.y
                                        },
                                        scale: this.flowContext.viewState
                                            .transform.scale
                                    };

                                    runInAction(() => {
                                        this.projectStore.uiStateStore.updateObjectUIState(
                                            page,
                                            "flow-state",
                                            uiState
                                        );
                                    });
                                }
                            }
                        }
                    })
                );
            }
        }

        return this.flow.createSelectionContextMenu(
            {
                add: false,
                atPoint: options?.atPoint
            },
            undefined,
            additionalMenuItems
        );
    }

    duplicateSelection = () => {
        this.projectStore.undoManager.setCombineCommands(true);

        this.flow.duplicateSelection();

        this.flowContext.viewState.selectedObjects.forEach(objectAdapter => {
            if (objectAdapter.object instanceof Component) {
                this.flowContext.projectStore.updateObject(
                    objectAdapter.object,
                    {
                        left: objectAdapter.object.left + 20,
                        top: objectAdapter.object.top + 20
                    }
                );
            }
        });

        this.projectStore.undoManager.setCombineCommands(false);
    };

    pasteSelection = () => {
        if (canPasteWithDependencies(this.projectStore)) {
            this.flow.pasteSelection();
        } else if (this.flow.canPaste()) {
            this.projectStore.undoManager.setCombineCommands(true);

            this.flow.pasteSelection();

            const rectBounding = getSelectedObjectsBoundingRect(
                this.flowContext.viewState
            );
            const rectPage =
                this.flowContext.viewState.transform.clientToPageRect(
                    this.flowContext.viewState.transform.clientRect
                );

            const left =
                rectPage.left + (rectPage.width - rectBounding.width) / 2;
            const top =
                rectPage.top + (rectPage.height - rectBounding.height) / 2;

            this.flowContext.viewState.selectedObjects.forEach(
                objectAdapter => {
                    if (objectAdapter.object instanceof Component) {
                        this.flowContext.projectStore.updateObject(
                            objectAdapter.object,
                            {
                                left:
                                    left +
                                    (objectAdapter.object.left -
                                        rectBounding.left),
                                top:
                                    top +
                                    (objectAdapter.object.top -
                                        rectBounding.top)
                            }
                        );
                    }
                }
            );

            this.projectStore.undoManager.setCombineCommands(false);
        }
    };

    get projectStore() {
        return getProjectStore(this.flow.object);
    }

    onDragStart(): void {
        this.projectStore.undoManager.setCombineCommands(true);
    }

    onDragEnd(): void {
        this.projectStore.undoManager.setCombineCommands(false);
    }

    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean {
        const flow = this.flow.object as Flow;

        const sourceObject = this.projectStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.projectStore.getObjectFromObjectId(
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

        const sourceObject = this.projectStore.getObjectFromObjectId(
            sourceObjectId
        ) as Component;
        const targetObject = this.projectStore.getObjectFromObjectId(
            targetObjectId
        ) as Component;

        const connectionLine = createObject<ConnectionLine>(
            this.flowContext.projectStore,
            {
                source: sourceObject.objID,
                output: connectionOutput,
                target: targetObject.objID,
                input: connectionInput
            },
            ConnectionLine
        );

        this.projectStore.addObject(flow.connectionLines, connectionLine);
    }

    async connectToNewTarget(
        sourceObjectId: string,
        connectionOutputName: string,
        atPoint: Point
    ) {
        const component = await selectComponentDialog(
            this.flowContext.projectStore,
            "actions"
        );

        if (component) {
            component.left = Math.round(atPoint.x);
            component.top = Math.round(atPoint.y);

            this.flowContext.projectStore.undoManager.setCombineCommands(true);

            const flow = this.flow.object as Flow;
            let targetObject = this.flowContext.projectStore.addObject(
                flow.components,
                component
            ) as Component;

            const sourceObject = this.projectStore.getObjectFromObjectId(
                sourceObjectId
            ) as Component;

            let updatePositionInterval: NodeJS.Timer | undefined;

            const connectionOutput = sourceObject
                .getOutputs()
                .find(output => output.name == connectionOutputName);
            if (connectionOutput) {
                let connectionInput = targetObject
                    .getInputs()
                    .find(
                        input =>
                            input.isSequenceInput ==
                            connectionOutput.isSequenceOutput
                    );

                if (!connectionInput) {
                    connectionInput = targetObject.getInputs()[0];
                }

                if (connectionInput) {
                    if (
                        targetObject instanceof IsTrueActionComponent ||
                        targetObject instanceof LogActionComponent
                    ) {
                        if (connectionInput.isSequenceInput) {
                            this.projectStore.updateObject(targetObject, {
                                value: "",
                                customInputs: []
                            });
                        }
                    }

                    const connectionLine = createObject<ConnectionLine>(
                        this.flowContext.projectStore,
                        {
                            source: sourceObject.objID,
                            output: connectionOutputName,
                            target: targetObject.objID,
                            input: connectionInput.name
                        },
                        ConnectionLine
                    );

                    this.projectStore.addObject(
                        flow.connectionLines,
                        connectionLine
                    );

                    updatePositionInterval = setInterval(() => {
                        if (!targetObject._geometry) {
                            return;
                        }
                        clearInterval(updatePositionInterval);

                        const xOffset =
                            Math.round(atPoint.x) -
                            connectionLine._targetPosition!.x;
                        const yOffset =
                            Math.round(atPoint.y) -
                            connectionLine._targetPosition!.y;
                        this.projectStore.updateObject(targetObject, {
                            left: targetObject.left + xOffset,
                            top: targetObject.top + yOffset
                        });

                        this.flowContext.projectStore.undoManager.setCombineCommands(
                            false
                        );
                    }, 0);
                }
            }

            if (!updatePositionInterval) {
                this.flowContext.projectStore.undoManager.setCombineCommands(
                    false
                );
            }
            //
            const objectAdapter = this.flowContext.document.findObjectById(
                getId(targetObject)
            );
            if (objectAdapter) {
                const viewState = this.flowContext.viewState;
                viewState.selectObjects([objectAdapter]);
            }
        }
    }

    async connectToNewSource(
        targetObjectId: string,
        connectionInputName: string,
        atPoint: Point
    ) {
        const component = await selectComponentDialog(
            this.flowContext.projectStore,
            "actions"
        );

        if (component) {
            component.left = Math.round(atPoint.x);
            component.top = Math.round(atPoint.y);

            this.flowContext.projectStore.undoManager.setCombineCommands(true);

            const flow = this.flow.object as Flow;
            let sourceObject = this.flowContext.projectStore.addObject(
                flow.components,
                component
            ) as Component;

            const targetObject = this.projectStore.getObjectFromObjectId(
                targetObjectId
            ) as Component;

            let updatePositionInterval: NodeJS.Timer | undefined;

            const connectionInput = targetObject
                .getInputs()
                .find(input => input.name == connectionInputName);
            if (connectionInput) {
                let connectionOutput = sourceObject
                    .getOutputs()
                    .find(
                        output =>
                            output.isSequenceOutput ==
                            connectionInput.isSequenceInput
                    );

                if (!connectionOutput) {
                    connectionOutput = sourceObject.getOutputs()[0];
                }

                if (connectionOutput) {
                    const connectionLine = createObject<ConnectionLine>(
                        this.flowContext.projectStore,
                        {
                            source: sourceObject.objID,
                            output: connectionOutput.name,
                            target: targetObject.objID,
                            input: connectionInputName
                        },
                        ConnectionLine
                    );

                    this.projectStore.addObject(
                        flow.connectionLines,
                        connectionLine
                    );

                    updatePositionInterval = setInterval(() => {
                        if (!sourceObject._geometry) {
                            return;
                        }
                        clearInterval(updatePositionInterval);

                        const xOffset =
                            Math.round(atPoint.x) -
                            connectionLine._sourcePosition!.x;
                        const yOffset =
                            Math.round(atPoint.y) -
                            connectionLine._sourcePosition!.y;
                        this.projectStore.updateObject(sourceObject, {
                            left: sourceObject.left + xOffset,
                            top: sourceObject.top + yOffset
                        });

                        this.flowContext.projectStore.undoManager.setCombineCommands(
                            false
                        );
                    }, 0);
                }
            }
            if (!updatePositionInterval) {
                this.flowContext.projectStore.undoManager.setCombineCommands(
                    false
                );
            }
            //
            const objectAdapter = this.flowContext.document.findObjectById(
                getId(sourceObject)
            );
            if (objectAdapter) {
                const viewState = this.flowContext.viewState;
                viewState.selectObjects([objectAdapter]);
            }
        }
    }
}

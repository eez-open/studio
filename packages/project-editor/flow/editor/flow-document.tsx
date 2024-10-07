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
import { IEezObject, getParent } from "project-editor/core/object";
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
import { PageTabState } from "project-editor/features/page/PageEditor";

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

    createContextMenu(objects: TreeObjectAdapter[]) {
        return this.flow.createSelectionContextMenu(
            {
                add: false
            },
            undefined,
            this.flow.object instanceof ProjectEditor.PageClass &&
                objects.length == 0
                ? [
                      new MenuItem({
                          label: "Center View",
                          click: async () => {
                              this.flowContext.viewState.centerView();
                          }
                      }),
                      new MenuItem({
                          label: "Center View on All Pages",
                          click: async () => {
                              this.flowContext.viewState.centerView();

                              for (const page of this.projectStore.project
                                  .pages) {
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
                                                  this.flowContext.viewState
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
                          }
                      }),
                      ...(this.projectStore.uiStateStore.globalFlowZoom
                          ? []
                          : [
                                new MenuItem({
                                    label: "Set the Same Zoom for All Pages",
                                    click: async () => {
                                        for (const page of this.projectStore
                                            .project.pages) {
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
                                                        x: this.flowContext
                                                            .viewState.transform
                                                            .translate.x,
                                                        y: this.flowContext
                                                            .viewState.transform
                                                            .translate.y
                                                    },
                                                    scale: this.flowContext
                                                        .viewState.transform
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
                                })
                            ])
                  ]
                : undefined
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
        } else {
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
}

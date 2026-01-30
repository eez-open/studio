import { computed, makeObservable, runInAction } from "mobx";
import { intersection } from "lodash";
import { MenuItem } from "@electron/remote";

import { type Point, type Rect } from "eez-studio-shared/geometry";
import type { IDocument } from "project-editor/flow/flow-interfaces";
import type { EditorFlowContext } from "project-editor/flow/editor/context";
import {
    getObjectIdFromPoint,
    getObjectIdsInsideRect,
    getSelectedObjectsBoundingRect,
    isLVGLWidgetOutsideOfItsPageBounds
} from "project-editor/flow/editor/bounding-rects";
import { EezObject, IEezObject, getId, getParent } from "project-editor/core/object";
import {
    createObject,
    updateObject,
    deleteObject,
    getAncestorOfType,
    getProjectStore
} from "project-editor/store";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";
import type { Flow } from "project-editor/flow/flow";
import { ConnectionLine } from "project-editor/flow/connection-line";
import { Component, ActionComponent } from "project-editor/flow/component";
import { ComponentGroup } from "project-editor/flow/component-group";
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

        if (!maxLengthGroup) {
            return [];
        }

        // if single LVGLWidget is selected and this widget is not with its page bounds, exclude it from selection
        const lvglWidgets = maxLengthGroup.filter(editorObject => editorObject.object instanceof ProjectEditor.LVGLWidgetClass);
        if (
            lvglWidgets.length == 1 &&
            isLVGLWidgetOutsideOfItsPageBounds(lvglWidgets[0], this, this.flowContext.viewState)
        ) {
            return maxLengthGroup.filter(editorObject => editorObject != lvglWidgets[0]);
        }

        return maxLengthGroup;
    }

    createContextMenu(
        objects: TreeObjectAdapter[],
        options?: {
            atPoint?: Point;
        }
    ) {
        const flow = this.flow.object as Flow;

        let additionalMenuItems: Electron.MenuItem[] = [];

        // Add Group/Ungroup menu items for action components
        const selectedActionComponents = objects.filter(
            obj => obj.object instanceof ActionComponent
        );
        const selectedGroups = objects.filter(
            obj => obj.object instanceof ComponentGroup
        );
        // Only show grouping options when all selected objects are either ActionComponents or ComponentGroups
        if (selectedActionComponents.length + selectedGroups.length == objects.length) {
            // Filter out components that are already in a group
            const componentsNotInGroup = selectedActionComponents.filter(obj => {
                return !this.findGroupForComponent((obj.object as EezObject).objID);
            });

            // Find components that are in a group
            const componentsInGroup = selectedActionComponents.filter(obj => {
                return !!this.findGroupForComponent((obj.object as EezObject).objID);
            });

            // Check if all components in groups belong to the same group
            let commonGroup: ComponentGroup | undefined;
            if (componentsInGroup.length > 0) {
                commonGroup = this.findGroupForComponent(
                    (componentsInGroup[0].object as EezObject).objID
                );

                // Verify all other components are in the same group
                for (let i = 1; i < componentsInGroup.length; i++) {
                    const group = this.findGroupForComponent((componentsInGroup[i].object as EezObject).objID);
                    if (group !== commonGroup) {
                        commonGroup = undefined;
                        break;
                    }
                }
            }

            // Add to Group option when:
            // 1. A group is explicitly selected with ungrouped components, OR
            // 2. Some components are in the same group and others are not
            let addToGroupShown = false;
            if (selectedGroups.length === 1 && componentsNotInGroup.length >= 1) {
                // Add to explicitly selected group
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Add to Group",
                        click: async () => {
                            this.addComponentsToGroup(
                                selectedGroups[0].object as ComponentGroup,
                                componentsNotInGroup
                            );
                        }
                    })
                );
                addToGroupShown = true;
            } else if (selectedGroups.length === 0 && commonGroup && componentsNotInGroup.length >= 1) {
                // Add to the common group that some selected components belong to
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Add to Group",
                        click: async () => {
                            this.addComponentsToGroup(
                                commonGroup!,
                                componentsNotInGroup
                            );
                        }
                    })
                );
                addToGroupShown = true;
            }

            // Show Group option only when:
            // - There are ungrouped components AND
            // - "Add to Group" is not shown (no mixed selection with grouped components)
            if (componentsNotInGroup.length >= 1 && !addToGroupShown) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Group",
                        click: async () => {
                            this.groupSelectedComponents(componentsNotInGroup);
                        }
                    })
                );
            }

            if (componentsInGroup.length > 0) {
                // Show Ungroup option when there are components in groups
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Remove from Group",
                        click: async () => {
                            this.projectStore.undoManager.setCombineCommands(true);
                            for (const obj of componentsInGroup) {
                                this.ungroupComponent((obj.object as EezObject).objID);
                            }
                            this.projectStore.undoManager.setCombineCommands(false);
                        }
                    })
                );
            } else if (selectedGroups.length > 0) {
                // Show Ungroup All option when groups are selected
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Ungroup All",
                        click: async () => {
                            this.projectStore.undoManager.setCombineCommands(true);
                            for (const group of selectedGroups) {
                                this.projectStore.deleteObject(
                                    group.object
                                );
                            }
                            this.projectStore.undoManager.setCombineCommands(false);
                        }
                    })
                );
            }

            // Add Merge Groups menu item when multiple groups are selected
            if (selectedGroups.length >= 2) {
                additionalMenuItems.push(
                    new MenuItem({
                        label: "Merge Groups",
                        click: async () => {
                            this.mergeGroups(
                                selectedGroups.map(
                                    obj => obj.object as ComponentGroup
                                )
                            );
                        }
                    })
                );
            }
        }

        if (additionalMenuItems.length > 0) {
            additionalMenuItems.push(
                new MenuItem({
                    type: "separator"
                })
            );
        }

        const isPage = flow instanceof ProjectEditor.PageClass;
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

    // Group management methods
    findGroupForComponent(componentId: string): ComponentGroup | undefined {
        const flow = this.flow.object as Flow;
        return flow.componentGroups.find(group =>
            group.components.includes(componentId)
        );
    }

    groupSelectedComponents(selectedComponents: TreeObjectAdapter[]) {
        const flow = this.flow.object as Flow;
        const componentIds = selectedComponents.map(obj => (obj.object as EezObject).objID);

        this.projectStore.undoManager.setCombineCommands(true);

        const group = createObject<ComponentGroup>(
            this.projectStore,
            {
                description: "Group",
                components: componentIds
            },
            ComponentGroup
        );

        this.projectStore.addObject(flow.componentGroups, group);

        this.projectStore.undoManager.setCombineCommands(false);

        const groupAdapter = this.flowContext.document.findObjectById(
            getId(group)
        );
        if (groupAdapter) {
            this.flowContext.viewState.deselectAllObjects();
            this.flowContext.viewState.selectObject(groupAdapter);
        }
    }

    ungroupComponent(componentId: string) {
        const group = this.findGroupForComponent(componentId);
        if (group) {
            const index = group.components.indexOf(componentId);
            const newComponents = [...group.components];
            newComponents.splice(index, 1);
            updateObject(group, { components: newComponents });

            // Delete group if it has no components
            if (newComponents.length === 0) {
                deleteObject(group);
            }
        }
    }

    addComponentsToGroup(
        group: ComponentGroup,
        componentsToAdd: TreeObjectAdapter[]
    ) {
        const newComponentIds = componentsToAdd.map(obj => (obj.object as EezObject).objID);
        const updatedComponents = [...group.components, ...newComponentIds];

        updateObject(group, { components: updatedComponents });
    }

    mergeGroups(groups: ComponentGroup[]) {
        if (groups.length < 2) return;

        // Use the first group as the target, merge all others into it
        const targetGroup = groups[0];
        const allComponentIds = new Set<string>(targetGroup.components);

        // Collect all component IDs and descriptions from other groups
        const descriptions: string[] = [];
        for (const group of groups) {
            if (group.description && group.description.trim()) {
                descriptions.push(group.description.trim());
            }
            if (group !== targetGroup) {
                group.components.forEach(id => allComponentIds.add(id));
            }
        }

        this.projectStore.undoManager.setCombineCommands(true);

        // Update the target group with all components and merged description
        updateObject(targetGroup, {
            components: Array.from(allComponentIds),
            description: descriptions.join(", ")
        });

        // Delete the other groups
        for (let i = 1; i < groups.length; i++) {
            this.projectStore.deleteObject(groups[i]);
        }

        this.projectStore.undoManager.setCombineCommands(false);

        // Select the merged group
        runInAction(() => {
            const groupAdapter = this.flowContext.document.findObjectById(
                getId(targetGroup)
            );
            if (groupAdapter) {
                this.flow.selectItem(groupAdapter);
            }
        });
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

import type { Point, Rect } from "eez-studio-shared/geometry";
import type { TreeObjectAdapter } from "project-editor/core/objectAdapter";

import type { ProjectStore } from "project-editor/store";

import type { Transform } from "project-editor/flow/editor/transform";
import type { Component, Widget } from "project-editor/flow/component";
import type { ValueType } from "eez-studio-types";

export interface IFlowContext {
    dataContext: IDataContext;
    flowState?: IFlowState;
    document: IDocument;
    projectStore: ProjectStore;
    viewState: IViewState;
    editorOptions: IEditorOptions;
    frontFace: boolean;

    overrideDataContext(dataContextOverridesObject: any): IFlowContext;
    overrideFlowState(component: Component): IFlowContext;
}

export interface IVariable {
    name: string;
    fullName: string;
    description?: string;
    type: string;
    defaultValue: any;
    defaultValueList: any;
    persistent: boolean;
}

export interface IDataContext {
    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext;
    createWithLocalVariables(variables: IVariable[]): IDataContext;

    has(variableName: string): boolean;
    get(variableName: string): any;
    set(variableName: string, value: any): void;

    getEnumValue(variableName: string): number;
    getBool(variableName: string): boolean;
    getValueList(variableName: string): string[];

    debugInfo: any;
}

export type LogItemType =
    | "fatal"
    | "error"
    | "warning"
    | "scpi"
    | "info"
    | "debug";

export interface IRuntime {
    assignValue(
        flowState: IFlowState,
        sourceComponent: Component,
        assignableExpression: string,
        value: any
    ): void;
    propagateValue(
        flowState: IFlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ): void;
    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        actionName: string,
        value: any,
        valueType: ValueType
    ): void;
    throwError(
        flowState: IFlowState,
        sourceComponent: Component,
        message: string
    ): void;
    selectedPage: IFlow;
}

export interface IFlow {}

export interface IComponentState {
    inputsData: Map<string, any>;
    asyncState: boolean;
    executionState: any;
}

export interface IFlowState {
    getFlowStateByComponent(component: Component): IFlowState | undefined;

    getInputValue(component: Component, input: string): any;
    evalExpression(component: Component, expression: string): any;

    getComponentState(component: Component): IComponentState;

    getComponentExecutionState<T>(component: Component): T | undefined;
    setComponentExecutionState<T>(
        component: Component,
        executionState: T
    ): void;

    dataContext: IDataContext;
    runtime: IRuntime;
    flow: IFlow;
    projectStore: any;

    getVariable(component: Component, variableName: string): any;
    setVariable(component: Component, variableName: string, value: any): void;

    log(
        type: LogItemType,
        message: string,
        component: Component | undefined
    ): void;

    timelinePosition: number;
}

export interface IDocument {
    projectStore: ProjectStore;

    flow: TreeObjectAdapter;

    selectedConnectionLines: TreeObjectAdapter[];
    nonSelectedConnectionLines: TreeObjectAdapter[];

    findObjectById(id: string): TreeObjectAdapter | undefined;
    findObjectParent(object: TreeObjectAdapter): TreeObjectAdapter | undefined;

    // view
    objectFromPoint(point: Point):
        | {
              id: string;
              connectionInput?: string;
              connectionOutput?: string;
          }
        | undefined;
    getObjectsInsideRect(rect: Rect): TreeObjectAdapter[];

    // misc.
    createContextMenu(objects: TreeObjectAdapter[]): Electron.Menu | undefined;
    duplicateSelection(): void;
    pasteSelection(): void;

    // events
    onDragStart(): void;
    onDragEnd(): void;

    //
    connectionExists(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): boolean;
    connect(
        sourceObjectId: string,
        connectionOutput: string,
        targetObjectId: string,
        connectionInput: string
    ): void;
    connectToNewTarget(
        sourceObjectId: string,
        connectionOutput: string,
        atPoint: Point
    ): void;
    connectToNewSource(
        targetObjectId: string,
        connectionInput: string,
        atPoint: Point
    ): void;
}

export interface ObjectIdUnderPointer {
    id: string;
    connectionInput: string | undefined;
    connectionOutput: string | undefined;
}

export interface IViewState {
    projectStore: ProjectStore;

    containerId: string;

    transform: Transform;
    resetTransform(): void;

    // selection
    selectedObjects: TreeObjectAdapter[];
    getResizeHandlers: () => IResizeHandler[] | undefined;

    isObjectSelected(object: TreeObjectAdapter): boolean;
    isObjectIdSelected(id: string): boolean;

    selectObject(object: TreeObjectAdapter): void;
    selectObjects(objects: TreeObjectAdapter[]): void;
    deselectAllObjects(): void;

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
    ): void;

    dxMouseDrag: number | undefined;
    dyMouseDrag: number | undefined;

    sourceComponent: TreeObjectAdapter | undefined;
    connectionLine: TreeObjectAdapter | undefined;
    targetComponent: TreeObjectAdapter | undefined;
}

export interface IEditorOptions {
    center?: Point;
    filterSnapLines?: (node: TreeObjectAdapter) => boolean;
    disableUpdateComponentGeometry?: boolean;
}

export type HandleType =
    | "nw-resize"
    | "n-resize"
    | "ne-resize"
    | "w-resize"
    | "e-resize"
    | "sw-resize"
    | "s-resize"
    | "se-resize";

export interface IResizeHandler {
    // Top-left: 0, 0
    // Bottom-right: 100, 100
    // Left: 0 50
    // ...
    x: number;
    y: number;
    type: HandleType;
    columnIndex?: number;
    rowIndex?: number;
}

import React from "react";
import mobx from "mobx";
import { ThemedStyledInterface } from "styled-components";

interface IEezObject {}

export const enum PropertyType {
    String,
    StringArray,
    MultilineText,
    JSON,
    CSS,
    CPP,
    Number,
    NumberArray,
    Array,
    Object,
    Enum,
    Image,
    Color,
    ThemedColor,
    RelativeFolder,
    RelativeFile,
    ObjectReference,
    ConfigurationReference,
    Boolean,
    GUID,
    Any,
    Null
}

export const enum ProjectType {
    MASTER_FIRMWARE = "master",
    FIRMWARE_MODULE = "firmware-module",
    RESOURCE = "resource",
    APPLET = "applet",
    DASHBOARD = "dashboard"
}

interface PropertyInfo {
    name: string;
    displayName?: string | ((object: IEezObject) => string);
    type: PropertyType;
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
}

interface ClassInfo {
    properties: PropertyInfo[];
    icon?: React.ReactNode;
    componentHeaderColor?: string;
    updateObjectValueHook?: (object: IEezObject, values: any) => void;
    enabledInComponentPalette?: (projectType: ProjectType) => boolean;
}

declare class Component {
    static classInfo: ClassInfo;

    get inputs(): PropertyInfo[];
    get outputs(): PropertyInfo[];

    execute(
        runningFlow: IRunningFlow,
        dispose: (() => void) | undefined
    ): Promise<(() => void) | undefined>;
}

declare class ActionComponent extends Component {
    getBody(flowContext: IFlowContext): React.ReactNode;
}

interface IFlowContext {
    dataContext: IDataContext;
    runningFlow?: IRunningFlow;
    document: any;
    viewState: any;
    editorOptions: any;
    frontFace: boolean;

    overrideDataContext(dataContextOverridesObject: any): IFlowContext;
    overrideRunningFlow(component: Component): IFlowContext;
}

interface InputData {
    time: number;
    value: any;
}

type InputPropertyValue = InputData;

interface IRunningFlow {
    getRunningFlowByComponent(component: Component): IRunningFlow | undefined;

    getInputValue(component: Component, input: string): any;
    getPropertyValue(component: Component, propertyName: string): any;
    getInputPropertyValue(
        component: Component,
        input: string
    ): InputPropertyValue | undefined;

    getComponentRunningState<T>(component: Component): T;
    setComponentRunningState<T>(component: Component, runningState: T): void;

    dataContext: IDataContext;

    getVariable(component: Component, variableName: string): any;
    setVariable(component: Component, variableName: string, value: any): void;

    propagateValue(
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ): void;
}

interface IVariable {
    name: string;
    type: string;
    defaultValue: any;
    defaultMinValue: any;
    defaultMaxValue: any;
    defaultValueList: any;
}

interface IDataContext {
    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext;
    createWithLocalVariables(variables: IVariable[]): IDataContext;

    get(variableName: string): any;
    set(variableName: string, value: any): void;

    getEnumValue(variableName: string): number;
    getBool(variableName: string): boolean;
    getValueList(variableName: string): string[];
    getMin(variableName: string): number;
    getMax(variableName: string): number;
}

interface ThemeInterface {
    borderColor: string;
    darkBorderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    selectionColor: string;
    lightSelectionBackgroundColor: string;
    lightSelectionColor: string;
    tableBorderColor: string;
    nonFocusedSelectionBackgroundColor: string;
    nonFocusedSelectionColor: string;
    hoverBackgroundColor: string;
    hoverColor: string;
    scrollTrackColor: string;
    scrollThumbColor: string;
    darkTextColor: string;
    focusBackgroundColor: string;
    focusColor: string;
    dragSourceBackgroundColor: string;
    dragSourceColor: string;
    dropTargetBackgroundColor: string;
    dropTargetColor: string;
    dropPlaceColor: string;
    errorColor: string;
    actionTextColor: string;
    actionHoverColor: string;
    connectionLineColor: string;
    seqConnectionLineColor: string;
    selectedConnectionLineColor: string;
    activeConnectionLineColor: string;
    connectionLineInTheMakingColor: string;
}

interface IFlow {
    deleteConnectionLinesToInput(component: Component, input: string): void;
    deleteConnectionLinesFromOutput(component: Component, output: string): void;
    rerouteConnectionLinesInput(
        component: Component,
        inputBefore: string,
        inputAfter: string
    ): void;
    rerouteConnectionLinesOutput(
        component: Component,
        outputBefore: string,
        outputAfter: string
    ): void;
}

interface IEezStudio {
    React: typeof React;
    mobx: typeof mobx;
    styled: ThemedStyledInterface<ThemeInterface>;
    registerClass: (classToRegister: any) => void;
    makeDerivedClassInfo: (
        baseClassInfo: ClassInfo,
        derivedClassInfoProperties: Partial<ClassInfo>
    ) => ClassInfo;
    ActionComponent: typeof ActionComponent;
    getFlow(object: IEezObject): IFlow;
}

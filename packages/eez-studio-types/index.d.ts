import React from "react";
import mobx from "mobx";

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

interface IPropertyGridGroupDefinition {
    id: string;
    title: string;
    position?: number;
}

interface PropertyInfo {
    name: string;
    displayName?: string | ((object: IEezObject) => string);
    type: PropertyType;
    hideInPropertyGrid?:
        | boolean
        | ((object: IEezObject, propertyInfo: PropertyInfo) => boolean);
    propertyGridGroup?: IPropertyGridGroupDefinition;
    monospaceFont?: boolean;
}

interface ClassInfo {
    properties: PropertyInfo[];
    icon?: React.ReactNode;
    componentHeaderColor?: string;
    updateObjectValueHook?: (object: IEezObject, values: any) => void;
    enabledInComponentPalette?: (projectType: ProjectType) => boolean;

    onObjectVariableConstructor?: (variable: IVariable) => Promise<any>;
    onObjectVariableLoad?: (value: any) => Promise<any>;
    onObjectVariableSave?: (value: any) => Promise<any>;
    renderObjectVariableStatus?: (
        variable: IVariable,
        dataContext: IDataContext
    ) => React.ReactNode;
}

type BasicType =
    | "integer"
    | "float"
    | "double"
    | "boolean"
    | "string"
    | "date"
    | "any";

type ValueType =
    | BasicType
    | "undefined"
    | "null"
    | `object:${string}`
    | "enum:${string}"
    | `struct:${string}`
    | `array:${BasicType}`
    | `array:object:${string}`
    | `array:struct:${string}`
    | `array:enum:${string}`;

interface ComponentInput {
    name: string;
    type: ValueType;
    isSequenceInput: boolean;
    isOptionalInput:
        | boolean
        | ((component: Component, componentInput: ComponentInput) => boolean);

    displayName?:
        | ((component: Component, componentInput: ComponentInput) => string)
        | string;
}

interface ComponentOutput {
    name: string;
    type: ValueType;
    isSequenceOutput: boolean;
    isOptionalOutput:
        | boolean
        | ((component: Component, componentOutput: ComponentOutput) => boolean);

    displayName?:
        | ((component: Component, componentOutput: ComponentOutput) => string)
        | string;
}

declare class Component {
    static classInfo: ClassInfo;

    getInputs(): ComponentInput[];
    getOutputs(): ComponentOutput[];

    execute(
        flowState: IFlowState,
        dispose: (() => void) | undefined
    ): Promise<(() => void) | undefined | boolean>;
}

declare class ActionComponent extends Component {
    getBody(flowContext: IFlowContext): React.ReactNode;
}

declare class ObjectType {
    static classInfo: ClassInfo;
}

interface IFlowContext {
    dataContext: IDataContext;
    flowState?: IFlowState;
    document: any;
    DocumentStore: any;
    viewState: any;
    editorOptions: any;
    frontFace: boolean;

    overrideDataContext(dataContextOverridesObject: any): IFlowContext;
    overrideFlowState(component: Component): IFlowContext;
}

export type LogItemType =
    | "fatal"
    | "error"
    | "warning"
    | "scpi"
    | "info"
    | "debug";

interface IRuntime {
    propagateValue(
        flowState: IFlowState,
        sourceComponent: Component,
        output: string,
        value: any,
        outputName?: string
    ): void;
}

interface IFlowState {
    getFlowStateByComponent(component: Component): IFlowState | undefined;

    getInputValue(component: Component, input: string): any;
    getPropertyValue(component: Component, propertyName: string): any;
    evalExpression: (component: Component, expression: string) => any;

    getComponentRunningState<T>(component: Component): T | undefined;
    setComponentRunningState<T>(component: Component, runningState: T): void;

    runtime: IRuntime;
    dataContext: IDataContext;

    getVariable(component: Component, variableName: string): any;
    setVariable(component: Component, variableName: string, value: any): void;

    log(
        type: LogItemType,
        message: string,
        component: Component | undefined
    ): void;
}

interface IVariable {
    name: string;
    description?: string;
    type: string;
    defaultValue: any;
    defaultMinValue: any;
    defaultMaxValue: any;
    defaultValueList: any;
    persistent: boolean;
}

interface IDataContext {
    createWithDefaultValueOverrides(defaultValueOverrides: any): IDataContext;
    createWithLocalVariables(variables: IVariable[]): IDataContext;

    has(variableName: string): any;
    get(variableName: string): any;
    set(variableName: string, value: any): void;

    getEnumValue(variableName: string): number;
    getBool(variableName: string): boolean;
    getValueList(variableName: string): string[];
    getMin(variableName: string): number;
    getMax(variableName: string): number;
}

interface ThemeInterface {
    backgroundColor: string;
    borderColor: string;
    panelHeaderColor: string;
    selectionBackgroundColor: string;
    connectionLineColor: string;
    selectedConnectionLineColor: string;
    seqConnectionLineColor: string;
    activeConnectionLineColor: string;
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

////////////////////////////////////////////////////////////////////////////////

interface GenericDialogConfiguration {
    dialogDefinition: DialogDefinition;
    values: any;
    okButtonText?: string;
    onOk?: (result: GenericDialogResult) => Promise<boolean>;
}

interface DialogDefinition {
    title?: string;
    size?: "small" | "medium" | "large";
    fields: IFieldProperties[];
    error?: string;
}

interface IEnumItem {
    id: string;
    label: string;
}

type EnumItems = (number | string | IEnumItem)[];

interface IFieldProperties {
    name: string;
    displayName?: string;
    type?:
        | "integer"
        | "number"
        | "string"
        | "password"
        | "boolean"
        | "enum"
        | "radio"
        | "range"
        | "button";
    enumItems?: EnumItems | (() => EnumItems);
    defaultValue?: number | string | boolean;
    visible?: (values: any) => boolean;
    validators?: Rule[];
    minValue?: number;
    maxValue?: number;
}

type Rule = (
    object: any,
    ruleName: string
) => Promise<string | null> | string | null;

interface GenericDialogResult {
    values: any;
    onPogress: (type: "info" | "error", message: string) => boolean;
}

////////////////////////////////////////////////////////////////////////////////

export interface IExpressionContext {
    dataContext: IDataContext;
    flowState?: IFlowState;
    DocumentStore: any;
}

////////////////////////////////////////////////////////////////////////////////

interface IEezStudio {
    React: typeof React;
    mobx: typeof mobx;
    theme: ThemeInterface;
    registerClass: (classToRegister: any) => void;
    makeDerivedClassInfo: (
        baseClassInfo: ClassInfo,
        derivedClassInfoProperties: Partial<ClassInfo>
    ) => ClassInfo;
    makeExpressionProperty(
        propertyInfo: PropertyInfo,
        expressionType: ValueType
    ): PropertyInfo;
    ActionComponent: typeof ActionComponent;
    ObjectType: typeof ObjectType;
    getFlow: (object: IEezObject) => IFlow;
    showGenericDialog: (
        conf: GenericDialogConfiguration
    ) => Promise<GenericDialogResult>;
    validators: {
        required: Rule;
        rangeInclusive: (min: number, max?: number) => Rule;
    };
    propertyGridGroups: {
        specificGroup: IPropertyGridGroupDefinition;
    };
    RenderVariableStatus: React.ComponentType<{
        variable: IVariable;
        image?: React.ReactNode;
        color: string;
        error?: boolean;
        title?: string;
        onClick: () => void;
    }>;
}

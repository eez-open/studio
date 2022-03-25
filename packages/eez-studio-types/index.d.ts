////////////////////////////////////////////////////////////////////////////////

export type BasicType =
    | "integer"
    | "float"
    | "double"
    | "boolean"
    | "string"
    | "date"
    | "any";

export type ValueType =
    | BasicType
    | "undefined"
    | "null"
    | `object:${string}`
    | "enum:${string}"
    | `struct:${string}`
    | `dynamic:${string}`
    | `array:${BasicType}`
    | `array:object:${string}`
    | `array:struct:${string}`
    | `array:enum:${string}`
    | `array:dynamic:${string}`;

export interface IVariable {
    name: string;
    description?: string;
    type: ValueType;
    defaultValue: any;
    defaultMinValue: any;
    defaultMaxValue: any;
    defaultValueList: any;
    persistent: boolean;
}

////////////////////////////////////////////////////////////////////////////////

export interface GenericDialogConfiguration {
    dialogDefinition: DialogDefinition;
    values: any;
    okButtonText?: string;
    onOk?: (result: GenericDialogResult) => Promise<boolean>;
}

export interface DialogDefinition {
    title?: string;
    size?: "small" | "medium" | "large";
    fields: IFieldProperties[];
    error?: string;
}

export interface IEnumItem {
    id: string;
    label: string;
}

export type EnumItems = (number | string | IEnumItem)[];

export interface IFieldProperties {
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

export type Rule = (
    object: any,
    ruleName: string
) => Promise<string | null> | string | null;

export interface GenericDialogResult {
    values: any;
    onProgress: (type: "info" | "error", message: string) => boolean;
}

////////////////////////////////////////////////////////////////////////////////

export type LogItemType =
    | "fatal"
    | "error"
    | "warning"
    | "scpi"
    | "info"
    | "debug";

export interface IComponentFlowState {
    getComponentRunningState<T>(): T | undefined;
    setComponentRunningState<T>(runningState: T): void;
    evalExpression(expression: string): any;
    propagateValue(output: string, value: any): void;
    throwError(err: string): void;
    log(type: LogItemType, message: string): void;
    dispose: (() => void) | undefined;
}

////////////////////////////////////////////////////////////////////////////////

// must be serializable
export type IObjectVariableValueConstructorParams = {};

export interface IObjectVariableValueStatus {
    label?: string;
    image?: string;
    color?: string;
    error?: string;
}

export type IObjectVariableValue = {
    constructorParams: IObjectVariableValueConstructorParams;
    status: IObjectVariableValueStatus;
};

export interface IObjectVariableValueFieldDescription {
    name: string;
    valueType: ValueType | IObjectVariableValueFieldDescription[];
    getFieldValue(objectVariableValue: IObjectVariableValue): any;
}

export interface IObjectVariableType {
    editConstructorParams(
        variable: IVariable,
        params?: IObjectVariableValueConstructorParams
    ): Promise<IObjectVariableValueConstructorParams | undefined>;

    createValue(
        params: IObjectVariableValueConstructorParams,
        isRuntime: boolean
    ): IObjectVariableValue;
    destroyValue(value: IObjectVariableValue): void;

    valueFieldDescriptions: IObjectVariableValueFieldDescription[];
}

////////////////////////////////////////////////////////////////////////////////

export interface IComponentInput {
    name: string;
    type: ValueType;
    isSequenceInput: boolean;
    isOptionalInput: boolean;
}

export interface IComponentOutput {
    name: string;
    type: ValueType;
    isSequenceOutput: boolean;
    isOptionalOutput: boolean;
}

export interface IComponentPropertyBase {
    name: string;
    displayName?: string;
}

export interface IExpressionComponentProperty extends IComponentPropertyBase {
    type: "expression";
    valueType: ValueType;
}

export interface ITemplateLiteralComponentProperty
    extends IComponentPropertyBase {
    type: "template-literal";
}

export type IComponentProperty =
    | IExpressionComponentProperty
    | ITemplateLiteralComponentProperty;

export type IDisposeComponentState = () => void;

export type IComponentIsRunning = boolean;

export interface IActionComponentDefinition {
    name: string;
    icon: string;
    componentHeaderColor: string;

    bodyPropertyName?: string;
    bodyPropertyCallback?: (...props: string[]) => string;

    inputs: IComponentInput[];
    outputs: IComponentOutput[];

    properties: IComponentProperty[];

    execute(
        flowState: IComponentFlowState,
        ...props: string[]
    ): Promise<IDisposeComponentState | IComponentIsRunning | undefined>;
}

////////////////////////////////////////////////////////////////////////////////

export interface IEezStudio {
    registerActionComponent(definition: IActionComponentDefinition): void;

    registerObjectVariableType(
        name: string,
        objectVariableType: IObjectVariableType
    ): void;

    showGenericDialog(
        conf: GenericDialogConfiguration
    ): Promise<GenericDialogResult>;

    validators: {
        required: Rule;
        rangeInclusive: (min: number, max?: number) => Rule;
    };
}

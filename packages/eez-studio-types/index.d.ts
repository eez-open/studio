////////////////////////////////////////////////////////////////////////////////

import { WorkerToRenderMessage } from "project-editor/flow/runtime/wasm-worker-interfaces";

export type BasicType =
    | "integer"
    | "float"
    | "double"
    | "boolean"
    | "string"
    | "date"
    | "blob"
    | "stream"
    | "any";

export type ValueType =
    | BasicType
    | "undefined"
    | "null"
    | `object:${string}`
    | `enum:${string}`
    | `struct:${string}`
    | `dynamic:${string}`
    | `array:${BasicType}`
    | `array:array:${BasicType}`
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
    evalTemplateLiteral(expression: string): any;
    assignValue(assignableExpression: string, value: any): any;
    propagateValue(output: string, value: any): void;
    createObjectValue(valueType: ValueType, value: any): any;
    sendResultToWorker(
        messageId: number,
        result: any,
        finalResult?: boolean
    ): void;
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
    editConstructorParams?(
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
    enabled?: (...props: string[]) => boolean;
}

export interface IExpressionComponentProperty extends IComponentPropertyBase {
    type: "expression";
    valueType: ValueType;
}

export interface IAssignableExpressionComponentProperty
    extends IComponentPropertyBase {
    type: "assignable-expression";
    valueType: ValueType;
}

export interface ITemplateLiteralComponentProperty
    extends IComponentPropertyBase {
    type: "template-literal";
}

export interface EnumItem {
    id: string | number;
    label?: string;
}

export interface IEnumComponentProperty extends IComponentPropertyBase {
    type: "enum";
    enumItems: EnumItem[];
}

export interface IInlineCodeComponentProperty extends IComponentPropertyBase {
    type: "inline-code";
    language: "JSON" | "JavaScript" | "CSS" | "Python" | "C/C++";
}

export interface IListComponentProperty extends IComponentPropertyBase {
    type: "list";
    properties: IComponentProperty[];
    migrateProperties?: (component: IActionComponent) => void;
    defaults: any;
}

export interface IBooleanComponentProperty extends IComponentPropertyBase {
    type: "boolean";
}

export type IComponentProperty =
    | IExpressionComponentProperty
    | IAssignableExpressionComponentProperty
    | ITemplateLiteralComponentProperty
    | IEnumComponentProperty
    | IInlineCodeComponentProperty
    | IListComponentProperty
    | IBooleanComponentProperty;

export type IDisposeComponentState = () => void;

export type IComponentIsRunning = boolean;

export interface ICustomInput {
    name: string;
    type: ValueType;
}

export interface ICustomOutput {
    name: string;
    type: ValueType;
}

export interface IActionComponent {
    [propertyName: string]: any;

    customInputs: ICustomInput[];
    customOutputs: ICustomOutput[];
}

export interface IActionComponentDefinition {
    name: string;
    icon: string;
    componentHeaderColor: string;
    componentPaletteLabel?: string;

    bodyPropertyName?: string;
    bodyPropertyCallback?: (...props: string[]) => React.ReactNode;

    inputs: IComponentInput[];
    outputs: IComponentOutput[];

    properties: IComponentProperty[];

    defaults?: any;

    migrateProperties?: (component: IActionComponent) => void;

    onWasmWorkerMessage?(
        flowState: IComponentFlowState,
        message: any,
        messageId: number
    ): void;
}

// prettier-ignore
export interface IWasmFlowRuntime {
    // emscripten API
    HEAP8: Uint8Array;
    HEAPU8: Uint8Array;
    HEAP16: Uint8Array;
    HEAPU16: Uint8Array;
    HEAP32: Uint32Array;
    HEAPU32: Uint32Array;

    HEAPF32: Float32Array;
    HEAPF64: Float64Array;

    allocateUTF8(str: string): number;
    UTF8ToString(ptr: number): string;
    AsciiToString(ptr: number): string;

    _malloc(size: number): number;
    _free(ptr: number): void;

    //
    assetsMap: AssetsMap;
    componentMessages: IMessageFromWorker[] | undefined;

    postWorkerToRendererMessage: (workerToRenderMessage: WorkerToRenderMessage) => void

    // eez framework API
    _init(wasmModuleId: number, assets: number, assetsSize: number);
    _startFlow();
    _mainLoop();
    _getSyncedBuffer(): number;
    _onMouseWheelEvent(wheelDeltaY: number, wheelClicked: number);
    _onPointerEvent(x: number, y: number, pressed: number);
    _onMessageFromDebugger(messageData: number, messageDataSize: number);

    // eez flow API for Dashboard projects

    _createUndefinedValue(): number;
    _createNullValue(): number;
    _createIntValue(value: number): number;
    _createDoubleValue(value: number): number;
    _createBooleanValue(value: number): number;
    _createStringValue(value: number): number;
    _createArrayValue(arraySize: number, arrayType: number): number;
    _createStreamValue(value: number): number;
    _createDateValue(value: number): number;

    _arrayValueSetElementValue(arrayValuePtr: number, elementIndex: number, value: number): void;

    _valueFree(valuePtr: number): void;

    _setGlobalVariable(globalVariableIndex: number, valuePtr: number);
    _updateGlobalVariable(globalVariableIndex: number, valuePtr: number);

    _getFlowIndex(flowStateIndex: number): number;

    _getComponentExecutionState(flowStateIndex: number, componentIndex: number): number;
    _setComponentExecutionState(flowStateIndex: number, componentIndex: number, state: number): void;

    _getUint32Param(flowStateIndex: number, componentIndex: number, offset: number): number;
    _getStringParam(flowStateIndex: number, componentIndex: number, offset: number): number;
    _getExpressionListParam(flowStateIndex: number, componentIndex: number, offset: number): number;
    _freeExpressionListParam(ptr: number);

    _getListParamSize(flowStateIndex: number, componentIndex: number, offset: number): number;
    _evalListParamElementExpression(flowStateIndex: number, componentIndex: number, listOffset: number, elementIndex: number, expressionOffset: number, errorMessage: number): number;

    _getInputValue(flowStateIndex: number, inputIndex: number): number;
    _clearInputValue(flowStateIndex: number, inputIndex: number);

    _evalProperty(flowStateIndex: number, componentIndex: number, propertyIndex: number, iteratorsPtr: number): number;
    _assignProperty(flowStateIndex: number, componentIndex: number, propertyIndex: number, iteratorsPtr: number, valuePtr: number): number;

    _setPropertyField(flowStateIndex: number, componentIndex: number, propertyIndex: number, fieldIndex: number, valuePtr: number);

    _propagateValue(flowStateIndex: number, componentIndex: number, outputIndex: number, valuePtr: number);
    _propagateValueThroughSeqout(flowStateIndex: number, componentIndex: number);

    _startAsyncExecution(flowStateIndex: number, componentIndex: number): number;
    _endAsyncExecution(flowStateIndex: number, componentIndex: number);

    _executeCallAction(flowStateIndex: number, componentIndex: number, flowIndex: number);

    _logInfo(flowStateIndex: number, componentIndex: number, infoMessage: number);
    _throwError(flowStateIndex: number, componentIndex: number, errorMessage: number);

    _onScpiResult(errorMessage: number, result: number, resultLen: number, resultIsBlob: number);

    _getFirstRootFlowState(): number;
    _getFirstChildFlowState(flowStateIndex: number): number;
    _getNextSiblingFlowState(flowStateIndex: number): number;

    _getFlowStateFlowIndex(flowStateIndex: number): number;

    _stopScript(): void;

    _isRTL(): boolean;

    // LVGL API
    _lvglCreateContainer(parentObj: number, x: number, y: number, w: number, h: number): number;
    _lvglCreateLabel(parentObj: number, x: number, y: number, w: number, h: number, text: number, long_mode: number, recolor: number): number;
    _lvglCreateButton(parentObj: number, x: number, y: number, w: number, h: number): number;
    _lvglCreatePanel(parentObj: number, x: number, y: number, w: number, h: number): number;
    _lvglCreateImage(parentObj: number, x: number, y: number, w: number, h: number, img_src: number, pivotX: number, pivotY: number, zoom: number, angle: number): number;
    _lvglSetImageSrc(parentObj: number, img_src: number): void;
    _lvglCreateSlider(parentObj: number, x: number, y: number, w: number, h: number, min: number, max: number, mode: number, value: number, value_left: number): number;
    _lvglCreateRoller(parentObj: number, x: number, y: number, w: number, h: number, options: number, mode: number): number;
    _lvglCreateSwitch(parentObj: number, x: number, y: number, w: number, h: number): number;
    _lvglDeleteObject(obj: number): void;
    _lvglObjAddFlag(obj: number, f: number): void;
    _lvglObjClearFlag(obj: number, f: number): void;
    _lvglObjAddState(obj: number, s: number): void;
    _lvglObjClearState(obj: number, s: number): void;
    _lvglObjGetStylePropColor(obj: number, part: number, prop: number): number;
    _lvglObjGetStylePropNum(obj: number, part: number, prop: number): number;
    _lvglObjSetLocalStylePropColor(obj: number, prop: number, color: number, selector: number): void;
    _lvglObjSetLocalStylePropNum(obj: number, prop: number, num: number, selector: number): void;
    _lvglObjSetLocalStylePropPtr(obj: number, prop: number, ptr: number, selector: number): void;
    _lvglObjSetLocalStylePropBuiltInFont(obj: number, prop: number, font_index: number, selector: number): void;
    _lvglGetObjRelX(obj: number): number;
    _lvglGetObjRelY(obj: number): number;
    _lvglGetObjWidth(obj: number): number;
    _lvglGetObjHeight(obj: number): number;
    _lvglLoadFont(font_file_path: number): number;
    _lvglFreeFont(font_ptr: number): void;
}

export interface IDashboardComponentContext {
    WasmFlowRuntime: IWasmFlowRuntime;

    getFlowIndex: () => number;
    getComponentIndex: () => number;

    getComponentExecutionState: <T>() => T | undefined;
    setComponentExecutionState: <T>(runningState: T) => void;

    getUint32Param: (offset: number) => number;
    getStringParam: (offset: number) => string;
    getExpressionListParam: (offset: number) => any[];

    getListParamSize: (offset: number) => number;
    evalListParamElementExpression: <T = any>(
        listOffset: number,
        elementIndex: number,
        expressionOffset: number,
        errorMessage: string,
        expectedTypes?: ValueType | ValueType[]
    ) => T | undefined;

    getInputValue: <T = any>(
        inputName: string,
        expectedTypes?: ValueType[]
    ) => T | undefined;

    clearInputValue: (inputName: string) => void;

    evalProperty: <T = any>(
        propertyName: string,
        expectedTypes?: ValueType | ValueType[]
    ) => T | undefined;

    setPropertyField: <T = any>(
        propertyName: string,
        fieldName: string,
        value: any
    ) => void;

    propagateValue: (outputName: string, value: any) => void;
    propagateValueThroughSeqout: () => void;

    startAsyncExecution: () => IDashboardComponentContext;
    endAsyncExecution: () => void;

    executeCallAction: (flowIndex: number) => void;

    sendMessageToComponent: (
        message: any,
        callback?: (result: any) => void
    ) => void;

    logInfo: (infoMessage: string) => void;

    throwError: (errorMessage: string) => void;
}

////////////////////////////////////////////////////////////////////////////////

export interface IEezFlowEditor {
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

export interface IEezFlowRuntime {
    registerExecuteFunction(
        name: string,
        func: (context: IDashboardComponentContext) => void
    ): void;
}

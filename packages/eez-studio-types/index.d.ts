import type { Stream } from "stream";

////////////////////////////////////////////////////////////////////////////////

export type BasicType =
    | "integer"
    | "float"
    | "double"
    | "boolean"
    | "string"
    | "date"
    | "blob"
    | "stream"
    | "widget"
    | "json"
    | "event"
    | "any";

export type OtherBasicType =
    | "undefined"
    | "null"
    | `int8`
    | `uint8`
    | `int16`
    | `uint16`
    | `int8`
    | `int8`
    | `uint32`
    | `int64`
    | `uint64`
    | `stringasset`
    | `arrayasset`
    | `arrayref`;

export type ValueType =
    | BasicType
    | OtherBasicType
    | `object:${string}`
    | `enum:${string}`
    | `struct:${string}`
    | `dynamic:${string}`
    | `array:${BasicType}`
    | `array:array:${BasicType}`
    | `array:object:${string}`
    | `array:struct:${string}`
    | `array:enum:${string}`
    | `array:dynamic:${string}`
    | `importedProject`;

export interface IVariable {
    name: string;
    fullName: string;
    description?: string;
    type: ValueType;
    defaultValue: any;
    defaultValueList: any;
    persistent: boolean;
}

export interface IPropertyValue {
    propertyValueIndex: number;
    valueWithType: ValueWithType;
}

export type ValueWithType = {
    value: Value;
    valueType: ValueType;
};

export type Value =
    | null
    | undefined
    | boolean
    | number
    | string
    | Uint8Array
    | Stream
    | Date
    | ObjectOrArrayValue;

export type ObjectOrArrayValueWithType = {
    value: ObjectOrArrayValue;
    valueType: ValueType;
};

export type ObjectOrArrayValue =
    | undefined
    | Value[]
    | { [fieldName: string]: Value };

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
    id: string | number;
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
        params?: IObjectVariableValueConstructorParams,
        runtime?: boolean
    ): Promise<IObjectVariableValueConstructorParams | undefined>;

    createValue(
        params: IObjectVariableValueConstructorParams,
        isRuntime: boolean
    ): IObjectVariableValue;

    destroyValue(
        value: IObjectVariableValue,
        newValue?: IObjectVariableValue
    ): void;

    getValue(variableValue: any): IObjectVariableValue | null;

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
    disabled?: (...props: string[]) => boolean;
    optional?: (...props: string[]) => boolean;
    formText?: string;
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
    outputs: IComponentOutput[] | ((...props: string[]) => IComponentOutput[]);

    properties: IComponentProperty[];

    defaults?: any;

    migrateProperties?: (component: IActionComponent) => void;

    execute?: (context: IDashboardComponentContext) => void;
}

interface IMessageFromWorker {
    id: number;
    flowStateIndex: number;
    componentIndex: number;
    message: any;
    callback?: (result: any) => void;
}

// message data sent from WASM worker to renderer
export interface WorkerToRenderMessage {
    // sent from worker once at the start
    init?: any;

    // screen data (to be displayed in Canvas), sent from worker at each tick
    screen?: Uint8ClampedArray;

    isRTL?: boolean;

    // message from worker to Studio debugger
    messageToDebugger?: Uint8Array;

    // SCPI command to execute (only renderer is able to execute SCPI commands)
    scpiCommand?: ScpiCommand;

    // evaluated property values
    propertyValues?: IPropertyValue[];

    freeArrayValue?: ObjectOrArrayValueWithType;

    getObjectVariableMemberValue?: {
        arrayValuePtr: number;
        memberIndex: number;
    };

    getBitmapAsDataURL?: {
        name: string;
    };

    setDashboardColorTheme?: {
        themeName: string;
    };

    getLvglScreenByName?: {
        name: string;
    };

    getLvglObjectByName?: {
        name: string;
    };

    getLvglGroupByName?: {
        name: string;
    };

    getLvglStyleByName?: {
        name: string;
    };

    getLvglImageByName?: {
        name: string;
    };

    lvglObjAddStyle?: {
        targetObj: number;
        styleIndex: number;
    };

    lvglObjRemoveStyle?: {
        targetObj: number;
        styleIndex: number;
    };

    lvglSetColorTheme?: {
        themeName: string;
    };

    lvglCreateScreen?: {
        screenIndex: number;
    };

    lvglDeleteScreen?: {
        screenIndex: number;
    };

    lvglScreenTick?: any;

    lvglOnEventHandler?: {
        obj: number;
        eventCode: number;
        event: number;
    };
}

interface IField {
    name: string;
    valueType: ValueType;
}

interface ITypeBase {
    kind: "object" | "array";
    valueType: ValueType;
}

type IFieldIndexes = { [key: string]: number };

interface IObjectType {
    kind: "object";
    valueType: ValueType;
    fields: IField[];
    fieldIndexes: IFieldIndexes;
    open: boolean;
}

interface IArrayType {
    kind: "array";
    valueType: ValueType;
    elementType: IType;
}

interface IBasicType {
    kind: "basic";
    valueType: ValueType;
}

type IType = IArrayType | IObjectType | IBasicType;

type IIndexes = { [key: string]: string };

interface AssetsMap {
    flows: {
        flowIndex: number;
        path: string;
        readablePath: string;
        components: {
            componentIndex: number;
            path: string;
            readablePath: string;
            inputIndexes: {
                [inputName: string]: number;
            };
            outputs: {
                outputName: string;
                actionFlowIndex: number;
                valueTypeIndex: number;
                connectionLines: {
                    targetComponentIndex: number;
                    targetInputIndex: number;
                }[];
            }[];
            outputIndexes: {
                [outputName: string]: number;
            };
            properties: {
                valueTypeIndex: number;
            }[];
            propertyIndexes: {
                [propertyName: string]: number;
            };
        }[];
        componentIndexes: { [path: string]: number };
        componentInputs: {
            inputIndex: number;
            componentIndex: number;
            inputName: string;
            inputType: string;
        }[];
        localVariables: {
            index: number;
            name: string;
        }[];
        widgetDataItems: {
            widgetDataItemIndex: number;
            flowIndex: number;
            componentIndex: number;
            propertyValueIndex: number;
        }[];
        widgetActions: {
            widgetActionIndex: number;
            flowIndex: number;
            componentIndex: number;
            outputIndex: number;
        }[];
    }[];
    flowIndexes: { [path: string]: number };
    actionFlowIndexes: { [actionName: string]: number };
    jsonValues: any[];
    constants: any[];
    globalVariables: {
        index: number;
        name: string;
        type: string;
    }[];
    dashboardComponentTypeToNameMap: {
        [componentType: number]: string;
    };
    types: IType[];
    typeIndexes: IIndexes;
    displayWidth: number;
    displayHeight: number;
    bitmaps: string[];
    lvglWidgetIndexes: { [identifier: string]: number };
    lvglWidgetGeneratedIdentifiers: { [objId: string]: string };
}

export interface ScpiCommand {
    instrumentId: string;
    command: Uint8Array;
    isQuery: boolean;
    timeout: number;
    delay: number;
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
    wasmModuleId: number;
    assetsMap: AssetsMap;
    postWorkerToRendererMessage: (workerToRenderMessage: WorkerToRenderMessage) => any;

    getClassByName: (className: string) => any;

    onRuntimeTerminate: () => void;

    readSettings: (key: string) => any;
    writeSettings: (key: string, value: any) => any;
    hasWidgetHandle: (flowStateIndex: number, componentIndex: number) => boolean;
    getWidgetHandle: (flowStateIndex: number, componentIndex: number) => number;
    getWidgetHandleInfo: (widgetHandle: number) => {
        flowStateIndex: number, componentIndex: number
    } | undefined;

    // eez framework API
    _init(wasmModuleId: number, debuggerMessageSubsciptionFilter: number, assets: number, assetsSize: number, displayWidth: number, displayHeight: number, darkTheme: boolean, timeZone: number, screensLifetimeSupport: boolean): void;
    _mainLoop(): boolean;
    _getSyncedBuffer(): number;
    _onMouseWheelEvent(wheelDeltaY: number, pressed: number): void;
    _onPointerEvent(x: number, y: number, pressed: number): void;
    _onKeyPressed(key: number): void;
    _onMessageFromDebugger(messageData: number, messageDataSize: number): void;

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
    _createBlobValue(bufferPtr: number, bufferLen: number): number;
    _createJsonValue(value: number): number;
    _createErrorValue(): number;

    _arrayValueSetElementValue(arrayValuePtr: number, elementIndex: number, value: number): void;

    _valueFree(valuePtr: number): void;

    _getGlobalVariable(globalVariableIndex: number): number;
    _setGlobalVariable(globalVariableIndex: number, valuePtr: number): void;
    _updateGlobalVariable(globalVariableIndex: number, valuePtr: number): void;

    _getFlowIndex(flowStateIndex: number): number;

    _getComponentExecutionState(flowStateIndex: number, componentIndex: number): number;
    _allocateDashboardComponentExecutionState(flowStateIndex: number, componentIndex: number): number;
    _deallocateDashboardComponentExecutionState(flowStateIndex: number, componentIndex: number): void;

    _getUint8Param(flowStateIndex: number, componentIndex: number, offset: number): number;
    _getUint32Param(flowStateIndex: number, componentIndex: number, offset: number): number;
    _getStringParam(flowStateIndex: number, componentIndex: number, offset: number): number;
    _getExpressionListParam(flowStateIndex: number, componentIndex: number, offset: number): number;
    _freeExpressionListParam(ptr: number): void;

    _getListParamSize(flowStateIndex: number, componentIndex: number, offset: number): number;
    _evalListParamElementExpression(flowStateIndex: number, componentIndex: number, listOffset: number, elementIndex: number, expressionOffset: number, errorMessage: number): number;

    _getInputValue(flowStateIndex: number, inputIndex: number): number;
    _clearInputValue(flowStateIndex: number, inputIndex: number): void;

    _evalProperty(flowStateIndex: number, componentIndex: number, propertyIndex: number, iteratorsPtr: number, disableThrowError: boolean): number;
    _assignProperty(flowStateIndex: number, componentIndex: number, propertyIndex: number, iteratorsPtr: number, valuePtr: number): number;

    _setPropertyField(flowStateIndex: number, componentIndex: number, propertyIndex: number, fieldIndex: number, valuePtr: number): void;

    _propagateValue(flowStateIndex: number, componentIndex: number, outputIndex: number, valuePtr: number): void;
    _propagateValueThroughSeqout(flowStateIndex: number, componentIndex: number): void;

    _onEvent(flowStateIndex: number, flowEvent: number, valuePtr: number): void;

    _startAsyncExecution(flowStateIndex: number, componentIndex: number): number;
    _endAsyncExecution(flowStateIndex: number, componentIndex: number): void;

    _executeCallAction(flowStateIndex: number, componentIndex: number, flowIndex: number): void;

    _logInfo(flowStateIndex: number, componentIndex: number, infoMessage: number): void;
    _throwError(flowStateIndex: number, componentIndex: number, errorMessage: number): void;

    _onScpiResult(errorMessage: number, result: number, resultLen: number, resultIsBlob: number): void;

    _getFirstRootFlowState(): number;
    _getFirstChildFlowState(flowStateIndex: number): number;
    _getNextSiblingFlowState(flowStateIndex: number): number;

    _getFlowStateFlowIndex(flowStateIndex: number): number;

    _stopScript(): void;

    _isRTL(): boolean;

    _setDebuggerMessageSubsciptionFilter(filter: number): void;

    _onMqttEvent(handle: number, eventType: number, eventDataPtr1: number, eventDataPtr2: number): void;

    _flowCleanup() : void;

    // LVGL API
    _lvglCreateScreen(parentObj: number, index: number, x: number, y: number, w: number, h: number): number;
    _lvglCreateUserWidget(parentObj: number, index: number, x: number, y: number, w: number, h: number): number;

    _lvglScreenLoad(page_index: number, obj: number): void;
    _lvglDeleteObject(obj: number): void;
    _lvglDeleteObjectIndex(index: number): void;
    _lvglDeletePageFlowState(index: number): void;
    _lvglObjAddFlag(obj: number, f: number): void;
    _lvglObjClearFlag(obj: number, f: number): void;
    _lvglObjHasFlag(obj: number, f: number): boolean;
    _lvglObjAddState(obj: number, s: number): void;
    _lvglObjClearState(obj: number, s: number): void;
    _lvglObjGetStylePropColor(obj: number, part: number, state: number, prop: number): number;
    _lvglObjGetStylePropNum(obj: number, part: number, state: number, prop: number): number;
    _lvglObjSetLocalStylePropColor(obj: number, prop: number, color: number, selector: number): void;
    _lvglObjSetLocalStylePropNum(obj: number, prop: number, num: number, selector: number): void;
    _lvglObjSetLocalStylePropPtr(obj: number, prop: number, ptr: number, selector: number): void;
    _lvglObjGetStylePropBuiltInFont(obj: number, part: number, state: number, prop: number): number;
    _lvglObjGetStylePropFontAddr(obj: number, part: number, state: number, prop: number): number;
    _lvglObjSetLocalStylePropBuiltInFont(obj: number, prop: number, font_index: number, selector: number): void;

    _lvglStyleCreate(): number;
    _lvglStyleSetPropColor(obj: number, prop: number, color: number): void;
    _lvglSetStylePropBuiltInFont(obj: number, prop: number, font_index: number): void
    _lvglSetStylePropPtr(obj: number, prop: number, ptr: number): void;
    _lvglSetStylePropNum(obj: number, prop: number, num: number): void;
    _lvglStyleDelete(obj: number): void;

    _lvglObjAddStyle(obj: number, style: number, selector: number): void;
    _lvglObjRemoveStyle(obj: number, style: number, selector: number): void;

    _lvglGetObjRelX(obj: number): number;
    _lvglGetObjRelY(obj: number): number;
    _lvglGetObjWidth(obj: number): number;
    _lvglGetObjHeight(obj: number): number;
    _lvglLoadFont(font_file_path: number, fallback_user_font: number, fallback_builtin_font: number): number;
    _lvglFreeFont(font_ptr: number): void;
    _lvglAddObjectFlowCallback(obj: number, filter: number, flow_state: number, component_index: number, output_or_property_index: number, userDataValuePtr: number): void;
    
    _lvglUpdateCheckedState(obj: number, flow_state: number, component_index: number, property_index: number): void;
    _lvglUpdateDisabledState(obj: number, flow_state: number, component_index: number, property_index: number): void;
    _lvglUpdateHiddenFlag(obj: number, flow_state: number, component_index: number, property_index: number): void;
    _lvglUpdateClickableFlag(obj: number, flow_state: number, component_index: number, property_index: number): void;
    _lvglAddTimelineKeyframe(
        obj: number,
        page_index: number,
        start: number, end: number,
        enabledProperties: number,
        x: number, xEasingFunc: number,
        y: number, yEasingFunc: number,
        width: number, widthEasingFunc: number,
        height: number, heightEasingFunc: number,
        opacity: number, opacityEasingFunc: number,
        scale: number, scaleEasingFunc: number,
        rotate: number, rotateEasingFunc: number,
        cp1x: number, cp1y: number, cp2x: number, cp2y: number
    ): void;
    _lvglSetTimelinePosition(timelinePosition: number): void;
    _lvglClearTimeline(): void;
    _lvglGetFlowState(flowState: number, userWidgetComponentIndexOrPageIndex: number): number;

    _lvglSetScrollBarMode(obj: number, mode: number);
    _lvglSetScrollDir(obj: number, dir: number);
    _lvglSetScrollSnapX(obj: number, align: number);
    _lvglSetScrollSnapY(obj: number, align: number);

    _lvglTabviewSetActive(obj: number, tab_id: number, anim_en: number);
    _lvglLineSetPoints(obj: number, point_values: number, point_num: number);
    _lvglScrollTo(obj: number, x: number, y: number, anim_en: boolean);
    _lvglGetScrollX(obj: number): number;
    _lvglGetScrollY(obj: number): number;

    _lvglCreateGroup(): number;
    _lvglSetEncoderGroup(groupObj: number): void;
    _lvglSetKeyboardGroup(groupObj: number): void;
    _lvglAddScreenLoadedEventHandler(screenObj: number): void;
    _lvglGroupAddObject(screenObj: number, groupObj: number, obj: number): void;
    _lvglGroupRemoveObjectsForScreen(screenObj: number): void;

    _lvglObjInvalidate(obj: number);

    _lvglDeleteScreenOnUnload(screenIndex: number);

    _lvglAddEventHandler(obj: number, eventCode: number): void;
}

export interface IDashboardComponentContext {
    WasmFlowRuntime: IWasmFlowRuntime;

    flowStateIndex: number;

    getFlowIndex: () => number;
    getComponentIndex: () => number;

    getComponentExecutionState: <T>() => T | undefined;
    setComponentExecutionState: <T>(executionState: T) => void;

    getUint8Param: (offset: number) => number;
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

    assignProperty(
        inputName: string,
        value: any,
        iterators: number[] | undefined
    ): void;

    getOutputType: (outputName: string) => IType | undefined;

    propagateValue: (outputName: string, value: any) => void;
    propagateValueThroughSeqout: () => void;

    startAsyncExecution: () => IDashboardComponentContext;
    endAsyncExecution: () => void;

    executeCallAction: (flowIndex: number) => void;

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

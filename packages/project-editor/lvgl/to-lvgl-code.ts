import type { IEezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getAncestorOfType } from "project-editor/store";
import { findBitmap, Project } from "project-editor/project/project";
import type { ICustomWidgetCreateParams } from "project-editor/features/page/page";

import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { LVGLPageRuntime } from "project-editor/lvgl/page-runtime";
import type { LVGLBuild } from "project-editor/lvgl/build";
import {
    escapeCString,
    getExpressionPropertyData,
    getExpressionPropertyInitalValue,
    lvglAddObjectFlowCallback,
    unescapeCString
} from "project-editor/lvgl/widget-common";

////////////////////////////////////////////////////////////////////////////////

export interface LVGLCode {
    //
    get project(): Project;

    get pageRuntime(): LVGLPageRuntime | undefined;
    get lvglBuild(): LVGLBuild | undefined;

    get isV9(): boolean;
    get hasFlowSupport(): boolean;
    get screensLifetimeSupport(): boolean;

    //
    constant(constant: string): any;
    stringLiteral(str: string): any;
    stringProperty(
        type: string,
        value: string,
        previewValue?: string,
        nonEmpty?: boolean
    ): any;
    color(color: string | number): any;
    image(image: string): any;

    //
    or(...args: any): any;

    //
    get objectAccessor(): any;

    //
    createScreen(): any;
    createObject(createObjectFunction: string, ...args: any[]): any;
    getObject(getObjectFunction: string, ...args: any[]): any;
    getParentObject(getObjectFunction: string, ...args: any[]): any;

    //
    callObjectFunction(func: string, ...args: any[]): any;
    callObjectFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any;
    callObjectFunctionInline(func: string, ...args: any[]): any;

    //
    callFreeFunction(func: string, ...args: any[]): any;
    callFreeFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any;

    //
    evalTextProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ): any;
    evalIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ): any;
    evalUnsignedIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ): any;
    evalStringArrayPropertyAndJoin(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ): any;

    assignIntegerProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ): void;
    assignStringProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ): void;

    //
    addToTick(propertyName: string, callback: () => void): void;
    tickChangeStart(): void;
    tickChangeEnd(): void;

    //
    assign(declType: string, declName: string, rhs: any): any;

    if(a: any, callback: () => void): void;
    ifStringNotEqual(a: any, b: any, callback: () => void): void;

    ifIntegerLess(a: any, b: any, callback: () => void): void;
    ifIntegerNotEqual(a: any, b: any, callback: () => void): void;

    //
    buildColor<T>(
        object: IEezObject,
        color: string,
        getParams: () => T,
        callback: (color: string, params: T) => void,
        updateCallback: (color: any, params: T) => void
    ): void;
    buildColor2<T>(
        object: IEezObject,
        color1: string,
        color2: string,
        getParams: () => T,
        callback: (color1: string, color2: string, params: T) => void,
        updateCallback: (color1: any, color2: any, params: T) => void
    ): void;
    genFileStaticVar(id: string, type: string, prefixName: string): string;
    assingToFileStaticVar(varName: string, value: string): void;

    //
    blockStart(param: any): void;
    blockEnd(param: any): void;

    //
    addEventHandler(
        eventName: string,
        callback: (event: any, tick_value_change_obj: any) => void
    ): void;
    lvglAddObjectFlowCallback(propertyName: string, filter: number): void;

    //
    postExecute(callback: () => void): void;
}

////////////////////////////////////////////////////////////////////////////////

export class SimulatorLVGLCode implements LVGLCode {
    constructor(
        public runtime: LVGLPageRuntime,
        public constants: { [constant: string]: number }
    ) {}

    widget: LVGLWidget;
    parentObj: number;
    customWidget?: ICustomWidgetCreateParams;

    obj: number;

    flowState: number;
    componentIndex: number;
    propertyIndex: number;

    buildColorParams: any;

    allocated: number[] = [];

    startWidget(
        widget: LVGLWidget,
        parentObj: number,
        customWidget?: ICustomWidgetCreateParams
    ) {
        this.widget = widget;
        this.parentObj = parentObj;
        this.customWidget = customWidget;
    }

    endWidget() {
        this.callObjectFunction("lv_obj_update_layout");

        for (const tempStr of this.allocated) {
            this.runtime.wasm._free(tempStr);
        }
        this.allocated = [];
    }

    get project() {
        return this.runtime.project;
    }

    get pageRuntime() {
        return this.runtime;
    }

    get lvglBuild() {
        return undefined;
    }

    get isV9(): boolean {
        return this.runtime.isV9;
    }

    get hasFlowSupport() {
        return this.runtime.project.projectTypeTraits.hasFlowSupport;
    }

    get screensLifetimeSupport() {
        return this.runtime.project.settings.build.screensLifetimeSupport;
    }

    constant(constant: string) {
        return this.constants[constant];
    }

    stringLiteral(str: string) {
        return this.runtime.stringLiteral(str);
    }

    stringProperty(
        type: string,
        value: string,
        previewValue?: string,
        nonEmpty?: boolean
    ) {
        let str;
        if (type == "expression" && this.runtime.wasm.assetsMap) {
            str = nonEmpty ? " " : "";
        } else {
            str =
                type == "expression"
                    ? previewValue
                        ? unescapeCString(previewValue)
                        : getExpressionPropertyInitalValue(
                              this.runtime,
                              this.widget,
                              value
                          )
                    : unescapeCString(value);
        }

        const strPtr = this.runtime.wasm.allocateUTF8(str);
        this.allocated.push(strPtr);
        return strPtr;
    }

    color(color: string | number) {
        const num =
            typeof color == "string" ? this.runtime.getColorNum(color) : color;

        const ptr = this.runtime.wasm._malloc(4);
        this.allocated.push(ptr);

        this.runtime.wasm.HEAP32[ptr >> 2] = num;

        return ptr;
    }

    image(image: string) {
        const bitmap = findBitmap(ProjectEditor.getProject(this.widget), image);
        if (!bitmap || !bitmap.image) {
            return 0;
        }
        return this.runtime.getBitmapPtr(bitmap);
    }

    or(...args: any) {
        let result = 0;
        for (const arg of args) {
            result |= arg;
        }
        return result;
    }

    get objectAccessor() {
        return undefined;
    }

    createScreen() {
        if (this.customWidget) {
            this.obj = this.runtime.wasm._lvglCreateUserWidget(
                this.parentObj,
                this.customWidget.widgetIndex,
                this.customWidget.left,
                this.customWidget.top,
                this.customWidget.width,
                this.customWidget.height
            );
        } else {
            const rect = this.widget.getLvglCreateRect();

            this.obj = this.runtime.wasm._lvglCreateScreen(
                this.parentObj,
                this.runtime.getCreateWidgetIndex(
                    getAncestorOfType(
                        this.widget,
                        ProjectEditor.PageClass.classInfo
                    )!
                ),
                rect.left,
                rect.top,
                rect.width,
                rect.height
            );
        }
    }

    createObject(createObjectFunction: string, ...args: any[]) {
        this.obj = this.callFreeFunction(
            createObjectFunction,
            this.parentObj,
            ...args
        );

        this.callObjectFunction(
            "setObjectIndex",
            this.runtime.getCreateWidgetIndex(this.widget)
        );

        const rect = this.widget.getLvglCreateRect();
        this.callObjectFunction("lv_obj_set_pos", rect.left, rect.top);
        this.callObjectFunction("lv_obj_set_size", rect.width, rect.height);
    }

    getObject(getObjectFunction: string, ...args: any[]) {
        this.obj = this.callFreeFunction(
            getObjectFunction,
            this.parentObj,
            ...args
        );
        this.callObjectFunction(
            "setObjectIndex",
            this.runtime.getCreateWidgetIndex(this.widget)
        );
    }

    getParentObject(getObjectFunction: string, ...args: any[]) {
        const parentObj = this.callFreeFunction(
            "lv_obj_get_parent",
            this.parentObj
        );

        this.obj = this.callFreeFunction(getObjectFunction, parentObj, ...args);
        this.callObjectFunction(
            "setObjectIndex",
            this.runtime.getCreateWidgetIndex(this.widget)
        );
    }

    callObjectFunction(func: string, ...args: any[]): any {
        const result = (this.runtime.wasm as any)["_" + func](
            this.obj,
            ...args
        );
        // console.log(
        //     "callObjectFunction",
        //     func,
        //     this.obj,
        //     ...args,
        //     "->",
        //     result
        // );
        return result;
    }

    callObjectFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any {
        return this.callObjectFunction(func, ...args);
    }

    callObjectFunctionInline(func: string, ...args: any[]): any {
        return this.callObjectFunction(func, ...args);
    }

    callFreeFunction(func: string, ...args: any[]): any {
        const result = (this.runtime.wasm as any)["_" + func](...args);
        // console.log("callFreeFunction", func, ...args, "->", result);
        return result;
    }

    callFreeFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any {
        return this.callFreeFunction(func, ...args);
    }

    evalTextProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        return this.callFreeFunctionWithAssignment(
            declType,
            declName,
            "_evalTextProperty",
            this.flowState,
            this.componentIndex,
            this.propertyIndex,
            this.stringLiteral(errorMessage),
            0,
            0
        );
    }

    evalIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        return this.callFreeFunctionWithAssignment(
            declType,
            declName,
            "_evalIntegerProperty",
            this.flowState,
            this.componentIndex,
            this.propertyIndex,
            this.stringLiteral(errorMessage),
            0,
            0
        );
    }

    evalUnsignedIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        return this.callFreeFunctionWithAssignment(
            declType,
            declName,
            "_evalUnsignedIntegerProperty",
            this.flowState,
            this.componentIndex,
            this.propertyIndex,
            this.stringLiteral(errorMessage),
            0,
            0
        );
    }

    evalStringArrayPropertyAndJoin(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        return this.callFreeFunctionWithAssignment(
            declType,
            declName,
            "_evalStringArrayPropertyAndJoin",
            this.flowState,
            this.componentIndex,
            this.propertyIndex,
            this.stringLiteral(errorMessage),
            this.stringLiteral("\n"),
            0,
            0
        );
    }

    assignIntegerProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ): void {
        const propExpr = getExpressionPropertyData(
            this.runtime,
            this.widget,
            propertyName
        );

        if (propExpr) {
            this.callFreeFunction(
                "_assignIntegerProperty",
                this.flowState,
                propExpr.componentIndex,
                propExpr.propertyIndex,
                value,
                this.stringLiteral(errorMessage),
                0,
                0
            );
        }
    }

    assignStringProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ): void {
        const propExpr = getExpressionPropertyData(
            this.runtime,
            this.widget,
            propertyName
        );

        if (propExpr) {
            this.callFreeFunction(
                "_assignStringProperty",
                this.flowState,
                propExpr.componentIndex,
                propExpr.propertyIndex,
                value,
                this.stringLiteral(errorMessage),
                0,
                0
            );
        }
    }

    addToTick(propertyName: string, callback: () => void) {
        const propExpr = getExpressionPropertyData(
            this.runtime,
            this.widget,
            propertyName
        );
        const widget = this.widget;
        const obj = this.obj;
        const flowState = this.runtime.lvglCreateContext.flowState;
        if (propExpr) {
            this.runtime.addTickCallback((flowState1: number) => {
                this.widget = widget;
                this.obj = obj;
                this.flowState = flowState;
                this.componentIndex = propExpr.componentIndex;
                this.propertyIndex = propExpr.propertyIndex;
                callback();
            });
        }
    }

    tickChangeStart() {
        this.runtime.tick_value_change_obj = this.obj;
    }
    tickChangeEnd() {
        this.runtime.tick_value_change_obj = 0;
    }

    assign(declType: string, declName: string, rhs: any) {
        return rhs;
    }

    if(a: any, callback: () => void) {
        if (a) {
            callback();
        }
    }

    ifStringNotEqual(a: any, b: any, callback: () => void) {
        if (this.callFreeFunction("strcmp", a, b) != 0) {
            callback();
        }
    }

    ifIntegerLess(a: any, b: any, callback: () => void) {
        if (a < b) {
            callback();
        }
    }

    ifIntegerNotEqual(a: any, b: any, callback: () => void) {
        if (a != b) {
            callback();
        }
    }

    buildColor<T>(
        object: IEezObject,
        color: string,
        getParams: () => T,
        callback: (color: string, params: T) => void,
        updateCallback: (color: any, params: T) => void
    ) {
        callback(color, undefined as any);

        let params = this.buildColorParams;

        const widget = this.widget;
        const obj = this.obj;

        this.runtime.lvglUpdateColor(color, (wasm, colorNum) => {
            this.widget = widget;
            this.obj = obj;
            updateCallback(colorNum, params);
        });
    }

    buildColor2<T>(
        object: IEezObject,
        color1: string,
        color2: string,
        getParams: () => T,
        callback: (color1: string, color2: string, params: T) => void,
        updateCallback: (color1: any, color2: any, params: T) => void
    ) {
        callback(color1, color2, undefined as T);

        let params = this.buildColorParams;

        const widget = this.widget;
        const obj = this.obj;

        this.runtime.lvglUpdateColor(color1, (wasm, colorNum) => {
            this.widget = widget;
            this.obj = obj;
            updateCallback(colorNum, undefined, params);
        });
        this.runtime.lvglUpdateColor(color2, (wasm, colorNum) => {
            this.obj = obj;
            updateCallback(undefined, colorNum, params);
        });
    }

    genFileStaticVar(id: string, type: string, prefixName: string) {
        return undefined as any;
    }

    assingToFileStaticVar(varName: string, value: string) {
        this.buildColorParams = value;
    }

    blockStart(param: any) {}

    blockEnd(param: any) {}

    addEventHandler(
        eventName: string,
        callback: (event: any, tick_value_change_obj: any) => void
    ) {
        const widget = this.widget;
        const obj = this.obj;
        const flowState = this.runtime.lvglCreateContext.flowState;

        this.pageRuntime.addEventHandler(this.obj, eventName, event => {
            this.widget = widget;
            this.obj = obj;
            this.flowState = flowState;
            callback(event, this.runtime.tick_value_change_obj);
        });
    }

    lvglAddObjectFlowCallback(propertyName: string, filter: number) {
        const propExpr = getExpressionPropertyData(
            this.runtime,
            this.widget,
            propertyName
        );
        if (propExpr) {
            lvglAddObjectFlowCallback(
                this.pageRuntime,
                this.obj,
                filter,
                propExpr.componentIndex,
                propExpr.propertyIndex,
                0
            );
        }
    }

    postExecute(callback: () => void) {
        const widget = this.widget;
        const obj = this.obj;
        this.pageRuntime.addPostCreateCallback(() => {
            this.widget = widget;
            this.obj = obj;
            callback();
        });
    }
}

export class BuildLVGLCode implements LVGLCode {
    constructor(public build: LVGLBuild) {}

    widget: LVGLWidget;

    isTick = false;
    componentIndex: number;
    propertyIndex: number;

    startWidget(widget: LVGLWidget) {
        this.widget = widget;
    }

    get project() {
        return this.build.project;
    }

    get pageRuntime() {
        return undefined;
    }

    get lvglBuild() {
        return this.build;
    }

    get isV9(): boolean {
        return this.build.isV9;
    }

    get hasFlowSupport() {
        return this.build.assets.projectStore.projectTypeTraits.hasFlowSupport;
    }

    get screensLifetimeSupport() {
        return this.build.project.settings.build.screensLifetimeSupport;
    }

    constant(constant: string) {
        return constant;
    }

    stringProperty(
        type: string,
        value: string,
        previewValue?: string,
        nonEmpty?: boolean
    ) {
        if (type == "literal") {
            return this.stringLiteral(value);
        }

        if (type == "translated-literal") {
            return `_(${this.stringLiteral(value)})`;
        }

        return nonEmpty ? `" "` : `""`;
    }

    stringLiteral(str: string) {
        return escapeCString(str ?? "");
    }

    color(color: string | number) {
        return `lv_color_hex(${color})`;
    }

    image(image: string) {
        const bitmap = findBitmap(ProjectEditor.getProject(this.widget), image);

        return bitmap && bitmap.image
            ? `&${this.build.getImageVariableName(bitmap)}`
            : 0;
    }

    or(...args: any) {
        return args.join(" | ");
    }

    get objectAccessor() {
        return this.build.getLvglObjectAccessor(this.widget);
    }

    createScreen() {
        this.build.line(`lv_obj_t *obj = lv_obj_create(0);`);

        this.build.buildWidgetAssign(this.widget);
        this.build.buildWidgetSetPosAndSize(this.widget);

        return "obj";
    }

    createObject(createObjectFunction: string, ...args: any[]) {
        this.build.line(
            `lv_obj_t *obj = ${createObjectFunction}(${[
                "parent_obj",
                ...args
            ].join(", ")});`
        );

        this.build.buildWidgetAssign(this.widget);
        this.build.buildWidgetSetPosAndSize(this.widget);

        return "obj";
    }

    getObject(getObjectFunction: string, ...args: any[]) {
        this.build.line(
            `lv_obj_t *obj = ${getObjectFunction}(${[
                "parent_obj",
                ...args
            ].join(", ")});`
        );

        this.build.buildWidgetAssign(this.widget);

        return "obj";
    }

    getParentObject(getObjectFunction: string, ...args: any[]) {
        this.build.line(
            `lv_obj_t *obj = ${getObjectFunction}(${[
                "lv_obj_get_parent(parent_obj)",
                ...args
            ].join(", ")});`
        );

        this.build.buildWidgetAssign(this.widget);

        return "obj";
    }

    callObjectFunction(func: string, ...args: any[]): any {
        this.build.line(
            `${func}(${[
                this.isTick ? this.objectAccessor : "obj",
                ...args
            ].join(", ")});`
        );
        return undefined;
    }

    callObjectFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any {
        this.build.line(
            `${declType}${
                declType.endsWith("*") ? "" : " "
            }${declName} = ${func}(${[
                this.isTick ? this.objectAccessor : "obj",
                ...args
            ].join(", ")});`
        );
        return declName;
    }

    callObjectFunctionInline(func: string, ...args: any[]): any {
        return `${func}(${[
            this.isTick ? this.objectAccessor : "obj",
            ...args
        ].join(", ")})`;
    }

    callFreeFunction(func: string, ...args: any[]): any {
        this.build.line(`${func}(${args.join(", ")});`);
        return undefined;
    }

    callFreeFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any {
        this.build.line(
            `${declType}${
                declType.endsWith("*") ? "" : " "
            }${declName} = ${func}(${args.join(", ")});`
        );
        return declName;
    }

    getVariableWithAssignment(
        declType: string,
        declName: string,
        variableName: string
    ) {
        this.build.line(
            `${declType}${
                declType.endsWith("*") ? "" : " "
            }${declName} = ${this.build.getVariableGetterFunctionName(
                variableName
            )}();`
        );
        return declName;
    }

    setVariable(variableName: string, value: any) {
        this.build.line(
            `${this.build.getVariableSetterFunctionName(variableName)}(value);`
        );
    }

    evalTextProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        if (this.hasFlowSupport) {
            return this.callFreeFunctionWithAssignment(
                declType,
                declName,
                "evalTextProperty",
                "flowState",
                this.componentIndex,
                this.propertyIndex,
                this.stringLiteral(errorMessage)
            );
        } else {
            return this.getVariableWithAssignment(
                declType,
                declName,
                propertyValue
            );
        }
    }

    evalIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        if (this.hasFlowSupport) {
            return this.callFreeFunctionWithAssignment(
                declType,
                declName,
                "evalIntegerProperty",
                "flowState",
                this.componentIndex,
                this.propertyIndex,
                this.stringLiteral(errorMessage)
            );
        } else {
            return this.getVariableWithAssignment(
                declType,
                declName,
                propertyValue
            );
        }
    }

    evalUnsignedIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        if (this.hasFlowSupport) {
            return this.callFreeFunctionWithAssignment(
                declType,
                declName,
                "evalUnsignedIntegerProperty",
                "flowState",
                this.componentIndex,
                this.propertyIndex,
                this.stringLiteral(errorMessage)
            );
        } else {
            return this.getVariableWithAssignment(
                declType,
                declName,
                propertyValue
            );
        }
    }

    evalStringArrayPropertyAndJoin(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        if (this.hasFlowSupport) {
            return this.callFreeFunctionWithAssignment(
                declType,
                declName,
                "evalStringArrayPropertyAndJoin",
                "flowState",
                this.componentIndex,
                this.propertyIndex,
                this.stringLiteral(errorMessage),
                '"\\n"'
            );
        } else {
            return this.getVariableWithAssignment(
                declType,
                declName,
                propertyValue
            );
        }
    }

    assignIntegerProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ) {
        if (this.hasFlowSupport) {
            const componentIndex = this.build.assets.getComponentIndex(
                this.widget
            );
            const propertyIndex = this.build.assets.getComponentPropertyIndex(
                this.widget,
                propertyName
            );

            return this.callFreeFunction(
                "assignIntegerProperty",
                "flowState",
                componentIndex,
                propertyIndex,
                value,
                this.stringLiteral(errorMessage)
            );
        } else {
            return this.setVariable(propertyValue, value);
        }
    }

    assignStringProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ) {
        if (this.hasFlowSupport) {
            const componentIndex = this.build.assets.getComponentIndex(
                this.widget
            );
            const propertyIndex = this.build.assets.getComponentPropertyIndex(
                this.widget,
                propertyName
            );

            return this.callFreeFunction(
                "assignStringProperty",
                "flowState",
                componentIndex,
                propertyIndex,
                value,
                this.stringLiteral(errorMessage)
            );
        } else {
            return this.setVariable(propertyValue, value);
        }
    }

    addToTick(propertyName: string, callback: () => void) {
        const build = this.build;

        const widget = this.widget;

        build.addTickCallback(() => {
            this.widget = widget;

            build.blockStart(`{`);

            if (this.hasFlowSupport) {
                this.componentIndex = this.build.assets.getComponentIndex(
                    this.widget
                );
                this.propertyIndex =
                    this.build.assets.getComponentPropertyIndex(
                        this.widget,
                        propertyName
                    );
            }

            this.isTick = true;

            callback();

            this.isTick = false;

            build.blockEnd(`}`);
        });
    }

    tickChangeStart() {
        this.build.line(`tick_value_change_obj = ${this.objectAccessor};`);
    }

    tickChangeEnd() {
        this.build.line(`tick_value_change_obj = NULL;`);
    }

    assign(declType: string, declName: string, rhs: any) {
        this.build.line(
            `${declType}${
                declType.endsWith("*") ? "" : " "
            }${declName} = ${rhs};`
        );
        return declName;
    }

    if(a: any, callback: () => void) {
        const build = this.build;

        build.blockStart(`if (${a}) {`);
        callback();
        build.blockEnd(`}`);
    }

    ifStringNotEqual(a: any, b: any, callback: () => void) {
        const build = this.build;

        build.blockStart(`if (strcmp(${a}, ${b}) != 0) {`);
        callback();
        build.blockEnd(`}`);
    }

    ifIntegerLess(a: any, b: any, callback: () => void) {
        const build = this.build;

        build.blockStart(`if (${a} < ${b}) {`);
        callback();
        build.blockEnd(`}`);
    }

    ifIntegerNotEqual(a: any, b: any, callback: () => void) {
        const build = this.build;

        build.blockStart(`if (${a} != ${b}) {`);
        callback();
        build.blockEnd(`}`);
    }

    buildColor<T>(
        object: IEezObject,
        color: string,
        getParams: () => T,
        callback: (color: string, params: T) => void,
        updateCallback: (color: any, params: T) => void
    ) {
        this.build.buildColor(
            object,
            color,
            getParams,
            callback,
            updateCallback
        );
    }

    buildColor2<T>(
        object: IEezObject,
        color1: string,
        color2: string,
        getParams: () => T,
        callback: (color1: string, color2: string, params: T) => void,
        updateCallback: (color1: any, color2: any, params: T) => void
    ) {
        this.build.buildColor2(
            object,
            color1,
            color2,
            getParams,
            callback,
            updateCallback
        );
    }

    genFileStaticVar(id: string, type: string, prefixName: string) {
        return this.build.genFileStaticVar(id, type, prefixName);
    }

    assingToFileStaticVar(varName: string, value: string) {
        this.build.assingToFileStaticVar(varName, value);
    }

    blockStart(param: any) {
        this.build.blockStart(param);
    }

    blockEnd(param: any) {
        this.build.blockEnd(param);
    }

    addEventHandler(
        eventName: string,
        callback: (event: any, tick_value_change_obj: any) => void
    ) {
        const widget = this.widget;
        const componentIndex = this.componentIndex;
        const propertyIndex = this.propertyIndex;

        this.build.addEventHandler(this.widget, () => {
            this.build.blockStart(`if (event == LV_EVENT_${eventName}) {`);

            this.widget = widget;
            this.componentIndex = componentIndex;
            this.propertyIndex = propertyIndex;

            callback("e", "tick_value_change_obj");

            this.build.blockEnd("}");
        });
    }

    lvglAddObjectFlowCallback(propertyName: string, filter: number) {
        // this function is only used for the simulator
    }

    postExecute(callback: () => void) {
        this.build.postBuildAdd(callback);
    }
}

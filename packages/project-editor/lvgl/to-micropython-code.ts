import type { IEezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { findBitmap } from "project-editor/project/project";

import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { LVGLCode } from "project-editor/lvgl/to-lvgl-code";
import type { MicroPythonLVGLBuild } from "project-editor/lvgl/micropython-build";

////////////////////////////////////////////////////////////////////////////////

/**
 * MicroPython LVGL 9.x code generator
 *
 * This class implements the LVGLCode interface to generate MicroPython code
 * compatible with lv_micropython bindings for LVGL 9.x
 *
 * API Mapping (C -> MicroPython):
 * - lv_obj_create(parent) -> lv.obj(parent)
 * - lv_btn_create(parent) -> lv.button(parent)
 * - lv_obj_set_pos(obj, x, y) -> obj.set_pos(x, y)
 * - lv_obj_set_size(obj, w, h) -> obj.set_size(w, h)
 * - lv_style_set_bg_color(style, color) -> style.set_bg_color(color)
 * - LV_ALIGN_CENTER -> lv.ALIGN.CENTER
 * - lv_color_hex(0xFF0000) -> lv.color_hex(0xFF0000)
 */
export class MicroPythonLVGLCode implements LVGLCode {
    constructor(public build: MicroPythonLVGLBuild) {}

    widget: LVGLWidget;

    isTick = false;
    componentIndex: number;
    propertyIndex: number;

    noGoodNameCallbacks: (() => void)[] = [];

    startWidget(widget: LVGLWidget) {
        this.widget = widget;
    }

    endWidget() {
        for (const callback of this.noGoodNameCallbacks) {
            callback();
        }
        this.noGoodNameCallbacks = [];
    }

    get project() {
        return this.build.project;
    }

    get pageRuntime() {
        return undefined;
    }

    get lvglBuild() {
        return this.build as any;
    }

    get isV9(): boolean {
        return true; // MicroPython support targets LVGL 9.x
    }

    get hasFlowSupport() {
        return false; // Flow support not implemented for MicroPython yet
    }

    get screensLifetimeSupport() {
        return this.build.project.settings.build.screensLifetimeSupport;
    }

    //--------------------------------------------------------------------------
    // Constants and literals
    //--------------------------------------------------------------------------

    constant(constant: string) {
        // Convert C constants to MicroPython format
        // LV_ALIGN_CENTER -> lv.ALIGN.CENTER
        // LV_STATE_DEFAULT -> lv.STATE.DEFAULT
        // LV_PART_MAIN -> lv.PART.MAIN
        return this.convertConstant(constant);
    }

    private convertConstant(constant: string): string {
        if (!constant) return constant;

        // Handle multiple constants OR'd together
        if (constant.includes(" | ")) {
            return constant
                .split(" | ")
                .map(c => this.convertSingleConstant(c.trim()))
                .join(" | ");
        }

        return this.convertSingleConstant(constant);
    }

    private convertSingleConstant(constant: string): string {
        // Skip if already converted or is a number
        if (!constant.startsWith("LV_")) {
            return constant;
        }

        // LV_ALIGN_CENTER -> lv.ALIGN.CENTER
        // LV_STATE_DEFAULT -> lv.STATE.DEFAULT
        // LV_OPA_50 -> lv.OPA._50
        // LV_FLEX_FLOW_ROW -> lv.FLEX_FLOW.ROW

        const withoutPrefix = constant.substring(3); // Remove "LV_"

        // Known enum mappings for LVGL 9.x
        const enumMappings: { [key: string]: string } = {
            "ALIGN_": "ALIGN.",
            "STATE_": "STATE.",
            "PART_": "PART.",
            "OPA_": "OPA.",
            "FLEX_FLOW_": "FLEX_FLOW.",
            "FLEX_ALIGN_": "FLEX_ALIGN.",
            "GRID_ALIGN_": "GRID_ALIGN.",
            "DIR_": "DIR.",
            "BASE_DIR_": "BASE_DIR.",
            "TEXT_ALIGN_": "TEXT_ALIGN.",
            "BORDER_SIDE_": "BORDER_SIDE.",
            "GRAD_DIR_": "GRAD_DIR.",
            "SCROLLBAR_MODE_": "SCROLLBAR_MODE.",
            "SCROLL_SNAP_": "SCROLL_SNAP.",
            "ANIM_": "ANIM.",
            "BLEND_MODE_": "BLEND_MODE.",
            "SCR_LOAD_ANIM_": "SCR_LOAD_ANIM.",
            "EVENT_": "EVENT.",
            "KEY_": "KEY.",
            "LABEL_LONG_": "LABEL_LONG.",
            "ARC_MODE_": "ARC_MODE.",
            "BAR_MODE_": "BAR_MODE.",
            "BTNMATRIX_CTRL_": "BUTTONMATRIX_CTRL.",
            "CHART_TYPE_": "CHART_TYPE.",
            "CHART_UPDATE_MODE_": "CHART_UPDATE_MODE.",
            "CHART_AXIS_": "CHART_AXIS.",
            "COLORWHEEL_MODE_": "COLORWHEEL_MODE.",
            "IMG_SIZE_MODE_": "IMAGE_SIZE_MODE.",
            "KEYBOARD_MODE_": "KEYBOARD_MODE.",
            "MENU_HEADER_": "MENU_HEADER.",
            "ROLLER_MODE_": "ROLLER_MODE.",
            "SLIDER_MODE_": "SLIDER_MODE.",
            "SPAN_MODE_": "SPAN_MODE.",
            "SPAN_OVERFLOW_": "SPAN_OVERFLOW.",
            "TABLE_CELL_CTRL_": "TABLE_CELL_CTRL.",
            "TEXTAREA_": "TEXTAREA.",
        };

        for (const [prefix, replacement] of Object.entries(enumMappings)) {
            if (withoutPrefix.startsWith(prefix)) {
                const value = withoutPrefix.substring(prefix.length);
                return `lv.${replacement}${value}`;
            }
        }

        // Fallback: convert underscore-separated to dot notation
        // LV_SOMETHING_VALUE -> lv.SOMETHING.VALUE
        const parts = withoutPrefix.split("_");
        if (parts.length >= 2) {
            const enumName = parts[0];
            const enumValue = parts.slice(1).join("_");
            return `lv.${enumName}.${enumValue}`;
        }

        return `lv.${withoutPrefix}`;
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
            // Translation function - can be customized
            return `_(${this.stringLiteral(value)})`;
        }

        return nonEmpty ? `" "` : `""`;
    }

    stringLiteral(str: string) {
        // Escape string for Python
        return this.escapePythonString(str ?? "");
    }

    private escapePythonString(str: string): string {
        const escaped = str
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");
        return `"${escaped}"`;
    }

    color(color: string | number) {
        // lv_color_hex(0xFF0000) -> lv.color_hex(0xFF0000)
        if (typeof color === "number") {
            return `lv.color_hex(0x${color.toString(16).padStart(6, "0").toUpperCase()})`;
        }
        return `lv.color_hex(${color})`;
    }

    image(image: string) {
        const bitmap = findBitmap(ProjectEditor.getProject(this.widget), image);

        if (bitmap && bitmap.image) {
            // Reference to image variable
            return `img_${this.build.getBitmapName(bitmap)}`;
        }
        return "None";
    }

    or(...args: any) {
        return args.join(" | ");
    }

    //--------------------------------------------------------------------------
    // Object accessors
    //--------------------------------------------------------------------------

    get objectAccessor() {
        return this.build.getLvglObjectAccessor(this.widget);
    }

    //--------------------------------------------------------------------------
    // Object creation - LVGL 9.x MicroPython syntax
    //--------------------------------------------------------------------------

    createScreen() {
        this.build.line(`obj = lv.obj(None)`);

        this.build.buildWidgetAssign(this.widget);
        this.build.buildWidgetSetPosAndSize(this.widget);

        return "obj";
    }

    createObject(createObjectFunction: string, ...args: any[]) {
        // lv_btn_create(parent) -> lv.button(parent)
        // lv_label_create(parent) -> lv.label(parent)
        const pythonClass = this.convertCreateFunction(createObjectFunction);

        const allArgs = ["parent_obj", ...args].join(", ");
        this.build.line(`obj = ${pythonClass}(${allArgs})`);

        this.build.buildWidgetAssign(this.widget);
        this.build.buildWidgetSetPosAndSize(this.widget);

        return "obj";
    }

    private convertCreateFunction(func: string): string {
        // lv_xxx_create -> lv.xxx
        // Special mappings for LVGL 9.x naming changes
        const mappings: { [key: string]: string } = {
            "lv_obj_create": "lv.obj",
            "lv_btn_create": "lv.button",
            "lv_label_create": "lv.label",
            "lv_img_create": "lv.image",
            "lv_arc_create": "lv.arc",
            "lv_bar_create": "lv.bar",
            "lv_slider_create": "lv.slider",
            "lv_switch_create": "lv.switch",
            "lv_checkbox_create": "lv.checkbox",
            "lv_dropdown_create": "lv.dropdown",
            "lv_roller_create": "lv.roller",
            "lv_textarea_create": "lv.textarea",
            "lv_table_create": "lv.table",
            "lv_chart_create": "lv.chart",
            "lv_canvas_create": "lv.canvas",
            "lv_calendar_create": "lv.calendar",
            "lv_keyboard_create": "lv.keyboard",
            "lv_list_create": "lv.list",
            "lv_menu_create": "lv.menu",
            "lv_msgbox_create": "lv.msgbox",
            "lv_spinner_create": "lv.spinner",
            "lv_spinbox_create": "lv.spinbox",
            "lv_tabview_create": "lv.tabview",
            "lv_tileview_create": "lv.tileview",
            "lv_win_create": "lv.win",
            "lv_colorwheel_create": "lv.colorwheel",
            "lv_led_create": "lv.led",
            "lv_meter_create": "lv.meter",
            "lv_span_create": "lv.span",
            "lv_spangroup_create": "lv.spangroup",
            "lv_btnmatrix_create": "lv.buttonmatrix",
            "lv_line_create": "lv.line",
            "lv_scale_create": "lv.scale",
            "lv_imagebutton_create": "lv.imagebutton",
            "lv_animimg_create": "lv.animimg",
        };

        if (mappings[func]) {
            return mappings[func];
        }

        // Generic conversion: lv_xxx_create -> lv.xxx
        const match = func.match(/^lv_(\w+)_create$/);
        if (match) {
            return `lv.${match[1]}`;
        }

        return func;
    }

    getObject(getObjectFunction: string, ...args: any[]) {
        const pythonFunc = this.convertGetFunction(getObjectFunction);

        this.build.line(
            `obj = ${pythonFunc}(${["parent_obj", ...args].join(", ")})`
        );

        this.build.buildWidgetAssign(this.widget);

        return "obj";
    }

    getParentObject(getObjectFunction: string, ...args: any[]) {
        const pythonFunc = this.convertGetFunction(getObjectFunction);

        this.build.line(
            `obj = ${pythonFunc}(${[
                "parent_obj.get_parent()",
                ...args
            ].join(", ")})`
        );

        this.build.buildWidgetAssign(this.widget);

        return "obj";
    }

    private convertGetFunction(func: string): string {
        // lv_xxx_get_yyy -> xxx.get_yyy or direct conversion
        // Most get functions in MicroPython are methods
        return func.replace(/^lv_/, "lv.");
    }

    //--------------------------------------------------------------------------
    // Function calls
    //--------------------------------------------------------------------------

    callObjectFunction(func: string, ...args: any[]): any {
        // lv_obj_set_pos(obj, x, y) -> obj.set_pos(x, y)
        const methodName = this.convertToMethod(func);
        const objRef = this.isTick ? this.objectAccessor : "obj";

        this.build.line(`${objRef}.${methodName}(${args.join(", ")})`);
        return undefined;
    }

    callObjectFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any {
        const methodName = this.convertToMethod(func);
        const objRef = this.isTick ? this.objectAccessor : "obj";

        this.build.line(`${declName} = ${objRef}.${methodName}(${args.join(", ")})`);
        return declName;
    }

    callObjectFunctionInline(func: string, ...args: any[]): any {
        const methodName = this.convertToMethod(func);
        const objRef = this.isTick ? this.objectAccessor : "obj";

        return `${objRef}.${methodName}(${args.join(", ")})`;
    }

    private convertToMethod(func: string): string {
        // lv_obj_set_pos -> set_pos
        // lv_obj_get_width -> get_width
        // lv_label_set_text -> set_text

        // Remove lv_ prefix and object type prefix
        const withoutLv = func.replace(/^lv_/, "");

        // Common patterns to remove
        const prefixesToRemove = [
            "obj_", "label_", "btn_", "img_", "arc_", "bar_", "slider_",
            "switch_", "checkbox_", "dropdown_", "roller_", "textarea_",
            "table_", "chart_", "canvas_", "calendar_", "keyboard_",
            "list_", "menu_", "msgbox_", "spinner_", "spinbox_",
            "tabview_", "tileview_", "win_", "colorwheel_", "led_",
            "meter_", "span_", "spangroup_", "btnmatrix_", "line_",
            "scale_", "imagebutton_", "animimg_", "style_", "image_",
            "button_", "buttonmatrix_"
        ];

        for (const prefix of prefixesToRemove) {
            if (withoutLv.startsWith(prefix)) {
                return withoutLv.substring(prefix.length);
            }
        }

        return withoutLv;
    }

    callFreeFunction(func: string, ...args: any[]): any {
        // lv_xxx_yyy() -> lv.xxx_yyy() or special handling
        const pythonFunc = this.convertFreeFunction(func);
        this.build.line(`${pythonFunc}(${args.join(", ")})`);
        return undefined;
    }

    callFreeFunctionWithAssignment(
        declType: string,
        declName: string,
        func: string,
        ...args: any[]
    ): any {
        const pythonFunc = this.convertFreeFunction(func);
        this.build.line(`${declName} = ${pythonFunc}(${args.join(", ")})`);
        return declName;
    }

    private convertFreeFunction(func: string): string {
        // lv_scr_load -> lv.screen_load
        // lv_disp_get_default -> lv.display.get_default
        const mappings: { [key: string]: string } = {
            "lv_scr_load": "lv.screen_load",
            "lv_scr_load_anim": "lv.screen_load_anim",
            "lv_scr_act": "lv.screen_active",
            "lv_layer_top": "lv.layer_top",
            "lv_layer_sys": "lv.layer_sys",
            "lv_disp_get_default": "lv.display.get_default",
            "lv_theme_default_init": "lv.theme_default_init",
            "lv_color_hex": "lv.color_hex",
            "lv_color_make": "lv.color_make",
            "lv_color_white": "lv.color_white",
            "lv_color_black": "lv.color_black",
            "lv_pct": "lv.pct",
            "lv_anim_init": "lv.anim_t",
            "strcmp": "# strcmp - use Python comparison",
            "strncmp": "# strncmp - use Python comparison",
        };

        if (mappings[func]) {
            return mappings[func];
        }

        // Generic: lv_xxx -> lv.xxx
        return func.replace(/^lv_/, "lv.");
    }

    //--------------------------------------------------------------------------
    // Property evaluation (simplified for non-flow MicroPython)
    //--------------------------------------------------------------------------

    evalTextProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        // For MicroPython without flow, return variable directly
        this.build.line(`${declName} = get_var_${this.toSnakeCase(propertyValue)}()`);
        return declName;
    }

    evalIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        this.build.line(`${declName} = get_var_${this.toSnakeCase(propertyValue)}()`);
        return declName;
    }

    evalUnsignedIntegerProperty(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        this.build.line(`${declName} = get_var_${this.toSnakeCase(propertyValue)}()`);
        return declName;
    }

    evalStringArrayPropertyAndJoin(
        declType: string,
        declName: string,
        propertyValue: string,
        errorMessage: any
    ) {
        this.build.line(`${declName} = "\\n".join(get_var_${this.toSnakeCase(propertyValue)}())`);
        return declName;
    }

    private toSnakeCase(str: string): string {
        return str
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
    }

    assignIntegerProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ): void {
        this.build.line(`set_var_${this.toSnakeCase(propertyValue)}(${value})`);
    }

    assignStringProperty(
        propertyName: string,
        propertyValue: string,
        value: any,
        errorMessage: any
    ): void {
        this.build.line(`set_var_${this.toSnakeCase(propertyValue)}(${value})`);
    }

    //--------------------------------------------------------------------------
    // Tick callbacks
    //--------------------------------------------------------------------------

    addToTick(propertyName: string, callback: () => void) {
        const widget = this.widget;

        this.build.addTickCallback(() => {
            this.widget = widget;
            this.isTick = true;
            callback();
            this.isTick = false;
        });
    }

    tickChangeStart() {
        this.build.line(`tick_value_change_obj = ${this.objectAccessor}`);
    }

    tickChangeEnd() {
        this.build.line(`tick_value_change_obj = None`);
    }

    //--------------------------------------------------------------------------
    // Control flow
    //--------------------------------------------------------------------------

    assign(declType: string, declName: string, rhs: any) {
        // Python doesn't need type declarations
        this.build.line(`${declName} = ${rhs}`);
        return declName;
    }

    if(a: any, callback: () => void) {
        this.build.blockStart(`if ${a}:`);
        callback();
        this.build.blockEnd("");
    }

    ifStringNotEqual(a: any, b: any, callback: () => void) {
        this.build.blockStart(`if ${a} != ${b}:`);
        callback();
        this.build.blockEnd("");
    }

    ifStringNotEqualN(a: any, b: any, n: any, callback: () => void) {
        this.build.blockStart(`if ${a}[:${n}] != ${b}[:${n}]:`);
        callback();
        this.build.blockEnd("");
    }

    ifIntegerLess(a: any, b: any, callback: () => void) {
        this.build.blockStart(`if ${a} < ${b}:`);
        callback();
        this.build.blockEnd("");
    }

    ifIntegerNotEqual(a: any, b: any, callback: () => void) {
        this.build.blockStart(`if ${a} != ${b}:`);
        callback();
        this.build.blockEnd("");
    }

    //--------------------------------------------------------------------------
    // Color handling
    //--------------------------------------------------------------------------

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

    //--------------------------------------------------------------------------
    // Block structure (Python uses indentation)
    //--------------------------------------------------------------------------

    blockStart(param: any) {
        this.build.blockStart(param);
    }

    blockEnd(param: any) {
        this.build.blockEnd(param);
    }

    //--------------------------------------------------------------------------
    // Event handlers
    //--------------------------------------------------------------------------

    addEventHandler(
        eventName: string,
        callback: (event: any, tick_value_change_obj: any) => void
    ) {
        const widget = this.widget;
        const componentIndex = this.componentIndex;
        const propertyIndex = this.propertyIndex;

        this.build.addEventHandler(this.widget, () => {
            this.build.blockStart(`if event == lv.EVENT.${eventName}:`);

            this.widget = widget;
            this.componentIndex = componentIndex;
            this.propertyIndex = propertyIndex;

            callback("e", "tick_value_change_obj");

            this.build.blockEnd("");
        });
    }

    lvglAddObjectFlowCallback(propertyName: string, filter: number) {
        // Flow callbacks not supported in MicroPython mode
    }

    postPageExecute(callback: () => void) {
        this.build.postBuildAdd(callback);
    }

    postWidgetExecute(callback: () => void) {
        this.noGoodNameCallbacks.push(callback);
    }
}

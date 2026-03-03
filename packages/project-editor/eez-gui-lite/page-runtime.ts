import {
    autorun,
    IReactionDisposer,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import tinycolor from "tinycolor2";

import type { IWasmFlowRuntime } from "eez-studio-types";

import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    getStyleProperty,
    type Style
} from "project-editor/features/style/style";

import type { Page } from "project-editor/features/page/page";
import { Widget, type Component } from "project-editor/flow/component";
import {
    ButtonWidget,
    RectangleWidget,
    SwitchWidget,
    TextWidget
} from "project-editor/flow/components/widgets/eez-gui";
import {
    ContainerWidget,
    SelectWidget
} from "project-editor/flow/components/widgets";

import {
    evalConstantExpression,
    evalExpression
} from "project-editor/eez-flow-lite/expression";

import { Theme } from "project-editor/features/style/theme";
import type { EezGuiLiteWasmRuntime } from "project-editor/eez-gui-lite/wasm-runtime";

////////////////////////////////////////////////////////////////////////////////

interface WidgetInfo {
    widget: Widget;
    ptr: number;
    children?: WidgetInfo[];
}

////////////////////////////////////////////////////////////////////////////////

export class EezGuiLiteRuntime {
    wasm: IWasmFlowRuntime;
    autorRunDispose: IReactionDisposer | undefined;
    isMounted: boolean = false;
    requestAnimationFrameId: number | undefined;

    // Cached WASM pointers (freed on unmount / rebuild)
    fontsPtr: number = 0;
    colorsPtr: number = 0;
    stylesPtr: number = 0;
    pageDataPtr: number = 0;
    widgetInfos: WidgetInfo[] = [];
    allocatedPtrs: number[] = [];

    // Property tables — populated during createPage, queried by WASM callbacks
    strProps: Map<number, string | undefined> = new Map();
    boolProps: Map<number, string | undefined> = new Map();
    intProps: Map<number, string | undefined> = new Map();
    nextPropIndex: number = 1; // 0 = PROP_NONE

    // Widget pointer → WidgetInfo mapping (for event dispatch)
    widgetPtrMap: Map<number, WidgetInfo> = new Map();

    styles: Style[] = [];
    pageStyleIndex: number;

    colors: string[] = [];
    colorRgbs: { r: number; g: number; b: number }[] = [];

    pageImageDataMap = new Map<Page, ImageData>();

    pointerEvents: {
        x: number;
        y: number;
        pressed: boolean;
    }[] = [];
    lastPointerEvent = { x: -1, y: -1, pressed: false };

    constructor(
        public page: Page,
        public runtime?: EezGuiLiteWasmRuntime,
        public ctx?: CanvasRenderingContext2D
    ) {
        makeObservable(this, {
            pageImageDataMap: observable
        });
    }

    get displayWidth() {
        let width = this.page.width;
        if (typeof width != "number" || isNaN(width) || width < 1) {
            width = 1;
        }
        return width;
    }

    get displayHeight() {
        let height = this.page.height;
        if (typeof height != "number" || isNaN(height) || height < 1) {
            height = 1;
        }
        return height;
    }

    get project() {
        return ProjectEditor.getProject(this.page);
    }

    //
    // ── Lifecycle ───────────────────────────────────────────────────────
    //

    mount() {
        if (this.isMounted) {
            return;
        }

        const eezGuiLiteRuntimeConstructor = require("project-editor/flow/runtime/wasm/eez_gui_lite_runtime.js");
        const wasm = eezGuiLiteRuntimeConstructor(async () => {
            if (this.wasm != wasm) {
                return;
            }

            this.wasm._initEezGuiLite(this.displayWidth, this.displayHeight);

            // Register JS callbacks on the Module object so that
            // library.js can forward C calls to them.
            this.registerCallbacks();

            if (this.runtime) {
                this.buildAndRender();
                this.wasm._requestRefresh();
            } else {
                this.autorRunDispose = autorun(() => {
                    this.buildAndRender();
                    this.wasm._requestRefresh();
                });
            }

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.tick
            );

            this.isMounted = true;
        });

        this.wasm = wasm;
    }

    tick = () => {
        if (this.runtime) {
            this.runtime.processQueue();
            if (!this.isMounted) {
                return;
            }

            const pointerEvent = this.pointerEvents.shift();
            if (pointerEvent) {
                this.wasm._pointerInput(
                    pointerEvent.x,
                    pointerEvent.y,
                    pointerEvent.pressed
                );
                this.lastPointerEvent = pointerEvent;
            } else {
                this.wasm._pointerInput(
                    this.lastPointerEvent.x,
                    this.lastPointerEvent.y,
                    this.lastPointerEvent.pressed
                );
            }
        }

        this.renderPage();

        const frameBuffer = this.wasm._getSyncedBuffer();
        if (frameBuffer) {
            const screen = new Uint8ClampedArray(
                this.wasm.HEAPU8.subarray(
                    frameBuffer,
                    frameBuffer + this.displayWidth * this.displayHeight * 4
                )
            );

            var pageImageData = new ImageData(
                screen,
                this.displayWidth,
                this.displayHeight
            );

            if (this.runtime) {
                runInAction(() => {
                    this.pageImageDataMap.set(this.page, pageImageData);
                });
            } else if (this.ctx) {
                this.drawPage(this.ctx, pageImageData);
            }
        }

        this.requestAnimationFrameId = window.requestAnimationFrame(this.tick);
    };

    drawPage(ctx: CanvasRenderingContext2D, imgData: ImageData) {
        ctx.putImageData(
            imgData,
            0,
            0,
            0,
            0,
            this.displayWidth,
            this.displayHeight
        );
    }

    unmount() {
        if (!this.isMounted) {
            return;
        }

        if (this.requestAnimationFrameId !== undefined) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
            this.requestAnimationFrameId = undefined;
        }

        if (this.autorRunDispose) {
            this.autorRunDispose();
            this.autorRunDispose = undefined;
        }

        this.freeAllocatedPtrs();
        this.isMounted = false;
    }

    //
    // ── JS Callback Registration ────────────────────────────────────────
    //

    registerCallbacks() {
        const self = this;

        // String property getter — returns a WASM pointer to a UTF-8 string
        (this.wasm as any)._jsGetStrProp = (prop: number): number => {
            let value: any = self.strProps.get(prop);

            if (value != undefined) {
                if (this.runtime) {
                    const flowState = this.runtime.flowStates.find(
                        flowState => flowState.flow == this.page
                    );
                    if (flowState) {
                        value = evalExpression(
                            flowState.expressionContext,
                            undefined,
                            value
                        );
                    }
                } else {
                    try {
                        value = evalConstantExpression(
                            this.project,
                            value
                        ).value;
                    } catch (err) {
                        value = `{${value})`;
                    }
                }
            }

            if (value == undefined) {
                value = "";
            }

            if (typeof value != "string") {
                value = value.toString();
            }

            return self.wasm.stringToNewUTF8(value);
            return 0;
        };

        // Boolean property getter
        (this.wasm as any)._jsGetBoolProp = (prop: number): number => {
            let propValue = self.boolProps.get(prop);

            let value;

            if (propValue != undefined) {
                if (this.runtime) {
                    const flowState = this.runtime.flowStates.find(
                        flowState => flowState.flow == this.page
                    );
                    if (flowState) {
                        value = evalExpression(
                            flowState.expressionContext,
                            undefined,
                            propValue
                        );
                    }
                } else {
                    try {
                        value = evalConstantExpression(
                            this.project,
                            propValue
                        ).value;
                    } catch (err) {
                        value = false;
                    }
                }
            }

            if (value == undefined) {
                value = false;
            }

            return value ? 1 : 0;
        };

        // Integer property getter
        (this.wasm as any)._jsGetIntProp = (prop: number): number => {
            const propValue = self.intProps.get(prop);

            let value;

            if (propValue != undefined) {
                if (this.runtime) {
                    const flowState = this.runtime.flowStates.find(
                        flowState => flowState.flow == this.page
                    );
                    if (flowState) {
                        value = evalExpression(
                            flowState.expressionContext,
                            undefined,
                            propValue
                        );
                    }
                } else {
                    try {
                        value = evalConstantExpression(
                            this.project,
                            propValue
                        ).value;
                    } catch (err) {
                        value = 0;
                    }
                }
            }

            if (value == undefined) {
                value = 0;
            }

            return value;
        };

        // Event handler
        (this.wasm as any)._jsOnEvent = (
            widgetPtr: number,
            eventType: number
        ) => {
            const info = self.widgetPtrMap.get(widgetPtr);
            if (info && this.runtime) {
                this.runtime.onEvent(this.page, info.widget, eventType);
            }
        };
    }

    //
    // ── Build & Render ──────────────────────────────────────────────────
    //

    buildAndRender() {
        this.freeAllocatedPtrs();
        this.resetProps();

        this.createPage();
        this.createStyles();
        this.createColors();
        this.createFonts();
    }

    freeAllocatedPtrs() {
        for (const ptr of this.allocatedPtrs) {
            this.wasm._free(ptr);
        }
        this.allocatedPtrs = [];
        this.widgetInfos = [];
        this.widgetPtrMap.clear();
        this.fontsPtr = 0;
        this.colorsPtr = 0;
        this.stylesPtr = 0;
        this.pageDataPtr = 0;

        this.styles = [];
        this.colors = [];
        this.colorRgbs = [];
    }

    wasmMalloc(size: number): number {
        const ptr = this.wasm._malloc(size);
        this.allocatedPtrs.push(ptr);
        return ptr;
    }

    //
    // ── Property management ─────────────────────────────────────────────
    //

    resetProps() {
        this.strProps.clear();
        this.boolProps.clear();
        this.intProps.clear();
        this.nextPropIndex = 1;
    }

    addStrProp(value: string | undefined): number {
        const index = this.nextPropIndex++;
        this.strProps.set(index, value);
        return index;
    }

    addBoolProp(value: string | undefined): number {
        const index = this.nextPropIndex++;
        this.boolProps.set(index, value);
        return index;
    }

    addIntProp(value: string | undefined): number {
        const index = this.nextPropIndex++;
        this.intProps.set(index, value);
        return index;
    }

    //
    // ── Fonts ───────────────────────────────────────────────────────────
    //

    createFonts() {
        const fonts = this.project.fonts;
        const fontsPtr = this.wasmMalloc(fonts.length * 4);

        const glyphSize = this.wasm._sizeofGlyphData();
        const groupSize = this.wasm._sizeofGlyphsGroup();
        const fontDataSize = this.wasm._sizeofFontData();

        // glyph_data_t field offsets
        const offGlyphDx = this.wasm._offsetofGlyphDx();
        const offGlyphW = this.wasm._offsetofGlyphW();
        const offGlyphH = this.wasm._offsetofGlyphH();
        const offGlyphX = this.wasm._offsetofGlyphX();
        const offGlyphY = this.wasm._offsetofGlyphY();
        const offGlyphPixelsIndex = this.wasm._offsetofGlyphPixelsIndex();

        // glyphs_group_t field offsets
        const offGroupEncoding = this.wasm._offsetofGroupEncoding();
        const offGroupGlyphIndex = this.wasm._offsetofGroupGlyphIndex();
        const offGroupLength = this.wasm._offsetofGroupLength();

        // font_data_t field offsets
        const offFontAscent = this.wasm._offsetofFontAscent();
        const offFontDescent = this.wasm._offsetofFontDescent();
        const offFontEncodingStart = this.wasm._offsetofFontEncodingStart();
        const offFontEncodingEnd = this.wasm._offsetofFontEncodingEnd();
        const offFontGroups = this.wasm._offsetofFontGroups();
        const offFontGlyphs = this.wasm._offsetofFontGlyphs();
        const offFontPixels = this.wasm._offsetofFontPixels();

        for (let fi = 0; fi < fonts.length; fi++) {
            const font = fonts[fi];
            const glyphs = font.glyphs
                .slice()
                .sort((a, b) => a.encoding - b.encoding);

            // Build groups of consecutive encodings
            const groups: {
                encoding: number;
                glyphIndex: number;
                length: number;
            }[] = [];
            let i = 0;
            while (i < glyphs.length) {
                const start = i++;
                while (
                    i < glyphs.length &&
                    glyphs[i].encoding === glyphs[i - 1].encoding + 1
                ) {
                    i++;
                }
                groups.push({
                    encoding: glyphs[start].encoding,
                    glyphIndex: start,
                    length: i - start
                });
            }

            let startEncoding = groups.length > 0 ? groups[0].encoding : 0;
            let endEncoding =
                groups.length > 0
                    ? groups[0].encoding + groups[0].length - 1
                    : 0;

            // Pixels
            const pixels = glyphs.map(g => g.pixelArray || []).flat();
            const pixelsPtr = this.wasmMalloc(Math.max(pixels.length, 1));
            this.wasm.HEAPU8.set(pixels, pixelsPtr);

            // Glyphs
            const glyphsPtr = this.wasmMalloc(glyphs.length * glyphSize);
            let pixelsIndex = 0;
            for (let gi = 0; gi < glyphs.length; gi++) {
                const glyph = glyphs[gi];
                const base = glyphsPtr + gi * glyphSize;
                this.wasm.HEAP8[base + offGlyphDx] = glyph.dx;
                this.wasm.HEAPU8[base + offGlyphW] = glyph.width;
                this.wasm.HEAPU8[base + offGlyphH] = glyph.height;
                this.wasm.HEAP8[base + offGlyphX] = glyph.x;
                this.wasm.HEAP8[base + offGlyphY] = glyph.y;
                this.wasm.HEAPU32[(base + offGlyphPixelsIndex) >> 2] =
                    pixelsIndex;
                pixelsIndex += glyph.pixelArray ? glyph.pixelArray.length : 0;
            }

            // Groups (+1 for sentinel with length=0)
            const groupsPtr = this.wasmMalloc((groups.length + 1) * groupSize);
            for (let gi = 0; gi < groups.length; gi++) {
                const group = groups[gi];
                const base = groupsPtr + gi * groupSize;
                this.wasm.HEAPU32[(base + offGroupEncoding) >> 2] =
                    group.encoding;
                this.wasm.HEAPU32[(base + offGroupGlyphIndex) >> 2] =
                    group.glyphIndex;
                this.wasm.HEAPU32[(base + offGroupLength) >> 2] = group.length;
            }
            // Sentinel
            const sentinelBase = groupsPtr + groups.length * groupSize;
            this.wasm.HEAPU32[(sentinelBase + offGroupEncoding) >> 2] = 0;
            this.wasm.HEAPU32[(sentinelBase + offGroupGlyphIndex) >> 2] = 0;
            this.wasm.HEAPU32[(sentinelBase + offGroupLength) >> 2] = 0;

            // font_data_t
            const fontDataPtr = this.wasmMalloc(fontDataSize);
            this.wasm.HEAPU8[fontDataPtr + offFontAscent] = font.ascent;
            this.wasm.HEAPU8[fontDataPtr + offFontDescent] = font.descent;
            this.wasm.HEAPU32[(fontDataPtr + offFontEncodingStart) >> 2] =
                startEncoding;
            this.wasm.HEAPU32[(fontDataPtr + offFontEncodingEnd) >> 2] =
                endEncoding;
            this.wasm.HEAPU32[(fontDataPtr + offFontGroups) >> 2] = groupsPtr;
            this.wasm.HEAPU32[(fontDataPtr + offFontGlyphs) >> 2] = glyphsPtr;
            this.wasm.HEAPU32[(fontDataPtr + offFontPixels) >> 2] = pixelsPtr;

            // Store pointer in the fonts array
            this.wasm.HEAPU32[(fontsPtr >> 2) + fi] = fontDataPtr;
        }

        this.fontsPtr = fontsPtr;
        this.wasm._setFonts(fontsPtr, fonts.length);
    }

    //
    // ── Colors ──────────────────────────────────────────────────────────
    //

    createColors() {
        const colorsCount = this.colorRgbs.length;

        // Allocate color_t array (uint16_t per color)
        const colorsPtr = this.wasmMalloc(colorsCount * 4);

        for (let ci = 0; ci < colorsCount; ci++) {
            const rgb = this.colorRgbs[ci];
            const color = this.wasm._makeColor(rgb.r, rgb.g, rgb.b);
            this.wasm.HEAPU32[(colorsPtr >> 2) + ci] = color;
        }

        this.colorsPtr = colorsPtr;
        this.wasm._setColors(colorsPtr, colorsCount);
    }

    //
    // ── Styles ──────────────────────────────────────────────────────────
    //

    getColorIndex(style: Style, property: string): number {
        let colorValue = getStyleProperty(style, property, false);

        if (colorValue == undefined) {
            colorValue = "#00000000";
        }

        let colorIndex = this.colors.indexOf(colorValue);
        if (colorIndex == -1) {
            colorIndex = this.colors.length;
            this.colors.push(colorValue);

            let color = this.project.colors.find(
                color => color.name == colorValue
            );
            if (color) {
                let theme;
                if (this.runtime) {
                    theme = this.runtime.selectedTheme;
                } else {
                    theme = this.project._store.navigationStore.selectedThemeObject.get() as Theme;
                }
                if (!theme) {
                    theme = this.project.themes[0];
                }

                colorValue = this.project.getThemeColor(
                    theme.objID,
                    color.objID
                );
            }

            const tc = tinycolor(colorValue);
            const rgb = tc.toRgb();
            this.colorRgbs.push({ r: rgb.r, g: rgb.g, b: rgb.b });
        }
        return colorIndex;
    }

    getFontIndex(style: Style): number {
        const fontName = getStyleProperty(style, "font");
        if (fontName) {
            const fontIndex = this.project.fonts.findIndex(
                f => f.name == fontName
            );
            if (fontIndex >= 0) {
                return fontIndex;
            }
        }
        return 0;
    }

    createStyles() {
        const styles = this.styles;

        const styleSize = this.wasm._sizeofStyle();
        const stylesPtr = this.wasmMalloc(styles.length * styleSize);

        for (let si = 0; si < styles.length; si++) {
            const style = styles[si];
            const base = stylesPtr + si * styleSize;

            // flags
            let flags = 0;
            const hAlign = style.alignHorizontalProperty;
            if (hAlign == "right") {
                flags |= this.wasm._getStyleFlagHorzAlignRight();
            } else if (hAlign == "center") {
                flags |= this.wasm._getStyleFlagHorzAlignCenter();
            }

            const vAlign = style.alignVerticalProperty;
            if (vAlign == "bottom") {
                flags |= this.wasm._getStyleFlagVertAlignBottom();
            } else if (vAlign == "center") {
                flags |= this.wasm._getStyleFlagVertAlignCenter();
            }

            if (style.blinkProperty) {
                flags |= this.wasm._getStyleFlagBlink();
            }

            this.wasm.HEAPU16[(base + this.wasm._offsetofStyleFlags()) >> 1] =
                flags;

            this.wasm.HEAPU16[(base + this.wasm._offsetofStyleBgColor()) >> 1] =
                this.getColorIndex(style, "backgroundColor");

            this.wasm.HEAPU16[(base + this.wasm._offsetofStyleColor()) >> 1] =
                this.getColorIndex(style, "color");

            this.wasm.HEAPU16[
                (base + this.wasm._offsetofStyleActiveBgColor()) >> 1
            ] = this.getColorIndex(style, "activeBackgroundColor");

            this.wasm.HEAPU16[
                (base + this.wasm._offsetofStyleActiveColor()) >> 1
            ] = this.getColorIndex(style, "activeColor");

            const borderRect = style.borderSizeRect;
            this.wasm.HEAPU8[base + this.wasm._offsetofStyleBorderSizeTop()] =
                borderRect.top;
            this.wasm.HEAPU8[base + this.wasm._offsetofStyleBorderSizeRight()] =
                borderRect.right;
            this.wasm.HEAPU8[
                base + this.wasm._offsetofStyleBorderSizeBottom()
            ] = borderRect.bottom;
            this.wasm.HEAPU8[base + this.wasm._offsetofStyleBorderSizeLeft()] =
                borderRect.left;

            this.wasm.HEAPU16[
                (base + this.wasm._offsetofStyleBorderColor()) >> 1
            ] = this.getColorIndex(style, "borderColor");

            this.wasm.HEAPU8[base + this.wasm._offsetofStyleFont()] =
                this.getFontIndex(style);

            const paddingRect = style.paddingRect;
            this.wasm.HEAPU8[base + this.wasm._offsetofStylePaddingTop()] =
                paddingRect.top;
            this.wasm.HEAPU8[base + this.wasm._offsetofStylePaddingRight()] =
                paddingRect.right;
            this.wasm.HEAPU8[base + this.wasm._offsetofStylePaddingBottom()] =
                paddingRect.bottom;
            this.wasm.HEAPU8[base + this.wasm._offsetofStylePaddingLeft()] =
                paddingRect.left;
        }

        this.stylesPtr = stylesPtr;
        this.wasm._setStyles(stylesPtr, styles.length);
    }

    getStyleIndex(style: Style): number {
        let styleIndex = this.styles.findIndex(s => s == style);
        if (styleIndex == -1) {
            styleIndex = this.styles.length;
            this.styles.push(style);
        }
        return styleIndex;
    }

    getStyleIndexForWidget(widget: Widget): number {
        return this.getStyleIndex(widget.style);
    }

    //
    // ── Page / Widget Creation ──────────────────────────────────────────
    //

    createPage() {
        this.widgetInfos = [];
        this.widgetPtrMap.clear();

        // Allocate a unique page data sentinel (just 4 bytes)
        this.pageDataPtr = this.wasmMalloc(4);

        this.widgetInfos = this.createWidgets(this.page.components);

        this.pageStyleIndex = this.getStyleIndexForPage();
    }

    createWidgets(components: Component[]): WidgetInfo[] {
        const infos: WidgetInfo[] = [];

        for (const component of components) {
            if (!(component instanceof Widget)) continue;
            const widget = component;

            let widgetPtr: number;
            let children: WidgetInfo[] | undefined;

            if (widget instanceof TextWidget) {
                widgetPtr = this.wasm._allocTextWidget();
                this.setupWidgetBase(widgetPtr, widget);
                const textValue = widget.text || widget.data || "";
                const textProp = this.addStrProp(textValue);
                this.wasm._setTextWidgetText(widgetPtr, textProp);
            } else if (widget instanceof ButtonWidget) {
                widgetPtr = this.wasm._allocButtonWidget();
                this.setupWidgetBase(widgetPtr, widget);
                const textValue = widget.text || widget.data || "";
                const textProp = this.addStrProp(textValue);
                this.wasm._setButtonWidgetText(widgetPtr, textProp);
            } else if (widget instanceof RectangleWidget) {
                widgetPtr = this.wasm._allocRectangleWidget();
                this.setupWidgetBase(widgetPtr, widget);
            } else if (widget instanceof SwitchWidget) {
                widgetPtr = this.wasm._allocSwitchWidget();
                this.setupWidgetBase(widgetPtr, widget);
                const checkedProp = this.addBoolProp(widget.data);
                this.wasm._setSwitchWidgetChecked(widgetPtr, checkedProp);
            } else if (widget instanceof SelectWidget) {
                widgetPtr = this.wasm._allocSelectWidget();
                this.setupWidgetBase(widgetPtr, widget);
                children = this.createWidgets(widget.widgets);
            } else if (widget instanceof ContainerWidget) {
                widgetPtr = this.wasm._allocContainerWidget();
                this.setupWidgetBase(widgetPtr, widget);
                children = this.createWidgets(widget.widgets);
            } else {
                continue;
            }

            this.allocatedPtrs.push(widgetPtr);
            const info: WidgetInfo = { widget, ptr: widgetPtr, children };
            infos.push(info);
            this.widgetPtrMap.set(widgetPtr, info);
        }

        return infos;
    }

    setupWidgetBase(widgetPtr: number, widget: Widget) {
        this.wasm._setWidgetGeometry(
            widgetPtr,
            widget.left,
            widget.top,
            widget.width,
            widget.height
        );
        this.wasm._setWidgetStyle(
            widgetPtr,
            this.getStyleIndexForWidget(widget)
        );

        if (widget.visible) {
            const visProp = this.addBoolProp(widget.visible);
            this.wasm._setWidgetVisible(widgetPtr, visProp);
        }

        // clickable flag
        let clickable = false;

        if (widget instanceof SwitchWidget) {
            clickable = true;
        } else {
            for (const eventHandler of widget.eventHandlers) {
                if (eventHandler.handlerType == "action") {
                    clickable = true;
                    break;
                }

                const connectionLine = this.page.connectionLines.find(
                    connectionLine =>
                        connectionLine.sourceComponent == widget &&
                        connectionLine.output == eventHandler.eventName
                );
                if (connectionLine) {
                    clickable = true;
                    break;
                }
            }
        }

        if (clickable) {
            this.wasm._setWidgetFlags(
                widgetPtr,
                this.wasm._getWidgetFlagClickable()
            );
        }
    }

    //
    // ── Page Rendering (called each tick) ───────────────────────────────
    //

    renderPage() {
        if (!this.pageDataPtr) {
            return;
        }

        this.wasm._startPage(this.pageDataPtr, this.pageStyleIndex);
        this.renderWidgets(this.widgetInfos);
        this.wasm._endPage();
    }

    getStyleIndexForPage(): number {
        let style = this.project.styles.find(
            style => style.name == this.page.style
        );
        if (!style) {
            style = this.project.styles[0];
        }
        return this.getStyleIndex(style);
    }

    renderWidgets(infos: WidgetInfo[]) {
        for (const info of infos) {
            const widget = info.widget;

            if (widget instanceof TextWidget) {
                this.wasm._renderTextWidget(info.ptr);
            } else if (widget instanceof ButtonWidget) {
                this.wasm._renderButtonWidget(info.ptr);
            } else if (widget instanceof RectangleWidget) {
                this.wasm._renderRectangleWidget(info.ptr);
            } else if (widget instanceof SwitchWidget) {
                this.wasm._renderSwitchWidget(info.ptr);
            } else if (widget instanceof SelectWidget) {
                this.wasm._renderSelectBegin(info.ptr);
                if (info.children && info.children.length > 0) {
                    if (this.runtime) {
                        let selected = -1;
                        if (widget.data != undefined) {
                            const flowState = this.runtime.flowStates.find(
                                flowState => flowState.flow == this.page
                            );
                            if (flowState) {
                                const value = evalExpression(
                                    flowState.expressionContext,
                                    widget,
                                    widget.data
                                );

                                if (Number.isInteger(Number(value))) {
                                    selected = value;
                                }
                            }
                        }

                        if (selected >= 0 && selected < info.children.length) {
                            this.renderWidgets([info.children[selected]]);
                        }
                    } else {
                        this.renderWidgets([
                            info.children[
                                widget._lastSelectedIndexInSelectWidget ?? 0
                            ]
                        ]);
                    }
                }
                this.wasm._renderSelectEnd(info.ptr);
            } else if (widget instanceof ContainerWidget) {
                this.wasm._renderContainerBegin(info.ptr);
                if (info.children) {
                    this.renderWidgets(info.children);
                }
                this.wasm._renderContainerEnd(info.ptr);
            }
        }
    }
}

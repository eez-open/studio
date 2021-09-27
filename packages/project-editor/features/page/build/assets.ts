import {
    getObjectFromStringPath,
    getObjectPathAsString,
    getProperty
} from "project-editor/core/object";

import * as output from "project-editor/core/output";

import {
    Project,
    BuildConfiguration,
    getProject,
    getFlow
} from "project-editor/project/project";

import * as projectBuild from "project-editor/project/build";

import {
    Style,
    getStyleProperty,
    findStyle
} from "project-editor/features/style/style";
import { Page, findPage } from "project-editor/features/page/page";
import { findFont, Font } from "project-editor/features/font/font";
import { Bitmap, findBitmap } from "project-editor/features/bitmap/bitmap";
import { Action, findAction } from "project-editor/features/action/action";
import {
    Variable,
    findVariable
} from "project-editor/features/variable/variable";
import { Flow } from "project-editor/flow/flow";
import { Component, Widget } from "project-editor/flow/component";

import { buildGuiDocumentData } from "project-editor/features/page/build/pages";
import { buildGuiStylesData } from "project-editor/features/page/build/styles";
import { buildGuiFontsData } from "project-editor/features/page/build/fonts";
import { buildGuiBitmapsData } from "project-editor/features/page/build/bitmaps";
import { buildGuiColors } from "project-editor/features/page/build/themes";
import { buildActionNames } from "project-editor/features/page/build/actions";
import { buildVariableNames } from "project-editor/features/page/build/variables";
import { buildFlowData } from "project-editor/features/page/build/flows";
import {
    FlowValue,
    getConstantFlowValueType
} from "project-editor/features/page/build/value";

export const PATH_SEPARATOR = "//";

export class Assets {
    projects: Project[];

    globalVariables: Variable[];
    actions: Action[];
    pages: Page[];
    styles: (Style | undefined)[];
    fonts: (Font | undefined)[] = [];
    bitmaps: Bitmap[] = [];
    colors: string[] = [];
    flows: Flow[] = [];

    flowStates = new Map<
        Flow,
        {
            index: number;
            componentIndexes: Map<Component, number>;
            componentInputIndexes: Map<string, number>;

            flowWidgetDataIndexes: Map<string, number>;
            flowWidgetDataIndexToComponentPropertyValue: Map<
                number,
                {
                    componentIndex: number;
                    propertyValueIndex: number;
                }
            >;
            flowWidgetFromDataIndex: Map<number, Widget>;

            flowWidgetActionIndexes: Map<string, number>;
            flowWidgetActionComponentOutput: Map<number, number>;
            flowWidgetFromActionIndex: Map<number, Widget>;
        }
    >();

    constants: FlowValue[] = [];
    constantsMap = new Map<
        undefined | boolean | number | string | object,
        number
    >();

    map: AssetsMap = {
        flows: [],
        constants: [],
        globalVariables: []
    };

    get DocumentStore() {
        return this.rootProject._DocumentStore;
    }

    collectProjects(project: Project) {
        if (this.projects.indexOf(project) === -1) {
            this.projects.push(project);
            for (const importDirective of this.rootProject.settings.general
                .imports) {
                if (importDirective.project) {
                    this.collectProjects(importDirective.project);
                }
            }
        }
    }

    getAssets<T>(
        getCollection: (project: Project) => T[],
        assetIncludePredicate: (asset: T) => boolean
    ) {
        const assets = [];
        for (const project of this.projects) {
            assets.push(
                ...getCollection(project).filter(assetIncludePredicate)
            );
        }
        return assets;
    }

    constructor(
        public rootProject: Project,
        buildConfiguration: BuildConfiguration | undefined
    ) {
        this.getConstantIndex(undefined); // undefined has value index 0
        this.getConstantIndex(null); // null has value index 1

        this.projects = [];
        this.collectProjects(rootProject);

        {
            const assetIncludePredicate = (asset: Variable | Action | Page) =>
                !buildConfiguration ||
                !asset.usedIn ||
                asset.usedIn.indexOf(buildConfiguration.name) !== -1;

            this.flows = this.getAssets<Page | Action>(
                project => [...project.pages, ...project.actions],
                assetIncludePredicate
            );

            this.flows.forEach(flow => this.getFlowState(flow));

            this.globalVariables = this.getAssets<Variable>(
                project => project.variables.globalVariables,
                assetIncludePredicate
            );

            this.actions = this.getAssets<Action>(
                project => project.actions,
                assetIncludePredicate
            );

            this.pages = this.getAssets<Page>(
                project => project.pages,
                assetIncludePredicate
            );
        }

        this.styles = [undefined];
        this.getAssets<Style>(
            project => project.styles,
            style => style.id != undefined
        ).forEach(style => this.addStyle(style));
        this.getAssets<Style>(
            project => project.styles,
            style => style.alwaysBuild
        ).forEach(style => this.addStyle(style));

        this.fonts = [undefined];
        this.getAssets<Font>(
            project => project.fonts,
            font => font.id != undefined
        ).forEach(font => this.addFont(font));
        this.getAssets<Font>(
            project => project.fonts,
            (font: Font) => font.alwaysBuild
        ).forEach(font => this.addFont(font));

        this.bitmaps = this.getAssets<Bitmap>(
            project => project.bitmaps,
            (bitmap: Bitmap) => bitmap.alwaysBuild
        );

        buildGuiDocumentData(this, new DummyDataBuffer());
        buildGuiStylesData(this, new DummyDataBuffer());
    }

    getAssetIndex<T>(
        object: any,
        propertyName: string,
        findAsset: (project: Project, assetName: string) => T | undefined,
        collection: T[]
    ) {
        const project = getProject(object);
        const assetName = object[propertyName];
        const asset = findAsset(project, assetName);

        if (asset) {
            let assetIndex = collection.indexOf(asset);
            if (assetIndex == -1) {
                const isMasterProjectAsset =
                    this.DocumentStore.masterProject &&
                    getProject(asset) == this.DocumentStore.masterProject;

                if (isMasterProjectAsset) {
                    // TODO
                    return 0;
                } else {
                    collection.push(asset);
                    assetIndex = collection.length - 1;
                }
            }
            assetIndex++;
            return this.DocumentStore.masterProject ? -assetIndex : assetIndex;
        }

        if (assetName != undefined) {
            const message = output.propertyNotFoundMessage(
                object,
                propertyName
            );
            this.DocumentStore.outputSectionsStore.write(
                output.Section.OUTPUT,
                message.type,
                message.text,
                message.object
            );
        }

        return 0;
    }

    getWidgetDataItemIndex(object: any, propertyName: string) {
        if (this.DocumentStore.isAppletProject) {
            return this.getFlowWidgetDataItemIndex(object, propertyName);
        }

        if (!getProperty(object, propertyName)) {
            return 0;
        }

        return this.getAssetIndex(
            object,
            propertyName,
            findVariable,
            this.globalVariables
        );
    }

    getWidgetActionIndex(object: any, propertyName: string) {
        if (this.DocumentStore.isAppletProject) {
            return this.getFlowWidgetActionIndex(object, propertyName);
        }

        if (!getProperty(object, propertyName)) {
            return 0;
        }

        return this.getAssetIndex(
            object,
            propertyName,
            findAction,
            this.actions
        );
    }

    getPageIndex(object: any, propertyName: string) {
        return this.getAssetIndex(object, propertyName, findPage, this.pages);
    }

    addStyle(style: Style) {
        if (style.id != undefined) {
            this.styles[style.id] = style;
            return style.id;
        }

        for (let i = 1; i < this.styles.length; i++) {
            if (this.styles[i] == undefined) {
                this.styles[i] = style;
                return i;
            }
        }

        this.styles.push(style);
        return this.styles.length - 1;
    }

    addFont(font: Font) {
        if (font.id != undefined) {
            this.fonts[font.id] = font;
            return;
        }

        for (let i = 1; i < this.fonts.length; i++) {
            if (this.fonts[i] == undefined) {
                this.fonts[i] = font;
                return;
            }
        }

        this.fonts.push(font);
        return;
    }

    doGetStyleIndex(
        project: Project,
        styleNameOrObject: string | Style
    ): number {
        if (typeof styleNameOrObject === "string") {
            const styleName = styleNameOrObject;

            for (let i = 1; i < this.styles.length; i++) {
                const style = this.styles[i];
                if (style && style.name == styleName) {
                    return this.DocumentStore.masterProject ? -i : i;
                }
            }

            const style = findStyle(project, styleName);
            if (style) {
                const isMasterProjectStyle =
                    this.DocumentStore.masterProject &&
                    getProject(style) == this.DocumentStore.masterProject;

                if (style.id != undefined) {
                    return style.id;
                }

                if (!isMasterProjectStyle) {
                    const styleIndex = this.addStyle(style);
                    return this.DocumentStore.masterProject
                        ? -styleIndex
                        : styleIndex;
                }
            }
        } else {
            const style = styleNameOrObject;

            if (style.inheritFrom) {
                const parentStyle = findStyle(project, style.inheritFrom);
                if (parentStyle) {
                    if (style.compareTo(parentStyle)) {
                        if (style.id != undefined) {
                            return style.id;
                        }
                        return this.doGetStyleIndex(project, parentStyle.name);
                    }
                }
            }

            for (let i = 1; i < this.styles.length; i++) {
                const s = this.styles[i];
                if (s && style.compareTo(s)) {
                    return this.DocumentStore.masterProject ? -i : i;
                }
            }

            if (style.id) {
                return style.id;
            }

            const isMasterProjectStyle =
                this.DocumentStore.masterProject &&
                getProject(style) == this.DocumentStore.masterProject;

            if (!isMasterProjectStyle) {
                const styleIndex = this.addStyle(style);
                return this.DocumentStore.masterProject
                    ? -styleIndex
                    : styleIndex;
            }
        }

        return 0;
    }

    getStyleIndex(object: any, propertyName: string): number {
        const project = getProject(object);

        let style: string | Style | undefined = object[propertyName];
        if (style === undefined) {
            style = findStyle(project, "default");
            if (!style) {
                return 0;
            }
        }

        return this.doGetStyleIndex(project, style);
    }

    getFontIndex(object: any, propertyName: string) {
        let fontName: string | undefined = object[propertyName];
        for (let i = 1; i < this.fonts.length; i++) {
            const font = this.fonts[i];
            if (font && font.name == fontName) {
                return this.DocumentStore.masterProject ? -i : i;
            }
        }
        const font = findFont(this.DocumentStore.project, fontName);
        if (font) {
            if (font.id != undefined) {
                return font.id;
            }
        }
        return 0;
    }

    getBitmapIndex(object: any, propertyName: string) {
        return this.getAssetIndex(
            object,
            propertyName,
            findBitmap,
            this.bitmaps
        );
    }

    getColorIndex(
        style: Style,
        propertyName:
            | "color"
            | "backgroundColor"
            | "activeColor"
            | "activeBackgroundColor"
            | "focusColor"
            | "focusBackgroundColor"
            | "borderColor"
    ) {
        let color = getStyleProperty(style, propertyName, false);

        // TODO: currently all colors are available from master project,
        // we should add support for exporting colors (internal and exported),
        // like we are doing for styles
        let colors = this.DocumentStore.project.masterProject
            ? this.DocumentStore.project.masterProject.colors
            : this.DocumentStore.project.colors;

        for (let i = 0; i < colors.length; i++) {
            if (colors[i].name === color) {
                return i;
            }
        }

        if (this.DocumentStore.project.masterProject) {
            return 0;
        }

        for (let i = 0; i < this.colors.length; i++) {
            if (this.colors[i] == color) {
                return colors.length + i;
            }
        }

        this.colors.push(color);

        return colors.length + this.colors.length - 1;
    }

    reportUnusedAssets() {
        this.projects.forEach(project => {
            project.styles.forEach(style => {
                if (
                    !this.styles.find(usedStyle => {
                        if (!usedStyle) {
                            return false;
                        }

                        if (usedStyle == style) {
                            return true;
                        }

                        let baseStyle = findStyle(
                            this.rootProject,
                            usedStyle.inheritFrom
                        );
                        while (baseStyle) {
                            if (baseStyle == style) {
                                return true;
                            }
                            baseStyle = findStyle(
                                this.rootProject,
                                baseStyle.inheritFrom
                            );
                        }

                        return false;
                    })
                ) {
                    this.DocumentStore.outputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused style: " + style.name,
                        style
                    );
                }
            });

            project.fonts.forEach(font => {
                if (this.fonts.indexOf(font) === -1) {
                    this.DocumentStore.outputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused font: " + font.name,
                        font
                    );
                }
            });

            project.bitmaps.forEach(bitmap => {
                if (this.bitmaps.indexOf(bitmap) === -1) {
                    this.DocumentStore.outputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused bitmap: " + bitmap.name,
                        bitmap
                    );
                }
            });
        });
    }

    getFlowState(flow: Flow) {
        let flowState = this.flowStates.get(flow);
        if (flowState == undefined) {
            flowState = {
                index: this.flowStates.size,
                componentIndexes: new Map<Component, number>(),
                componentInputIndexes: new Map<string, number>(),
                flowWidgetDataIndexes: new Map<string, number>(),
                flowWidgetDataIndexToComponentPropertyValue: new Map<
                    number,
                    {
                        componentIndex: number;
                        propertyValueIndex: number;
                    }
                >(),
                flowWidgetFromDataIndex: new Map<number, Widget>(),
                flowWidgetActionIndexes: new Map<string, number>(),
                flowWidgetActionComponentOutput: new Map<number, number>(),
                flowWidgetFromActionIndex: new Map<number, Widget>()
            };
            this.flowStates.set(flow, flowState);
        }
        return flowState;
    }

    getFlowIndex(flow: Flow) {
        return this.getFlowState(flow).index;
    }

    getConstantIndex(value: any, valueType?: string) {
        let index = this.constantsMap.get(value);
        if (index == undefined) {
            index = this.constants.length;
            this.constants.push({
                type: getConstantFlowValueType(value, valueType),
                value
            });
            this.constantsMap.set(value, index);
        }
        return index;
    }

    getComponentIndex(component: Component) {
        const flowState = this.getFlowState(getFlow(component));
        let index = flowState.componentIndexes.get(component);
        if (index == undefined) {
            index = flowState.componentIndexes.size;
            flowState.componentIndexes.set(component, index);
        }
        return index;
    }

    getComponentInputIndex(component: Component, inputName: string) {
        const flowState = this.getFlowState(getFlow(component));
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + inputName;
        let index = flowState.componentInputIndexes.get(path);
        if (index == undefined) {
            index = flowState.componentInputIndexes.size;
            flowState.componentInputIndexes.set(path, index);
        }
        return index;
    }

    findComponentInputIndex(component: Component, inputName: string) {
        const flowState = this.getFlowState(getFlow(component));
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + inputName;
        const inputIndex = flowState.componentInputIndexes.get(path);
        if (inputIndex == undefined) {
            return -1;
        }
        return inputIndex;
    }

    getFlowWidgetDataItemIndex(widget: Widget, propertyName: string) {
        if (
            !widget.asInputProperties ||
            widget.asInputProperties.indexOf(propertyName) == -1
        ) {
            if (!getProperty(widget, propertyName)) {
                return 0;
            }
        }

        const flowState = this.getFlowState(getFlow(widget));
        const path =
            getObjectPathAsString(widget) + PATH_SEPARATOR + propertyName;
        let index = flowState.flowWidgetDataIndexes.get(path);
        if (index == undefined) {
            index = flowState.flowWidgetDataIndexes.size;
            flowState.flowWidgetDataIndexes.set(path, index);
            flowState.flowWidgetFromDataIndex.set(index, widget);
        }
        return -(index + 1);
    }

    getFlowWidgetActionIndex(widget: Widget, propertyName: string) {
        if (
            !widget.asOutputProperties ||
            widget.asOutputProperties.indexOf(propertyName) == -1
        ) {
            if (!getProperty(widget, propertyName)) {
                return 0;
            }
        }

        const flowState = this.getFlowState(getFlow(widget));
        const path =
            getObjectPathAsString(widget) + PATH_SEPARATOR + propertyName;
        let index = flowState.flowWidgetActionIndexes.get(path);
        if (index == undefined) {
            index = flowState.flowWidgetActionIndexes.size;
            flowState.flowWidgetActionIndexes.set(path, index);
            flowState.flowWidgetFromActionIndex.set(index, widget);
        }
        return -(index + 1);
    }

    registerComponentProperty(
        component: Component,
        propertyName: string,
        componentIndex: number,
        propertyValueIndex: number
    ) {
        const flowState = this.getFlowState(getFlow(component));
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + propertyName;
        let index = flowState.flowWidgetDataIndexes.get(path);
        if (index != undefined) {
            flowState.flowWidgetDataIndexToComponentPropertyValue.set(index, {
                componentIndex,
                propertyValueIndex
            });
        }
    }

    registerComponentOutput(
        component: Component,
        outputName: string,
        componentOutputOffset: number
    ) {
        const flowState = this.getFlowState(getFlow(component));
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + outputName;
        let index = flowState.flowWidgetActionIndexes.get(path);
        if (index != undefined) {
            flowState.flowWidgetActionComponentOutput.set(
                index,
                componentOutputOffset
            );
        }
    }

    finalizeMap() {
        this.map.constants = this.constants;

        this.flows.forEach(flow => {
            const flowState = this.getFlowState(flow);
            const flowIndex = flowState.index;

            flowState.flowWidgetDataIndexes.forEach((index, path) => {
                const [componentObjectPath, inputName] =
                    path.split(PATH_SEPARATOR);

                const component = getObjectFromStringPath(
                    this.rootProject,
                    componentObjectPath
                ) as Component;

                const componentIndex = this.map.flows[
                    flowIndex
                ].components.find(
                    component => component.path == componentObjectPath
                )!.componentIndex;

                this.map.flows[flowIndex].widgetDataItems[index] = {
                    widgetDataItemIndex: index,
                    flowIndex,
                    componentIndex,
                    inputIndex: component.inputs.findIndex(
                        input => input.name == inputName
                    )
                };
            });

            flowState.flowWidgetActionIndexes.forEach((index, path) => {
                const [componentObjectPath, outputName] =
                    path.split(PATH_SEPARATOR);

                const component = getObjectFromStringPath(
                    this.rootProject,
                    componentObjectPath
                ) as Component;

                const flowIndex = this.getFlowIndex(getFlow(component));

                const componentIndex = this.map.flows[
                    flowIndex
                ].components.find(
                    component => component.path == componentObjectPath
                )!.componentIndex;

                this.map.flows[flowIndex].widgetActions[index] = {
                    widgetActionIndex: index,
                    flowIndex,
                    componentIndex,
                    outputIndex: component.buildOutputs.findIndex(
                        output => output.name == outputName
                    )
                };
            });
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DataBuffer {
    buffer = Buffer.alloc(10 * 1024 * 1024);

    currentOffset: number = 0;

    writeLaterObjectList: {
        currentOffset: number;
        callback: () => void;
        padding: number;
    }[] = [];

    futureValueList: {
        currentOffset: number;
        callback: () => void;
    }[] = [];

    futureArrayList: {
        currentOffset: number;
        callback: () => void;
    }[] = [];

    writeInt8(value: number) {
        this.buffer.writeInt8(value, this.currentOffset);
        this.currentOffset += 1;
    }

    writeUint8(value: number) {
        try {
            this.buffer.writeUInt8(value, this.currentOffset);
        } catch (err) {
            console.error(err);
        }
        this.currentOffset += 1;
    }

    writeInt16(value: number) {
        if (this.currentOffset % 2) {
            throw "invalid offset";
        }
        this.buffer.writeInt16LE(value, this.currentOffset);
        this.currentOffset += 2;
    }

    writeUint16(value: number) {
        if (this.currentOffset % 2) {
            throw "invalid offset";
        }
        this.buffer.writeUInt16LE(value, this.currentOffset);
        this.currentOffset += 2;
    }

    writeUint16NonAligned(value: number) {
        this.buffer.writeUInt16LE(value, this.currentOffset);
        this.currentOffset += 2;
    }

    writeInt32(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        this.buffer.writeInt32LE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeUint32(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        this.buffer.writeUInt32LE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeUint64(value: number) {
        if (this.currentOffset % 8) {
            throw "invalid offset";
        }
        this.buffer.writeBigUInt64LE(BigInt(value), this.currentOffset);
        this.currentOffset += 8;
    }

    writeFloat(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        this.buffer.writeFloatLE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeDouble(value: number) {
        if (this.currentOffset % 8) {
            throw "invalid offset";
        }
        this.buffer.writeDoubleLE(value, this.currentOffset);
        this.currentOffset += 8;
    }

    writeFutureValue(writeZero: () => void, callback: () => void) {
        const currentOffset = this.currentOffset;
        writeZero();
        this.futureValueList.push({ currentOffset, callback });
    }

    writeUint8Array(array: Uint8Array | number[]) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        this.buffer.set(array, this.currentOffset);
        this.currentOffset += array.length;
        this.addPadding();
    }

    writeString(str: string) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        for (let i = 0; i < str.length; i++) {
            this.writeUint8(str.charCodeAt(i));
        }
        this.writeUint8(0);
        this.addPadding();
    }

    writeArray<T>(
        arr: T[],
        callback: (item: T, i: number) => void,
        padding: number = 4
    ) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        if (arr.length > 0) {
            this.writeUint32(arr.length);
            this.writeObjectOffset(() => {
                for (let i = 0; i < arr.length; i++) {
                    this.writeObjectOffset(() => callback(arr[i], i), padding);
                }
            });
        } else {
            this.writeUint32(0);
            this.writeUint32(0);
        }
    }

    writeFutureArray(callback: () => void) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        const currentOffset = this.currentOffset;
        this.writeUint32(0);
        this.writeUint32(0);
        this.futureArrayList.push({
            currentOffset,
            callback
        });
    }

    writeNumberArray<T>(arr: T[], callback: (item: T, i: number) => void) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        if (arr.length > 0) {
            this.writeUint32(arr.length);
            this.writeObjectOffset(() => {
                for (let i = 0; i < arr.length; i++) {
                    callback(arr[i], i);
                }
            });
        } else {
            this.writeUint32(0);
            this.writeUint32(0);
        }
    }

    writeObjectOffset(callback: () => void, padding: number = 4) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        const currentOffset = this.currentOffset;
        this.writeUint32(0);
        this.writeLaterObjectList.push({ currentOffset, callback, padding });
    }

    addPadding() {
        if (this.currentOffset % 4) {
            const n = 4 - (this.currentOffset % 4);
            for (let i = 0; i < n; ++i) {
                this.writeUint8(0);
            }
        }
    }

    addPadding8() {
        if (this.currentOffset % 8) {
            const n = 8 - (this.currentOffset % 8);
            for (let i = 0; i < n; ++i) {
                this.writeUint8(0);
            }
        }
    }

    get size() {
        return this.currentOffset;
    }

    finalizeObjectList() {
        for (let i = 0; i < this.writeLaterObjectList.length; i++) {
            const writeLater = this.writeLaterObjectList[i];

            if (writeLater.padding == 8) {
                this.addPadding8();
            }

            const currentOffset = this.currentOffset;

            writeLater.callback();

            if (writeLater.padding == 8) {
                this.addPadding8();
            } else {
                this.addPadding();
            }

            this.buffer.writeUInt32LE(currentOffset, writeLater.currentOffset);
        }

        this.writeLaterObjectList = [];
    }

    finalize() {
        this.addPadding();

        this.finalizeObjectList();

        let currentOffset = this.currentOffset;

        for (let i = 0; i < this.futureValueList.length; i++) {
            this.currentOffset = this.futureValueList[i].currentOffset;
            this.futureValueList[i].callback();
        }

        for (let i = 0; i < this.futureArrayList.length; i++) {
            this.currentOffset = this.futureArrayList[i].currentOffset;
            this.futureArrayList[i].callback();
        }

        this.currentOffset = currentOffset;

        this.finalizeObjectList();

        const buffer = Buffer.alloc(this.size);
        this.buffer.copy(buffer, 0, 0, this.size);
        this.buffer = buffer;
    }

    compress() {
        const lz4ModuleName = "lz4";
        const LZ4 = require(lz4ModuleName);
        var compressedBuffer = Buffer.alloc(LZ4.encodeBound(this.size));
        var compressedSize = LZ4.encodeBlock(this.buffer, compressedBuffer);
        return { compressedBuffer, compressedSize };
    }
}

export class DummyDataBuffer {
    buffer = Buffer.alloc(0);

    currentOffset = 0;

    writeLaterObjectList: {
        currentOffset: number;
        callback: () => void;
        padding: number;
    }[] = [];

    futureValueList: {
        currentOffset: number;
        callback: () => void;
    }[] = [];

    futureArrayList: {
        currentOffset: number;
        callback: () => void;
    }[] = [];

    writeInt8(value: number) {}

    writeUint8(value: number) {}

    writeInt16(value: number) {}

    writeUint16(value: number) {}

    writeUint16NonAligned(value: number) {}

    writeInt32(value: number) {}

    writeUint32(value: number) {}

    writeUint64(value: number) {}

    writeFloat(value: number) {}

    writeDouble(value: number) {}

    writeFutureValue(callback: () => void) {}

    writeUint8Array(array: Uint8Array | number[]) {}

    writeString(str: string) {}

    writeArray<T>(
        arr: T[],
        callback: (item: T, i: number) => void,
        padding: number = 4
    ) {
        if (arr.length > 0) {
            for (let i = 0; i < arr.length; i++) {
                callback(arr[i], i);
            }
        }
    }

    writeFutureArray(callback: () => void) {}

    writeNumberArray<T>(arr: T[], callback: (item: T, i: number) => void) {}

    writeObjectOffset(callback: () => void, padding: number = 4) {
        callback();
    }

    addPadding() {}

    addPadding8() {}

    get size() {
        return 0;
    }

    finalizeObjectList() {}

    finalize() {}

    compress() {
        return { compressedBuffer: this.buffer, compressedSize: 0 };
    }
}

function buildHeaderData(
    assets: Assets,
    uncompressedSize: number,
    dataBuffer: DataBuffer
) {
    const tag = new TextEncoder().encode("~eez");

    dataBuffer.writeUint8Array(tag);

    dataBuffer.writeUint16(3); // PROJECT VERSION: 3

    dataBuffer.writeUint16(
        assets.DocumentStore.project.settings.general.getProjectTypeAsNumber()
    );

    dataBuffer.writeUint32(uncompressedSize);

    dataBuffer.finalize();
}

export async function buildGuiAssetsData(assets: Assets) {
    const dataBuffer = new DataBuffer();

    buildGuiDocumentData(assets, dataBuffer);
    buildGuiStylesData(assets, dataBuffer);
    await buildGuiFontsData(assets, dataBuffer);
    await buildGuiBitmapsData(assets, dataBuffer);
    buildGuiColors(assets, dataBuffer);
    buildActionNames(assets, dataBuffer);
    buildVariableNames(assets, dataBuffer);
    buildFlowData(assets, dataBuffer);

    dataBuffer.finalize();

    const uncompressedSize = dataBuffer.size;

    const { compressedBuffer, compressedSize } = dataBuffer.compress();

    const headerBuffer = new DataBuffer();
    buildHeaderData(assets, uncompressedSize, headerBuffer);

    const allData = Buffer.alloc(headerBuffer.size + compressedSize);
    headerBuffer.buffer.copy(allData, 0, 0, headerBuffer.size);
    compressedBuffer.copy(allData, headerBuffer.size, 0, compressedSize);

    assets.DocumentStore.outputSectionsStore.write(
        output.Section.OUTPUT,
        output.Type.INFO,
        "Uncompressed size: " + uncompressedSize
    );

    assets.DocumentStore.outputSectionsStore.write(
        output.Section.OUTPUT,
        output.Type.INFO,
        "Compressed size: " + compressedSize
    );

    return allData;
}

export function buildGuiAssetsDecl(data: Buffer) {
    return `extern const uint8_t assets[${data.length}];`;
}

export function buildGuiAssetsDef(data: Buffer) {
    return `// ASSETS DEFINITION\nconst uint8_t assets[${
        data.length
    }] = {${projectBuild.dumpData(data)}};`;
}

export interface AssetsMap {
    flows: {
        flowIndex: number;
        path: string;
        pathReadable: string;
        components: {
            componentIndex: number;
            path: string;
            pathReadable: string;
            inputs: number[];
            outputs: {
                targetComponentIndex: number;
                targetInputIndex: number;
            }[][];
        }[];
        localVariables: {
            index: number;
            name: string;
        }[];
        widgetDataItems: {
            widgetDataItemIndex: number;
            flowIndex: number;
            componentIndex: number;
            inputIndex: number;
        }[];
        widgetActions: {
            widgetActionIndex: number;
            flowIndex: number;
            componentIndex: number;
            outputIndex: number;
        }[];
    }[];
    constants: any[];
    globalVariables: {
        index: number;
        name: string;
    }[];
}

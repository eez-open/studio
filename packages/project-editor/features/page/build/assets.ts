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
import { Font, findFont } from "project-editor/features/font/font";
import { Bitmap, findBitmap } from "project-editor/features/bitmap/bitmap";
import { Action, findAction } from "project-editor/features/action/action";
import {
    Variable,
    findVariable
} from "project-editor/features/variable/variable";
import { Flow } from "project-editor/flow/flow";
import { Component } from "project-editor/flow/component";

import { buildGuiDocumentData } from "project-editor/features/page/build/pages";
import { buildGuiStylesData } from "project-editor/features/page/build/styles";
import { buildGuiFontsData } from "project-editor/features/page/build/fonts";
import { buildGuiBitmapsData } from "project-editor/features/page/build/bitmaps";
import { buildGuiColors } from "project-editor/features/page/build/themes";
import { buildActionNames } from "project-editor/features/page/build/actions";
import { buildVariableNames } from "project-editor/features/page/build/variables";
import {
    buildFlowData,
    FlowValue,
    getComponentOutputNames,
    getFlowValueType
} from "project-editor/features/page/build/flows";

export const PATH_SEPARATOR = "//";

class FlowAsset {
    constructor(public flow: Flow) {}

    inputIndexes = new Map<string, number>();

    getInputIndex(component: Component, inputName: string) {
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + inputName;
        let index = this.inputIndexes.get(path);
        if (index == undefined) {
            index = this.inputIndexes.size;
            this.inputIndexes.set(path, index);
        }
        return index;
    }
}

export class Assets {
    projects: Project[];

    globalVariables: Variable[];
    actions: Action[];
    pages: Page[];
    styles: (Style | undefined)[];
    fonts: Font[] = [];
    bitmaps: Bitmap[] = [];
    colors: string[] = [];
    flows: Flow[] = [];

    flowIndexes = new Map<Flow, number>();

    constants: FlowValue[] = [];
    constantsMap = new Map<
        undefined | boolean | number | string | object,
        number
    >();

    flowWidgetDataIndexes = new Map<string, number>();
    flowWidgetActionIndexes = new Map<string, number>();
    flowWidgetDataIndexComponentInput = new Map<number, number>();
    flowWidgetActionComponentOutput = new Map<number, number>();

    flow: FlowAsset;

    map: {
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
        }[];
        constants: any[];
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
    } = {
        flows: [],
        constants: [],
        widgetDataItems: [],
        widgetActions: []
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
        this.getConstantIndexFromJSON(undefined); // undefined has value index 0
        this.getConstantIndexFromJSON("null"); // null has value index 1

        this.projects = [];
        this.collectProjects(rootProject);

        {
            const assetIncludePredicate = (asset: Variable | Action | Page) =>
                !buildConfiguration ||
                !asset.usedIn ||
                asset.usedIn.indexOf(buildConfiguration.name) !== -1;

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

            this.flows = this.getAssets<Page | Action>(
                project => [...project.pages, ...project.actions],
                assetIncludePredicate
            );
        }

        this.styles = [undefined];
        if (!this.DocumentStore.masterProject) {
            this.getAssets<Style>(
                project => project.styles,
                style => style.id != undefined
            ).forEach(style => this.addStyle(style));

            this.getAssets<Style>(
                project => project.styles,
                style => style.alwaysBuild
            ).forEach(style => this.addStyle(style));
        }

        {
            const assetIncludePredicate = (asset: Font | Bitmap) =>
                asset.alwaysBuild;

            this.fonts = this.getAssets<Font>(
                project => project.fonts,
                assetIncludePredicate
            );

            this.bitmaps = this.getAssets<Bitmap>(
                project => project.bitmaps,
                assetIncludePredicate
            );
        }

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
                collection.push(asset);
                assetIndex = collection.length - 1;
            }
            assetIndex++;
            return this.DocumentStore.masterProject ? -assetIndex : assetIndex;
        }

        const message = output.propertyNotFoundMessage(object, propertyName);
        this.DocumentStore.OutputSectionsStore.write(
            output.Section.OUTPUT,
            message.type,
            message.text,
            message.object
        );

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

    doGetStyleIndex(
        project: Project,
        styleNameOrObject: string | Style
    ): number {
        if (this.DocumentStore.masterProject) {
            if (typeof styleNameOrObject === "string") {
                const styleName = styleNameOrObject;
                const style = findStyle(project, styleName);
                if (style && style.id != undefined) {
                    return style.id;
                }
            } else {
                const style = styleNameOrObject;
                if (style.id != undefined) {
                    return style.id;
                }
                if (style.inheritFrom) {
                    return this.doGetStyleIndex(project, style.inheritFrom);
                }
            }
        } else {
            if (typeof styleNameOrObject === "string") {
                const styleName = styleNameOrObject;

                for (let i = 1; i < this.styles.length; i++) {
                    const style = this.styles[i];
                    if (style && style.name == styleName) {
                        return i;
                    }
                }

                const style = findStyle(project, styleName);
                if (style) {
                    if (style.id != undefined) {
                        return style.id;
                    }

                    return this.addStyle(style);
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
                            return this.doGetStyleIndex(
                                project,
                                parentStyle.name
                            );
                        }
                    }
                }

                for (let i = 1; i < this.styles.length; i++) {
                    const s = this.styles[i];
                    if (s && style.compareTo(s)) {
                        return i;
                    }
                }

                return this.addStyle(style);
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
        return this.getAssetIndex(object, propertyName, findFont, this.fonts);
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

        let colors = this.DocumentStore.project.colors;

        for (let i = 0; i < colors.length; i++) {
            if (colors[i].name === color) {
                return i;
            }
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
                    this.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused style: " + style.name,
                        style
                    );
                }
            });

            project.fonts.forEach(font => {
                if (this.fonts.indexOf(font) === -1) {
                    this.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused font: " + font.name,
                        font
                    );
                }
            });

            project.bitmaps.forEach(bitmap => {
                if (this.bitmaps.indexOf(bitmap) === -1) {
                    this.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.INFO,
                        "Unused bitmap: " + bitmap.name,
                        bitmap
                    );
                }
            });
        });
    }

    getFlowIndex(flow: Flow) {
        let index = this.flowIndexes.get(flow);
        if (index == undefined) {
            index = this.flowIndexes.size;
            this.flowIndexes.set(flow, index);
        }
        return index;
    }

    getConstantIndexFromJSON(jsonStr: string | undefined) {
        const value = jsonStr == undefined ? undefined : JSON.parse(jsonStr);
        let index = this.constantsMap.get(value);
        if (index == undefined) {
            index = this.constants.length;
            this.constants.push({
                type: getFlowValueType(value),
                value
            });
            this.constantsMap.set(value, index);
        }
        return index;
    }

    startFlowBuild(flow: Flow) {
        this.flow = new FlowAsset(flow);
    }

    getFlowWidgetDataItemIndex(object: any, propertyName: string) {
        const path =
            getObjectPathAsString(object) + PATH_SEPARATOR + propertyName;
        let index = this.flowWidgetDataIndexes.get(path);
        if (index == undefined) {
            index = this.flowWidgetDataIndexes.size;
            this.flowWidgetDataIndexes.set(path, index);
        }
        return -(index + 1);
    }

    getFlowWidgetActionIndex(object: any, propertyName: string) {
        const path =
            getObjectPathAsString(object) + PATH_SEPARATOR + propertyName;
        let index = this.flowWidgetActionIndexes.get(path);
        if (index == undefined) {
            index = this.flowWidgetActionIndexes.size;
            this.flowWidgetActionIndexes.set(path, index);
        }
        return -(index + 1);
    }

    registerComponentInput(
        component: Component,
        inputName: string,
        componentInputOffset: number
    ) {
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + inputName;
        let index = this.flowWidgetDataIndexes.get(path);
        if (index != undefined) {
            this.flowWidgetDataIndexComponentInput.set(
                index,
                componentInputOffset
            );
        }
    }

    registerComponentOutput(
        component: Component,
        outputName: string,
        componentOutputOffset: number
    ) {
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + outputName;
        let index = this.flowWidgetActionIndexes.get(path);
        if (index != undefined) {
            this.flowWidgetActionComponentOutput.set(
                index,
                componentOutputOffset
            );
        }
    }

    finalizeMap() {
        this.map.constants = this.constants;

        this.flowWidgetDataIndexes.forEach((index, path) => {
            const [componentObjectPath, inputName] = path.split(PATH_SEPARATOR);

            const component = getObjectFromStringPath(
                this.rootProject,
                componentObjectPath
            ) as Component;

            const flow = getFlow(component)!;
            const flowIndex = this.flowIndexes.get(flow)!;

            const componentIndex = this.map.flows[flowIndex].components.find(
                component => component.path == componentObjectPath
            )!.componentIndex;

            this.map.widgetDataItems[index] = {
                widgetDataItemIndex: index,
                flowIndex,
                componentIndex,
                inputIndex: component.inputs.findIndex(
                    input => input.name == inputName
                )
            };
        });

        this.flowWidgetActionIndexes.forEach((index, path) => {
            const [componentObjectPath, outputName] =
                path.split(PATH_SEPARATOR);

            const component = getObjectFromStringPath(
                this.rootProject,
                componentObjectPath
            ) as Component;

            const flow = getFlow(component)!;
            const flowIndex = this.flowIndexes.get(flow)!;

            const componentIndex = this.map.flows[flowIndex].components.find(
                component => component.path == componentObjectPath
            )!.componentIndex;

            this.map.widgetActions[index] = {
                widgetActionIndex: index,
                flowIndex,
                componentIndex,
                outputIndex: getComponentOutputNames(component).findIndex(
                    output => output.name == outputName
                )
            };
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export class DataBuffer {
    buffer = Buffer.alloc(10 * 1024 * 1024);
    currentOffset: number = 0;
    writeLater: { currentOffset: number; callback: () => void }[] = [];

    writeInt8(value: number) {
        this.buffer.writeInt8(value, this.currentOffset);
        this.currentOffset += 1;
    }

    writeUint8(value: number) {
        this.buffer.writeUInt8(value, this.currentOffset);
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

    writeUint32(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        this.buffer.writeUInt32LE(value, this.currentOffset);
        this.currentOffset += 4;
    }

    writeFloat(value: number) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        this.buffer.writeFloatLE(value, this.currentOffset);
        this.currentOffset += 4;
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

    writeArray<T>(arr: T[], callback: (item: T, i: number) => void) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        if (arr.length > 0) {
            this.writeUint32(arr.length);
            this.writeObjectOffset(() => {
                for (let i = 0; i < arr.length; i++) {
                    this.writeObjectOffset(() => callback(arr[i], i));
                }
            });
        } else {
            this.writeUint32(0);
            this.writeUint32(0);
        }
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

    writeObjectOffset(callback: () => void) {
        if (this.currentOffset % 4) {
            throw "invalid offset";
        }
        const currentOffset = this.currentOffset;
        this.writeUint32(0);
        this.writeLater.push({ currentOffset, callback });
    }

    addPadding() {
        if (this.currentOffset % 4) {
            const n = 4 - (this.currentOffset % 4);
            for (let i = 0; i < n; ++i) {
                this.writeUint8(0);
            }
        }
    }

    get size() {
        return this.currentOffset;
    }

    finalize() {
        for (let i = 0; i < this.writeLater.length; i++) {
            const currentOffset = this.currentOffset;
            this.writeLater[i].callback();
            this.addPadding();
            this.buffer.writeUInt32LE(
                currentOffset,
                this.writeLater[i].currentOffset
            );
        }

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
    writeLater: { currentOffset: number; callback: () => void }[] = [];

    writeInt8(value: number) {}

    writeUint8(value: number) {}

    writeInt16(value: number) {}

    writeUint16(value: number) {}

    writeUint32(value: number) {}

    writeFloat(value: number) {}

    writeUint8Array(array: Uint8Array | number[]) {}

    writeString(str: string) {}

    writeArray<T>(arr: T[], callback: (item: T, i: number) => void) {
        if (arr.length > 0) {
            for (let i = 0; i < arr.length; i++) {
                callback(arr[i], i);
            }
        }
    }

    writeNumberArray<T>(arr: T[], callback: (item: T, i: number) => void) {}

    writeObjectOffset(callback: () => void) {
        callback();
    }

    addPadding() {}

    get size() {
        return 0;
    }

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

    assets.DocumentStore.OutputSectionsStore.write(
        output.Section.OUTPUT,
        output.Type.INFO,
        "Uncompressed size: " + uncompressedSize
    );

    assets.DocumentStore.OutputSectionsStore.write(
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

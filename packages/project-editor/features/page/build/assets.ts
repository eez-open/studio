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

import {
    DataBuffer,
    Struct,
    UInt16,
    UInt32,
    UInt8ArrayField
} from "project-editor/features/page/build/pack";

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
    FLOW_VALUE_TYPE_NULL,
    FLOW_VALUE_TYPE_UNDEFINED,
    getComponentInputNames,
    getComponentOutputNames,
    getFlowValueType
} from "project-editor/features/page/build/flows";

const PATH_SEPARATOR = "//";

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
    componentIndexes = new Map<Component, number>();

    nextValueIndex = 0;
    componentInputValueIndexes = new Map<string, number>();
    simpleValueIndexes = new Map<
        undefined | boolean | number | string | object,
        number
    >();

    flowWidgetDataIndexes = new Map<string, number>();
    flowWidgetActionIndexes = new Map<string, number>();
    flowWidgetDataIndexComponentInput = new Map<number, Struct>();
    flowWidgetActionComponentOutput = new Map<number, Struct>();

    values = [];

    map: {
        flows: {
            flowIndex: number;
            path: string;
            pathReadable: string;
            components: {
                componentIndex: number;
                path: string;
                pathReadable: string;
                inputs: number[][];
                outputs: {
                    targetComponentIndex: number;
                    targetInputIndex: number;
                }[][];
            }[];
        }[];
        values: any[];
        widgetDataItems: {
            widgetDataItemIndex: number;
            componentIndex: number;
            inputIndex: number;
        }[];
        widgetActions: {
            widgetActionIndex: number;
            componentIndex: number;
            outputIndex: number;
        }[];
    } = {
        flows: [],
        values: [],
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
        this.getValueIndexFromJSON(undefined); // undefined has value index 0
        this.getValueIndexFromJSON("null"); // null has value index 1

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

        buildGuiDocumentData(this, null);
        buildGuiStylesData(this, null);
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

    getGlobalVariableIndex(object: any, propertyName: string) {
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

    getActionIndex(object: any, propertyName: string) {
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

    getComponentIndex(component: Component) {
        let index = this.componentIndexes.get(component);
        if (index == undefined) {
            index = this.componentIndexes.size;
            this.componentIndexes.set(component, index);
        }
        return index;
    }

    getComponentInputIndex(component: Component, inputName: string) {
        return getComponentInputNames(component).findIndex(
            input => input.name == inputName
        );
    }

    getComponentInputValueIndex(
        component: Component,
        input: { name: string; type: "input" | "property" }
    ) {
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + input.name;
        let index = this.componentInputValueIndexes.get(path);
        if (index == undefined) {
            if (input.type == "input") {
                index = this.nextValueIndex++;
                this.componentInputValueIndexes.set(path, index);
            } else {
                try {
                    index = this.getValueIndexFromJSON(
                        getProperty(component, input.name)
                    );
                } catch (err) {
                    this.DocumentStore.OutputSectionsStore.write(
                        output.Section.OUTPUT,
                        output.Type.ERROR,
                        err.toString(),
                        component
                    );
                    index = -1;
                }
            }
        }
        return index;
    }

    getComponentOutputIndex(component: Component, outputName: string) {
        return getComponentOutputNames(component).findIndex(
            output => output.name == outputName
        );
    }

    getValueIndexFromJSON(jsonStr: string | undefined) {
        const value = jsonStr == undefined ? undefined : JSON.parse(jsonStr);
        if (
            typeof value == "undefined" ||
            typeof value == "boolean" ||
            typeof value == "number" ||
            typeof value == "string" ||
            value === null
        ) {
            let index = this.simpleValueIndexes.get(value);
            if (index == undefined) {
                index = this.nextValueIndex++;
                this.simpleValueIndexes.set(value, index);
            }
            return index;
        }
        return -1;
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
        componentInput: Struct
    ) {
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + inputName;
        let index = this.flowWidgetDataIndexes.get(path);
        if (index != undefined) {
            this.flowWidgetDataIndexComponentInput.set(index, componentInput);
        }
    }

    registerComponentOutput(
        component: Component,
        outputName: string,
        componentOutput: Struct
    ) {
        const path =
            getObjectPathAsString(component) + PATH_SEPARATOR + outputName;
        let index = this.flowWidgetActionIndexes.get(path);
        if (index != undefined) {
            this.flowWidgetActionComponentOutput.set(index, componentOutput);
        }
    }

    get flowValues() {
        const flowValues: FlowValue[] = [];

        for (let [value, index] of this.simpleValueIndexes) {
            flowValues.push({
                index,
                type: getFlowValueType(value),
                value
            });
        }

        for (let [path, index] of this.componentInputValueIndexes) {
            const [componentObjectPath, inputName] = path.split(PATH_SEPARATOR);

            let type = FLOW_VALUE_TYPE_UNDEFINED;
            let value: undefined | null;
            if (inputName === "@seqin") {
                const component = getObjectFromStringPath(
                    this.rootProject,
                    componentObjectPath
                );

                const flow = getFlow(component);

                if (
                    !flow.connectionLines.find(
                        connectionLine =>
                            connectionLine.targetComponent == component &&
                            connectionLine.input == inputName
                    )
                ) {
                    // store null value if there is no connection line to "@seqin"
                    type = FLOW_VALUE_TYPE_NULL;
                    value = null;
                }
            }

            flowValues.push({
                index,
                type,
                value
            });
        }

        flowValues.sort((a, b) => a.index - b.index);

        return flowValues;
    }

    finalizeMap() {
        this.map.values = this.flowValues;

        this.flowWidgetDataIndexes.forEach((index, path) => {
            const [componentObjectPath, inputName] = path.split(PATH_SEPARATOR);
            const component = getObjectFromStringPath(
                this.rootProject,
                componentObjectPath
            ) as Component;
            this.map.widgetDataItems[index] = {
                widgetDataItemIndex: index,
                componentIndex: this.componentIndexes.get(component!)!,
                inputIndex: getComponentInputNames(component).findIndex(
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

            this.map.widgetActions[index] = {
                widgetActionIndex: index,
                componentIndex: this.componentIndexes.get(component!)!,
                outputIndex: getComponentOutputNames(component).findIndex(
                    output => output.name == outputName
                )
            };
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

export async function buildGuiAssetsData(assets: Assets) {
    function buildHeaderData(assets: Assets, uncompressedSize: number) {
        let headerStruct = new Struct();

        const tag = new TextEncoder().encode("~eez");
        headerStruct.addField(new UInt8ArrayField(tag));

        headerStruct.addField(new UInt16(3)); // PROJECT VERSION: 3

        headerStruct.addField(
            new UInt16(
                assets.DocumentStore.project.settings.general.getProjectTypeAsNumber()
            )
        );

        headerStruct.addField(new UInt32(uncompressedSize));

        const headerDataBuffer = new DataBuffer();
        headerStruct.packObject(headerDataBuffer);
        return headerDataBuffer;
    }

    const dataBuffer = new DataBuffer();

    await dataBuffer.packRegions(8, async i => {
        if (i == 0) {
            buildGuiDocumentData(assets, dataBuffer);
        } else if (i == 1) {
            buildGuiStylesData(assets, dataBuffer);
        } else if (i == 2) {
            await buildGuiFontsData(assets, dataBuffer);
        } else if (i == 3) {
            await buildGuiBitmapsData(assets, dataBuffer);
        } else if (i == 4) {
            buildGuiColors(assets, dataBuffer);
        } else if (i == 5) {
            buildActionNames(assets, dataBuffer);
        } else if (i == 6) {
            buildVariableNames(assets, dataBuffer);
        } else if (i == 7) {
            buildFlowData(assets, dataBuffer);
        }
    });

    var uncompressedBuffer = Buffer.from(
        dataBuffer.buffer.slice(0, dataBuffer.offset)
    );
    const uncompressedSize = uncompressedBuffer.length;

    const lz4ModuleName = "lz4";
    const LZ4 = require(lz4ModuleName);
    var compressedBuffer = Buffer.alloc(
        LZ4.encodeBound(uncompressedBuffer.length)
    );
    var compressedSize = LZ4.encodeBlock(uncompressedBuffer, compressedBuffer);

    const header = buildHeaderData(assets, uncompressedSize);
    var headerBuffer = Buffer.from(header.buffer.slice(0, header.offset));

    const allData = Buffer.alloc(headerBuffer.length + compressedSize);
    headerBuffer.copy(allData, 0, 0, headerBuffer.length);
    compressedBuffer.copy(allData, headerBuffer.length, 0, compressedSize);

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

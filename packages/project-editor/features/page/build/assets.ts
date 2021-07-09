import * as output from "project-editor/core/output";
import * as projectBuild from "project-editor/project/build";
import {
    Project,
    BuildConfiguration,
    getProject
} from "project-editor/project/project";
import { DataItem, findDataItem } from "project-editor/features/data/data";
import { Bitmap, findBitmap } from "project-editor/features/bitmap/bitmap";
import {
    Style,
    getStyleProperty,
    findStyle
} from "project-editor/features/style/style";
import { Page, findPage } from "project-editor/features/page/page";
import { Font, findFont } from "project-editor/features/font/font";
import { Action, findAction } from "project-editor/features/action/action";
import { buildGuiDocumentData } from "project-editor/features/page/build/pages";
import { buildGuiStylesData } from "project-editor/features/page/build/styles";
import {
    buildListData,
    DataBuffer,
    StringList,
    Struct,
    String
} from "project-editor/features/page/build/pack";
import { buildGuiFontsData } from "./fonts";
import { buildGuiBitmapsData } from "./bitmaps";
import { buildGuiColors } from "./themes";

export class Assets {
    projects: Project[];

    dataItems: DataItem[];
    actions: Action[];
    pages: Page[];
    styles: (Style | undefined)[];
    fonts: Font[] = [];
    bitmaps: Bitmap[] = [];
    colors: string[] = [];

    map: any = {};

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
        this.projects = [];
        this.collectProjects(rootProject);

        {
            const assetIncludePredicate = (asset: DataItem | Action | Page) =>
                !buildConfiguration ||
                !asset.usedIn ||
                asset.usedIn.indexOf(buildConfiguration.name) !== -1;

            this.dataItems = this.getAssets<DataItem>(
                project => project.data,
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

    getDataItemIndex(object: any, propertyName: string) {
        return this.getAssetIndex(
            object,
            propertyName,
            findDataItem,
            this.dataItems
        );
    }

    getActionIndex(object: any, propertyName: string) {
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
}

////////////////////////////////////////////////////////////////////////////////

function buildActionNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let actionNames = new StringList();
        for (let i = 0; i < assets.actions.length; i++) {
            actionNames.addItem(new String(assets.actions[i].name));
        }
        document.addField(actionNames);
    }, dataBuffer);
}

function buildDataItemNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let dataItemNames = new StringList();
        for (let i = 0; i < assets.dataItems.length; i++) {
            dataItemNames.addItem(new String(assets.dataItems[i].name));
        }
        document.addField(dataItemNames);
    }, dataBuffer);
}

function buildPrologData(assets: Assets, uncompressedSize: number) {
    let prolog = new DataBuffer();

    prolog.packArray(new TextEncoder().encode("~eez"));

    prolog.packArray(
        new TextEncoder().encode(
            EEZStudio.remote.app.getVersion().padEnd(8, " ").substring(0, 8)
        )
    );

    prolog.packUInt16(3); // PROJECT VERSION: 3

    prolog.packUInt16(
        assets.DocumentStore.project.settings.general.getProjectTypeAsNumber()
    );

    prolog.packUInt32(uncompressedSize);

    return prolog;
}

export async function buildGuiAssetsData(assets: Assets) {
    const dataBuffer = new DataBuffer();

    await dataBuffer.packRegions(
        assets.DocumentStore.masterProject ? 7 : 5,
        async i => {
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
                buildDataItemNames(assets, dataBuffer);
            }
        }
    );

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

    const prolog = buildPrologData(assets, uncompressedSize);
    var prologBuffer = Buffer.from(prolog.buffer.slice(0, prolog.offset));

    const allData = Buffer.alloc(prologBuffer.length + compressedSize);
    prologBuffer.copy(allData, 0, 0, prologBuffer.length);
    compressedBuffer.copy(allData, prologBuffer.length, 0, compressedSize);

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

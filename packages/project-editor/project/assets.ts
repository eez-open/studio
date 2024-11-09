import { makeObservable, computed } from "mobx";

import { underscore } from "eez-studio-shared/string";

import { EezObject, IEezObject } from "project-editor/core/object";
import type { Action } from "project-editor/features/action/action";
import type { Bitmap } from "project-editor/features/bitmap/bitmap";
import type { Font } from "project-editor/features/font/font";
import type { Page } from "project-editor/features/page/page";
import type { Style } from "project-editor/features/style/style";
import type { LVGLStyle } from "project-editor/lvgl/style";
import type { Color } from "project-editor/features/style/theme";
import type { Variable } from "project-editor/features/variable/variable";
import type { Project } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export const IMPORT_AS_PREFIX = ".";

////////////////////////////////////////////////////////////////////////////////

export type AssetType =
    | "pages"
    | "actions"
    | "variables/globalVariables"
    | "allStyles"
    | "allLvglStyles"
    | "fonts"
    | "bitmaps"
    | "colors";

////////////////////////////////////////////////////////////////////////////////

function findAsset<T>(
    project: Project,
    assetType: AssetType,
    name: string | undefined
) {
    if (name == undefined) {
        return undefined;
    }

    let objects = project._assets.maps["name"].allAssets.get(
        assetType + "/" + name
    );

    if (objects && objects.length === 1) {
        return objects[0] as T;
    }
    return undefined;
}

function findAssetDeep<T>(
    project: Project,
    assetType: AssetType,
    name: string | undefined
) {
    if (name == undefined) {
        return undefined;
    }

    const importAsList = name.split(IMPORT_AS_PREFIX);
    for (let i = 0; i < importAsList.length - 1; i++) {
        const importDirective = project.settings.general.imports.find(
            importDirective => importDirective.importAs == importAsList[i]
        );
        if (!importDirective || !importDirective.project) {
            return undefined;
        }
        project = importDirective.project;
    }

    return findAsset<T>(
        project,
        assetType,
        importAsList[importAsList.length - 1]
    );
}

export function findPage(project: Project, name: string) {
    return findAsset<Page>(project, "pages", name);
}

export function findAction(project: Project, name: string) {
    return findAsset<Action>(project, "actions", name);
}

export function findVariable(project: Project, name: string) {
    return findAsset<Variable>(project, "variables/globalVariables", name);
}

export function findVariableDeep(project: Project, name: string) {
    return findAssetDeep<Variable>(project, "variables/globalVariables", name);
}

export function findBitmap(project: Project, name: any) {
    return findAsset<Bitmap>(project, "bitmaps", name);
}

export function findStyle(project: Project, name: string | undefined) {
    return findAsset<Style>(project, "allStyles", name);
}

export function findLvglStyle(project: Project, name: string | undefined) {
    return findAsset<LVGLStyle>(project, "allLvglStyles", name);
}

export function findFont(project: Project, name: string | undefined) {
    return findAsset<Font>(project, "fonts", name);
}

export function findFontByVarName(
    project: Project,
    varName: string | undefined
) {
    const allAssets = project._assets.maps["name"].allAssets;
    for (const key of allAssets.keys()) {
        if (key.startsWith("fonts/")) {
            const fontName = key.slice("fonts/".length);
            const fontVarName = getName(
                "ui_font_",
                fontName,
                NamingConvention.UnderscoreLowerCase
            );
            if (fontVarName == varName) {
                const objects = allAssets.get(key);
                if (objects && objects.length === 1) {
                    return objects[0] as Font;
                }
                return undefined;
            }
        }
    }

    return undefined;
}

export function getAssetFullName<T extends EezObject & { name: string }>(
    object: T,
    separator?: string
): string {
    if (separator == undefined) {
        separator = IMPORT_AS_PREFIX;
    }

    const objectName = object.name;

    let objectFullName;

    const objectProject = ProjectEditor.getProject(object);
    const rootProject = objectProject._store.project;
    if (objectProject != rootProject) {
        const visitedProjects = new Set<Project>();

        function findImportDirective(
            project: Project,
            accumulatedPrefix: string
        ): string | undefined {
            if (visitedProjects.has(project)) {
                return undefined;
            }
            visitedProjects.add(project);
            for (const importDirective of project.settings.general.imports) {
                if (importDirective.project) {
                    const importDirectivePrefix = importDirective.importAs
                        ? importDirective.importAs + separator
                        : "";

                    if (importDirective.project == objectProject) {
                        return importDirective.importAs
                            ? accumulatedPrefix +
                                  importDirectivePrefix +
                                  objectName
                            : objectName;
                    } else {
                        const name = findImportDirective(
                            importDirective.project,
                            accumulatedPrefix + importDirectivePrefix
                        );

                        if (name) {
                            return name;
                        }
                    }
                }
            }

            return undefined;
        }

        objectFullName = findImportDirective(rootProject, "");
    }

    if (!objectFullName) {
        objectFullName = objectName;
    }

    return objectFullName;
}

export enum NamingConvention {
    UnderscoreUpperCase,
    UnderscoreLowerCase
}

export function getName<
    T extends EezObject & {
        name: string;
    }
>(
    prefix: string,
    objectOrName: T | string,
    namingConvention: NamingConvention
) {
    let name;
    if (typeof objectOrName == "object") {
        name = getAssetFullName<T>(objectOrName, "_");
    } else {
        name = objectOrName.toString();
    }
    name = name.replace(/\$/g, "");
    name = name.replace(/[^a-zA-Z_0-9]/g, "_");

    if (namingConvention == NamingConvention.UnderscoreUpperCase) {
        name = underscore(name).toUpperCase();
    } else if (namingConvention == NamingConvention.UnderscoreLowerCase) {
        name = underscore(name).toLowerCase();
    }

    name = prefix + name;

    return name;
}

////////////////////////////////////////////////////////////////////////////////

class BuildAssetsMap<T extends IEezObject> {
    assets = new Map<string, T[]>();

    addAsset(path: string, object: T) {
        let asset = this.assets.get(path);
        if (!asset) {
            this.assets.set(path, [object]);
        } else {
            asset.push(object);
        }
    }
}

class AssetsMap {
    constructor(public assets: Assets, public key: "name" | "id") {
        makeObservable(this, {
            allAssetsMaps: computed,
            assetCollectionPaths: computed,
            localAssets: computed,
            importedAssets: computed,
            masterAssets: computed,
            allAssets: computed,
            globalVariablesMap: computed,
            actionsMap: computed,
            pagesMap: computed,
            stylesMap: computed,
            lvglStylesMap: computed,
            fontsMap: computed,
            bitmapsMap: computed,
            colorsMap: computed
        });
    }

    get project() {
        return this.assets.project;
    }

    get allAssetsMaps(): {
        path: AssetType;
        map: Map<string, IEezObject[]>;
    }[] {
        return [
            {
                path: "variables/globalVariables",
                map: this.globalVariablesMap
            },
            { path: "actions", map: this.actionsMap },
            { path: "pages", map: this.pagesMap },
            { path: "allStyles", map: this.stylesMap },
            { path: "allLvglStyles", map: this.lvglStylesMap },
            { path: "fonts", map: this.fontsMap },
            { path: "bitmaps", map: this.bitmapsMap },
            { path: "colors", map: this.colorsMap }
        ];
    }

    get assetCollectionPaths() {
        const assetCollectionPaths = new Set<string>();
        this.allAssetsMaps.forEach(assetsMap =>
            assetCollectionPaths.add(assetsMap.path)
        );
        return assetCollectionPaths;
    }

    get localAssets() {
        const buildAssets = new BuildAssetsMap();

        this.allAssetsMaps.forEach(({ path, map }) => {
            if (map) {
                map.forEach((objects, key) =>
                    objects.forEach(object => {
                        buildAssets.addAsset(path + "/" + key, object);
                    })
                );
            }
        });

        return buildAssets.assets;
    }

    get importedAssets() {
        const buildAssets = new BuildAssetsMap();

        for (const importDirective of this.project.settings.general.imports) {
            const project = importDirective.project;
            if (project) {
                project._assets.maps[this.key].allAssetsMaps.forEach(
                    ({ path, map }) => {
                        if (map) {
                            map.forEach((objects, key) =>
                                objects.forEach(object =>
                                    buildAssets.addAsset(
                                        path +
                                            "/" +
                                            (importDirective.importAs
                                                ? importDirective.importAs +
                                                  IMPORT_AS_PREFIX
                                                : "") +
                                            key,
                                        object
                                    )
                                )
                            );
                        }
                    }
                );
            }
        }

        return buildAssets.assets;
    }

    get masterAssets() {
        const buildAssets = new BuildAssetsMap();

        if (this.project.masterProject) {
            this.project.masterProject._assets.maps[
                this.key
            ].allAssetsMaps.forEach(({ path, map }) => {
                if (map) {
                    map.forEach((objects, key) => {
                        objects.forEach(object => {
                            if ((object as any).id) {
                                buildAssets.addAsset(path + "/" + key, object);
                            }
                        });
                    });
                }
            });
        }

        return buildAssets.assets;
    }

    get allAssets() {
        return new Map([
            ...this.localAssets,
            ...this.masterAssets,
            ...this.importedAssets
        ]);
    }

    addToMap<
        T extends EezObject & {
            id?: number;
            name: string;
        }
    >(map: BuildAssetsMap<T>, asset: T) {
        if (this.key == "name") {
            if (asset.name) {
                map.addAsset(asset.name, asset);
            }
        } else {
            if (asset.id != undefined) {
                map.addAsset(asset.id.toString(), asset);
            }
        }
    }

    get actionsMap() {
        const buildAssets = new BuildAssetsMap<Action>();
        if (this.project.actions) {
            this.project.actions.forEach(action =>
                this.addToMap(buildAssets, action)
            );
        }
        return buildAssets.assets;
    }

    get pagesMap() {
        const buildAssets = new BuildAssetsMap<Page>();
        if (this.project.pages) {
            this.project.pages.forEach(page =>
                this.addToMap(buildAssets, page)
            );
        }
        return buildAssets.assets;
    }

    get globalVariablesMap() {
        const buildAssets = new BuildAssetsMap<Variable>();
        if (this.project.variables && this.project.variables.globalVariables) {
            this.project.variables.globalVariables.forEach(globalVariable =>
                this.addToMap(buildAssets, globalVariable)
            );
        }
        return buildAssets.assets;
    }

    get stylesMap() {
        const buildAssets = new BuildAssetsMap<Style>();
        this.project.allStyles.forEach(style =>
            this.addToMap(buildAssets, style)
        );
        return buildAssets.assets;
    }

    get lvglStylesMap() {
        const buildAssets = new BuildAssetsMap<LVGLStyle>();
        if (this.project.lvglStyles) {
            this.project.lvglStyles.allStyles.forEach(style =>
                this.addToMap(buildAssets, style)
            );
        }
        return buildAssets.assets;
    }

    get fontsMap() {
        const buildAssets = new BuildAssetsMap<Font>();
        if (this.project.fonts) {
            this.project.fonts.forEach(font =>
                this.addToMap(buildAssets, font)
            );
        }
        return buildAssets.assets;
    }

    get bitmapsMap() {
        const buildAssets = new BuildAssetsMap<Bitmap>();
        if (this.project.bitmaps) {
            this.project.bitmaps.forEach(bitmap =>
                this.addToMap(buildAssets, bitmap)
            );
        }
        return buildAssets.assets;
    }

    get colorsMap() {
        const buildAssets = new BuildAssetsMap<Color>();
        this.project.colors.forEach(color => this.addToMap(buildAssets, color));
        return buildAssets.assets;
    }

    getAllObjectsOfType(referencedObjectCollectionPath: string): {
        name: string;
        object: IEezObject;
    }[] {
        const isAssetType = this.assetCollectionPaths.has(
            referencedObjectCollectionPath
        );

        if (isAssetType) {
            return Array.from(this.allAssets.keys())
                .filter(key => key.startsWith(referencedObjectCollectionPath))
                .map(key => ({ key, objects: this.allAssets.get(key)! }))
                .filter(assets => assets.objects.length == 1)
                .map(assets => ({
                    name: assets.key.substring(
                        referencedObjectCollectionPath.length + 1
                    ),
                    object: assets.objects[0]
                }));
        } else {
            const objects = (this.project._store.getObjectFromPath(
                referencedObjectCollectionPath.split("/")
            ) || []) as IEezObject[];

            return objects.map(object => ({
                name: (object as any).name,
                object
            }));
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Assets {
    maps = {
        name: new AssetsMap(this, "name"),
        id: new AssetsMap(this, "id")
    };

    constructor(public project: Project) {
        makeObservable(this, {
            pages: computed
        });
    }

    get pages(): { name: string; page: Page }[] {
        const pages = this.project.pages.map(page => ({
            name: page.name,
            page
        }));

        for (const importDirective of this.project.settings.general.imports) {
            if (importDirective.importAs) {
                const project = importDirective.project;
                if (project) {
                    project.pages.forEach(page =>
                        pages.push({
                            name:
                                importDirective.importAs +
                                IMPORT_AS_PREFIX +
                                page.name,
                            page
                        })
                    );
                }
            }
        }

        return pages;
    }

    get actions(): { name: string; action: Action }[] {
        const actions = this.project.actions.map(action => ({
            name: action.name,
            action
        }));

        for (const importDirective of this.project.settings.general.imports) {
            if (importDirective.importAs) {
                const project = importDirective.project;
                if (project) {
                    project.actions.forEach(action =>
                        actions.push({
                            name:
                                importDirective.importAs +
                                IMPORT_AS_PREFIX +
                                action.name,
                            action
                        })
                    );
                }
            }
        }

        return actions;
    }
}

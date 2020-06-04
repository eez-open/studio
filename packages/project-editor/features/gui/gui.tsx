import React from "react";
import { observable, computed, action } from "mobx";
import { observer } from "mobx-react";
//const LZ4 = require("lz4");

import { guid } from "eez-studio-shared/guid";
import {
    ClassInfo,
    registerClass,
    IEezObject,
    EezObject,
    PropertyType,
    NavigationComponent,
    PropertyInfo
} from "project-editor/core/object";
import * as output from "project-editor/core/output";

import { ProjectStore } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { MenuNavigation } from "project-editor/components/MenuNavigation";

import { Project } from "project-editor/project/project";

import { Page, IPage } from "project-editor/features/gui/page";
import { Style, IStyle, findStyle } from "project-editor/features/gui/style";
import { Font, IFont, serializePixelArray } from "project-editor/features/gui/font";
import { Bitmap, IBitmap } from "project-editor/features/gui/bitmap";
import { Theme, ITheme, Color, IColor } from "project-editor/features/gui/theme";

import { build } from "project-editor/features/gui/build";
import { metrics } from "project-editor/features/gui/metrics";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GuiNavigation extends NavigationComponent {
    render() {
        return <MenuNavigation id={this.props.id} navigationObject={ProjectStore.project.gui} />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface IGui {
    storyboard: string;
    pages: IPage[];
    styles: IStyle[];
    fonts: IFont[];
    bitmaps: IBitmap[];
    colors: IColor[];
    themes: ITheme[];
}

export class Gui extends EezObject implements IGui {
    @observable storyboard: string;
    @observable pages: Page[];
    @observable styles: Style[];
    @observable fonts: Font[];
    @observable bitmaps: Bitmap[];
    @observable colors: Color[];
    @observable themes: Theme[];

    static classInfo: ClassInfo = {
        label: () => "GUI",
        properties: [
            {
                name: "storyboard",
                type: PropertyType.JSON
            },
            {
                name: "pages",
                displayName: "Pages (Layouts)",
                type: PropertyType.Array,
                typeClass: Page,
                hideInPropertyGrid: true
            },
            {
                name: "styles",
                type: PropertyType.Array,
                typeClass: Style,
                hideInPropertyGrid: true,
                enumerable: (object: IEezObject, propertyInfo: PropertyInfo) => {
                    return !ProjectStore.masterProjectEnabled;
                }
            },
            {
                name: "fonts",
                type: PropertyType.Array,
                typeClass: Font,
                hideInPropertyGrid: true,
                enumerable: (object: IEezObject, propertyInfo: PropertyInfo) => {
                    return !ProjectStore.masterProjectEnabled;
                },
                check: (object: IEezObject[]) => {
                    let messages: output.Message[] = [];

                    if (object.length > 255) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Max. 255 fonts are supported",
                                object
                            )
                        );
                    }

                    return messages;
                }
            },
            {
                name: "bitmaps",
                type: PropertyType.Array,
                typeClass: Bitmap,
                hideInPropertyGrid: true,
                check: (object: IEezObject[]) => {
                    let messages: output.Message[] = [];

                    if (object.length > 255) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Max. 255 bitmaps are supported",
                                object
                            )
                        );
                    }

                    if (!findStyle("default")) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "'Default' style is missing.",
                                object
                            )
                        );
                    }

                    return messages;
                }
            },
            {
                name: "colors",
                type: PropertyType.Array,
                typeClass: Color,
                hideInPropertyGrid: true,
                partOfNavigation: false
            },
            {
                name: "themes",
                type: PropertyType.Array,
                typeClass: Theme,
                hideInPropertyGrid: true,
                partOfNavigation: false
            }
        ],
        beforeLoadHook: (object: Gui, jsObject: any) => {
            if (jsObject.colors) {
                for (const color of jsObject.colors) {
                    color.id = guid();
                }
            }
            if (jsObject.themes) {
                for (const theme of jsObject.themes) {
                    theme.id = guid();
                    for (let i = 0; i < theme.colors.length; i++) {
                        object.setThemeColor(theme.id, jsObject.colors[i].id, theme.colors[i]);
                    }
                    delete theme.colors;
                }
            }
        },
        navigationComponent: GuiNavigation,
        navigationComponentId: "gui",
        defaultNavigationKey: "pages",
        icon: "filter"
    };

    @computed
    get pagesMap() {
        const map = new Map<String, Page>();
        this.pages.forEach(page => map.set(page.name, page));
        return map;
    }

    @computed
    get stylesMap() {
        const map = new Map<String, Style>();
        this.styles.forEach(style => map.set(style.name, style));
        return map;
    }

    @computed({ keepAlive: true })
    get allStyleIdToStyleMap() {
        const map = new Map<number, Style[]>();

        this.stylesMap.forEach(style => {
            if (style.id != undefined) {
                map.set(style.id, (map.get(style.id) || []).concat([style]));
            }
        });

        for (const importDirective of ProjectStore.project.settings.general.imports) {
            const project = importDirective.project;
            if (project) {
                project.gui.stylesMap.forEach(style => {
                    if (style.id != undefined) {
                        map.set(style.id, (map.get(style.id) || []).concat([style]));
                    }
                });
            }
        }

        return map;
    }

    @computed
    get fontsMap() {
        const map = new Map<String, Font>();
        this.fonts.forEach(font => map.set(font.name, font));
        return map;
    }

    @computed
    get bitmapsMap() {
        const map = new Map<String, Bitmap>();
        this.bitmaps.forEach(bitmap => map.set(bitmap.name, bitmap));
        return map;
    }

    @observable themeColors = new Map<string, string>();

    getThemeColor(themeId: string, colorId: string) {
        return this.themeColors.get(themeId + colorId) || "#000000";
    }

    @action
    setThemeColor(themeId: string, colorId: string, color: string) {
        this.themeColors.set(themeId + colorId, color);
    }

    @computed
    get colorToIndexMap() {
        const map = new Map<String, number>();
        this.colors.forEach((color, i) => map.set(color.name, i));
        return map;
    }

    @computed
    get colorsMap() {
        const map = new Map<String, Color>();
        this.colors.forEach((color, i) => map.set(color.name, color));
        return map;
    }
}

registerClass(Gui);

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("gui", {
    projectFeature: {
        mandatory: false,
        key: "gui",
        type: PropertyType.Object,
        typeClass: Gui,
        icon: "filter",
        create: () => {
            return {
                pages: [],
                styles: [],
                fonts: [],
                bitmaps: []
            };
        },
        build: build,
        metrics: metrics,
        toJsHook: (jsObject: Project) => {
            const gui = ProjectStore.project.gui;
            if (gui) {
                //
                jsObject.gui.colors.forEach((color: any) => delete color.id);

                jsObject.gui.themes.forEach((theme: any, i: number) => {
                    delete theme.id;
                    theme.colors = gui.themes[i].colors;
                });

                delete jsObject.gui.themeColors;

                jsObject.gui.fonts.forEach(font =>
                    font.glyphs.forEach(glyph => {
                        if (glyph.glyphBitmap && glyph.glyphBitmap.pixelArray) {
                            (glyph.glyphBitmap as any).pixelArray = serializePixelArray(
                                glyph.glyphBitmap.pixelArray
                            );
                        }
                    })
                );
            }
        }
    }
});

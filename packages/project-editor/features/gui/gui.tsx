import React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { guid } from "eez-studio-shared/guid";
import {
    ClassInfo,
    registerClass,
    EezObject,
    EezArrayObject,
    PropertyType,
    asArray,
    getProperty,
    NavigationComponent
} from "project-editor/model/object";
import * as output from "project-editor/model/output";

import { ProjectStore } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { MenuNavigation } from "project-editor/ui/MenuNavigation";

import { Page } from "project-editor/features/gui/page";
import { Style } from "project-editor/features/gui/style";
import { Font } from "project-editor/features/gui/font";
import { Bitmap } from "project-editor/features/gui/bitmap";
import { Theme, Color } from "project-editor/features/gui/theme";

import { build } from "project-editor/features/gui/build";
import { metrics } from "project-editor/features/gui/metrics";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GuiNavigation extends NavigationComponent {
    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={getProperty(ProjectStore.project, "gui")}
                content={this.props.content}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Gui extends EezObject {
    @observable
    pages: EezArrayObject<Page>;

    @observable
    styles: EezArrayObject<Style>;

    @observable
    fonts: EezArrayObject<Font>;

    @observable
    bitmaps: EezArrayObject<Bitmap>;

    @observable
    colors: EezArrayObject<Color>;

    @observable
    themes: EezArrayObject<Theme>;

    static classInfo: ClassInfo = {
        label: () => "GUI",
        properties: [
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
                hideInPropertyGrid: true
            },
            {
                name: "fonts",
                type: PropertyType.Array,
                typeClass: Font,
                hideInPropertyGrid: true,
                check: (object: EezObject) => {
                    let messages: output.Message[] = [];

                    if (asArray(object).length >= 255) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Max. 254 fonts are supported",
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
                check: (object: EezObject) => {
                    let messages: output.Message[] = [];

                    if (asArray(object).length >= 255) {
                        messages.push(
                            new output.Message(
                                output.Type.ERROR,
                                "Max. 254 bitmaps are supported",
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

    @observable themeColors = new Map<string, string>();

    getThemeColor(themeId: string, colorId: string) {
        return this.themeColors.get(themeId + colorId) || "#000000";
    }

    @action
    setThemeColor(themeId: string, colorId: string, color: string) {
        this.themeColors.set(themeId + colorId, color);
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
        toJsHook: (jsObject: {
            gui: {
                colors: {
                    _array: {
                        id: string;
                    }[];
                };
                themes: {
                    _array: {
                        id: string;
                        colors: string[];
                    }[];
                };
                themeColors: any;
            };
        }) => {
            const gui = getProperty(ProjectStore.project, "gui") as Gui;

            jsObject.gui.colors._array.forEach((color: any) => delete color.id);

            jsObject.gui.themes._array.forEach((theme: any, i: number) => {
                delete theme.id;
                theme.colors = gui.themes._array[i].colors;
            });

            delete jsObject.gui.themeColors;
        }
    }
});

////////////////////////////////////////////////////////////////////////////////

export function getGui() {
    return ProjectStore.project && (getProperty(ProjectStore.project, "gui") as Gui);
}

export function getPages() {
    let gui = getGui();
    return (gui && gui.pages) || [];
}

export function findPage(pageName: string) {
    let pages = getPages();
    for (const page of pages._array) {
        if (page.name == pageName) {
            return page;
        }
    }
    return undefined;
}

export function findStyle(styleName: string | undefined) {
    let gui = getGui();
    let styles = (gui && gui.styles._array) || [];
    for (const style of styles) {
        if (style.name == styleName) {
            return style;
        }
    }
    return undefined;
}

export function findFont(fontName: any) {
    let gui = getGui();
    let fonts = (gui && gui.fonts) || [];
    for (const font of fonts._array) {
        if (font.name == fontName) {
            return font;
        }
    }
    return undefined;
}

export function findBitmap(bitmapName: any) {
    let gui = getGui();
    let bitmaps = (gui && gui.bitmaps) || [];
    for (const bitmap of bitmaps._array) {
        if (bitmap.name == bitmapName) {
            return bitmap;
        }
    }
    return undefined;
}

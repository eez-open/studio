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
    getProperty,
    NavigationComponent,
    PropertyInfo
} from "project-editor/core/object";
import * as output from "project-editor/core/output";

import { ProjectStore } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { MenuNavigation } from "project-editor/components/MenuNavigation";

import { Page } from "project-editor/features/gui/page";
import { Style, findStyle } from "project-editor/features/gui/style";
import { Font } from "project-editor/features/gui/font";
import { Bitmap } from "project-editor/features/gui/bitmap";
import { Theme, Color } from "project-editor/features/gui/theme";

import { build } from "project-editor/features/gui/build";
import { metrics } from "project-editor/features/gui/metrics";

export { findStyle } from "project-editor/features/gui/style";
export { findFont } from "project-editor/features/gui/font";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GuiNavigation extends NavigationComponent {
    render() {
        return (
            <MenuNavigation
                id={this.props.id}
                navigationObject={getProperty(ProjectStore.project, "gui")}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class Gui extends EezObject {
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
            if (jsObject.widgets) {
                jsObject.pages.push(
                    ...jsObject.widgets.map((widgetType: any) => ({
                        name: widgetType.name,
                        description: widgetType.description,
                        style: widgetType.style,
                        widgets: widgetType.widgets,
                        left: 0,
                        top: 0,
                        width: widgetType.width,
                        height: widgetType.height,
                        isUsedAsCustomWidget: true
                    }))
                );
            }

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
    get stylesMap() {
        const map = new Map<String, Style>();
        this.styles.forEach(style => map.set(style.name, style));
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
    get colorsMap() {
        const map = new Map<String, number>();
        this.colors.forEach((color, i) => map.set(color.name, i));
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
                    id: string;
                }[];
                themes: {
                    id: string;
                    colors: string[];
                }[];
                themeColors: any;
                pages: {
                    left: number;
                    top: number;
                    width: number;
                    height: number;
                    widgets: any[];
                    landscape: {
                        x: number;
                        y: number;
                        width: number;
                        height: number;
                        widgets: any[];
                    };
                }[];
            };
        }) => {
            const gui = ProjectStore.project.gui;
            if (gui) {
                //
                jsObject.gui.colors.forEach((color: any) => delete color.id);

                jsObject.gui.themes.forEach((theme: any, i: number) => {
                    delete theme.id;
                    theme.colors = gui.themes[i].colors;
                });

                delete jsObject.gui.themeColors;
            }
        }
    }
});

////////////////////////////////////////////////////////////////////////////////

export function getPages() {
    return (ProjectStore.project.gui && ProjectStore.project.gui.pages) || [];
}

export function findPage(pageName: string) {
    let pages = getPages();
    for (const page of pages) {
        if (page.name == pageName) {
            return page;
        }
    }
    return undefined;
}

export function findBitmap(bitmapName: any) {
    let bitmaps = (ProjectStore.project.gui && ProjectStore.project.gui.bitmaps) || [];
    for (const bitmap of bitmaps) {
        if (bitmap.name == bitmapName) {
            return bitmap;
        }
    }
    return undefined;
}

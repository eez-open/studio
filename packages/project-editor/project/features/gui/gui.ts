import { observable } from "mobx";

import { registerMetaData, EezObject, EezArrayObject } from "project-editor/core/metaData";
import { ProjectStore, asArray, getProperty } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import * as output from "project-editor/core/output";

import {
    storyboardMetaData,
    StoryboardProperties
} from "project-editor/project/features/gui/storyboard";
import { pageMetaData, PageProperties } from "project-editor/project/features/gui/page";
import {
    styleMetaData,
    StyleProperties,
    getDefaultStyle
} from "project-editor/project/features/gui/style";
import { FontProperties, fontMetaData } from "project-editor/project/features/gui/fontMetaData";
import { bitmapMetaData, BitmapProperties } from "project-editor/project/features/gui/bitmap";
import { build } from "project-editor/project/features/gui/build";
import { metrics } from "project-editor/project/features/gui/metrics";
import { GuiNavigation } from "project-editor/project/features/gui/GuiNavigation";

////////////////////////////////////////////////////////////////////////////////

export class GuiProperties extends EezObject {
    @observable
    storyboard: StoryboardProperties;

    @observable
    pages: EezArrayObject<PageProperties>;

    @observable
    styles: EezArrayObject<StyleProperties>;

    @observable
    fonts: EezArrayObject<FontProperties>;

    @observable
    bitmaps: EezArrayObject<BitmapProperties>;
}

export const guiMetaData = registerMetaData({
    getClass: function(jsObject: any) {
        return GuiProperties;
    },
    className: "Gui",
    label: () => "GUI",
    properties: () => [
        {
            name: "storyboard",
            type: "object",
            typeMetaData: storyboardMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "pages",
            displayName: "Pages (Layouts)",
            type: "array",
            typeMetaData: pageMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "styles",
            type: "array",
            typeMetaData: styleMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "fonts",
            type: "array",
            typeMetaData: fontMetaData,
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
            type: "array",
            typeMetaData: bitmapMetaData,
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
                        new output.Message(output.Type.ERROR, "'Default' style is missing.", object)
                    );
                }

                return messages;
            }
        }
    ],
    navigationComponent: GuiNavigation,
    navigationComponentId: "gui",
    defaultNavigationKey: "storyboard",
    icon: "filter"
});

////////////////////////////////////////////////////////////////////////////////

registerFeatureImplementation("gui", {
    projectFeature: {
        mandatory: false,
        key: "gui",
        type: "object",
        metaData: guiMetaData,
        create: () => {
            return {
                pages: [],
                styles: [],
                fonts: [],
                bitmaps: []
            };
        },
        build: build,
        metrics: metrics
    }
});

////////////////////////////////////////////////////////////////////////////////

export function getGui() {
    return (
        ProjectStore.projectProperties &&
        (getProperty(ProjectStore.projectProperties, "gui") as GuiProperties)
    );
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

export function findStyle(styleName: any) {
    let gui = getGui();
    let styles = (gui && gui.styles._array) || [];
    for (const style of styles) {
        if (style.name == styleName) {
            return style;
        }
    }
    return undefined;
}

export function findStyleOrGetDefault(styleName: any) {
    return findStyle(styleName) || getDefaultStyle();
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

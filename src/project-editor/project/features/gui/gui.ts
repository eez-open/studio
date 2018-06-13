import { observable } from "mobx";

import { registerMetaData, EezObject } from "project-editor/core/metaData";
import { ProjectStore, asArray, getProperty } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";
import * as output from "project-editor/core/output";

import {
    storyboardMetaData,
    StoryboardProperties
} from "project-editor/project/features/gui/storyboard";
import { pageMetaData, PageProperties } from "project-editor/project/features/gui/page";
import {
    widgetTypeMetaData,
    WidgetTypeProperties
} from "project-editor/project/features/gui/widgetType";
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
    @observable storyboard: StoryboardProperties;
    @observable pages: PageProperties[];
    @observable widgets: WidgetTypeProperties[];
    @observable styles: StyleProperties[];
    @observable fonts: FontProperties[];
    @observable bitmaps: BitmapProperties[];
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
            type: "array",
            typeMetaData: pageMetaData,
            hideInPropertyGrid: true
        },
        {
            name: "widgets",
            type: "array",
            typeMetaData: widgetTypeMetaData,
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

                if (asArray(object).length > 255) {
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
            type: "array",
            typeMetaData: bitmapMetaData,
            hideInPropertyGrid: true,
            check: (object: EezObject) => {
                let messages: output.Message[] = [];

                if (asArray(object).length > 255) {
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
    for (let i = 0; i < pages.length; i++) {
        let page = pages[i];
        if (page.name == pageName) {
            return page;
        }
    }
    return undefined;
}

export function findLocalWidgetType(widgetTypeName: string) {
    let gui = getGui();
    let widgetTypes = (gui && gui.widgets) || [];
    for (let i = 0; i < widgetTypes.length; i++) {
        let widgetType = widgetTypes[i];
        if (widgetType.name == widgetTypeName) {
            return widgetType;
        }
    }
    return undefined;
}

export function findLocalWidgetTypeIndex(widgetTypeName: string) {
    let gui = getGui();
    let widgetTypes = (gui && gui.widgets) || [];
    for (let i = 0; i < widgetTypes.length; i++) {
        let widgetType = widgetTypes[i];
        if (widgetType.name == widgetTypeName) {
            return i;
        }
    }
    return -1;
}

export function findStyle(styleName: any) {
    let gui = getGui();
    let styles = (gui && gui.styles) || [];
    for (let i = 0; i < styles.length; i++) {
        let style = styles[i];
        if (style.name == styleName) {
            return style;
        }
    }
    return undefined;
}

export function findStyleOrGetDefault(styleName: any) {
    return findStyle(styleName) || getDefaultStyle();
}

export function findStyleIndex(styleName: any) {
    let gui = getGui();
    let styles = (gui && gui.styles) || [];
    for (let i = 0; i < styles.length; i++) {
        let style = styles[i];
        if (style.name == styleName) {
            return i;
        }
    }
    return -1;
}

export function findFontIndex(fontName: any) {
    let gui = getGui();
    let fonts = (gui && gui.fonts) || [];
    for (let i = 0; i < fonts.length; i++) {
        if (fonts[i].name == fontName) {
            return i;
        }
    }
    return -1;
}

export function findFont(fontName: any) {
    let gui = getGui();
    let fonts = (gui && gui.fonts) || [];
    for (let i = 0; i < fonts.length; i++) {
        let font = fonts[i];
        if (font.name == fontName) {
            return font;
        }
    }
    return undefined;
}

export function findBitmapIndex(bitmapName: any) {
    let gui = getGui();
    let bitmaps = (gui && gui.bitmaps) || [];
    for (let i = 0; i < bitmaps.length; i++) {
        if (bitmaps[i].name == bitmapName) {
            return i;
        }
    }
    return -1;
}

export function findBitmap(bitmapName: any) {
    let gui = getGui();
    let bitmaps = (gui && gui.bitmaps) || [];
    for (let i = 0; i < bitmaps.length; i++) {
        let bitmap = bitmaps[i];
        if (bitmap.name == bitmapName) {
            return bitmap;
        }
    }
    return undefined;
}

import { observable } from "mobx";

import {
    ClassInfo,
    registerClass,
    EezObject,
    EezArrayObject,
    PropertyType,
    asArray,
    getProperty
} from "eez-studio-shared/model/object";
import * as output from "eez-studio-shared/model/output";
import { filterNumber } from "eez-studio-shared/model/validation";

import { Widget } from "eez-studio-page-editor/widget";
import { setPageContext, PropertyProps } from "eez-studio-page-editor/page-context";

import {
    dataContext,
    findDataItemIndex,
    findDataItem
} from "project-editor/project/features/data/data";
import { findActionIndex } from "project-editor/project/features/action/action";
import * as draw from "project-editor/project/features/gui/draw";

import { ProjectStore } from "project-editor/core/store";
import { registerFeatureImplementation } from "project-editor/core/extensions";

import { Page } from "project-editor/project/features/gui/page";
import { Style } from "project-editor/project/features/gui/style";
import { Font } from "project-editor/project/features/gui/font";
import { Bitmap } from "project-editor/project/features/gui/bitmap";
import { build } from "project-editor/project/features/gui/build";
import { metrics } from "project-editor/project/features/gui/metrics";
import { GuiNavigation } from "project-editor/project/features/gui/GuiNavigation";

////////////////////////////////////////////////////////////////////////////////

setPageContext({
    inEditor: true,

    resolution: 0,
    allResolutions: [],

    rootDataContext: dataContext,

    renderRootElement: draw.renderRootElement,

    findActionIndex,

    findDataItemIndex: findDataItemIndex,
    findDataItem: findDataItem,

    layoutConceptName: "Layout",

    getPages() {
        return (getProperty(ProjectStore.project, "gui") as Gui).pages;
    },

    findPage,

    getLayouts() {
        return (getProperty(ProjectStore.project, "gui") as Gui).pages;
    },
    findLayout: findPage,

    findStyle,
    findFont,

    onChangeValueInPropertyGrid(newValue: any, props: PropertyProps) {
        if (props.object instanceof Widget) {
            if (
                props.propertyInfo.name === "top" ||
                props.propertyInfo.name === "left" ||
                props.propertyInfo.name === "width" ||
                props.propertyInfo.name === "height"
            ) {
                if (filterNumber(newValue)) {
                    props.updateObject({
                        [props.propertyInfo.name]: newValue
                    });
                }
                return true;
            }
        }
        return false;
    },

    onKeyDownInPropertyGrid(newValue: any, event: React.KeyboardEvent, props: PropertyProps) {
        if (event.keyCode === 13) {
            if (props.object instanceof Widget) {
                if (
                    props.propertyInfo.name === "top" ||
                    props.propertyInfo.name === "left" ||
                    props.propertyInfo.name === "width" ||
                    props.propertyInfo.name === "height"
                ) {
                    try {
                        var mexp = require("math-expression-evaluator");
                        const value = (props.object as any)[props.propertyInfo.name];
                        newValue = mexp.eval(newValue);
                        if (newValue !== undefined && newValue !== value) {
                            props.updateObject({
                                [props.propertyInfo.name]: newValue
                            });
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        }
    }
});

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
            }
        ],
        navigationComponent: GuiNavigation,
        navigationComponentId: "gui",
        defaultNavigationKey: "pages",
        icon: "filter"
    };
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
        metrics: metrics
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

import { observable } from "mobx";

import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import {
    EezObject,
    registerClass,
    EezArrayObject,
    PropertyType
} from "project-editor/core/metaData";
import { getProperty, ProjectStore } from "project-editor/core/store";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import { Glyph } from "project-editor/project/features/gui/glyph";
import { FontEditor } from "project-editor/project/features/gui/FontEditor";
import extractFont from "font-services/font-extract";

const path = EEZStudio.electron.remote.require("path");

////////////////////////////////////////////////////////////////////////////////

export class FontSource extends EezObject {
    @observable
    filePath: string;
    @observable
    size?: number;

    static classInfo = {
        getClass: (jsObject: any) => {
            return FontSource;
        },

        label: (fontSource: FontSource) => {
            let label = fontSource.filePath;

            if (fontSource.size != undefined) {
                label += ", " + fontSource.size;
            }

            return label;
        },

        properties: () => [
            {
                name: "filePath",
                type: PropertyType.String
            },
            {
                name: "size",
                type: PropertyType.Number
            }
        ]
    };
}

registerClass(FontSource);

////////////////////////////////////////////////////////////////////////////////

export class Font extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    source?: FontSource;
    @observable
    bpp: number;
    @observable
    height: number;
    @observable
    ascent: number;
    @observable
    descent: number;

    @observable
    glyphs: EezArrayObject<Glyph>;

    @observable
    alwaysBuild: boolean;

    static classInfo = {
        getClass: (jsObject: any) => {
            return Font;
        },
        label: (font: Font) => {
            return font.name;
        },
        properties: () => [
            {
                name: "name",
                type: PropertyType.String,
                unique: true
            },
            {
                name: "description",
                type: PropertyType.MultilineText
            },
            {
                name: "source",
                type: PropertyType.Object,
                typeClassInfo: FontSource.classInfo
            },
            {
                name: "bpp",
                type: PropertyType.Enum,
                enumItems: [{ id: 1 }, { id: 8 }],
                defaultValue: 1,
                readOnlyInPropertyGrid: true
            },
            {
                name: "height",
                type: PropertyType.Number
            },
            {
                name: "ascent",
                type: PropertyType.Number
            },
            {
                name: "descent",
                type: PropertyType.Number
            },
            {
                name: "glyphs",
                typeClassInfo: Glyph.classInfo,
                type: PropertyType.Array,
                hideInPropertyGrid: true
            },
            {
                name: "alwaysBuild",
                type: PropertyType.Boolean
            }
        ],
        newItem: (parent: EezObject) => {
            function isFont(obj: EezObject) {
                return getProperty(obj, "filePath");
            }

            function isNonBdfFont(obj: EezObject) {
                return isFont(obj) && path.extname(getProperty(obj, "filePath")) != ".bdf";
            }

            function isNonBdfFontAnd1BitPerPixel(obj: EezObject) {
                return isNonBdfFont(obj) && getProperty(obj, "bpp") === 1;
            }

            function isCreateGlyphs(obj: EezObject) {
                return isFont(obj) && getProperty(obj, "createGlyphs");
            }

            return showGenericDialog({
                dialogDefinition: {
                    title: "New Font",
                    fields: [
                        {
                            name: "name",
                            type: "string",
                            validators: [validators.required, validators.unique(undefined, parent)]
                        },
                        {
                            name: "filePath",
                            displayName: "Based on font",
                            type: RelativeFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    { name: "Font files", extensions: ["bdf", "ttf", "otf"] },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        {
                            name: "bpp",
                            displayName: "Bits per pixel",
                            type: "enum",
                            enumItems: [1, 8]
                        },
                        {
                            name: "size",
                            type: "number",
                            visible: isNonBdfFont
                        },
                        {
                            name: "threshold",
                            type: "number",
                            visible: isNonBdfFontAnd1BitPerPixel
                        },
                        {
                            name: "createGlyphs",
                            type: "boolean",
                            visible: isFont
                        },
                        {
                            name: "fromGlyph",
                            type: "number",
                            visible: isCreateGlyphs
                        },
                        {
                            name: "toGlyph",
                            type: "number",
                            visible: isCreateGlyphs
                        },
                        {
                            name: "createBlankGlyphs",
                            type: "boolean",
                            visible: isCreateGlyphs
                        }
                    ]
                },
                values: {
                    size: 14,
                    bpp: 8,
                    threshold: 128,
                    fromGlyph: 32,
                    toGlyph: 127,
                    createGlyphs: true,
                    createBlankGlyphs: false
                }
            })
                .then(result => {
                    return extractFont({
                        name: result.values.name,
                        absoluteFilePath: ProjectStore.getAbsoluteFilePath(result.values.filePath),
                        relativeFilePath: result.values.filePath,
                        bpp: result.values.bpp,
                        size: result.values.size,
                        threshold: result.values.threshold,
                        createGlyphs: result.values.createGlyphs,
                        fromEncoding: result.values.fromGlyph,
                        toEncoding: result.values.toGlyph,
                        createBlankGlyphs: result.values.createBlankGlyphs
                    })
                        .then(font => {
                            notification.info(`Added ${result.values.name} font.`);
                            return font;
                        })
                        .catch(err => {
                            let errorMessage;
                            if (err) {
                                if (err.message) {
                                    errorMessage = err.message;
                                } else {
                                    errorMessage = err.toString();
                                }
                            }

                            if (errorMessage) {
                                notification.error(
                                    `Adding ${Font.constructor.name} failed: ${errorMessage}!`
                                );
                            } else {
                                notification.error(`Adding ${Font.constructor.name} failed!`);
                            }

                            return false;
                        });
                })
                .catch(() => {
                    // canceled
                    return false;
                });
        },
        editorComponent: FontEditor,
        navigationComponent: ListNavigationWithContent,
        navigationComponentId: "fonts",
        icon: "font_download"
    };
}

registerClass(Font);

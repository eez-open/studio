import { observable } from "mobx";

import { _minBy, _maxBy } from "eez-studio-shared/algorithm";
import { validators } from "eez-studio-shared/model/validation";

import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import * as notification from "eez-studio-ui/notification";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import {
    ClassInfo,
    EezObject,
    registerClass,
    EezArrayObject,
    PropertyType,
    getProperty
} from "project-editor/core/object";
import { ProjectStore } from "project-editor/core/store";

import { ListNavigationWithContent } from "project-editor/project/ui/ListNavigation";

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

    static classInfo: ClassInfo = {
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

        properties: [
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

    static classInfo: ClassInfo = {
        properties: [
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
                typeClass: FontSource
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
                typeClass: Glyph,
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
                                notification.error(`Adding ${Font.name} failed: ${errorMessage}!`);
                            } else {
                                notification.error(`Adding ${Font.name} failed!`);
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

////////////////////////////////////////////////////////////////////////////////

export function getData(font: Font) {
    /*
    Font header:

    offset
    0           ascent              uint8
    1           descent             uint8
    2           encoding start      uint8
    3           encoding end        uint8
    4           1st encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    6           2nd encoding offset uint16 BE (1 bpp) | uint32 LE (8 bpp)
    ...
    */

    /*
    Glyph header:

    offset
    0             DWIDTH                    int8
    1             BBX width                 uint8
    2             BBX height                uint8
    3             BBX xoffset               int8
    4             BBX yoffset               int8

    Note: byte 0 == 255 indicates empty glyph
    */

    const min = _minBy(font.glyphs._array, g => g.encoding);
    const startEncoding = (min && min.encoding) || 32;
    const max = _maxBy(font.glyphs._array, g => g.encoding);
    const endEncoding = (max && max.encoding) || 127;

    const data: number[] = [];

    function add(...values: number[]) {
        for (const value of values) {
            if (value < 0) {
                data.push(256 + value);
            } else {
                data.push(value);
            }
        }
    }

    if (startEncoding <= endEncoding) {
        add(font.ascent);
        add(font.descent);
        add(startEncoding);
        add(endEncoding);

        for (let i = startEncoding; i <= endEncoding; i++) {
            if (font.bpp === 8) {
                add(0);
                add(0);
                add(0);
                add(0);
            } else {
                add(0);
                add(0);
            }
        }

        for (let i = startEncoding; i <= endEncoding; i++) {
            const offsetIndex = 4 + (i - startEncoding) * (font.bpp === 8 ? 4 : 2);
            const offset = data.length;
            if (font.bpp === 8) {
                // uint32 LE
                data[offsetIndex + 0] = offset & 0xff;
                data[offsetIndex + 1] = (offset >> 8) & 0xff;
                data[offsetIndex + 2] = (offset >> 16) & 0xff;
                data[offsetIndex + 3] = offset >> 24;
            } else {
                // uint16 BE
                data[offsetIndex + 0] = offset >> 8;
                data[offsetIndex + 1] = offset & 0xff;
            }

            const glyph = font.glyphs._array[i - 32];

            if (glyph && glyph.pixelArray) {
                add(glyph.dx);
                add(glyph.width);
                add(glyph.height);
                add(glyph.x);
                add(glyph.y);

                add(...glyph.pixelArray);
            } else {
                add(255);
            }
        }
    }

    return data;
}

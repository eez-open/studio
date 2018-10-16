import { observable } from "mobx";

import { validators } from "shared/model/validation";

import { showGenericDialog } from "shared/ui/generic-dialog";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";

import { EezObject, registerMetaData } from "project-editor/core/metaData";
import { getProperty } from "project-editor/core/store";

import { ListNavigationWithContent } from "project-editor/project/ListNavigation";

import { GlyphProperties, glyphMetaData } from "project-editor/project/features/gui/glyph";
import { FontEditor } from "project-editor/project/features/gui/FontEditor";
import { loadFontFromFile } from "project-editor/project/features/gui/fontsService";

const path = EEZStudio.electron.remote.require("path");

////////////////////////////////////////////////////////////////////////////////

export class FontSourceProperties extends EezObject {
    @observable
    filePath: string;
    @observable
    size?: number;
}

export const fontSourceMetaData = registerMetaData({
    getClass: (jsObject: any) => {
        return FontSourceProperties;
    },
    className: "FontSource",

    label: (fontSource: FontSourceProperties) => {
        let label = fontSource.filePath;

        if (fontSource.size != undefined) {
            label += ", " + fontSource.size;
        }

        return label;
    },

    properties: () => [
        {
            name: "filePath",
            type: "string"
        },
        {
            name: "size",
            type: "number"
        }
    ]
});

////////////////////////////////////////////////////////////////////////////////

export class FontProperties extends EezObject {
    @observable
    name: string;
    @observable
    description?: string;
    @observable
    source?: FontSourceProperties;
    @observable
    bpp: number;
    @observable
    height: number;
    @observable
    ascent: number;
    @observable
    descent: number;
    @observable
    screenOrientation: string;
    @observable
    glyphs: GlyphProperties[];
}

export const fontMetaData = registerMetaData({
    getClass: (jsObject: any) => {
        return FontProperties;
    },
    className: "Font",
    label: (font: FontProperties) => {
        return font.name;
    },
    properties: () => [
        {
            name: "name",
            type: "string",
            unique: true
        },
        {
            name: "description",
            type: "multiline-text"
        },
        {
            name: "source",
            type: "object",
            typeMetaData: fontSourceMetaData
        },
        {
            name: "bpp",
            type: "enum",
            enumItems: [{ id: 1 }, { id: 8 }],
            defaultValue: 1,
            readOnlyInPropertyGrid: true
        },
        {
            name: "height",
            type: "number"
        },
        {
            name: "ascent",
            type: "number"
        },
        {
            name: "descent",
            type: "number"
        },
        {
            name: "screenOrientation",
            type: "enum",
            enumItems: [
                {
                    id: "all"
                },
                {
                    id: "portrait"
                },
                {
                    id: "landscape"
                }
            ]
        },
        {
            name: "glyphs",
            typeMetaData: glyphMetaData,
            type: "array",
            hideInPropertyGrid: true
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
                bpp: 1,
                threshold: 128,
                fromGlyph: 32,
                toGlyph: 127,
                createBlankGlyphs: false
            }
        }).then(result => {
            if (result.values.filePath) {
                return loadFontFromFile(
                    result.values.name,
                    result.values.filePath,
                    result.values.bpp,
                    result.values.size,
                    result.values.threshold,
                    result.values.createGlyphs,
                    result.values.fromGlyph,
                    result.values.toGlyph,
                    result.values.createBlankGlyphs
                );
            } else {
                return {
                    name: result.values.name,
                    bpp: 1,
                    ascent: 0,
                    descent: 0,
                    height: 0,
                    screenOrientation: "all",
                    glyphs: []
                } as any;
            }
        });
    },
    editorComponent: FontEditor,
    navigationComponent: ListNavigationWithContent,
    navigationComponentId: "fonts",
    icon: "font_download"
});

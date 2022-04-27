import { dialog, getCurrentWindow } from "@electron/remote";
import path from "path";
import React from "react";
import {
    observable,
    action,
    IObservableValue,
    makeObservable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { getParent, getProperty, IEezObject } from "project-editor/core/object";
import {
    IPanel,
    LayoutModels,
    loadObject,
    objectToJS,
    getDocumentStore
} from "project-editor/store";
import { validators } from "eez-studio-shared/validation";
import * as notification from "eez-studio-ui/notification";

import { ProjectContext } from "project-editor/project/context";
import { EditorComponent } from "project-editor/project/EditorComponent";

import {
    EditorImageHitTestResult,
    getMissingEncodings,
    setPixel
} from "project-editor/features/font/utils";
import { Glyphs } from "./Glyphs";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";
import { showGenericDialog } from "project-editor/core/util";
import { GlyphSelectFieldType } from "project-editor/features/font/GlyphSelectFieldType";
import { Font, Glyph, GlyphSource } from "project-editor/features/font/font";

import {
    EncodingRange,
    extractFont
} from "project-editor/features/font/font-extract";

////////////////////////////////////////////////////////////////////////////////

export const FontEditor = observer(
    class FontEditor extends EditorComponent implements IPanel {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                onSelectGlyph: action.bound,
                onAddGlyph: action.bound,
                onDeleteGlyph: action.bound
            });
        }

        get font() {
            return this.props.editor.object as Font;
        }

        get glyphs() {
            let font = this.font;
            return font.glyphs.sort((a, b) => a.encoding - b.encoding);
        }

        get selectedGlyph() {
            return this.context.navigationStore.selectedGlyphObject.get() as Glyph;
        }

        onSelectGlyph(glyph: Glyph) {
            this.context.navigationStore.selectedGlyphObject.set(glyph);
        }

        onBrowseGlyph = (glyph: Glyph) => {
            browseGlyph(glyph)
                .then(propertyValues => {
                    this.context.updateObject(glyph, propertyValues);
                })
                .catch(error => console.error(error));
        };

        onBrowseSelectedGlyph = () => {
            const glyph = this.selectedGlyph;
            if (glyph) {
                this.onBrowseGlyph(glyph);
            }
        };

        // interface IPanel implementation
        get selectedObject() {
            if (
                this.selectedGlyph &&
                getParent(this.selectedGlyph) == this.font.glyphs
            ) {
                return this.selectedGlyph;
            } else {
                return this.font;
            }
        }
        cutSelection() {
            // TODO
        }
        copySelection() {
            const glyph = this.selectedGlyph;
            if (glyph) {
                glyph.copyToClipboard();
            }
        }
        pasteSelection() {
            const glyph = this.selectedGlyph;
            if (glyph) {
                glyph.pasteFromClipboard();
            }
        }
        deleteSelection() {
            // TODO
        }
        onFocus = () => {
            this.context.navigationStore.setSelectedPanel(this);
        };

        onAddGlyph() {
            function isFont(obj: IEezObject) {
                return getProperty(obj, "filePath");
            }

            function isNonBdfFont(obj: IEezObject) {
                return (
                    isFont(obj) &&
                    path.extname(getProperty(obj, "filePath")) != ".bdf"
                );
            }

            function isNonBdfFontAnd1BitPerPixel(obj: IEezObject) {
                return isNonBdfFont(obj) && getProperty(obj, "bpp") === 1;
            }

            function isAddOptionRange(obj: IEezObject) {
                return isFont(obj) && getProperty(obj, "addOption") == "range";
            }

            const missingEncodings = getMissingEncodings(this.font);

            const addOptionEnumItems = [
                {
                    id: "append",
                    label: "Add single glyph at the end"
                },
                {
                    id: "range",
                    label: "Add glpyhs from range"
                }
            ];

            if (missingEncodings.length > 0) {
                addOptionEnumItems.push({
                    id: "missing",
                    label: "Add missing glyphs"
                });
            }

            return showGenericDialog(getDocumentStore(parent), {
                dialogDefinition: {
                    title: "Add Glyphs",
                    fields: [
                        {
                            name: "filePath",
                            type: RelativeFileInput,
                            validators: [validators.required],
                            options: {
                                filters: [
                                    {
                                        name: "Font files",
                                        extensions: ["bdf", "ttf", "otf"]
                                    },
                                    { name: "All Files", extensions: ["*"] }
                                ]
                            }
                        },
                        {
                            name: "renderingEngine",
                            displayName: "Rendering engine",
                            type: "enum",
                            enumItems: [
                                { id: "freetype", label: "FreeType" },
                                { id: "opentype", label: "OpenType" }
                            ],
                            visible: isNonBdfFont
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
                            name: "addOption",
                            type: "radio",
                            enumItems: addOptionEnumItems,
                            visible: isFont
                        },
                        {
                            name: "fromGlyph",
                            type: "number",
                            visible: isAddOptionRange
                        },
                        {
                            name: "toGlyph",
                            type: "number",
                            visible: isAddOptionRange
                        },
                        {
                            name: "overwriteExisting",
                            type: "boolean",
                            visible: isAddOptionRange
                        },
                        {
                            name: "createBlankGlyphs",
                            type: "boolean",
                            visible: isFont
                        }
                    ]
                },
                values: {
                    filePath: this.font.source?.filePath ?? "",
                    renderingEngine: this.font.renderingEngine,
                    size: this.font.source?.size ?? 14,
                    bpp: this.font.bpp,
                    threshold: this.font.threshold ?? 128,
                    fromGlyph: 32,
                    toGlyph: 127,
                    addOption: "append",
                    createGlyphs: true,
                    createBlankGlyphs: false
                }
            })
                .then(result => {
                    let encodings: EncodingRange[];

                    if (result.values.addOption === "append") {
                        let encoding = this.font.getMaxEncoding();
                        if (encoding < 0) {
                            encoding = 32;
                        } else {
                            encoding++;
                        }
                        encodings = [
                            {
                                from: encoding,
                                to: encoding
                            }
                        ];
                    } else if (result.values.addOption === "range") {
                        encodings = [
                            {
                                from: result.values.fromGlyph,
                                to: result.values.toGlyph
                            }
                        ];
                    } else {
                        encodings = missingEncodings;
                    }

                    return extractFont({
                        absoluteFilePath: this.context.getAbsoluteFilePath(
                            result.values.filePath
                        ),
                        relativeFilePath: result.values.filePath,
                        renderingEngine: result.values.renderingEngine,
                        bpp: result.values.bpp,
                        size: result.values.size,
                        threshold: result.values.threshold,
                        createGlyphs: true,
                        encodings,
                        createBlankGlyphs: result.values.createBlankGlyphs
                    })
                        .then(font => {
                            this.context.undoManager.setCombineCommands(true);

                            let newGlyph: IEezObject | undefined;

                            for (const glyph of font.glyphs) {
                                const existingGlyph = this.font.glyphs.find(
                                    existingGlyph =>
                                        existingGlyph.encoding == glyph.encoding
                                );
                                if (existingGlyph) {
                                    if (result.values.overwriteExisting) {
                                        this.context.deleteObject(
                                            existingGlyph
                                        );
                                    } else {
                                        continue;
                                    }
                                }

                                newGlyph = this.context.addObject(
                                    this.font.glyphs,
                                    glyph
                                ) as Glyph;
                            }

                            this.context.undoManager.setCombineCommands(false);

                            if (newGlyph) {
                                runInAction(() => {
                                    this.context.navigationStore.selectedGlyphObject.set(
                                        newGlyph!
                                    );
                                });
                            }
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
                                    `Adding glyphs failed: ${errorMessage}!`
                                );
                            } else {
                                notification.error(`Adding glyphs failed!`);
                            }

                            return false;
                        });
                })
                .catch(() => {
                    // canceled
                    return false;
                });
        }

        onDeleteGlyph() {
            const glyph = this.selectedGlyph;
            if (glyph) {
                this.context.deleteObject(glyph);
            }
        }

        onCreateShadow = async () => {
            const result = await dialog.showOpenDialog(getCurrentWindow(), {
                properties: ["openFile"],
                filters: [
                    {
                        name: "Image files",
                        extensions: ["png", "jpg", "jpeg"]
                    },
                    { name: "All Files", extensions: ["*"] }
                ]
            });

            const filePaths = result.filePaths;

            if (filePaths && filePaths[0]) {
                let image = new Image();
                image.src = filePaths[0];
                image.onload = action(() => {
                    let canvas = document.createElement("canvas");

                    canvas.width = image.width;
                    canvas.height = image.height;

                    let ctx = canvas.getContext("2d");
                    if (ctx == null) {
                        return;
                    }

                    ctx.clearRect(0, 0, image.width, image.height);
                    ctx.drawImage(image, 0, 0);

                    let imageData = ctx.getImageData(
                        0,
                        0,
                        image.width,
                        image.height
                    ).data;

                    const font = this.font;

                    let glyphWidth = font.glyphs[0].width;
                    let glyphHeight = font.glyphs[0].height;

                    const darkest =
                        imageData[
                            (Math.round(image.width / 2) * image.width +
                                Math.round(image.height / 2)) *
                                4 +
                                2
                        ];

                    function getPixelArray(left: number, top: number) {
                        const pixelArray = [];
                        for (let y = 0; y < glyphHeight; y++) {
                            for (let x = 0; x < glyphWidth; x++) {
                                const blue =
                                    imageData[
                                        ((top + y) * image.width + left + x) *
                                            4 +
                                            2
                                    ];
                                const shadow =
                                    ((255 - blue) / (255 - darkest)) * 255;
                                pixelArray.push(
                                    Math.max(
                                        Math.min(255, Math.round(shadow)),
                                        0
                                    )
                                );
                            }
                        }
                        return pixelArray;
                    }

                    font.glyphs[0].glyphBitmap = {
                        pixelArray: getPixelArray(0, 0),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[1].glyphBitmap = {
                        pixelArray: getPixelArray(
                            Math.round((image.width - glyphWidth) / 2),
                            0
                        ),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[2].glyphBitmap = {
                        pixelArray: getPixelArray(image.width - glyphWidth, 0),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[3].glyphBitmap = {
                        pixelArray: getPixelArray(
                            0,
                            (image.height - glyphHeight) / 2
                        ),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[4].glyphBitmap = {
                        pixelArray: getPixelArray(
                            image.width - glyphWidth,
                            (image.height - glyphHeight) / 2
                        ),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[5].glyphBitmap = {
                        pixelArray: getPixelArray(
                            0,
                            image.height - glyphHeight
                        ),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[6].glyphBitmap = {
                        pixelArray: getPixelArray(
                            Math.round((image.width - glyphWidth) / 2),
                            image.height - glyphHeight
                        ),
                        width: glyphWidth,
                        height: glyphHeight
                    };

                    font.glyphs[7].glyphBitmap = {
                        pixelArray: getPixelArray(
                            image.width - glyphWidth,
                            image.height - glyphHeight
                        ),
                        width: glyphWidth,
                        height: glyphHeight
                    };
                });
            }
        };

        onKeyDown = (event: any) => {
            if (event.ctrlKey) {
                if (event.keyCode == "C".charCodeAt(0)) {
                    this.copySelection();
                } else if (event.keyCode == "V".charCodeAt(0)) {
                    this.pasteSelection();
                }
            }
        };

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "glyphs") {
                return (
                    <Glyphs
                        glyphs={this.glyphs}
                        selectedGlyph={
                            this.context.navigationStore
                                .selectedGlyphObject as IObservableValue<
                                Glyph | undefined
                            >
                        }
                        onSelectGlyph={this.onSelectGlyph}
                        onDoubleClickGlyph={this.onBrowseGlyph}
                        onAddGlyph={this.onAddGlyph}
                        onDeleteGlyph={this.onDeleteGlyph}
                        onCreateShadow={this.onCreateShadow}
                        dialog={false}
                    />
                );
            }

            if (component === "editor") {
                return (
                    <GlyphEditor
                        glyph={
                            this.context.navigationStore
                                .selectedGlyphObject as IObservableValue<
                                Glyph | undefined
                            >
                        }
                    />
                );
            }

            return null;
        };

        render() {
            return (
                <div
                    onFocus={this.onFocus}
                    tabIndex={0}
                    onKeyDown={this.onKeyDown}
                >
                    <FlexLayout.Layout
                        model={this.context.layoutModels.fonts}
                        factory={this.factory}
                        realtimeResize={true}
                        font={LayoutModels.FONT_SUB}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const GlyphEditor = observer(
    class GlyphEditor extends React.Component<{
        glyph: IObservableValue<Glyph | undefined>;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        div: HTMLDivElement;

        hitTestResult: EditorImageHitTestResult | undefined = undefined;
        isLeftButtonDown: boolean = false;
        lastToggledPixel:
            | {
                  x: number;
                  y: number;
              }
            | undefined = undefined;

        constructor(props: { glyph: IObservableValue<Glyph | undefined> }) {
            super(props);

            makeObservable(this, {
                hitTestResult: observable,
                selectPixel: action,
                onMouseMove: action
            });
        }

        togglePixel() {
            const glyph = this.props.glyph.get();
            if (glyph && this.hitTestResult) {
                let glyphBitmap = glyph.glyphBitmap;
                if (!glyphBitmap) {
                    const width = this.hitTestResult.x + 1;
                    const height = this.hitTestResult.y + 1;
                    glyphBitmap = {
                        width,
                        height,
                        pixelArray: new Array<number>(width * height)
                    };
                }

                const font = glyph.font;

                const newGlyphBitmap = setPixel(
                    glyphBitmap,
                    this.hitTestResult.x,
                    this.hitTestResult.y,
                    glyph.getPixel(this.hitTestResult.x, this.hitTestResult.y)
                        ? 0
                        : 255,
                    font.bpp
                );

                this.context.updateObject(glyph, {
                    glyphBitmap: newGlyphBitmap
                });

                this.lastToggledPixel = {
                    x: this.hitTestResult.x,
                    y: this.hitTestResult.y
                };
            }
        }

        selectPixel(event: any) {
            const glyph = this.props.glyph.get();
            if (glyph) {
                this.hitTestResult = glyph.editorImageHitTest(
                    event.nativeEvent.offsetX + $(this.div).scrollLeft(),
                    event.nativeEvent.offsetY + $(this.div).scrollTop()
                );
            } else {
                this.hitTestResult = undefined;
            }
        }

        onMouseDown(event: any) {
            if (event.nativeEvent.which === 1) {
                this.isLeftButtonDown = true;

                this.lastToggledPixel = undefined;
                this.selectPixel(event);
                if (this.hitTestResult) {
                    this.togglePixel();
                }
            }
        }

        onMouseMove(event: any) {
            this.selectPixel(event);
            if (this.isLeftButtonDown) {
                if (this.hitTestResult) {
                    if (
                        !this.lastToggledPixel ||
                        this.lastToggledPixel.x != this.hitTestResult.x ||
                        this.lastToggledPixel.y != this.hitTestResult.y
                    ) {
                        this.togglePixel();
                    }
                } else {
                    this.lastToggledPixel = undefined;
                }
            }
        }

        onMouseUp(event: any) {
            if (event.nativeEvent.which === 1) {
                this.isLeftButtonDown = false;
            }
        }

        render() {
            var glyphImage: JSX.Element | undefined;
            const glyph = this.props.glyph.get();
            if (glyph) {
                glyphImage = (
                    <img
                        src={glyph.editorImage}
                        style={{
                            pointerEvents: "none"
                        }}
                    />
                );
            }

            var hitTest: JSX.Element | undefined;
            if (this.hitTestResult) {
                hitTest = (
                    <div
                        style={{
                            position: "absolute",
                            left: this.hitTestResult.rect.left,
                            top: this.hitTestResult.rect.top,
                            width: this.hitTestResult.rect.width,
                            height: this.hitTestResult.rect.height,
                            backgroundColor: "blue",
                            pointerEvents: "none"
                        }}
                    />
                );
            }

            return (
                <div
                    ref={ref => (this.div = ref!)}
                    onMouseDown={this.onMouseDown.bind(this)}
                    onMouseMove={this.onMouseMove.bind(this)}
                    onMouseUp={this.onMouseUp.bind(this)}
                >
                    {glyphImage}
                    {hitTest}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export function browseGlyph(glyph: Glyph) {
    function isFont(obj: any) {
        return obj["filePath"];
    }

    function isNonBdfFont(obj: any) {
        return isFont(obj) && path.extname(obj["filePath"]) != ".bdf";
    }

    function isNonBdfFontAnd1BitPerPixel(obj: any) {
        return isNonBdfFont(obj) && obj["bpp"] === 1;
    }

    const title = "Select Glyph";

    const DocumentStore = getDocumentStore(glyph);

    return showGenericDialog(DocumentStore, {
        dialogDefinition: {
            title,
            size: "large",
            fields: [
                {
                    name: "filePath",
                    displayName: "Font",
                    type: RelativeFileInput,
                    options: {
                        filters: [
                            {
                                name: "Font files",
                                extensions: ["bdf", "ttf", "otf"]
                            },
                            { name: "All Files", extensions: ["*"] }
                        ]
                    }
                },
                {
                    name: "renderingEngine",
                    displayName: "Rendering engine",
                    type: "enum",
                    enumItems: [
                        { id: "freetype", label: "FreeType" },
                        { id: "opentype", label: "OpenType" }
                    ],
                    visible: isNonBdfFont
                },
                {
                    name: "bpp",
                    type: "number",
                    visible: () => false
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
                    name: "encoding",
                    type: GlyphSelectFieldType,
                    enclosureClassName: "encoding",
                    options: {
                        fontFilePathField: "filePath",
                        fontRenderingEngine: "renderingEngine",
                        fontBppField: "bpp",
                        fontSizeField: "size",
                        fontThresholdField: "threshold"
                    }
                }
            ]
        },
        values: Object.assign({}, glyph.source && objectToJS(glyph.source), {
            bpp: glyph.font.bpp,
            renderingEngine: glyph.font.renderingEngine,
            threshold: glyph.font.threshold ?? 128
        }),
        opts: {
            jsPanel: {
                title,
                width: 1200
            },
            fieldsEnclosureDiv: SelectGlyphDialogFieldsEnclosure
        }
    }).then(result => {
        return {
            x: result.context.encoding.glyph.x,
            y: result.context.encoding.glyph.y,
            width: result.context.encoding.glyph.width,
            height: result.context.encoding.glyph.height,
            dx: result.context.encoding.glyph.dx,
            glyphBitmap: result.context.encoding.glyph.glyphBitmap,
            source: loadObject(DocumentStore, glyph, result.values, GlyphSource)
        };
    });
}

class SelectGlyphDialogFieldsEnclosure extends React.Component {
    render() {
        return (
            <div className="EezStudio_SelectGlyphDialogFieldsEnclosure">
                {this.props.children}
            </div>
        );
    }
}

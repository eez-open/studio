import React from "react";
import { observable, action, IObservableValue } from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import * as notification from "eez-studio-ui/notification";

import { getParent } from "project-editor/core/object";
import {
    IPanel,
    LayoutModel,
    cloneObject,
    loadObject,
    objectToJS,
    getDocumentStore
} from "project-editor/core/store";

import { ProjectContext } from "project-editor/project/context";
import rebuildFont from "font-services/font-rebuild";
import { EditorComponent } from "project-editor/project/EditorComponent";

import {
    EditorImageHitTestResult,
    setPixel
} from "project-editor/features/font/font-utils";
import { Glyphs } from "./Glyphs";

import { RelativeFileInput } from "project-editor/components/RelativeFileInput";
import { showGenericDialog } from "project-editor/core/util";
import { GlyphSelectFieldType } from "project-editor/features/font/GlyphSelectFieldType";
import { Font, Glyph, GlyphSource } from "project-editor/features/font/font";

////////////////////////////////////////////////////////////////////////////////

@observer
export class FontEditor extends EditorComponent implements IPanel {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get font() {
        return this.props.editor.object as Font;
    }

    get glyphs() {
        let font = this.font;
        return font.glyphs;
    }

    get selectedGlyph() {
        return this.context.navigationStore.selectedGlyphObject.get() as Glyph;
    }

    @action.bound
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

    @action.bound
    async onRebuildGlyphs() {
        try {
            const font = this.font;

            const newFont = await rebuildFont({
                font: objectToJS(font),
                projectFilePath: this.context.filePath!
            });

            this.context.replaceObject(
                font,
                loadObject(this.context, getParent(font), newFont, Font)
            );

            notification.info(`Font rebuilded.`);
        } catch (err) {
            notification.error(`Rebuild failed (${err})!`);
        }
    }

    @action.bound
    onAddGlyph() {
        const font = this.font;

        let newGlyph: Glyph;

        if (font.glyphs.length > 0) {
            newGlyph = cloneObject(
                this.context,
                font.glyphs[font.glyphs.length - 1]
            ) as Glyph;

            newGlyph.encoding = newGlyph.encoding + 1;
        } else {
            newGlyph = loadObject(
                this.context,
                undefined,
                {
                    encoding: 128,
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 1,
                    dx: 1,
                    glyphBitmap: {
                        width: 1,
                        height: 1,
                        pixelArray: [0]
                    },
                    source: font.source
                },
                Glyph
            ) as Glyph;
        }

        newGlyph = this.context.addObject(font.glyphs, newGlyph) as Glyph;

        this.context.navigationStore.selectedGlyphObject.set(newGlyph);
    }

    @action.bound
    onDeleteGlyph() {
        const font = this.font;
        const glyph = this.selectedGlyph;
        if (glyph && font.glyphs[font.glyphs.length - 1] == glyph) {
            this.context.deleteObject(glyph);
        }
    }

    onCreateShadow = async () => {
        const result = await EEZStudio.remote.dialog.showOpenDialog(
            EEZStudio.remote.getCurrentWindow(),
            {
                properties: ["openFile"],
                filters: [
                    { name: "Image files", extensions: ["png", "jpg", "jpeg"] },
                    { name: "All Files", extensions: ["*"] }
                ]
            }
        );

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
                                    ((top + y) * image.width + left + x) * 4 + 2
                                ];
                            const shadow =
                                ((255 - blue) / (255 - darkest)) * 255;
                            pixelArray.push(
                                Math.max(Math.min(255, Math.round(shadow)), 0)
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
                    pixelArray: getPixelArray(0, image.height - glyphHeight),
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

    onFocus = () => {
        this.context.navigationStore.setSelectedPanel(this);
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

    get model() {
        return FlexLayout.Model.fromJson({
            global: LayoutModel.GLOBAL_OPTIONS,
            borders: [],
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        enableTabStrip: false,
                        enableDrag: false,
                        enableDrop: false,
                        enableClose: false,
                        children: [
                            {
                                type: "tab",
                                enableClose: false,
                                component: "glyphs"
                            }
                        ]
                    },
                    {
                        type: "tabset",
                        enableTabStrip: false,
                        enableDrag: false,
                        enableDrop: false,
                        enableClose: false,
                        children: [
                            {
                                type: "tab",
                                enableClose: false,
                                component: "editor"
                            }
                        ]
                    }
                ]
            }
        });
    }

    factory = (node: FlexLayout.TabNode) => {
        var component = node.getComponent();

        if (component === "glyphs") {
            //const onRebuildGlyphs = !isDialog ? this.onRebuildGlyphs : undefined
            const onRebuildGlyphs = undefined;

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
                    onRebuildGlyphs={onRebuildGlyphs}
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
            <FlexLayout.Layout
                model={this.model}
                factory={this.factory}
                realtimeResize={true}
                font={LayoutModel.FONT_SUB}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GlyphEditor extends React.Component<{
    glyph: IObservableValue<Glyph | undefined>;
}> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    div: HTMLDivElement;

    @observable hitTestResult: EditorImageHitTestResult | undefined = undefined;
    isLeftButtonDown: boolean = false;
    lastToggledPixel:
        | {
              x: number;
              y: number;
          }
        | undefined = undefined;

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

    @action
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

    @action
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

////////////////////////////////////////////////////////////////////////////////

export function browseGlyph(glyph: Glyph) {
    function isFont(obj: any) {
        return obj["filePath"];
    }

    function isNonBdfFont(obj: any) {
        const path = EEZStudio.remote.require("path");
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
                    options: {
                        fontFilePathField: "filePath",
                        fontBppField: "bpp",
                        fontSizeField: "size",
                        fontThresholdField: "threshold"
                    }
                }
            ]
        },
        values: Object.assign({}, glyph.source && objectToJS(glyph.source), {
            bpp: glyph.font.bpp
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

import React from "react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import type { Params } from "font-services/font-extract";
import type { FontProperties, GlyphProperties } from "font-services/interfaces";
import { observer } from "mobx-react";
import { makeObservable, observable, runInAction } from "mobx";
import { load } from "opentype.js";

class Progress {
    error: string | undefined;
    message: string | null = null;

    constructor() {
        makeObservable(this, {
            error: observable,
            message: observable
        });
    }
}

export async function extractFontWithOpentype(data: Params) {
    return new Promise<FontProperties>((resolve, reject) => {
        const progress = new Progress();

        runInAction(() => (progress.message = "Loading font file..."));

        showDialog(
            <ProgressDialog progress={progress} onAbort={() => reject(false)} />
        );

        load(data.absoluteFilePath, (err, font) => {
            if (err) {
                progress.error = err.toString();
                return;
            }

            if (!font) {
                progress.error = "Unexpected error!";
                return;
            }

            function* generator() {
                for (let i = 0; i < font!.glyphs.length; i++) {
                    yield font!.glyphs.get(i);
                }
            }

            const gen = generator();

            let numGlyphs = font.glyphs.length;
            let glyphIndex = 0;

            const canvas = document.createElement(
                "canvas"
            ) as HTMLCanvasElement;
            canvas.width = 1024;
            canvas.height = 1024;
            const ctx = canvas.getContext("2d")!;

            var scale = (1 / (font.unitsPerEm || 1000)) * data.size;

            const x = 512;
            const y = 512;

            const ascent = Math.ceil(font.ascender * scale);
            const descent = Math.ceil(-font.descender * scale);

            const fontProperties: FontProperties = {
                name: data.name || "",
                source: {
                    filePath: data.relativeFilePath,
                    size: data.size,
                    threshold: data.threshold
                },
                bpp: data.bpp,
                height: ascent + descent,
                ascent,
                descent,
                glyphs: []
            };

            function doWork() {
                const startTime = Date.now();

                do {
                    const result = gen.next();
                    if (result.done) {
                        runInAction(() => (progress.message = `Done!`));
                        resolve(fontProperties);
                        return;
                    }

                    const glyph = result.value;

                    if (
                        !data.fromEncoding ||
                        !data.toEncoding ||
                        (glyph.unicode >= data.fromEncoding &&
                            glyph.unicode <= data.toEncoding)
                    ) {
                        const bb = glyph.getBoundingBox();
                        const x1 = Math.round(bb.x1 * scale);
                        const x2 = Math.round(bb.x2 * scale);
                        const y1 = Math.round(-bb.y2 * scale);
                        const y2 = Math.round(-bb.y1 * scale);

                        let glyphProperties: GlyphProperties = {} as any;

                        glyphProperties.encoding = glyph.unicode;

                        glyphProperties.dx = Math.round(
                            glyph.advanceWidth * scale
                        );

                        glyphProperties.x = x1;
                        glyphProperties.y = y1;
                        glyphProperties.width = x2 - x1;
                        glyphProperties.height = y2 - y1;

                        glyphProperties.glyphBitmap = {
                            width: 0,
                            height: 0,
                            pixelArray: []
                        };

                        if (
                            glyphProperties.width > 0 &&
                            glyphProperties.height > 0
                        ) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            glyph.draw(ctx, x, y, data.size);

                            glyphProperties.glyphBitmap.width =
                                glyphProperties.width;
                            glyphProperties.glyphBitmap.height =
                                glyphProperties.height;

                            const imageData = ctx.getImageData(
                                x + x1,
                                y + y1,
                                glyphProperties.width,
                                glyphProperties.height
                            );

                            for (
                                let i = 0;
                                i <
                                glyphProperties.width * glyphProperties.height;
                                i++
                            ) {
                                glyphProperties.glyphBitmap.pixelArray.push(
                                    imageData.data[i * 4]
                                );
                            }

                            glyphProperties.source = {
                                filePath: data.relativeFilePath,
                                size: data.size,
                                threshold: data.threshold,
                                encoding: glyph.unicode
                            } as any;

                            fontProperties.glyphs.push(glyphProperties);
                        }
                    }

                    glyphIndex++;
                } while (Date.now() - startTime < 10);

                runInAction(
                    () =>
                        (progress.message = `Glyph ${glyphIndex} / ${numGlyphs}`)
                );

                setTimeout(doWork);
            }

            if (data.createGlyphs) {
                setTimeout(doWork);
            } else {
                runInAction(() => (progress.message = `Done!`));
                resolve(fontProperties);
                return;
            }
        });
    });
}

export const ProgressDialog = observer(
    class ProgressDialog extends React.Component<{
        progress: Progress;
        onAbort: () => void;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {});
        }

        render() {
            return (
                <Dialog
                    cancelButtonText={
                        this.props.progress.error ? "Close" : "Abort"
                    }
                    onCancel={this.props.onAbort}
                >
                    {this.props.progress.message}
                </Dialog>
            );
        }
    }
);

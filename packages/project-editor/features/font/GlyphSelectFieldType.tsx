import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import extractFont from "font-services/font-extract";
import { FontProperties as FontValue } from "font-services/interfaces";
import { loadObject } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { Font, Glyph } from "./font";
import { Loader } from "eez-studio-ui/loader";
import { IFieldComponentProps } from "eez-studio-ui/generic-dialog";

import { Glyphs } from "project-editor/features/font/Glyphs";

////////////////////////////////////////////////////////////////////////////////

export const GlyphSelectFieldType = observer(
    class GlyphSelectFieldType extends React.Component<IFieldComponentProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        fontFilePath: string;
        fontBpp: number;
        fontSize: number;
        fontThreshold: number;

        timeoutId: any;

        glyphs: any;
        glyphsContainer: any;

        isLoading: boolean;
        font?: Font;

        selectedGlyph = observable.box<Glyph | undefined>();

        static MAX_CACHED_FONTS = 5;

        static fontsCache: {
            font: Font;
            fontFilePath: string;
            fontBpp: number;
            fontSize: number;
            fontThreshold: number;
        }[] = [];

        constructor(props: IFieldComponentProps) {
            super(props);

            makeObservable(this, {
                isLoading: observable,
                loadFont: action,
                onChange: action
            });
        }

        static getFontFromCache(
            fontFilePath: string,
            fontBpp: number,
            fontSize: number,
            fontThreshold: number
        ) {
            for (let cachedFont of GlyphSelectFieldType.fontsCache) {
                if (
                    cachedFont.fontFilePath === fontFilePath &&
                    cachedFont.fontBpp === fontBpp &&
                    cachedFont.fontSize === fontSize &&
                    cachedFont.fontThreshold === fontThreshold
                ) {
                    return cachedFont.font;
                }
            }
            return undefined;
        }

        static putFontInCache(
            font: Font,
            fontFilePath: string,
            fontBpp: number,
            fontSize: number,
            fontThreshold: number
        ) {
            GlyphSelectFieldType.fontsCache.push({
                font,
                fontFilePath,
                fontBpp,
                fontSize,
                fontThreshold
            });
            if (
                GlyphSelectFieldType.fontsCache.length >
                GlyphSelectFieldType.MAX_CACHED_FONTS
            ) {
                GlyphSelectFieldType.fontsCache.shift();
            }
        }

        componentDidMount() {
            this.delayedLoadFont();
        }

        componentDidUpdate() {
            this.delayedLoadFont();
        }

        delayedLoadFont() {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            this.timeoutId = setTimeout(() => this.loadFont(), 100);
        }

        loadFont() {
            let fontFilePath: string =
                this.props.values[
                    this.props.fieldProperties.options.fontFilePathField
                ];
            if (!fontFilePath) {
                return;
            }

            let fontBpp: number =
                this.props.values[
                    this.props.fieldProperties.options.fontBppField
                ];
            if (!fontBpp) {
                return;
            }

            let fontSize: number;
            let fontThreshold: number = 0;

            if (!fontFilePath.toLowerCase().endsWith(".bdf")) {
                fontSize =
                    this.props.values[
                        this.props.fieldProperties.options.fontSizeField
                    ];
                if (!fontSize || fontSize < 6 || fontSize > 100) {
                    return;
                }

                if (fontBpp !== 8) {
                    fontThreshold =
                        this.props.values[
                            this.props.fieldProperties.options
                                .fontThresholdField
                        ];
                    if (
                        !fontThreshold ||
                        fontThreshold < 1 ||
                        fontThreshold > 255
                    ) {
                        return;
                    }
                }
            } else {
                fontSize = this.fontSize;
                fontThreshold = this.fontThreshold;
            }

            if (
                fontFilePath != this.fontFilePath ||
                fontBpp != this.fontBpp ||
                fontSize != this.fontSize ||
                fontThreshold != this.fontThreshold
            ) {
                this.fontFilePath = fontFilePath;
                this.fontBpp = fontBpp;
                this.fontSize = fontSize;
                this.fontThreshold = fontThreshold;

                const font = GlyphSelectFieldType.getFontFromCache(
                    fontFilePath,
                    fontBpp,
                    fontSize,
                    fontThreshold
                );
                if (font) {
                    this.onChange(
                        font,
                        font.glyphs.find(
                            glyph =>
                                glyph.encoding ==
                                this.props.values[
                                    this.props.fieldProperties.name
                                ]
                        )
                    );
                } else {
                    extractFont({
                        absoluteFilePath:
                            this.context.getAbsoluteFilePath(fontFilePath),
                        relativeFilePath: fontFilePath,
                        bpp: fontBpp,
                        size: fontSize,
                        threshold: fontThreshold,
                        createGlyphs: true
                    })
                        .then((fontValue: FontValue) => {
                            const font: Font = loadObject(
                                this.context,
                                undefined,
                                fontValue,
                                Font
                            ) as Font;

                            GlyphSelectFieldType.putFontInCache(
                                font,
                                fontFilePath,
                                fontBpp,
                                fontSize,
                                fontThreshold
                            );

                            this.onChange(
                                font,
                                font.glyphs.find(
                                    glyph =>
                                        glyph.encoding ==
                                        this.props.values[
                                            this.props.fieldProperties.name
                                        ]
                                )
                            );
                        })
                        .catch(error => {
                            console.error(error);
                            this.onChange(undefined, undefined);
                        });

                    this.isLoading = true;
                    this.font = undefined;
                    this.selectedGlyph.set(undefined);
                }
            } else {
                if (this.glyphs) {
                    this.glyphs.ensureVisible();
                }
            }
        }

        onChange(font: Font | undefined, glyph: Glyph | undefined) {
            this.isLoading = false;
            this.font = font;
            this.selectedGlyph.set(glyph);

            this.props.onChange((glyph && glyph.encoding) || undefined);

            this.props.fieldContext[this.props.fieldProperties.name] = {
                font: font,
                glyph: glyph
            };
        }

        onSelectGlyph(glyph: Glyph) {
            this.onChange(this.font, glyph);
        }

        onDoubleClickGlyph(glyph: Glyph) {
            this.onSelectGlyph(glyph);
            this.props.onOk();
        }

        render() {
            if (this.font) {
                return (
                    <div
                        className="EezStudio_GlyphSelectFieldContainer"
                        ref={(ref: any) => (this.glyphsContainer = ref)}
                    >
                        <Glyphs
                            ref={ref => (this.glyphs = ref!)}
                            glyphs={this.font.glyphs}
                            selectedGlyph={this.selectedGlyph}
                            onSelectGlyph={this.onSelectGlyph.bind(this)}
                            onDoubleClickGlyph={this.onDoubleClickGlyph.bind(
                                this
                            )}
                            dialog={true}
                        />
                    </div>
                );
            } else {
                return (
                    <div style={{ padding: 20 }}>
                        {this.isLoading && <Loader />}
                    </div>
                );
            }
        }
    }
);

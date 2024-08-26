import React from "react";
import {
    observable,
    makeObservable,
    runInAction,
    IObservableValue,
    action
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FixedSizeGrid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

import { Loader } from "eez-studio-ui/loader";
import {
    FontRenderingEngine,
    IFontExtract,
    createFontExtract,
    Params
} from "project-editor/features/font/font-extract";
import { ProjectContext } from "project-editor/project/context";
import { IFieldComponentProps } from "eez-studio-ui/generic-dialog";
import { SearchInput } from "eez-studio-ui/search-input";

import {
    drawGlyph2,
    setBackColor,
    setColor
} from "project-editor/flow/editor/eez-gui-draw";
import { formatEncoding } from "project-editor/features/font/utils";
import { settingsController } from "home/settings";

////////////////////////////////////////////////////////////////////////////////

export const GlyphSelectFieldType = observer(
    class GlyphSelectFieldType extends React.Component<IFieldComponentProps> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        params: Params | undefined;
        fontExtract: IFontExtract | undefined;
        selectedEncoding = observable.box<number | undefined>();
        isLoading: boolean;
        unmounted: boolean;

        constructor(props: IFieldComponentProps) {
            super(props);

            this.selectedEncoding.set(props.values.encoding);

            makeObservable(this, {
                fontExtract: observable,
                isLoading: observable,
                onSelectEncoding: action
            });
        }

        async loadFont() {
            let fontFilePath: string =
                this.props.values[
                    this.props.fieldProperties.options.fontFilePathField
                ];

            let fontRenderingEngine: FontRenderingEngine =
                this.props.values[
                    this.props.fieldProperties.options.fontRenderingEngine
                ];

            let fontBpp: number =
                this.props.values[
                    this.props.fieldProperties.options.fontBppField
                ];

            let fontSize: number =
                this.props.values[
                    this.props.fieldProperties.options.fontSizeField
                ];

            let fontThreshold: number =
                fontBpp !== 8
                    ? this.props.values[
                          this.props.fieldProperties.options.fontThresholdField
                      ]
                    : 128;

            if (
                this.params &&
                fontFilePath == this.params.relativeFilePath &&
                fontRenderingEngine == this.params.renderingEngine &&
                fontBpp == this.params.bpp &&
                fontSize == this.params.size &&
                fontThreshold == this.params.threshold
            ) {
                return;
            }

            if (this.fontExtract) {
                this.fontExtract.freeResources();
                runInAction(() => {
                    this.fontExtract = undefined;
                });
                this.params = undefined;
            }

            if (
                !fontFilePath ||
                !fontRenderingEngine ||
                !fontBpp ||
                !fontSize ||
                fontSize < 6 ||
                fontSize > 100 ||
                !fontThreshold ||
                fontThreshold < 1 ||
                fontThreshold > 255
            ) {
                return;
            }

            runInAction(() => (this.isLoading = true));

            this.params = {
                name: "",
                absoluteFilePath:
                    this.context.getAbsoluteFilePath(fontFilePath),
                relativeFilePath: fontFilePath,
                renderingEngine: fontRenderingEngine,
                bpp: fontBpp,
                size: fontSize,
                threshold: fontThreshold,
                createGlyphs: false,
                encodings: [],
                createBlankGlyphs: false,
                doNotAddGlyphIfNotFound: false
            };

            const fontExtract = await createFontExtract(this.params);

            if (fontExtract) {
                try {
                    await fontExtract.start();
                } catch (err) {
                    fontExtract.freeResources();
                    return;
                }

                runInAction(() => (this.isLoading = false));

                if (!this.unmounted) {
                    runInAction(() => {
                        this.fontExtract = fontExtract;
                    });
                } else {
                    fontExtract.freeResources();
                }
            }
        }

        componentDidMount() {
            this.loadFont();
        }

        componentDidUpdate() {
            this.loadFont();
        }

        componentWillUnmount() {
            if (this.fontExtract) {
                this.fontExtract.freeResources();
                this.fontExtract = undefined;
                this.params = undefined;
            }

            this.unmounted = true;
        }

        onSelectEncoding = (encoding: number) => {
            this.selectedEncoding.set(encoding);

            if (this.fontExtract && this.fontExtract.getGlyph) {
                const glyph = this.fontExtract.getGlyph(encoding);

                this.props.onChange(glyph);

                this.props.fieldContext[this.props.fieldProperties.name] = {
                    glyph
                };
            }
        };

        onDoubleClickEncoding = (encoding: number) => {
            this.onSelectEncoding(encoding);
            this.props.onOk();
        };

        render() {
            return (
                <div className="EezStudio_GlyphSelectFieldContainer">
                    {this.fontExtract ? (
                        <Glyphs
                            fontExtract={this.fontExtract}
                            selectedEncoding={this.selectedEncoding}
                            onSelectEncoding={this.onSelectEncoding}
                            onDoubleClickEncoding={this.onDoubleClickEncoding}
                            dialog={true}
                        />
                    ) : this.isLoading ? (
                        <Loader />
                    ) : (
                        <span></span>
                    )}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Glyphs = observer(
    class Glyphs extends React.Component<{
        fontExtract: IFontExtract;
        selectedEncoding: IObservableValue<number | undefined>;
        onSelectEncoding: (encoding: number) => void;
        onDoubleClickEncoding: (encoding: number) => void;
        dialog: boolean;
    }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        searchText: string = "";

        listRef = React.createRef<FixedSizeGrid>();

        columnCount: number | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                searchText: observable,
                onSearchChange: action.bound
            });
        }

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();

            const searchText = this.searchText.toLowerCase();

            let encoding = this.props.fontExtract.allEncodings.find(
                encoding =>
                    formatEncoding(encoding)
                        .toLowerCase()
                        .indexOf(searchText) != -1
            );

            if (encoding) {
                if (this.ensureVisibleIntervalID) {
                    clearInterval(this.ensureVisibleIntervalID);
                }
                this.props.onSelectEncoding(encoding);
            }
        }

        componentDidMount() {
            this.ensureVisible();
        }

        componentDidUpdate() {
            this.ensureVisible();
        }

        componentWillUnmount() {}

        ensureVisibleIntervalID: any;

        doEnsureVisible = () => {
            const encoding = this.props.selectedEncoding.get();
            if (encoding != undefined) {
                const index =
                    this.props.fontExtract.allEncodings.indexOf(encoding);
                if (index != -1) {
                    if (this.listRef.current && this.columnCount != undefined) {
                        this.listRef.current.scrollToItem({
                            align: "auto",
                            columnIndex: index % this.columnCount,
                            rowIndex: Math.floor(index / this.columnCount)
                        });
                    } else {
                        return;
                    }
                }
            }
            clearInterval(this.ensureVisibleIntervalID);
        };

        ensureVisible() {
            if (this.ensureVisibleIntervalID) {
                clearInterval(this.ensureVisibleIntervalID);
            }
            this.ensureVisibleIntervalID = setInterval(this.doEnsureVisible);
        }

        render() {
            const GLYPH_WIDTH = 128;
            const GLYPH_HEIGHT = 100;

            return (
                <div className="EezStudio_GlyphSelect" tabIndex={0}>
                    <div className="btn-toolbar" role="toolbar">
                        <SearchInput
                            searchText={this.searchText}
                            onClear={action(() => {
                                this.searchText = "";
                            })}
                            onChange={this.onSearchChange}
                            onKeyDown={this.onSearchChange}
                        />
                    </div>
                    <div>
                        <AutoSizer>
                            {({
                                width,
                                height
                            }: {
                                width: number;
                                height: number;
                            }) => {
                                this.columnCount = Math.floor(
                                    width / GLYPH_WIDTH
                                );
                                const rowCount = Math.ceil(
                                    this.props.fontExtract.allEncodings.length /
                                        this.columnCount
                                );

                                return (
                                    <FixedSizeGrid
                                        ref={this.listRef}
                                        columnCount={this.columnCount}
                                        rowCount={rowCount}
                                        columnWidth={GLYPH_WIDTH}
                                        rowHeight={GLYPH_HEIGHT}
                                        itemData={
                                            {
                                                columnCount: this.columnCount,
                                                fontExtract:
                                                    this.props.fontExtract,
                                                selectedEncoding:
                                                    this.props.selectedEncoding,
                                                onSelect:
                                                    this.props.onSelectEncoding,
                                                onDoubleClick:
                                                    this.props
                                                        .onDoubleClickEncoding
                                            } as any
                                        }
                                        width={width}
                                        height={height}
                                    >
                                        {Glyph}
                                    </FixedSizeGrid>
                                );
                            }}
                        </AutoSizer>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Glyph = observer(
    ({
        columnIndex,
        rowIndex,
        style,
        data
    }: {
        columnIndex: number;
        rowIndex: number;
        style: React.CSSProperties;
        data: {
            columnCount: number;
            fontExtract: IFontExtract;
            selectedEncoding: IObservableValue<number | undefined>;
            onSelect: (encoding: number) => void;
            onDoubleClick: (encoding: number) => void;
        };
    }) => {
        const index = rowIndex * data.columnCount + columnIndex;
        if (index >= data.fontExtract.allEncodings.length) {
            return null;
        }

        const encoding = data.fontExtract.allEncodings[index];

        if (settingsController.isDarkTheme) {
            setColor("white");
            setBackColor("black");
        } else {
            setColor("black");
            setBackColor("white");
        }

        const canvas = drawGlyph2(encoding, data.fontExtract);

        return (
            <div className="glyph" style={style}>
                <div
                    className={classNames({
                        selected: encoding == data.selectedEncoding.get()
                    })}
                    onClick={() => data.onSelect(encoding)}
                    onDoubleClick={() => data.onDoubleClick(encoding)}
                >
                    <div>
                        <img src={canvas.toDataURL()}></img>
                        <div>{formatEncoding(encoding)}</div>
                    </div>
                </div>
            </div>
        );
    }
);

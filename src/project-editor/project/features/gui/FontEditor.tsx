import { action, observable } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";

import { IconAction } from "shared/ui/action";

import { FieldComponentProps } from "shared/ui/generic-dialog";

import { EditorComponent } from "project-editor/core/metaData";
import {
    NavigationStore,
    loadObject,
    addObject,
    deleteObject,
    cloneObject,
    updateObject,
    getId
} from "project-editor/core/store";
import { doLayout } from "project-editor/core/layout";

import * as Layout from "project-editor/components/Layout";
import { Loading } from "project-editor/components/Loading";

import { FontProperties, fontMetaData } from "project-editor/project/features/gui/fontMetaData";
import {
    GlyphProperties,
    selectGlyph,
    EditorImageHitTestResult
} from "project-editor/project/features/gui/glyph";
import { glyphMetaData, setPixel } from "project-editor/project/features/gui/glyph";
import { loadFontFromFile } from "project-editor/project/features/gui/fontsService";

////////////////////////////////////////////////////////////////////////////////

@observer
export class GlyphSelectFieldType extends React.Component<
    FieldComponentProps,
    {
        isLoading: boolean;
        font?: FontProperties;
        selectedGlyph?: GlyphProperties;
    }
> {
    fontFilePath: string;
    fontSize: number;
    fontThreshold: number;

    timeoutId: any;

    refs: {
        [key: string]: Element;
        glyphs: any;
        glyphsContainer: any;
    };

    constructor(props: FieldComponentProps) {
        super(props);
        this.state = {
            isLoading: false,
            font: undefined,
            selectedGlyph: undefined
        };
    }

    componentDidMount() {
        this.loadFont();
    }

    componentDidUpdate() {
        this.loadFont();
    }

    loadFont() {
        let fontFilePath: string = this.props.values[
            this.props.fieldProperties.options.fontFilePathField
        ];
        if (!fontFilePath) {
            return;
        }

        let fontSize: number;
        let fontThreshold: number;

        if (!fontFilePath.toLowerCase().endsWith(".bdf")) {
            fontSize = this.props.values[this.props.fieldProperties.options.fontSizeField];
            if (!fontSize || fontSize < 8 || fontSize > 100) {
                return;
            }

            fontThreshold = this.props.values[
                this.props.fieldProperties.options.fontThresholdField
            ];
            if (!fontThreshold || fontThreshold < 1 || fontThreshold > 255) {
                return;
            }
        } else {
            fontSize = this.fontSize;
            fontThreshold = this.fontThreshold;
        }

        if (
            fontFilePath != this.fontFilePath ||
            fontSize != this.fontSize ||
            fontThreshold != this.fontThreshold
        ) {
            this.fontFilePath = fontFilePath;
            this.fontSize = fontSize;
            this.fontThreshold = fontThreshold;

            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            this.timeoutId = setTimeout(() => {
                loadFontFromFile(undefined, fontFilePath, fontSize, fontThreshold, true)
                    .then((font: FontProperties) => {
                        font = loadObject(undefined, font, fontMetaData) as FontProperties;
                        this.onChange(
                            font,
                            font.glyphs.find(
                                glyph =>
                                    glyph.encoding ==
                                    this.props.values[this.props.fieldProperties.name]
                            )
                        );
                    })
                    .catch(error => {
                        console.error(error);
                        this.onChange(undefined, undefined);
                    });
            }, 1000);

            this.setState({
                isLoading: true,
                font: undefined,
                selectedGlyph: undefined
            });
        } else {
            if (this.refs.glyphs) {
                doLayout(this.refs.glyphsContainer);
                this.refs.glyphs.ensureVisible();
            }
        }
    }

    onChange(font: FontProperties | undefined, glyph: GlyphProperties | undefined) {
        this.setState({
            isLoading: false,
            font: font,
            selectedGlyph: glyph
        });

        this.props.onChange((glyph && glyph.encoding) || undefined);

        this.props.fieldContext[this.props.fieldProperties.name] = {
            font: font,
            glyph: glyph
        };
    }

    onSelectGlyph(glyph: GlyphProperties) {
        this.onChange(this.state.font, glyph);
    }

    onDoubleClickGlyph(glyph: GlyphProperties) {}

    render() {
        if (this.state.font) {
            return (
                <div
                    className="EezStudio_ProjectEditor_glyph-select-field-glyphs-container"
                    ref="glyphsContainer"
                >
                    <Glyphs
                        ref="glyphs"
                        glyphs={this.state.font.glyphs}
                        selectedGlyph={this.state.selectedGlyph}
                        onSelectGlyph={this.onSelectGlyph.bind(this)}
                        onDoubleClickGlyph={this.onDoubleClickGlyph.bind(this)}
                    />
                </div>
            );
        } else if (this.state.isLoading) {
            return (
                <div className="form-control-static">
                    <Loading size={6} />
                </div>
            );
        } else {
            return <div className="form-control-static" />;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Glyph extends React.Component<
    {
        glyph: GlyphProperties;
        isSelected: boolean;
        onSelect: () => void;
        onDoubleClick: () => void;
    },
    {}
> {
    render() {
        let classes: string[] = [];
        if (this.props.isSelected) {
            classes.push("selected");
        }

        return (
            <li
                key={this.props.glyph.encoding}
                className={classes.join(" ")}
                onClick={this.props.onSelect}
                onDoubleClick={this.props.onDoubleClick}
            >
                <div>
                    <img src={this.props.glyph.image} />
                    <div>{glyphMetaData.label(this.props.glyph)}</div>
                </div>
            </li>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Glyphs extends React.Component<
    {
        glyphs: GlyphProperties[];
        selectedGlyph: GlyphProperties | undefined;
        onSelectGlyph: (glyph: GlyphProperties) => void;
        onDoubleClickGlyph: (glyph: GlyphProperties) => void;
        onAddGlyph?: () => void;
        onDeleteGlyph?: () => void;
    },
    {
        searchValue: string;
    }
> {
    state = {
        searchValue: ""
    };

    refs: {
        [key: string]: Element;
        list: HTMLUListElement;
    };

    onChange(event: any) {
        let searchValue: string = event.target.value;

        this.setState({
            searchValue: searchValue
        });

        searchValue = searchValue.toLowerCase();
        let glyph = this.props.glyphs.find(
            glyph =>
                glyphMetaData
                    .label(glyph)
                    .toLowerCase()
                    .indexOf(searchValue) != -1
        );

        if (glyph) {
            this.props.onSelectGlyph(glyph);
        }
    }

    componentDidMount() {
        this.ensureVisible();
    }

    componentDidUpdate() {
        this.ensureVisible();
    }

    ensureVisible() {
        let $selectedGlyph = $(this.refs.list).find(".selected");
        if ($selectedGlyph.length == 1) {
            ($selectedGlyph[0] as any).scrollIntoViewIfNeeded();
        }
    }

    render() {
        let glyphs: JSX.Element[] = this.props.glyphs.map(glyph => (
            <Glyph
                key={getId(glyph)}
                glyph={glyph}
                isSelected={glyph == this.props.selectedGlyph}
                onSelect={this.props.onSelectGlyph.bind(null, glyph)}
                onDoubleClick={this.props.onDoubleClickGlyph.bind(null, glyph)}
            />
        ));

        let addGlyphButton: JSX.Element | undefined;
        if (this.props.onAddGlyph) {
            addGlyphButton = (
                <div className="btn-group" role="group">
                    <IconAction
                        title="Add Glyph"
                        icon="material:add"
                        iconSize={16}
                        onClick={this.props.onAddGlyph.bind(this)}
                    />
                </div>
            );
        }

        let deleteGlyphButton: JSX.Element | undefined;
        if (this.props.onDeleteGlyph) {
            deleteGlyphButton = (
                <div className="btn-group" role="group">
                    <IconAction
                        title="Delete Glyph"
                        icon="material:remove"
                        iconSize={16}
                        onClick={this.props.onDeleteGlyph.bind(this)}
                    />
                </div>
            );
        }

        return (
            <div className="EezStudio_ProjectEditor_font-editor-glyphs layoutCenter">
                <div className="EezStudio_ProjectEditor_font-editor-glyphs-filter layoutTop">
                    <div className="btn-toolbar" role="toolbar">
                        <div className="btn-group float-right">
                            <input
                                type="text"
                                className="form-control"
                                value={this.state.searchValue}
                                onChange={this.onChange.bind(this)}
                                placeholder="search"
                            />
                        </div>
                        {addGlyphButton}
                        {deleteGlyphButton}
                    </div>
                </div>
                <div className="EezStudio_ProjectEditor_font-editor-glyphs-content layoutCenter">
                    <ul ref="list">{glyphs}</ul>
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GlyphEditor extends React.Component<
    {
        glyph: GlyphProperties | undefined;
    },
    {}
> {
    refs: {
        [key: string]: Element;
        div: any;
    };

    @observable hitTestResult: EditorImageHitTestResult | undefined = undefined;
    isLeftButtonDown: boolean = false;
    lastToggledPixel:
        | {
              x: number;
              y: number;
          }
        | undefined = undefined;

    togglePixel() {
        if (this.props.glyph && this.hitTestResult) {
            let glyphBitmap = setPixel(
                this.props.glyph.glyphBitmap,
                this.hitTestResult.x,
                this.hitTestResult.y,
                this.props.glyph.getPixel(this.hitTestResult.x, this.hitTestResult.y) ? 0 : 1
            );

            updateObject(this.props.glyph, {
                glyphBitmap: glyphBitmap
            });

            this.lastToggledPixel = {
                x: this.hitTestResult.x,
                y: this.hitTestResult.y
            };
        }
    }

    @action
    selectPixel(event: any) {
        if (this.props.glyph) {
            this.hitTestResult = this.props.glyph.editorImageHitTest(
                event.nativeEvent.offsetX + $(this.refs.div).scrollLeft(),
                event.nativeEvent.offsetY + $(this.refs.div).scrollTop()
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
                    (this.lastToggledPixel.x != this.hitTestResult.x ||
                        this.lastToggledPixel.y != this.hitTestResult.y)
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
        var glyph: JSX.Element | undefined;
        if (this.props.glyph) {
            glyph = (
                <img
                    src={this.props.glyph.editorImage}
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
                        left: this.hitTestResult.rect.x,
                        top: this.hitTestResult.rect.y,
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
                ref="div"
                className="EezStudio_ProjectEditor_font-editor-glyph layoutCenter"
                onMouseDown={this.onMouseDown.bind(this)}
                onMouseMove={this.onMouseMove.bind(this)}
                onMouseUp={this.onMouseUp.bind(this)}
            >
                {glyph}
                {hitTest}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class FontEditor extends EditorComponent {
    get glyphs() {
        let font = this.props.editor.object as FontProperties;
        return font.glyphs;
    }

    @observable selectedGlyph: GlyphProperties | undefined;

    @action
    onSelectGlyph(glyph: GlyphProperties) {
        this.selectedGlyph = glyph;
    }

    onDoubleClickGlyph(glyph: GlyphProperties) {
        selectGlyph(glyph)
            .then(propertyValues => {
                updateObject(glyph, propertyValues);
            })
            .catch(error => console.error(error));
    }

    get selectedObject() {
        return this.selectedGlyph;
    }

    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    @action
    onAddGlyph() {
        let font = this.props.editor.object as FontProperties;
        let newGlyph = cloneObject(
            undefined,
            font.glyphs[font.glyphs.length - 1]
        ) as GlyphProperties;
        newGlyph.encoding = newGlyph.encoding + 1;
        newGlyph = addObject(font.glyphs as any, newGlyph) as GlyphProperties;
        this.selectedGlyph = newGlyph;
    }

    onDeleteGlyph() {
        let font = this.props.editor.object as FontProperties;
        let selectedGlyph = this.selectedGlyph;
        if (selectedGlyph && font.glyphs[font.glyphs.length - 1] == selectedGlyph) {
            deleteObject(selectedGlyph);
        }
    }

    render() {
        let font = this.props.editor.object as FontProperties;

        let onDeleteGlyph: (() => void) | undefined;
        if (this.selectedGlyph && font.glyphs[font.glyphs.length - 1] == this.selectedGlyph) {
            onDeleteGlyph = this.onDeleteGlyph.bind(this);
        }

        return (
            <Layout.Split
                orientation="vertical"
                splitId="font-editor"
                tabIndex={0}
                onFocus={this.focusHander.bind(this)}
            >
                <Glyphs
                    glyphs={this.glyphs}
                    selectedGlyph={this.selectedGlyph}
                    onSelectGlyph={this.onSelectGlyph.bind(this)}
                    onDoubleClickGlyph={this.onDoubleClickGlyph.bind(this)}
                    onAddGlyph={this.onAddGlyph.bind(this)}
                    onDeleteGlyph={onDeleteGlyph}
                />
                <GlyphEditor glyph={this.selectedGlyph} />
            </Layout.Split>
        );
    }
}

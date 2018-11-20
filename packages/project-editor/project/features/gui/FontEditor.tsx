import { action, observable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { bind } from "bind-decorator";

import { IconAction, TextAction } from "eez-studio-ui/action";
import { IFieldComponentProps } from "eez-studio-ui/generic-dialog";
import styled from "eez-studio-ui/styled-components";
import * as notification from "eez-studio-ui/notification";
import { Splitter } from "eez-studio-ui/splitter";
import { Loader } from "eez-studio-ui/loader";

import { EditorComponent, loadObject, objectToJS, cloneObject } from "project-editor/core/object";
import { NavigationStore, ProjectStore } from "project-editor/core/store";

import { Font } from "project-editor/project/features/gui/font";
import {
    Glyph,
    selectGlyph,
    EditorImageHitTestResult
} from "project-editor/project/features/gui/glyph";
import { setPixel } from "project-editor/project/features/gui/glyph";
import extractFont from "font-services/font-extract";
import rebuildFont from "font-services/font-rebuild";
import { FontProperties as FontValue } from "font-services/interfaces";

////////////////////////////////////////////////////////////////////////////////

const GlyphSelectFieldContainerDiv = styled.div`
    height: 600px;
    border: 1px solid ${props => props.theme.borderColor};
    display: flex;
`;

@observer
export class GlyphSelectFieldType extends React.Component<
    IFieldComponentProps,
    {
        isLoading: boolean;
        font?: Font;
        selectedGlyph?: Glyph;
    }
> {
    fontFilePath: string;
    fontBpp: number;
    fontSize: number;
    fontThreshold: number;

    timeoutId: any;

    glyphs: any;
    glyphsContainer: any;

    constructor(props: IFieldComponentProps) {
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

        let fontBpp: number = this.props.values[this.props.fieldProperties.options.fontBppField];
        if (!fontBpp) {
            return;
        }

        let fontSize: number;
        let fontThreshold: number = 0;

        if (!fontFilePath.toLowerCase().endsWith(".bdf")) {
            fontSize = this.props.values[this.props.fieldProperties.options.fontSizeField];
            if (!fontSize || fontSize < 8 || fontSize > 100) {
                return;
            }

            if (fontBpp !== 8) {
                fontThreshold = this.props.values[
                    this.props.fieldProperties.options.fontThresholdField
                ];
                if (!fontThreshold || fontThreshold < 1 || fontThreshold > 255) {
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

            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            this.timeoutId = setTimeout(() => {
                extractFont({
                    absoluteFilePath: ProjectStore.getAbsoluteFilePath(fontFilePath),
                    relativeFilePath: fontFilePath,
                    bpp: fontBpp,
                    size: fontSize,
                    threshold: fontThreshold,
                    createGlyphs: true
                })
                    .then((fontValue: FontValue) => {
                        const font: Font = loadObject(undefined, fontValue, Font) as Font;
                        this.onChange(
                            font,
                            font.glyphs._array.find(
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
            if (this.glyphs) {
                this.glyphs.ensureVisible();
            }
        }
    }

    onChange(font: Font | undefined, glyph: Glyph | undefined) {
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

    onSelectGlyph(glyph: Glyph) {
        this.onChange(this.state.font, glyph);
    }

    onDoubleClickGlyph(glyph: Glyph) {}

    render() {
        if (this.state.font) {
            return (
                <GlyphSelectFieldContainerDiv innerRef={ref => (this.glyphsContainer = ref)}>
                    <Glyphs
                        ref={ref => (this.glyphs = ref!)}
                        glyphs={this.state.font.glyphs._array}
                        selectedGlyph={this.state.selectedGlyph}
                        onSelectGlyph={this.onSelectGlyph.bind(this)}
                        onDoubleClickGlyph={this.onDoubleClickGlyph.bind(this)}
                    />
                </GlyphSelectFieldContainerDiv>
            );
        } else if (this.state.isLoading) {
            return (
                <div className="form-control-static">
                    <Loader />
                </div>
            );
        } else {
            return <div className="form-control-static" />;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GlyphComponent extends React.Component<
    {
        glyph: Glyph;
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
                    <div>{this.props.glyph._label}</div>
                </div>
            </li>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const Toolbar = styled.div`
    flex-wrap: nowrap;

    & > input {
        width: 200px;
        margin-left: 4px;
        margin-top: 3px;
    }
`;

const GlyphsDiv = styled.div`
    display: flex;
    flex-direction: column;
    overflow: hidden;

    ul {
        padding: 5px;
    }

    li {
        display: inline-block;
        margin: 5px;
        border: 2px solid #eee;
        padding: 5px;
        background-color: white;
        cursor: pointer;
    }

    li.selected {
        border: 2px solid ${props => props.theme.selectionBackgroundColor};
    }

    li > div {
        display: flex;
        align-items: center;
        flex-direction: column;
    }

    li > div > img {
        flex: 1;
    }

    li > div > div {
        font-size: 80%;
        font-family: monospace;
    }
`;

const GlyphsFilterDiv = styled.div`
    flex-grow: 0;
    flex-shrink: 0;
    padding: 5px;
    background-color: ${props => props.theme.panelHeaderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};
    input {
        height: 28px;
    }

    input {
        width: 100%;
    }
`;

const GlyphsContentDiv = styled.div`
    flex-grow: 1;
    display: flex;
    overflow: auto;
`;

@observer
class Glyphs extends React.Component<
    {
        glyphs: Glyph[];
        selectedGlyph: Glyph | undefined;
        onSelectGlyph: (glyph: Glyph) => void;
        onDoubleClickGlyph: (glyph: Glyph) => void;
        onRebuildGlyphs?: () => void;
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

    list: HTMLUListElement;

    onChange(event: any) {
        let searchValue: string = event.target.value;

        this.setState({
            searchValue: searchValue
        });

        searchValue = searchValue.toLowerCase();
        let glyph = this.props.glyphs.find(
            glyph => glyph._label.toLowerCase().indexOf(searchValue) != -1
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
        const $selectedGlyph = $(this.list).find(".selected");
        if ($selectedGlyph.length == 1) {
            ($selectedGlyph[0] as any).scrollIntoViewIfNeeded();
        }
    }

    render() {
        const glyphs: JSX.Element[] = this.props.glyphs.map(glyph => (
            <GlyphComponent
                key={glyph._id}
                glyph={glyph}
                isSelected={glyph == this.props.selectedGlyph}
                onSelect={this.props.onSelectGlyph.bind(null, glyph)}
                onDoubleClick={this.props.onDoubleClickGlyph.bind(null, glyph)}
            />
        ));

        let rebuildGlyphsButton: JSX.Element | undefined;
        if (this.props.onRebuildGlyphs) {
            rebuildGlyphsButton = (
                <TextAction
                    text="Rebuild"
                    title="Rebuild Glyphs"
                    onClick={this.props.onRebuildGlyphs.bind(this)}
                />
            );
        }

        let addGlyphButton: JSX.Element | undefined;
        if (this.props.onAddGlyph) {
            addGlyphButton = (
                <IconAction
                    title="Add Glyph"
                    icon="material:add"
                    iconSize={16}
                    onClick={this.props.onAddGlyph.bind(this)}
                />
            );
        }

        let deleteGlyphButton: JSX.Element | undefined;
        if (this.props.onDeleteGlyph) {
            deleteGlyphButton = (
                <IconAction
                    title="Delete Glyph"
                    icon="material:remove"
                    iconSize={16}
                    onClick={this.props.onDeleteGlyph}
                />
            );
        }

        return (
            <GlyphsDiv>
                <GlyphsFilterDiv>
                    <Toolbar className="btn-toolbar" role="toolbar">
                        <input
                            type="text"
                            className="form-control"
                            value={this.state.searchValue}
                            onChange={this.onChange.bind(this)}
                            placeholder="search"
                        />
                        <div style={{ flexGrow: 1 }} />
                        {rebuildGlyphsButton}
                        {addGlyphButton}
                        {deleteGlyphButton}
                    </Toolbar>
                </GlyphsFilterDiv>
                <GlyphsContentDiv>
                    <ul ref={ref => (this.list = ref!)}>{glyphs}</ul>
                </GlyphsContentDiv>
            </GlyphsDiv>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class GlyphEditor extends React.Component<
    {
        glyph: Glyph | undefined;
    },
    {}
> {
    div: HTMLDivElement;

    @observable
    hitTestResult: EditorImageHitTestResult | undefined = undefined;
    isLeftButtonDown: boolean = false;
    lastToggledPixel:
        | {
              x: number;
              y: number;
          }
        | undefined = undefined;

    togglePixel() {
        if (this.props.glyph && this.hitTestResult) {
            let glyphBitmap = this.props.glyph.glyphBitmap;
            if (!glyphBitmap) {
                const width = this.hitTestResult.x + 1;
                const height = this.hitTestResult.y + 1;
                glyphBitmap = {
                    width,
                    height,
                    pixelArray: new Array<number>(width * height)
                };
            }

            const font = this.props.glyph.getFont();

            const newGlyphBitmap = setPixel(
                glyphBitmap,
                this.hitTestResult.x,
                this.hitTestResult.y,
                this.props.glyph.getPixel(this.hitTestResult.x, this.hitTestResult.y) ? 0 : 255,
                font.bpp
            );

            ProjectStore.updateObject(this.props.glyph, {
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
        if (this.props.glyph) {
            this.hitTestResult = this.props.glyph.editorImageHitTest(
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
        let font = this.props.editor.object as Font;
        return font.glyphs;
    }

    @observable
    selectedGlyph: Glyph | undefined;

    @action.bound
    onSelectGlyph(glyph: Glyph) {
        this.selectedGlyph = glyph;
    }

    @bind
    onDoubleClickGlyph(glyph: Glyph) {
        selectGlyph(glyph)
            .then(propertyValues => {
                ProjectStore.updateObject(glyph, propertyValues);
            })
            .catch(error => console.error(error));
    }

    get selectedObject() {
        return this.selectedGlyph;
    }

    focusHander() {
        NavigationStore.setSelectedPanel(this);
    }

    @action.bound
    async onRebuildGlyphs() {
        try {
            const font = this.props.editor.object as Font;

            const newFont = await rebuildFont({
                font: objectToJS(font),
                projectFilePath: ProjectStore.filePath!
            });

            ProjectStore.replaceObject(font, loadObject(undefined, newFont, Font));

            notification.info(`Font rebuilded.`);
        } catch (err) {
            notification.error(`Rebuild failed (${err})!`);
        }
    }

    @action.bound
    onAddGlyph() {
        let font = this.props.editor.object as Font;
        let newGlyph = cloneObject(
            undefined,
            font.glyphs._array[font.glyphs._array.length - 1]
        ) as Glyph;
        newGlyph.encoding = newGlyph.encoding + 1;
        newGlyph = ProjectStore.addObject(font.glyphs, newGlyph) as Glyph;
        this.selectedGlyph = newGlyph;
    }

    @action.bound
    onDeleteGlyph() {
        let font = this.props.editor.object as Font;
        let selectedGlyph = this.selectedGlyph;
        if (selectedGlyph && font.glyphs._array[font.glyphs._array.length - 1] == selectedGlyph) {
            ProjectStore.deleteObject(selectedGlyph);
        }
    }

    render() {
        let font = this.props.editor.object as Font;

        let onDeleteGlyph: (() => void) | undefined;
        if (
            this.selectedGlyph &&
            font.glyphs._array[font.glyphs._array.length - 1] == this.selectedGlyph
        ) {
            onDeleteGlyph = this.onDeleteGlyph;
        }

        return (
            <Splitter
                type="vertical"
                persistId="project-editor/font-editor"
                sizes={`50%|50%`}
                tabIndex={0}
                onFocus={this.focusHander.bind(this)}
            >
                <Glyphs
                    glyphs={this.glyphs._array}
                    selectedGlyph={this.selectedGlyph}
                    onSelectGlyph={this.onSelectGlyph}
                    onDoubleClickGlyph={this.onDoubleClickGlyph}
                    onRebuildGlyphs={this.onRebuildGlyphs}
                    onAddGlyph={this.onAddGlyph}
                    onDeleteGlyph={onDeleteGlyph}
                />
                <GlyphEditor glyph={this.selectedGlyph} />
            </Splitter>
        );
    }
}

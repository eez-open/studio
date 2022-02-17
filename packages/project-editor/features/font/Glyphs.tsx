import React from "react";
import { observable, action, IObservableValue, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    drawGlyph,
    setBackColor,
    setColor
} from "project-editor/flow/editor/draw";

import { getId } from "project-editor/core/object";
import { getAncestorOfType, getLabel, IPanel } from "project-editor/core/store";

import { IconAction, TextAction } from "eez-studio-ui/action";
import { SearchInput } from "eez-studio-ui/search-input";

import { Font, Glyph } from "project-editor/features/font/font";
import { ProjectContext } from "project-editor/project/context";

export const Glyphs = observer(
    class Glyphs
        extends React.Component<{
            glyphs: Glyph[];
            selectedGlyph: IObservableValue<Glyph | undefined>;
            onSelectGlyph: (glyph: Glyph) => void;
            onDoubleClickGlyph: (glyph: Glyph) => void;
            onRebuildGlyphs?: () => void;
            onAddGlyph?: () => void;
            onDeleteGlyph?: () => void;
            onCreateShadow?: () => void;
            dialog: boolean;
        }>
        implements IPanel
    {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        searchText: string;

        list: HTMLUListElement;

        constructor(props: {
            glyphs: Glyph[];
            selectedGlyph: IObservableValue<Glyph | undefined>;
            onSelectGlyph: (glyph: Glyph) => void;
            onDoubleClickGlyph: (glyph: Glyph) => void;
            onRebuildGlyphs?: () => void;
            onAddGlyph?: () => void;
            onDeleteGlyph?: () => void;
            onCreateShadow?: () => void;
            dialog: boolean;
        }) {
            super(props);

            makeObservable(this, {
                searchText: observable,
                onSearchChange: action.bound
            });
        }

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();

            const searchText = this.searchText.toLowerCase();

            let glyph = this.props.glyphs.find(
                glyph => getLabel(glyph).toLowerCase().indexOf(searchText) != -1
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
            setTimeout(() => {
                const $selectedGlyph = $(this.list).find(".selected");
                if ($selectedGlyph.length == 1) {
                    $selectedGlyph[0].scrollIntoView({
                        block: "nearest",
                        behavior: "auto"
                    });
                }
            }, 100);
        }

        // interface IPanel implementation
        get selectedObject() {
            return this.props.selectedGlyph.get();
        }
        cutSelection() {}
        copySelection() {}
        pasteSelection() {}
        deleteSelection() {}
        onFocus = () => {
            if (!this.props.dialog) {
                this.context.navigationStore.setSelectedPanel(this);
            }
        };

        render() {
            const glyphs: JSX.Element[] = this.props.glyphs.map(glyph => (
                <GlyphComponent
                    key={getId(glyph)}
                    glyph={glyph}
                    isSelected={glyph == this.props.selectedGlyph.get()}
                    onSelect={this.props.onSelectGlyph.bind(null, glyph)}
                    onDoubleClick={this.props.onDoubleClickGlyph.bind(
                        null,
                        glyph
                    )}
                />
            ));

            let rebuildGlyphsButton: JSX.Element | undefined;
            if (!this.props.dialog && this.props.onRebuildGlyphs) {
                rebuildGlyphsButton = (
                    <TextAction
                        text="Rebuild"
                        title="Rebuild Glyphs"
                        onClick={this.props.onRebuildGlyphs}
                    />
                );
            }

            let addGlyphButton: JSX.Element | undefined;
            if (!this.props.dialog && this.props.onAddGlyph) {
                addGlyphButton = (
                    <IconAction
                        title="Add Glyph"
                        icon="material:add"
                        iconSize={16}
                        onClick={this.props.onAddGlyph}
                    />
                );
            }

            let deleteGlyphButton: JSX.Element | undefined;
            if (!this.props.dialog && this.props.onDeleteGlyph) {
                const glyph = this.props.selectedGlyph.get();
                if (glyph) {
                    const font = getAncestorOfType(
                        glyph,
                        Font.classInfo
                    ) as Font;
                    if (
                        font &&
                        font.glyphs[font.glyphs.length - 1] ==
                            this.props.selectedGlyph.get()
                    ) {
                        deleteGlyphButton = (
                            <IconAction
                                title="Delete Glyph"
                                icon="material:delete"
                                iconSize={16}
                                onClick={this.props.onDeleteGlyph}
                            />
                        );
                    }
                }
            }

            let createShadowButton: JSX.Element | undefined;
            if (!this.props.dialog && this.props.onCreateShadow) {
                // createShadowButton = (
                //     <IconAction
                //         title="Create Shadow"
                //         icon="material:grid_on"
                //         iconSize={16}
                //         onClick={this.props.onCreateShadow}
                //     />
                // );
            }

            return (
                <div
                    className="EezStudio_Glyphs"
                    onFocus={this.onFocus}
                    tabIndex={0}
                >
                    <div>
                        <div className="btn-toolbar" role="toolbar">
                            <SearchInput
                                searchText={this.searchText}
                                onChange={this.onSearchChange}
                                onKeyDown={this.onSearchChange}
                            />
                            {rebuildGlyphsButton}
                            {addGlyphButton}
                            {deleteGlyphButton}
                            {createShadowButton}
                        </div>
                    </div>
                    <div>
                        <ul ref={ref => (this.list = ref!)}>{glyphs}</ul>
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const GlyphComponent = observer(
    ({
        glyph,
        isSelected,
        onSelect,
        onDoubleClick
    }: {
        glyph: Glyph;
        isSelected: boolean;
        onSelect: () => void;
        onDoubleClick: () => void;
    }) => {
        const refDiv = React.useRef<HTMLDivElement>(null);

        const canvas = document.createElement("canvas");
        canvas.width = (glyph.glyphBitmap && glyph.glyphBitmap.width) || 1;
        canvas.height = glyph.font.height || 1;
        let ctx = canvas.getContext("2d")!;
        setColor("black");
        setBackColor("white");
        drawGlyph(ctx, -glyph.x, 0, glyph.encoding, glyph.font);

        React.useEffect(() => {
            if (refDiv.current) {
                if (refDiv.current.children[0]) {
                    refDiv.current.replaceChild(
                        canvas,
                        refDiv.current.children[0]
                    );
                } else {
                    refDiv.current.appendChild(canvas);
                }
            }
        });

        return (
            <li
                key={glyph.encoding}
                className={classNames({
                    selected: isSelected
                })}
                onClick={onSelect}
                onDoubleClick={onDoubleClick}
            >
                <div>
                    <div
                        style={{
                            width: glyph.font.maxDx,
                            height: glyph.font.height,
                            textAlign: "center"
                        }}
                        ref={refDiv}
                    ></div>
                    <div
                        style={{
                            position: "relative",
                            width: 100,
                            overflow: "visible",
                            whiteSpace: "nowrap"
                        }}
                    >
                        {getLabel(glyph)}
                    </div>
                </div>
            </li>
        );
    }
);

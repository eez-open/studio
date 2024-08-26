import React from "react";
import { observable, action, IObservableValue, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import {
    drawGlyph,
    setBackColor,
    setColor
} from "project-editor/flow/editor/eez-gui-draw";

import { getId } from "project-editor/core/object";
import { getAncestorOfType, getLabel, IPanel } from "project-editor/store";

import { IconAction } from "eez-studio-ui/action";
import { SearchInput } from "eez-studio-ui/search-input";

import { Font, Glyph } from "project-editor/features/font/font";
import { ProjectContext } from "project-editor/project/context";
import { settingsController } from "home/settings";

export const Glyphs = observer(
    class Glyphs
        extends React.Component<{
            glyphs: Glyph[];
            selectedGlyph: IObservableValue<Glyph | undefined>;
            onSelectGlyph: (glyph: Glyph) => void;
            onDoubleClickGlyph: (glyph: Glyph) => void;
            onEditGlyphs?: () => void;
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

            let glyph = this.props.glyphs.find(
                glyph => getLabel(glyph).toLowerCase().indexOf(searchText) != -1
            );

            if (glyph) {
                this.props.onSelectGlyph(glyph);
            }
        }

        componentDidMount() {
            this.ensureVisible();
            this.context.navigationStore.mountPanel(this);
        }

        componentDidUpdate() {
            this.ensureVisible();
        }

        componentWillUnmount() {
            this.context.navigationStore.unmountPanel(this);
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
        onFocus = () => {
            if (!this.props.dialog) {
                this.context.navigationStore.setSelectedPanel(this);
            }
        };

        render() {
            const glyphs: JSX.Element[] = this.props.glyphs
                .slice()
                .sort((a, b) => a.encoding - b.encoding)
                .map(glyph => (
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

            let addGlyphButton: JSX.Element | undefined;
            if (
                !this.context.projectTypeTraits.isLVGL &&
                !this.props.dialog &&
                this.props.onAddGlyph
            ) {
                addGlyphButton = (
                    <IconAction
                        title="Add Characters"
                        icon="material:add"
                        iconSize={16}
                        onClick={this.props.onAddGlyph}
                    />
                );
            }

            let deleteGlyphButton: JSX.Element | undefined;
            if (
                !this.context.projectTypeTraits.isLVGL &&
                !this.props.dialog &&
                this.props.onDeleteGlyph
            ) {
                const glyph = this.props.selectedGlyph.get();
                if (glyph) {
                    const font = getAncestorOfType(
                        glyph,
                        Font.classInfo
                    ) as Font;
                    if (font) {
                        deleteGlyphButton = (
                            <IconAction
                                title="Delete Character"
                                icon="material:delete"
                                iconSize={16}
                                onClick={this.props.onDeleteGlyph}
                            />
                        );
                    }
                }
            }

            let editGlyphsButton: JSX.Element | undefined;
            if (!this.props.dialog && this.props.onEditGlyphs) {
                editGlyphsButton = (
                    <IconAction
                        title="Add or Remove Characters"
                        icon="material:edit"
                        iconSize={16}
                        onClick={this.props.onEditGlyphs}
                    />
                );
            }

            let createShadowButton: JSX.Element | undefined;
            if (
                !this.context.projectTypeTraits.isLVGL &&
                !this.props.dialog &&
                this.props.onCreateShadow
            ) {
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
                    onContextMenu={e => e.preventDefault()}
                >
                    <div>
                        <div className="btn-toolbar" role="toolbar">
                            <SearchInput
                                searchText={this.searchText}
                                onClear={action(() => {
                                    this.searchText = "";
                                })}
                                onChange={this.onSearchChange}
                                onKeyDown={this.onSearchChange}
                            />
                            {addGlyphButton}
                            {deleteGlyphButton}
                            {editGlyphsButton}
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

        if (settingsController.isDarkTheme) {
            setColor("white");
            setBackColor("black");
        } else {
            setColor("black");
            setBackColor("white");
        }

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

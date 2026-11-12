// Previews of EEZ-GUI projects drawn with the framework WASM: a page that isn't
// in the project, built and drawn as the page editor draws a page (see
// eez-gui-editor-page.tsx). The style preview shows a Text widget in the style
// and one in its active colors, the font preview (vector fonts) sample texts in
// the font.

import React from "react";
import {
    autorun,
    computed,
    IReactionDisposer,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import { createObject } from "project-editor/store";
import { setParent } from "project-editor/core/object";
import type { Page } from "project-editor/features/page/page";
import type { Style } from "project-editor/features/style/style";
import type { Font } from "project-editor/features/font/font";
import type { Project } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getProjectWithThemes } from "project-editor/features/style/theme";
import { buildEditorAssets } from "project-editor/build/editor-build";
import { EezGuiEditorWasm } from "project-editor/flow/editor/eez-gui-editor-wasm";

// the widgets (as in the project file) of a page of the size
type GetComponents = (width: number, height: number) => any[];

const EezGuiPreview = observer(
    class EezGuiPreview extends React.Component<{
        project: Project;
        width: number;
        height: number;
        getComponents: GetComponents;
        className?: string;
    }> {
        canvasRef = React.createRef<HTMLCanvasElement>();
        editorWasm: EezGuiEditorWasm | undefined;
        wasmGeneration = observable.box(0);
        disposeAutorun: IReactionDisposer | undefined;
        unmounted = false;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                size: computed,
                previewPage: computed
            });
        }

        async createWasm() {
            const editorWasm = await EezGuiEditorWasm.create();
            if (this.unmounted) {
                return;
            }
            this.editorWasm = editorWasm;
            runInAction(() =>
                this.wasmGeneration.set(this.wasmGeneration.get() + 1)
            );
        }

        async componentDidMount() {
            await this.createWasm();
            if (this.unmounted) {
                return;
            }
            this.disposeAutorun = autorun(() => this.draw(), { delay: 30 });
        }

        componentWillUnmount() {
            this.unmounted = true;
            if (this.disposeAutorun) {
                this.disposeAutorun();
                this.disposeAutorun = undefined;
            }
        }

        // the page is drawn on the display
        get size() {
            const { displayWidth, displayHeight } =
                this.props.project.settings.general;
            return {
                width: Math.min(this.props.width, displayWidth),
                height: Math.min(this.props.height, displayHeight)
            };
        }

        get previewPage() {
            const { project } = this.props;
            const { width, height } = this.size;

            const page = createObject<Page>(
                project._store,
                {
                    name: "$preview",
                    left: 0,
                    top: 0,
                    width,
                    height,
                    components: this.props.getComponents(width, height)
                } as any,
                ProjectEditor.PageClass,
                undefined,
                true
            );

            setParent(page, project);

            return page;
        }

        draw() {
            this.wasmGeneration.get();

            const editorWasm = this.editorWasm;
            const canvas = this.canvasRef.current;
            if (!editorWasm || !canvas) {
                return;
            }

            const { project } = this.props;
            const projectStore = project._store;
            const { displayWidth, displayHeight } = project.settings.general;

            const selectedTheme =
                projectStore.navigationStore.selectedThemeObject.get();
            const themes = getProjectWithThemes(projectStore).themes;
            const themeIndex = Math.max(
                0,
                themes.findIndex(theme => theme == selectedTheme)
            );

            try {
                // what the widgets don't draw is transparent
                const assets = buildEditorAssets(this.previewPage, undefined, {
                    pageBackgroundColor: "transparent"
                });

                editorWasm.load(assets, displayWidth, displayHeight);
                editorWasm.setTheme(themeIndex);

                const { width, height } = this.size;
                canvas
                    .getContext("2d")!
                    .putImageData(editorWasm.renderPage(0, 0, width, height), 0, 0);
            } catch (err) {
                console.error("EEZ-GUI preview drawing:", err);
                if (err instanceof WebAssembly.RuntimeError) {
                    this.editorWasm = undefined;
                    this.createWasm();
                }
            }
        }

        render() {
            const { width, height } = this.size;
            return (
                <canvas
                    ref={this.canvasRef}
                    className={this.props.className}
                    width={width}
                    height={height}
                ></canvas>
            );
        }
    }
);

function textWidget(
    left: number,
    top: number,
    width: number,
    height: number,
    text: string,
    style: any
) {
    return {
        type: "Text",
        left,
        top,
        width,
        height,
        text,
        style
    };
}

export const EezGuiStylePreview = observer(
    class EezGuiStylePreview extends React.Component<{
        project: Project;
        style: Style;
        width: number;
        height: number;
        text: string;
        // a blinking style is shown in turns in its colors and in its active
        // colors
        inverse: boolean;
    }> {
        getComponents = (width: number, height: number) => {
            const { style, text } = this.props;

            // the framework blinks a blinking style on its own, the preview
            // shows the two colors in turns
            const normalStyle = { useStyle: style.name, blink: false };
            const activeStyle = {
                useStyle: style.name,
                blink: false,
                color: style.activeColorProperty,
                backgroundColor: style.activeBackgroundColorProperty
            };

            if (style.blinkProperty) {
                return [
                    textWidget(
                        0,
                        0,
                        width,
                        height,
                        text,
                        this.props.inverse ? activeStyle : normalStyle
                    )
                ];
            }

            if (width > height) {
                const w = Math.floor(width / 2) - 4;
                return [
                    textWidget(0, 0, w, height, text, normalStyle),
                    textWidget(width - w, 0, w, height, text, activeStyle)
                ];
            }

            const h = Math.floor(height / 2) - 4;
            return [
                textWidget(0, 0, width, h, text, normalStyle),
                textWidget(0, height - h, width, h, text, activeStyle)
            ];
        };

        render() {
            const { project, style, width, height, inverse } = this.props;
            // read here, so a change of the style draws the preview again
            style.blinkProperty;
            inverse;
            return (
                <EezGuiPreview
                    project={project}
                    width={width}
                    height={height}
                    getComponents={this.getComponents}
                    className="EezStudio_StyleEditorImg"
                />
            );
        }
    }
);

const FONT_PREVIEW_LINES = [
    "The quick brown fox jumps over the lazy dog",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz",
    "0123456789 +-*/=.,:;%()[] 12.345 V 0.500 A",
    "ÀÉÎÕÜ àéîõü ßæø €£µ°±Ω"
];

// The sample texts in a vector font, in the colors of the default style.
export const EezGuiFontPreview = observer(
    class EezGuiFontPreview extends React.Component<{
        project: Project;
        font: Font;
    }> {
        getComponents = (width: number, height: number) => {
            const lineHeight = this.lineHeight;
            return FONT_PREVIEW_LINES.map((text, i) =>
                textWidget(0, i * lineHeight, width, lineHeight, text, {
                    useStyle: "default",
                    font: this.props.font.name,
                    alignHorizontal: "left",
                    alignVertical: "center",
                    padding: "0 8"
                })
            );
        };

        get lineHeight() {
            return Math.max(this.props.font.height || 0, 8) + 8;
        }

        render() {
            const { project, font } = this.props;
            // read here, so a change of the font draws the preview again
            font.name;
            font.source?.filePath;
            font.source?.size;
            font.vectorFeatures;
            font.vectorLetterSpacing;
            return (
                <EezGuiPreview
                    project={project}
                    width={project.settings.general.displayWidth}
                    height={FONT_PREVIEW_LINES.length * this.lineHeight}
                    getComponents={this.getComponents}
                />
            );
        }
    }
);

// The style preview of EEZ-GUI projects drawn with the framework WASM: a page
// that isn't in the project, with a Text widget in the style and one in the
// active colors of the style, built and drawn as the page editor draws a page
// (see eez-gui-editor-page.tsx).

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
import type { Project } from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getProjectWithThemes } from "project-editor/features/style/theme";
import { buildEditorAssets } from "project-editor/build/editor-build";
import { EezGuiEditorWasm } from "project-editor/flow/editor/eez-gui-editor-wasm";

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
            const { project, style, text } = this.props;
            const { width, height } = this.size;

            // the framework blinks a blinking style on its own, the preview
            // shows the two colors in turns
            const normalStyle = { useStyle: style.name, blink: false };
            const activeStyle = {
                useStyle: style.name,
                blink: false,
                color: style.activeColorProperty,
                backgroundColor: style.activeBackgroundColorProperty
            };

            const textWidget = (
                left: number,
                top: number,
                width: number,
                height: number,
                style: any
            ) => ({
                type: "Text",
                left,
                top,
                width,
                height,
                text,
                style
            });

            let components;
            if (style.blinkProperty) {
                components = [
                    textWidget(
                        0,
                        0,
                        width,
                        height,
                        this.props.inverse ? activeStyle : normalStyle
                    )
                ];
            } else if (width > height) {
                const w = Math.floor(width / 2) - 4;
                components = [
                    textWidget(0, 0, w, height, normalStyle),
                    textWidget(width - w, 0, w, height, activeStyle)
                ];
            } else {
                const h = Math.floor(height / 2) - 4;
                components = [
                    textWidget(0, 0, width, h, normalStyle),
                    textWidget(0, height - h, width, h, activeStyle)
                ];
            }

            const page = createObject<Page>(
                project._store,
                {
                    name: "$style_preview",
                    left: 0,
                    top: 0,
                    width,
                    height,
                    components: components as any
                },
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
                console.error("EEZ-GUI style preview drawing:", err);
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
                    className="EezStudio_StyleEditorImg"
                    width={width}
                    height={height}
                ></canvas>
            );
        }
    }
);

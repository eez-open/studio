// The page editor of EEZ-GUI projects draws the page with the framework WASM:
// the editor build of the page (build/editor-build.ts) is loaded into an
// EezGuiEditorWasm and the frame is drawn into a canvas, under the transparent
// widget enclosures that the editor uses for selection. The boxes of the
// widgets as the framework laid them out are kept (eez-gui-editor-boxes.ts):
// the enclosures of the children of rows, columns and scrolling containers
// are placed there. A scrolling container is drawn with the scroll position
// set in the editor (Alt + mouse wheel or Alt + drag, eez-gui-editor-boxes.ts).

import React from "react";
import {
    autorun,
    computed,
    IReactionDisposer,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import type { Page } from "project-editor/features/page/page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { Widget } from "project-editor/flow/component";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import { getEditorPageLayout } from "project-editor/features/page/page-layouts";
import { getProjectWithThemes } from "project-editor/features/style/theme";
import type { IEezObject } from "project-editor/core/object";
import type { Rect } from "eez-studio-shared/geometry";
import { buildEditorAssets } from "project-editor/build/editor-build";
import { getFlowGuiDisplaySize } from "project-editor/build/assets";
import { EezGuiEditorWasm } from "project-editor/flow/editor/eez-gui-editor-wasm";
import {
    getEditorScrollPositions,
    setDrawnScrollPosition,
    setEditorWidgetBoxes
} from "project-editor/flow/editor/eez-gui-editor-boxes";

type EditorBuild = {
    assets: ReturnType<typeof buildEditorAssets>;
    widgetOffsets: Map<number, Widget | Page>;
    offsetOfWidget: Map<IEezObject, number>;
};

export const EezGuiEditorPage = observer(
    class EezGuiEditorPage extends React.Component<{
        page: Page;
        flowContext: IFlowContext;
    }> {
        canvasRef = React.createRef<HTMLCanvasElement>();
        editorWasm: EezGuiEditorWasm | undefined;
        // a new WASM instance (after an abort) draws the page again
        wasmGeneration = observable.box(0);
        disposeAutorun: IReactionDisposer | undefined;
        unmounted = false;
        // the build loaded into editorWasm
        loadedBuild: EditorBuild | undefined;

        // The editor build of the page: built again only when something it
        // read has changed (not when a container is scrolled in the editor).
        // widgetOffsets: the widgets at the offsets in the assets data, and
        // the other way around.
        editorBuild = computed((): EditorBuild => {
            const { page, flowContext } = this.props;
            const widgetOffsets = new Map<number, Widget | Page>();
            const assets = buildEditorAssets(page, getEditorPageLayout(page), {
                getSelectChildIndex: (select: Widget) =>
                    (select as any).getSelectedIndex(flowContext),
                pageBackgroundColor: this.previewBackgroundColor,
                widgetOffsets
            });
            const offsetOfWidget = new Map<IEezObject, number>();
            for (const [offset, widget] of widgetOffsets) {
                if (!offsetOfWidget.has(widget)) {
                    offsetOfWidget.set(widget, offset);
                }
            }
            return { assets, widgetOffsets, offsetOfWidget };
        });

        async createWasm() {
            const editorWasm = await EezGuiEditorWasm.create();
            if (this.unmounted) {
                return;
            }
            this.editorWasm = editorWasm;
            this.loadedBuild = undefined;
            runInAction(() =>
                this.wasmGeneration.set(this.wasmGeneration.get() + 1)
            );
        }

        async componentDidMount() {
            await this.createWasm();
            if (this.unmounted) {
                return;
            }

            // runs again when something the page build read has changed;
            // throttled while the user drags or resizes
            this.disposeAutorun = autorun(() => this.draw(), { delay: 30 });
        }

        componentWillUnmount() {
            this.unmounted = true;
            if (this.disposeAutorun) {
                this.disposeAutorun();
                this.disposeAutorun = undefined;
            }
        }

        // where the page is (in the page layout of the editor), in the editor
        // and on the display
        get pageRect() {
            return this.props.page.pageRect;
        }

        draw() {
            this.wasmGeneration.get();

            const { page, flowContext } = this.props;
            const editorWasm = this.editorWasm;
            const canvas = this.canvasRef.current;
            if (!editorWasm || !canvas) {
                return;
            }

            const projectStore = flowContext.projectStore;
            // as the Studio runtime: a page larger than the display size of
            // the settings is drawn whole
            const { width: displayWidth, height: displayHeight } =
                getFlowGuiDisplaySize(projectStore.project);

            // the display of a WASM instance has the size of its first load
            if (
                editorWasm.displayWidth &&
                (editorWasm.displayWidth != displayWidth ||
                    editorWasm.displayHeight != displayHeight)
            ) {
                this.editorWasm = undefined;
                this.createWasm();
                return;
            }

            const selectedTheme =
                projectStore.navigationStore.selectedThemeObject.get();
            const themes = getProjectWithThemes(projectStore).themes;
            const themeIndex = Math.max(
                0,
                themes.findIndex(theme => theme == selectedTheme)
            );

            try {
                const build = this.editorBuild.get();
                const { widgetOffsets, offsetOfWidget } = build;

                if (build !== this.loadedBuild) {
                    editorWasm.load(build.assets, displayWidth, displayHeight);
                    this.loadedBuild = build;
                }
                editorWasm.setTheme(themeIndex);

                // the positions of the containers of this page scrolled in
                // the editor
                const scrollPositions: number[] = [];
                for (const [widget, position] of getEditorScrollPositions()) {
                    const offset = offsetOfWidget.get(widget);
                    if (offset != undefined) {
                        scrollPositions.push(offset, position);
                    }
                }
                editorWasm.setScrollPositions(scrollPositions);

                const { left, top, width, height } = this.pageRect;
                const imageData = editorWasm.renderPage(
                    left,
                    top,
                    width,
                    height
                );
                canvas.getContext("2d")!.putImageData(imageData, 0, 0);

                // where the framework laid out the widgets (rows, columns and
                // the children of the scrolled containers), and the scroll
                // positions it drew
                const boxes = new Map<IEezObject, Rect>();
                for (const box of editorWasm.getWidgetBoxes()) {
                    const widget = widgetOffsets.get(box.offset);
                    if (widget && !boxes.has(widget)) {
                        boxes.set(widget, {
                            left: box.left,
                            top: box.top,
                            width: box.width,
                            height: box.height
                        });
                        if (box.scrollPosition >= 0) {
                            setDrawnScrollPosition(
                                widget,
                                box.scrollPosition,
                                box.maxScrollPosition
                            );
                        }
                    }
                }
                setEditorWidgetBoxes(page, boxes);
            } catch (err) {
                console.error("EEZ-GUI page editor drawing:", err);
                // the WASM instance can't be used after an abort
                if (err instanceof WebAssembly.RuntimeError) {
                    this.editorWasm = undefined;
                    this.createWasm();
                }
            }
        }

        // a user widget page opened in its editor can be shown on a chosen
        // background (a theme color name or a color value), drawn in place of
        // the background of the page style
        get previewBackgroundColor() {
            const { page, flowContext } = this.props;
            if (!page.isUsedAsUserWidget) {
                return undefined;
            }
            const editor =
                flowContext.projectStore.editorsStore?.getEditorByObject(page);
            return (
                (editor?.state as PageTabState | undefined)
                    ?.previewBackgroundColor || undefined
            );
        }

        render() {
            const { left, top, width, height } = this.pageRect;
            return (
                <canvas
                    ref={this.canvasRef}
                    width={width}
                    height={height}
                    style={{
                        position: "absolute",
                        left,
                        top,
                        imageRendering:
                            this.props.flowContext.viewState.transform.scale > 2
                                ? "pixelated"
                                : "auto",
                        pointerEvents: "none"
                    }}
                ></canvas>
            );
        }
    }
);

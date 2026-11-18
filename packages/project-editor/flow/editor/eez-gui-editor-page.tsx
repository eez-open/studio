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
    runInAction,
    untracked
} from "mobx";
import { observer } from "mobx-react";

import type { Page } from "project-editor/features/page/page";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import type { Widget } from "project-editor/flow/component";
import type { PageTabState } from "project-editor/features/page/PageEditor";
import { getProjectWithThemes } from "project-editor/features/style/theme";
import type { IEezObject } from "project-editor/core/object";
import type { Rect } from "eez-studio-shared/geometry";
import {
    buildEditorAssets,
    getEditorListItemCount
} from "project-editor/build/editor-build";
import { visitObjects } from "project-editor/core/search";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { getFlowGuiDisplaySize } from "project-editor/build/assets";
import { EezGuiEditorWasm } from "project-editor/flow/editor/eez-gui-editor-wasm";
import {
    getEditorScrollPositions,
    getEditorWidgetBox,
    setDrawnScrollPosition,
    setEditorWidgetBoxes
} from "project-editor/flow/editor/eez-gui-editor-boxes";

function isSameMap<K, V>(a: Map<K, V>, b: Map<K, V>) {
    if (a.size != b.size) {
        return false;
    }
    for (const [key, value] of a) {
        if (b.get(key) !== value) {
            return false;
        }
    }
    return true;
}

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
        disposeBuildAutorun: IReactionDisposer | undefined;
        unmounted = false;
        // the build loaded into editorWasm
        loadedBuild: EditorBuild | undefined;

        // The editor build of the page: built again only when something it
        // read has changed (not when a container is scrolled in the editor).
        // widgetOffsets: the widgets at the offsets in the assets data, and
        // the other way around.
        //
        // It is built by a reaction of its own, after the next paint, and
        // kept here for draw(). As a computed value read by draw() it was
        // built inside of the change itself (MobX computes a stale value to
        // see if the reaction must run), so a click that changed the build
        // waited for it before the selection was shown.
        editorBuild = observable.box<EditorBuild | undefined>(undefined, {
            deep: false
        });

        // The child every Select of the page shows: the one with the
        // selection. It is the only thing of the selection the build reads,
        // and it is the same after most changes of the selection, so the
        // build depends on this value and not on the selection: a click on
        // another widget doesn't build the page again (some hundred ms).
        selectChildIndexes = computed(
            (): Map<Widget, number> => {
                const { page, flowContext } = this.props;
                const indexes = new Map<Widget, number>();
                for (const object of visitObjects(page.components)) {
                    if (object instanceof ProjectEditor.SelectWidgetClass) {
                        indexes.set(
                            object,
                            object.getSelectedIndex(flowContext)
                        );
                    }
                }
                return indexes;
            },
            { equals: isSameMap }
        );

        // The number of items every List and Grid of the page shows: as many
        // as fit in it. The size is the one the framework drew it with (a
        // list in a row or column can grow), the design size before the first
        // draw. The build depends on the counts and not on the boxes, so it
        // is built again only when a count has changed.
        listItemCounts = computed(
            (): Map<Widget, number> => {
                const { page } = this.props;
                const counts = new Map<Widget, number>();
                for (const object of visitObjects(page.components)) {
                    if (
                        object instanceof ProjectEditor.ListWidgetClass ||
                        object instanceof ProjectEditor.GridWidgetClass
                    ) {
                        const box = getEditorWidgetBox(object);
                        counts.set(
                            object,
                            getEditorListItemCount(
                                object,
                                box?.width,
                                box?.height
                            )
                        );
                    }
                }
                return counts;
            },
            { equals: isSameMap }
        );

        buildPage(): EditorBuild {
            const { page, flowContext } = this.props;
            const widgetOffsets = new Map<number, Widget | Page>();
            const selectChildIndexes = this.selectChildIndexes.get();
            const listItemCounts = this.listItemCounts.get();
            const assets = buildEditorAssets(page, {
                // a Select of a user widget page is not in the map: the
                // selection is never inside of it
                getSelectChildIndex: (select: Widget) =>
                    selectChildIndexes.get(select) ??
                    untracked(() =>
                        (select as any).getSelectedIndex(flowContext)
                    ),
                // a List or Grid of a user widget page shows the items that
                // fit in its design size
                getListItemCount: (widget: Widget) =>
                    listItemCounts.get(widget) ??
                    getEditorListItemCount(widget),
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
        }

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

            // runs again when something the page build read has changed,
            // after the browser has painted what the change itself shows
            // (the selection)
            this.disposeBuildAutorun = autorun(
                () => {
                    let build: EditorBuild | undefined;
                    try {
                        build = this.buildPage();
                    } catch (err) {
                        console.error("EEZ-GUI page editor build:", err);
                        return;
                    }
                    runInAction(() => this.editorBuild.set(build));
                },
                {
                    scheduler: run =>
                        requestAnimationFrame(() => setTimeout(run, 0))
                }
            );

            // runs again after a build and when a container is scrolled;
            // throttled while the user drags or resizes
            this.disposeAutorun = autorun(() => this.draw(), { delay: 30 });
        }

        componentWillUnmount() {
            this.unmounted = true;
            if (this.disposeAutorun) {
                this.disposeAutorun();
                this.disposeAutorun = undefined;
            }
            if (this.disposeBuildAutorun) {
                this.disposeBuildAutorun();
                this.disposeBuildAutorun = undefined;
            }
        }

        // where the page is, in the editor and on the display
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
                if (!build) {
                    return;
                }
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

import { ipcRenderer } from "electron";
import { autorun, observable, runInAction } from "mobx";
import fs from "fs";

import { Message, ProjectStore, Section } from "project-editor/store";

import { loadProjectEditor } from "project-editor/project-editor-loader";

// --render-page: draw one page the way the page editor does (editor build +
// framework WASM) into a PNG file, and report the times
export interface RenderPageOptions {
    pageName: string;
    outFile: string;
    themeIndex?: number;
    pageLayoutName?: string;
    // the child every Select shows (default: the first)
    selectChildIndex?: number;
    // the preview background of a user widget page (a theme color name or a
    // color value)
    background?: string;
}

async function renderPage(projectStore: ProjectStore, options: RenderPageOptions) {
    const { findPage } = await import("project-editor/project/project");
    const { getPageLayouts } = await import(
        "project-editor/features/page/page-layouts"
    );
    const { buildEditorAssets } = await import(
        "project-editor/build/editor-build"
    );
    const { EezGuiEditorWasm } = await import(
        "project-editor/flow/editor/eez-gui-editor-wasm"
    );

    const log = (text: string) =>
        ipcRenderer.send("on-build-project-message", text);

    const page = findPage(projectStore.project, options.pageName);
    if (!page) {
        log(`Page not found: ${options.pageName}`);
        return;
    }

    const pageLayout = options.pageLayoutName
        ? getPageLayouts(page).find(
              pageLayout => pageLayout.name == options.pageLayoutName
          )
        : undefined;
    const width = pageLayout ? pageLayout.width : page.width;
    const height = pageLayout ? pageLayout.height : page.height;

    // the display of the page editor (getFlowGuiDisplaySize)
    const { getFlowGuiDisplaySize } = await import(
        "project-editor/build/assets"
    );
    const { width: displayWidth, height: displayHeight } =
        getFlowGuiDisplaySize(projectStore.project);

    // the editor build doesn't wait for the images (it runs again when they
    // are loaded), here they are loaded before
    const { preloadAllBitmaps } = await import(
        "project-editor/features/bitmap/bitmap"
    );
    await preloadAllBitmaps(projectStore);

    let t = performance.now();
    const editorWasm = await EezGuiEditorWasm.create();
    const createTime = performance.now() - t;

    // the build runs inside an autorun, as in the page editor: the first run is
    // the build when the page is opened, the next ones are rebuilds after a
    // change (the trigger), with the computed values cached
    const trigger = observable.box(0);
    const buildTimes: number[] = [];
    const loadRenderTimes: number[] = [];
    let assetsSize = 0;
    let imageData: ImageData | undefined;
    const dispose = autorun(() => {
        trigger.get();

        let t = performance.now();
        const assets = buildEditorAssets(page, pageLayout, {
            getSelectChildIndex: () => options.selectChildIndex ?? 0,
            pageBackgroundColor: options.background
        });
        buildTimes.push(performance.now() - t);
        assetsSize = assets.length;

        t = performance.now();
        editorWasm.load(assets, displayWidth, displayHeight);
        if (options.themeIndex != undefined) {
            editorWasm.setTheme(options.themeIndex);
        }
        imageData = editorWasm.renderPage(page.left, page.top, width, height);
        loadRenderTimes.push(performance.now() - t);
    });

    const rebuild = () => runInAction(() => trigger.set(trigger.get() + 1));

    for (let i = 0; i < 12; i++) {
        rebuild();
    }

    // EEZ_PROFILE_RENDER=<file>: CPU profile of 20 rebuilds (for measuring)
    const profileFile = process.env.EEZ_PROFILE_RENDER;
    if (profileFile) {
        await ipcRenderer.invoke("render-page-profile", "start");
        for (let i = 0; i < 20; i++) {
            rebuild();
        }
        await ipcRenderer.invoke("render-page-profile", "stop", profileFile);
        log(`Profile written to ${profileFile}`);
    }

    dispose();

    const canvas = document.createElement("canvas");
    canvas.width = imageData!.width;
    canvas.height = imageData!.height;
    canvas.getContext("2d")!.putImageData(imageData!, 0, 0);
    const png = canvas.toDataURL("image/png").split(",")[1];
    fs.writeFileSync(options.outFile, Buffer.from(png, "base64"));

    const ms = (times: number[]) => times.map(t => t.toFixed(1)).join(", ");
    log(
        `Rendered ${options.pageName} (${imageData!.width}x${imageData!.height}) to ${options.outFile}`
    );
    log(`Assets: ${assetsSize} bytes, WASM create ${createTime.toFixed(1)} ms`);
    log(`Build (ms): ${ms(buildTimes.slice(0, 13))}`);
    log(`Load + render (ms): ${ms(loadRenderTimes.slice(0, 13))}`);
}

export async function buildProject(
    filePath: string,
    renderPageOptions?: RenderPageOptions
) {
    ipcRenderer.send("on-build-project-message", "Build project: " + filePath);

    try {
        await loadProjectEditor();

        const projectStore = ProjectStore.create({
            type: "read-only"
        });

        await projectStore.openFile(filePath);

        // dump build messages
        const messages =
            projectStore.outputSectionsStore.sections[Section.OUTPUT].messages;
        let lastMessageIndexDumped = -1;
        autorun(() => {
            let messageIndex = 0;
            function dumpMessages(messages: Message[], indent: string) {
                for (let i = 0; i < messages.length; i++, messageIndex++) {
                    const message = messages[i];
                    if (messageIndex > lastMessageIndexDumped) {
                        lastMessageIndexDumped = messageIndex;

                        ipcRenderer.send(
                            "on-build-project-message",
                            indent + message.text
                        );
                    }
                    if (message.messages) {
                        dumpMessages(message.messages, indent + "\t");
                    }
                }
            }
            dumpMessages(messages.messages, "");
        });

        if (renderPageOptions) {
            await renderPage(projectStore, renderPageOptions);
        } else {
            await projectStore.build();
        }
    } catch (err: any) {
        ipcRenderer.send(
            "on-build-project-message",
            "Unhandled error: " + err.toString()
        );
    }

    ipcRenderer.send("on-build-project-message", undefined);
}

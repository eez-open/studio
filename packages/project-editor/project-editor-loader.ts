import { observable, runInAction } from "mobx";

// The project editor (every widget and action class, the WASM runtimes,
// LVGL, ...) is a large module graph, so it is loaded on demand instead of
// before the first paint of the home window.

export const projectEditorLoaded = observable.box(false);

let loadPromise: Promise<void> | undefined;

export function loadProjectEditor() {
    if (!loadPromise) {
        loadPromise = (async () => {
            const [{ initProjectEditor }, { tabs, ProjectEditorTab }] =
                await Promise.all([
                    import("project-editor/project-editor-bootstrap"),
                    import("home/tabs-store")
                ]);

            initProjectEditor(tabs, ProjectEditorTab);

            runInAction(() => projectEditorLoaded.set(true));
        })();
    }
    return loadPromise;
}

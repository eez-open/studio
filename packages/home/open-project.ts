import { tabs } from "home/tabs-store";

export function openProject(filePath: string) {
    try {
        let tab = tabs.findProjectEditorTab(filePath);
        if (!tab) {
            tab = tabs.addProjectTab(filePath);
        }
        if (tab) {
            tab.makeActive();
        }
    } catch (err) {
        console.error(err);
    }
}

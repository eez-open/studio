import React from "react";
import {
    observable,
    action,
    runInAction,
    reaction,
    autorun,
    computed
} from "mobx";
import * as path from "path";

import { onSimpleMessage } from "eez-studio-shared/util";

import {
    loadPreinstalledExtension,
    extensions
} from "eez-studio-shared/extensions/extensions";
import { IEditor, IHomeSection } from "eez-studio-shared/extensions/extension";

import { ITab } from "eez-studio-ui/tabs";
import { Icon } from "eez-studio-ui/icon";

import {
    HistoryView,
    showSessionsList
} from "instrument/window/history/history-view";

import { WorkbenchObject, workbenchObjects } from "home/store";
import * as DesignerModule from "home/designer/designer";
import * as HistoryModule from "home/history";
import * as ShortcutsModule from "home/shortcuts";
import * as ExtensionsManagerModule from "home/extensions-manager/extensions-manager";
import * as SettingsModule from "home/settings";
import { DocumentStoreClass } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project/ProjectEditor";

////////////////////////////////////////////////////////////////////////////////

export interface IHomeTab extends ITab {
    editor?: IEditor;
    render(): JSX.Element;
    attention?: boolean;
    beforeAppClose?(): Promise<void>;
}

////////////////////////////////////////////////////////////////////////////////

class WorkbenchTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    id = "workbench";
    title = "Workbench";
    icon = "material:developer_board";

    render() {
        const {
            Designer
        } = require("home/designer/designer") as typeof DesignerModule;
        return <Designer />;
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class HistoryTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    id = "history";
    title = "History";
    icon = "material:history";

    render() {
        if (tabs.viewDeletedHistory) {
            const {
                DeletedHistoryItemsSection
            } = require("home/history") as typeof HistoryModule;
            return <DeletedHistoryItemsSection />;
        } else {
            const {
                HistorySection
            } = require("home/history") as typeof HistoryModule;
            return <HistorySection />;
        }
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class ShortcutsAndGroupsTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    id = "shortcutsAndGroups";
    title = "Shortcuts and Groups";
    icon = "material:playlist_play";

    render() {
        const {
            ShortcutsAndGroups
        } = require("home/shortcuts") as typeof ShortcutsModule;
        return <ShortcutsAndGroups />;
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class ExtensionManagerTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    id = "extensions";
    title = "Extension Manager";

    @computed
    get numNewVersions() {
        const {
            extensionsManagerStore
        } = require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
        return extensionsManagerStore.newVersions.length;
    }

    get icon() {
        return (
            <Icon
                icon="material:extension"
                attention={this.numNewVersions > 0}
            />
        );
    }

    @computed
    get tooltipTitle() {
        const {
            extensionsManagerStore
        } = require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;

        let title = this.title;
        if (this.numNewVersions > 1) {
            title += ` (${extensionsManagerStore.newVersions.length} new versions)`;
        } else if (this.numNewVersions === 1) {
            title += " (1 new version)";
        }

        return title;
    }

    @computed
    get attention() {
        return this.numNewVersions > 0;
    }

    render() {
        const {
            ExtensionsManager
        } = require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
        return <ExtensionsManager />;
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class SettingsTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    id = "settings";
    title = "Settings";

    @computed
    get attention() {
        const {
            settingsController
        } = require("home/settings") as typeof SettingsModule;
        return settingsController.isCompactDatabaseAdvisable;
    }

    get icon() {
        return <Icon icon="material:settings" attention={this.attention} />;
    }

    get tooltipTitle() {
        if (this.attention) {
            const {
                COMPACT_DATABASE_MESSAGE
            } = require("home/settings") as typeof SettingsModule;
            return COMPACT_DATABASE_MESSAGE;
        } else {
            return this.title;
        }
    }

    render() {
        const { Settings } = require("home/settings") as typeof SettingsModule;
        return <Settings />;
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

class HomeSectionTab implements IHomeTab {
    constructor(public tabs: Tabs, public homeSection: IHomeSection) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    get id() {
        return "homeSection_" + this.homeSection.id;
    }
    get title() {
        return this.homeSection.title;
    }
    get icon() {
        return this.homeSection.icon;
    }

    render() {
        return this.homeSection.renderContent();
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

class ObjectEditorTab implements IHomeTab {
    constructor(public tabs: Tabs, public object: WorkbenchObject) {
        this.editor = this.object.getEditor();
        this.editor.onCreate();
    }

    editor: IEditor;

    permanent: boolean = true;
    @observable _active: boolean = false;

    loading = false;

    get active() {
        return this._active;
    }

    set active(value: boolean) {
        if (value !== this._active) {
            runInAction(() => (this._active = value));

            if (this._active) {
                this.editor.onActivate();
            } else {
                this.editor.onDeactivate();
            }
        }
    }

    get id() {
        return this.object.id;
    }

    get title() {
        return this.object.name;
    }

    get icon() {
        return this.object.getIcon();
    }

    render() {
        return this.editor.render();
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    openInWindow() {
        this.object.openEditor!("window");
    }

    close() {
        this.tabs.removeTab(this);
        this.editor.onTerminate();
    }

    beforeAppClose() {
        return this.editor.onBeforeAppClose();
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ProjectEditorTab implements IHomeTab {
    static ID_PREFIX = "PROJECT_TAB_";

    static async addTab(filePath?: string) {
        const { DocumentStoreClass } = await import(
            "project-editor/core/store"
        );

        const DocumentStore = await DocumentStoreClass.create();
        if (filePath) {
            await DocumentStore.openFile(filePath);
        } else {
            DocumentStore.newProject();
        }

        DocumentStore.waitUntilready();

        return tabs.addProjectTab(DocumentStore);
    }

    constructor(public tabs: Tabs, public DocumentStore: DocumentStoreClass) {}

    permanent: boolean = true;
    @observable _active: boolean = false;
    loading: boolean = false;

    get active() {
        return this._active;
    }

    removeListeners: (() => void) | undefined;

    set active(value: boolean) {
        if (value !== this._active) {
            runInAction(() => (this._active = value));
            if (this._active) {
                this.removeListeners = this.addListeners();
            } else {
                if (this.removeListeners) {
                    this.removeListeners();
                    this.removeListeners = undefined;
                }
            }
        }
    }

    addListeners() {
        const save = () => {
            this.DocumentStore.save();
        };
        const saveAs = () => {
            this.DocumentStore.saveAs();
        };
        const check = () => {
            this.DocumentStore.check();
        };
        const build = () => {
            this.DocumentStore.build();
        };
        const buildExtensions = () => {
            this.DocumentStore.buildExtensions();
        };
        const undo = () => {
            this.DocumentStore.UndoManager.undo();
        };
        const redo = () => {
            this.DocumentStore.UndoManager.redo();
        };
        const cut = () => {
            if (this.DocumentStore.NavigationStore.selectedPanel)
                this.DocumentStore.NavigationStore.selectedPanel.cutSelection();
        };
        const copy = () => {
            if (this.DocumentStore.NavigationStore.selectedPanel)
                this.DocumentStore.NavigationStore.selectedPanel.copySelection();
        };
        const paste = () => {
            if (this.DocumentStore.NavigationStore.selectedPanel)
                this.DocumentStore.NavigationStore.selectedPanel.pasteSelection();
        };
        const deleteSelection = () => {
            if (this.DocumentStore.NavigationStore.selectedPanel)
                this.DocumentStore.NavigationStore.selectedPanel.deleteSelection();
        };
        const toggleOutput = action(() => {
            this.DocumentStore.UIStateStore.viewOptions.outputVisible = !this
                .DocumentStore.UIStateStore.viewOptions.outputVisible;
        });
        const showMetrics = () => this.DocumentStore.showMetrics();

        EEZStudio.electron.ipcRenderer.on("save", save);
        EEZStudio.electron.ipcRenderer.on("saveAs", saveAs);
        EEZStudio.electron.ipcRenderer.on("check", check);
        EEZStudio.electron.ipcRenderer.on("build", build);
        EEZStudio.electron.ipcRenderer.on("build-extensions", buildExtensions);
        EEZStudio.electron.ipcRenderer.on("undo", undo);
        EEZStudio.electron.ipcRenderer.on("redo", redo);
        EEZStudio.electron.ipcRenderer.on("cut", cut);
        EEZStudio.electron.ipcRenderer.on("copy", copy);
        EEZStudio.electron.ipcRenderer.on("paste", paste);
        EEZStudio.electron.ipcRenderer.on("delete", deleteSelection);
        EEZStudio.electron.ipcRenderer.on("toggleOutput", toggleOutput);
        EEZStudio.electron.ipcRenderer.on("showProjectMetrics", showMetrics);

        return () => {
            EEZStudio.electron.ipcRenderer.removeListener("save", save);
            EEZStudio.electron.ipcRenderer.removeListener("saveAs", saveAs);
            EEZStudio.electron.ipcRenderer.removeListener("check", check);
            EEZStudio.electron.ipcRenderer.removeListener("build", build);
            EEZStudio.electron.ipcRenderer.removeListener(
                "build-extensions",
                buildExtensions
            );
            EEZStudio.electron.ipcRenderer.removeListener("undo", undo);
            EEZStudio.electron.ipcRenderer.removeListener("redo", redo);
            EEZStudio.electron.ipcRenderer.removeListener("cut", cut);
            EEZStudio.electron.ipcRenderer.removeListener("copy", copy);
            EEZStudio.electron.ipcRenderer.removeListener("paste", paste);
            EEZStudio.electron.ipcRenderer.removeListener(
                "delete",
                deleteSelection
            );
            EEZStudio.electron.ipcRenderer.removeListener(
                "toggleOutput",
                toggleOutput
            );
            EEZStudio.electron.ipcRenderer.removeListener(
                "showProjectMetrics",
                showMetrics
            );
        };
    }

    get id() {
        return ProjectEditorTab.ID_PREFIX + this.DocumentStore.filePath || "";
    }

    get title() {
        return (
            path.parse(this.DocumentStore.filePath || "").name ||
            "Untitled project"
        );
    }

    get icon() {
        return <Icon icon="material:developer_board" />;
    }

    render() {
        return (
            <ProjectContext.Provider value={this.DocumentStore}>
                <ProjectEditor />
            </ProjectContext.Provider>
        );
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.DocumentStore.saveModified(() => this.tabs.removeTab(this));
    }

    beforeAppClose() {
        return this.DocumentStore.closeWindow();
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ITabDefinition {
    instance: IHomeTab;
    open: () => IHomeTab;
    selectItem?: (itemId: string) => void;
}

////////////////////////////////////////////////////////////////////////////////

interface ISavedTab {
    id: string;
    active: boolean;
}

class Tabs {
    @observable _firstTime: boolean;
    @observable tabs: IHomeTab[] = [];
    @observable activeTab: IHomeTab;

    constructor() {
        this._firstTime = EEZStudio.electron.ipcRenderer.sendSync(
            "getFirstTime"
        );

        loadPreinstalledExtension("instrument").then(async () => {
            if (!this.firstTime) {
                const tabsJSON = window.localStorage.getItem("home/tabs");
                if (tabsJSON) {
                    const savedTabs: ISavedTab[] = JSON.parse(tabsJSON);

                    for (const savedTab of savedTabs) {
                        if (savedTab.id) {
                            try {
                                await this.openTabById(
                                    savedTab.id,
                                    savedTab.active
                                );
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }

                    if (this.tabs.length == 0) {
                        this.openTabById("workbench", true);
                    }
                }
            }
        });

        reaction(
            () =>
                this.tabs.map(
                    tab =>
                        ({
                            id: tab.id,
                            active: tab.active
                        } as ISavedTab)
                ),
            tabs => {
                const tabsJSON = JSON.stringify(tabs);
                window.localStorage.setItem("home/tabs", tabsJSON);
                EEZStudio.electron.ipcRenderer.send("tabs-change", tabsJSON);
            }
        );

        autorun(() => {
            const tabsToClose = this.tabs.filter(
                tab =>
                    tab instanceof ObjectEditorTab &&
                    !workbenchObjects.get(tab.id)
            ) as ObjectEditorTab[];

            tabsToClose.forEach(tab => tab.close());
        });

        EEZStudio.electron.ipcRenderer.on(
            "openTab",
            action((sender: any, tabId: string) => {
                this.openTabById(tabId, true);
            })
        );

        autorun(() => {
            if (this.activeTab) {
                document.title = `${this.activeTab.title} - Home - EEZ Studio`;
            } else {
                document.title = `Home - EEZ Studio`;
            }
        });

        autorun(() => {
            if (
                this.activeTab &&
                this.activeTab.id === "history" &&
                this.mainHistoryView &&
                this.mainHistoryView.props.appStore.deletedItemsHistory
                    .deletedCount === 0
            ) {
                runInAction(() => (this.viewDeletedHistory = false));
            }
        });

        onSimpleMessage(
            "home/show-section",
            (args: { sectionId: string; itemId?: string }) => {
                EEZStudio.remote.getCurrentWindow().show();
                this.navigateToTab(args.sectionId, args.itemId);
            }
        );
    }

    get firstTime() {
        return this._firstTime;
    }

    set firstTime(value: boolean) {
        runInAction(() => (this._firstTime = false));
        EEZStudio.electron.ipcRenderer.send("setFirstTime", false);
    }

    findTabDefinition(tabId: string) {
        return this.allTabs.find(
            tab =>
                tab.instance.id == tabId ||
                tab.instance.id == "homeSection_" + tabId
        );
    }

    async openTabById(tabId: string, makeActive: boolean) {
        let tab = this.findTab(tabId);

        if (!tab) {
            const tabDefinition = this.findTabDefinition(tabId);
            if (tabDefinition) {
                tab = tabDefinition.open();
            } else if (tabId.startsWith(ProjectEditorTab.ID_PREFIX)) {
                tab = await ProjectEditorTab.addTab(
                    tabId.substr(ProjectEditorTab.ID_PREFIX.length)
                );
            } else {
                const object = workbenchObjects.get(tabId);
                if (object) {
                    tab = this.addObjectTab(object);
                }
            }
        }

        if (tab && makeActive) {
            tab.makeActive();
        }
    }

    @computed
    get allTabs() {
        const TabClassToTabDefinition = (TabClass: any) => ({
            instance: new TabClass(this),
            open: action(() => {
                for (const tab of this.tabs) {
                    if (tab instanceof TabClass) {
                        return tab;
                    }
                }
                const tab = new TabClass(this);
                this.tabs.push(tab);
                return tab;
            })
        });

        const allTabs: ITabDefinition[] = [
            // HomeTab,
            WorkbenchTab,
            HistoryTab,
            ShortcutsAndGroupsTab
        ].map(TabClassToTabDefinition);

        extensions.forEach(extension => {
            if (extension.homeSections) {
                extension.homeSections.forEach(homeSection => {
                    allTabs.push({
                        instance: new HomeSectionTab(this, homeSection),
                        open: action(() => {
                            for (const tab of this.tabs) {
                                if (tab.id == "homeSection_" + homeSection.id) {
                                    return tab;
                                }
                            }
                            const tab = new HomeSectionTab(this, homeSection);
                            this.tabs.push(tab);
                            return tab;
                        }),
                        selectItem: homeSection.selectItem
                    });
                });
            }
        });

        return allTabs.concat(
            [ExtensionManagerTab, SettingsTab].map(TabClassToTabDefinition)
        );
    }

    findTab(id: string) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; tabIndex++) {
            const tab = this.tabs[tabIndex];
            if (tab.id === id) {
                return tab;
            }
        }
        return null;
    }

    @action
    addObjectTab(object: WorkbenchObject) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; tabIndex++) {
            if (this.tabs[tabIndex].id === object.id) {
                return this.tabs[tabIndex];
            }
        }

        const tab = new ObjectEditorTab(this, object);
        this.tabs.push(tab);
        return tab;
    }

    @action
    addProjectTab(DocumentStore: DocumentStoreClass) {
        const tab = new ProjectEditorTab(this, DocumentStore);
        this.tabs.push(tab);
        return tab;
    }

    @action
    removeTab(tab: IHomeTab) {
        const tabIndex = this.tabs.indexOf(tab);
        if (tabIndex !== -1) {
            const tab = this.tabs[tabIndex];
            this.tabs.splice(tabIndex, 1);
            if (tab.active) {
                if (tabIndex === this.tabs.length) {
                    this.makeActive(this.tabs[tabIndex - 1]);
                } else {
                    this.makeActive(this.tabs[tabIndex]);
                }
            }
        }
    }

    @action
    makeActive(tab: IHomeTab) {
        if (this.activeTab) {
            this.activeTab.active = false;
        }
        this.activeTab = tab;
        if (this.activeTab) {
            this.activeTab.active = true;
        }
    }

    @observable viewDeletedHistory = false;

    @action
    navigateToHistory() {
        this.openTabById("history", true);
        this.viewDeletedHistory = false;
    }

    @action
    navigateToDeletedHistoryItems() {
        this.openTabById("history", true);
        this.viewDeletedHistory = true;
    }

    @action.bound
    navigateToSessionsList() {
        this.openTabById("history", true);
        this.viewDeletedHistory = false;
        showSessionsList(this);
    }

    mainHistoryView: HistoryView | undefined;

    // @TODO remove this, not requred in home
    selectedListId: string | undefined = undefined;

    async changeSelectedListId(selectedListId: string | undefined) {
        this.selectedListId = selectedListId;
    }

    async navigateToTab(tabId: string, itemId?: string) {
        const tabDefinition = this.findTabDefinition(tabId);
        if (tabDefinition) {
            await tabs.openTabById(tabId, true);

            if (itemId && tabDefinition.selectItem) {
                tabDefinition.selectItem(itemId);
            }
        }
    }

    findProjectEditorTab(filePath: string) {
        return this.tabs.find(
            tab =>
                tab instanceof ProjectEditorTab &&
                tab.DocumentStore.filePath == filePath
        );
    }
}

export let tabs: Tabs;

export function loadTabs() {
    tabs = new Tabs();
}

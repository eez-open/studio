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

import { instruments, InstrumentObject } from "instrument/instrument-object";
import type * as WorkbenchModule from "home/workbench";
import type * as HistoryModule from "home/history";
import type * as ShortcutsModule from "home/shortcuts";
import type * as ExtensionsManagerModule from "home/extensions-manager/extensions-manager";
import type * as SettingsModule from "home/settings";

import type * as ProjectEditorModule from "project-editor/project/ProjectEditor";

import { Loader } from "eez-studio-ui/loader";

import { DocumentStoreClass } from "project-editor/core/store";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project/ProjectEditor";
import { firstTime } from "./first-time";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";

////////////////////////////////////////////////////////////////////////////////

export interface IHomeTab extends ITab {
    editor?: IEditor;
    render(): React.ReactNode;
    attention?: boolean;
    beforeAppClose?(): Promise<boolean>;
    showCommandPalette?(): void;
    titleStr: string;
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

    get titleStr() {
        return this.title;
    }

    render() {
        const { Workbench } =
            require("home/workbench") as typeof WorkbenchModule;
        return <Workbench />;
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

    get titleStr() {
        return this.title;
    }

    render() {
        if (tabs.viewDeletedHistory) {
            const { DeletedHistoryItemsSection } =
                require("home/history") as typeof HistoryModule;
            return <DeletedHistoryItemsSection />;
        } else {
            const { HistorySection } =
                require("home/history") as typeof HistoryModule;
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

    get titleStr() {
        return this.title;
    }

    render() {
        const { ShortcutsAndGroups } =
            require("home/shortcuts") as typeof ShortcutsModule;
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

    get titleStr() {
        return this.title;
    }

    @computed
    get numNewVersions() {
        const { extensionsManagerStore } =
            require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
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
        const { extensionsManagerStore } =
            require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;

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
        const { ExtensionsManager } =
            require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
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

    get titleStr() {
        return this.title;
    }

    @computed
    get attention() {
        const { settingsController } =
            require("home/settings") as typeof SettingsModule;
        return settingsController.isCompactDatabaseAdvisable;
    }

    get icon() {
        return <Icon icon="material:settings" attention={this.attention} />;
    }

    get tooltipTitle() {
        if (this.attention) {
            const { COMPACT_DATABASE_MESSAGE } =
                require("home/settings") as typeof SettingsModule;
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

    get titleStr() {
        return this.title;
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

class InstrumentTab implements IHomeTab {
    constructor(public tabs: Tabs, public object: InstrumentObject) {
        this.editor = this.object.getEditor();
        this.editor.onCreate();
    }

    editor?: IEditor;

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
                if (!this.editor) {
                    this.editor = this.object.getEditor();
                    this.editor.onCreate();
                }
                this.editor.onActivate();
            } else {
                if (this.editor) {
                    this.editor.onDeactivate();
                }
            }
        }
    }

    get id() {
        return this.object.id;
    }

    get title() {
        return this.object.isConnected ? (
            <div
                className="EezStudio_InstrumentConnectionState"
                style={{ flexGrow: 1, paddingLeft: 5 }}
            >
                <span
                    style={{
                        backgroundColor: this.object.connectionState.color
                    }}
                />
                <span>{this.object.name}</span>
            </div>
        ) : (
            this.object.name
        );
    }

    get titleStr() {
        return this.object.name;
    }

    get icon() {
        return this.object.getIcon();
    }

    render() {
        return this.editor ? this.editor.render() : null;
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
        if (this.editor) {
            this.editor.onTerminate();
        }
    }

    async beforeAppClose() {
        if (this.editor) {
            return await this.editor.onBeforeAppClose();
        }
        return true;
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ProjectEditorTab implements IHomeTab {
    static ID_PREFIX = "PROJECT_TAB_";

    constructor(public tabs: Tabs, public _filePath: string | undefined) {}

    permanent: boolean = true;
    @observable _active: boolean = false;
    loading: boolean = false;

    @observable
    DocumentStore: DocumentStoreClass | undefined;

    ProjectContext: React.Context<DocumentStoreClass>;
    ProjectEditor: typeof ProjectEditorModule.ProjectEditor;

    async loadProject() {
        this.ProjectContext = ProjectContext;

        this.ProjectEditor = ProjectEditor;

        await initProjectEditor();
        const DocumentStore = await DocumentStoreClass.create();

        if (this._filePath) {
            await DocumentStore.openFile(this._filePath);
        } else {
            DocumentStore.newProject();
        }

        await DocumentStore.loadAllExternalProjects();
        runInAction(() => {
            DocumentStore.project._fullyLoaded = true;
        });
        DocumentStore.startBackgroundCheck();

        runInAction(() => {
            this.DocumentStore = DocumentStore;
        });
    }

    get active() {
        return this._active;
    }

    removeListeners: (() => void) | undefined;

    set active(value: boolean) {
        if (value !== this._active) {
            runInAction(() => (this._active = value));
            if (this._active) {
                this.addListeners();
            } else {
                if (this.removeListeners) {
                    this.removeListeners();
                    this.removeListeners = undefined;
                }
            }
        }
    }

    async addListeners() {
        if (!this.DocumentStore) {
            await this.loadProject();
        }

        const DocumentStore = this.DocumentStore;
        if (!DocumentStore) {
            return;
        }

        const save = () => {
            DocumentStore.save();
        };
        const saveAs = () => {
            DocumentStore.saveAs();
        };
        const check = () => {
            DocumentStore.check();
        };
        const build = () => {
            DocumentStore.build();
        };
        const buildExtensions = () => {
            DocumentStore.buildExtensions();
        };
        const undo = () => {
            DocumentStore.undoManager.undo();
        };
        const redo = () => {
            DocumentStore.undoManager.redo();
        };
        const cut = () => {
            if (DocumentStore.navigationStore.selectedPanel)
                DocumentStore.navigationStore.selectedPanel.cutSelection();
        };
        const copy = () => {
            if (DocumentStore.navigationStore.selectedPanel)
                DocumentStore.navigationStore.selectedPanel.copySelection();
        };
        const paste = () => {
            if (DocumentStore.navigationStore.selectedPanel)
                DocumentStore.navigationStore.selectedPanel.pasteSelection();
        };
        const deleteSelection = () => {
            if (DocumentStore.navigationStore.selectedPanel)
                DocumentStore.navigationStore.selectedPanel.deleteSelection();
        };
        const toggleOutput = action(() => {
            DocumentStore.uiStateStore.viewOptions.outputVisible =
                !DocumentStore.uiStateStore.viewOptions.outputVisible;
        });
        const showMetrics = () => DocumentStore.showMetrics();

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

        this.removeListeners = () => {
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

    get filePath() {
        return (
            (this.DocumentStore && this.DocumentStore.filePath) ||
            this._filePath ||
            ""
        );
    }

    get id() {
        return ProjectEditorTab.ID_PREFIX + this.filePath;
    }

    get title() {
        return path.parse(this.filePath || "").name || "Untitled project";
    }

    get titleStr() {
        return this.title;
    }

    get icon() {
        return <Icon icon="material:developer_board" />;
    }

    render() {
        if (!this.DocumentStore) {
            return (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    <Loader size={60} />
                </div>
            );
        }

        return (
            <this.ProjectContext.Provider value={this.DocumentStore}>
                <this.ProjectEditor />
            </this.ProjectContext.Provider>
        );
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }

    async close() {
        if (this.DocumentStore) {
            if (await this.DocumentStore.closeWindow()) {
                this.tabs.removeTab(this);
                this.DocumentStore.changeProject(undefined);
            }
            this.DocumentStore = undefined;
        }
    }

    async beforeAppClose() {
        if (this.DocumentStore) {
            return await this.DocumentStore.closeWindow();
        }

        return true;
    }

    @action
    showCommandPalette() {
        if (this.DocumentStore) {
            this.DocumentStore.uiStateStore.showCommandPalette = true;
        }
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
    @observable tabs: IHomeTab[] = [];
    @observable activeTab: IHomeTab | undefined;

    constructor() {
        loadPreinstalledExtension("instrument").then(async () => {
            if (!firstTime.get()) {
                if (location.search) {
                    const instrumentId = location.search.substring(1);
                    if (instruments.get(instrumentId)) {
                        this.openTabById(instrumentId, true);
                        return;
                    }
                }

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
                        //this.openTabById("workbench", true);
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
                tab => tab instanceof InstrumentTab && !instruments.get(tab.id)
            ) as InstrumentTab[];

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
                document.title = `${this.activeTab.titleStr} - EEZ Studio`;
            } else {
                document.title = `EEZ Studio`;
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
                const filePath = tabId.substr(
                    ProjectEditorTab.ID_PREFIX.length
                );
                if (filePath === "undefined") {
                    return;
                }
                tab = this.addProjectTab(filePath);
            } else {
                const instrument = instruments.get(tabId);
                if (instrument) {
                    tab = this.addInstrumentTab(instrument);
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
    addInstrumentTab(instrument: InstrumentObject) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; tabIndex++) {
            if (this.tabs[tabIndex].id === instrument.id) {
                return this.tabs[tabIndex];
            }
        }

        const tab = new InstrumentTab(this, instrument);
        this.tabs.push(tab);
        return tab;
    }

    @action
    addProjectTab(filePath: string | undefined) {
        const tab = new ProjectEditorTab(this, filePath);
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
                if (tabIndex >= this.tabs.length) {
                    this.makeActive(this.tabs[this.tabs.length - 1]);
                } else if (this.tabs.length > 0) {
                    this.makeActive(this.tabs[tabIndex]);
                } else {
                    this.makeActive(undefined);
                }
            }
        }
    }

    @action
    makeActive(tab: IHomeTab | undefined) {
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
            tab => tab instanceof ProjectEditorTab && tab.filePath == filePath
        );
    }
}

export let tabs: Tabs;

export function loadTabs() {
    tabs = new Tabs();
}

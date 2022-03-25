import { ipcRenderer } from "electron";
import { getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    observable,
    action,
    runInAction,
    reaction,
    autorun,
    computed,
    makeObservable
} from "mobx";
import * as path from "path";

import { onSimpleMessage } from "eez-studio-shared/util-renderer";

import {
    loadPreinstalledExtension,
    extensions
} from "eez-studio-shared/extensions/extensions";
import { IEditor, IHomeSection } from "eez-studio-shared/extensions/extension";

import { ITab } from "eez-studio-ui/tabs";
import { Icon } from "eez-studio-ui/icon";

import {
    HistoryViewComponent,
    showSessionsList
} from "instrument/window/history/history-view";

import { instruments, InstrumentObject } from "instrument/instrument-object";
import type * as HomeTabModule from "home/home-tab";
import type * as HistoryModule from "home/history";
import type * as ShortcutsModule from "home/shortcuts";
import type * as ExtensionsManagerModule from "home/extensions-manager/extensions-manager";
import type * as SettingsModule from "home/settings";

import type * as ProjectEditorModule from "project-editor/project/ProjectEditor";

import { Loader } from "eez-studio-ui/loader";

import { DocumentStoreClass } from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditor } from "project-editor/project/ProjectEditor";
import { firstTime } from "./first-time";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";
import { PROJECT_TAB_ID_PREFIX } from "home/tabs-store-conf";

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

class HomeTab implements IHomeTab {
    constructor(public tabs: Tabs) {
        makeObservable(this, {
            active: observable,
            makeActive: action
        });
    }

    permanent: boolean = true;
    dragDisabled: boolean = true;
    active: boolean = false;
    loading: boolean = false;

    id = "home";
    title = "Home";
    icon = "material:home";

    get titleStr() {
        return this.title;
    }

    render() {
        const { Home } = require("home/home-tab") as typeof HomeTabModule;
        return <Home />;
    }

    makeActive(): void {
        this.tabs.makeActive(this);
    }
}

class HistoryTab implements IHomeTab {
    constructor(public tabs: Tabs) {
        makeObservable(this, {
            active: observable,
            makeActive: action
        });
    }

    permanent: boolean = true;
    active: boolean = false;
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

    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class ShortcutsAndGroupsTab implements IHomeTab {
    constructor(public tabs: Tabs) {
        makeObservable(this, {
            active: observable,
            makeActive: action
        });
    }

    permanent: boolean = true;
    active: boolean = false;
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

    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class ExtensionManagerTab implements IHomeTab {
    constructor(public tabs: Tabs) {
        makeObservable(this, {
            active: observable,
            numNewVersions: computed,
            tooltipTitle: computed,
            attention: computed,
            makeActive: action
        });
    }

    permanent: boolean = true;
    active: boolean = false;
    loading: boolean = false;

    id = "extensions";
    title = "Extension Manager";

    get titleStr() {
        return this.title;
    }

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

    get attention() {
        return this.numNewVersions > 0;
    }

    render() {
        const { ExtensionsManager } =
            require("home/extensions-manager/extensions-manager") as typeof ExtensionsManagerModule;
        return <ExtensionsManager />;
    }

    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

class SettingsTab implements IHomeTab {
    constructor(public tabs: Tabs) {
        makeObservable(this, {
            active: observable,
            attention: computed,
            makeActive: action
        });
    }

    permanent: boolean = true;
    active: boolean = false;
    loading: boolean = false;

    id = "settings";
    title = "Settings";

    get titleStr() {
        return this.title;
    }

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

    makeActive(): void {
        this.tabs.makeActive(this);
    }

    close() {
        this.tabs.removeTab(this);
    }
}

////////////////////////////////////////////////////////////////////////////////

class HomeSectionTab implements IHomeTab {
    constructor(public tabs: Tabs, public homeSection: IHomeSection) {
        makeObservable(this, {
            active: observable,
            makeActive: action
        });
    }

    permanent: boolean = true;
    active: boolean = false;
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
        makeObservable(this, {
            _active: observable,
            makeActive: action
        });

        this.editor = this.object.getEditor();
        this.editor.onCreate();
    }

    editor?: IEditor;

    permanent: boolean = true;
    _active: boolean = false;

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
    constructor(public tabs: Tabs, public _filePath: string | undefined) {
        makeObservable(this, {
            _active: observable,
            DocumentStore: observable,
            error: observable,
            makeActive: action,
            showCommandPalette: action
        });
    }

    permanent: boolean = true;
    _active: boolean = false;
    loading: boolean = false;

    DocumentStore: DocumentStoreClass | undefined;

    error: string | undefined;

    ProjectContext: React.Context<DocumentStoreClass>;
    ProjectEditor: typeof ProjectEditorModule.ProjectEditor;

    closed: boolean = false;

    async loadProject() {
        try {
            this.ProjectContext = ProjectContext;

            this.ProjectEditor = ProjectEditor;

            await initProjectEditor(tabs);
            const DocumentStore = await DocumentStoreClass.create();

            if (this._filePath) {
                await DocumentStore.openFile(this._filePath);
            } else {
                await DocumentStore.newProject();
            }

            await DocumentStore.loadAllExternalProjects();
            runInAction(() => {
                DocumentStore.project._fullyLoaded = true;
            });

            if (!DocumentStore.project._isDashboardBuild) {
                DocumentStore.startBackgroundCheck();
            } else {
                DocumentStore.setRuntimeMode(false);
            }

            if (!this.closed) {
                runInAction(() => {
                    this.DocumentStore = DocumentStore;
                });
            }
        } catch (err) {
            console.log(err);
            runInAction(() => {
                this.error = "Failed to load file!";
            });
        }
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
        if (!this.DocumentStore && !this.error) {
            await this.loadProject();
        }

        const DocumentStore = this.DocumentStore;
        if (!DocumentStore) {
            return;
        }

        if (this.removeListeners) {
            this.removeListeners();
            this.removeListeners = undefined;
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
        const showMetrics = () => DocumentStore.showMetrics();

        ipcRenderer.on("save", save);
        ipcRenderer.on("saveAs", saveAs);
        ipcRenderer.on("check", check);
        ipcRenderer.on("build", build);
        ipcRenderer.on("build-extensions", buildExtensions);
        ipcRenderer.on("undo", undo);
        ipcRenderer.on("redo", redo);
        ipcRenderer.on("cut", cut);
        ipcRenderer.on("copy", copy);
        ipcRenderer.on("paste", paste);
        ipcRenderer.on("delete", deleteSelection);
        ipcRenderer.on("showProjectMetrics", showMetrics);

        this.removeListeners = () => {
            ipcRenderer.removeListener("save", save);
            ipcRenderer.removeListener("saveAs", saveAs);
            ipcRenderer.removeListener("check", check);
            ipcRenderer.removeListener("build", build);
            ipcRenderer.removeListener("build-extensions", buildExtensions);
            ipcRenderer.removeListener("undo", undo);
            ipcRenderer.removeListener("redo", redo);
            ipcRenderer.removeListener("cut", cut);
            ipcRenderer.removeListener("copy", copy);
            ipcRenderer.removeListener("paste", paste);
            ipcRenderer.removeListener("delete", deleteSelection);
            ipcRenderer.removeListener("showProjectMetrics", showMetrics);
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
        return PROJECT_TAB_ID_PREFIX + this.filePath;
    }

    get title() {
        if (this.DocumentStore) {
            return this.DocumentStore.title;
        }

        if (this.filePath) {
            if (this.filePath.endsWith(".eez-project")) {
                return path.basename(this.filePath, ".eez-project");
            }
            return (
                path.basename(this.filePath, ".eez-dashboard") + " dashboard"
            );
        }

        return "Untitled project";
    }

    get titleStr() {
        return this.title;
    }

    get tooltipTitle() {
        return this.filePath;
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
                    {this.error ? (
                        <div className="error">{this.error}</div>
                    ) : (
                        <Loader size={60} />
                    )}
                </div>
            );
        }

        return (
            <this.ProjectContext.Provider value={this.DocumentStore}>
                <this.ProjectEditor />
            </this.ProjectContext.Provider>
        );
    }

    makeActive(): void {
        this.tabs.makeActive(this);
    }

    async close() {
        if (this.DocumentStore) {
            if (await this.DocumentStore.closeWindow()) {
                this.tabs.removeTab(this);
                this.DocumentStore.unmount();
            }
            this.DocumentStore = undefined;
        } else {
            this.tabs.removeTab(this);
        }
        this.closed = true;
    }

    async beforeAppClose() {
        if (this.DocumentStore) {
            return await this.DocumentStore.closeWindow();
        }

        return true;
    }

    showCommandPalette() {
        if (this.DocumentStore) {
            this.DocumentStore.uiStateStore.showCommandPalette = true;
        }
    }

    loadDebugInfo(filePath: string) {
        if (this.DocumentStore) {
            this.DocumentStore.loadDebugInfo(filePath);
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

export class Tabs {
    tabs: IHomeTab[] = [];
    activeTab: IHomeTab | undefined;

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
                this.addTab(tab);
                return tab;
            })
        });

        const allTabs: ITabDefinition[] = [
            HomeTab,
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

    constructor() {
        makeObservable(this, {
            tabs: observable,
            activeTab: observable,
            allTabs: computed,
            addInstrumentTab: action,
            addProjectTab: action,
            removeTab: action,
            makeActive: action,
            viewDeletedHistory: observable,
            navigateToHistory: action.bound,
            navigateToDeletedHistoryItems: action.bound,
            navigateToSessionsList: action.bound
        });

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
                                this.openTabById(savedTab.id, savedTab.active);
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }
                }
            } else {
                this.openTabById("home", true);
            }

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
                    ipcRenderer.send("tabs-change", tabs);
                }
            );

            autorun(() => {
                const tabsToClose = this.tabs.filter(
                    tab =>
                        tab instanceof InstrumentTab && !instruments.get(tab.id)
                ) as InstrumentTab[];

                tabsToClose.forEach(tab => tab.close());
            });

            ipcRenderer.on(
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
                    getCurrentWindow().show();
                    this.navigateToTab(args.sectionId, args.itemId);
                }
            );
        });
    }

    findTabDefinition(tabId: string) {
        return this.allTabs.find(
            tab =>
                tab.instance.id == tabId ||
                tab.instance.id == "homeSection_" + tabId
        );
    }

    addTab(tab: IHomeTab) {
        this.tabs.push(tab);
    }

    openTabById(tabId: string, makeActive: boolean) {
        let tab = this.findTab(tabId);

        if (!tab) {
            const tabDefinition = this.findTabDefinition(tabId);
            if (tabDefinition) {
                tab = tabDefinition.open();
            } else if (tabId.startsWith(PROJECT_TAB_ID_PREFIX)) {
                const filePath = tabId.substr(PROJECT_TAB_ID_PREFIX.length);
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

    findTab(id: string) {
        if (id == "workbench") {
            id = "home";
        }
        for (let tabIndex = 0; tabIndex < this.tabs.length; tabIndex++) {
            const tab = this.tabs[tabIndex];
            if (tab.id === id) {
                return tab;
            }
        }
        return null;
    }

    addInstrumentTab(instrument: InstrumentObject) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; tabIndex++) {
            if (this.tabs[tabIndex].id === instrument.id) {
                return this.tabs[tabIndex];
            }
        }

        const tab = new InstrumentTab(this, instrument);
        this.addTab(tab);
        return tab;
    }

    addProjectTab(filePath: string | undefined) {
        const tab = new ProjectEditorTab(this, filePath);
        this.addTab(tab);
        return tab;
    }

    removeTab(tab: IHomeTab) {
        const tabIndex = this.tabs.indexOf(tab);
        if (tabIndex > 0) {
            const tab = this.tabs[tabIndex];
            this.tabs.splice(tabIndex, 1);
            if (tab.active) {
                if (tabIndex >= this.tabs.length) {
                    this.makeActive(this.tabs[this.tabs.length - 1]);
                } else if (this.tabs.length > 0) {
                    this.makeActive(this.tabs[tabIndex]);
                }
            }

            if (this.tabs.length === 0) {
                this.openTabById("home", true);
            }
        }
    }

    makeActive(tab: IHomeTab | undefined) {
        if (this.activeTab) {
            this.activeTab.active = false;
        }
        this.activeTab = tab;
        if (this.activeTab) {
            this.activeTab.active = true;
        }
    }

    viewDeletedHistory = false;

    navigateToHistory() {
        this.openTabById("history", true);
        this.viewDeletedHistory = false;
    }

    navigateToDeletedHistoryItems() {
        this.openTabById("history", true);
        this.viewDeletedHistory = true;
    }

    navigateToSessionsList() {
        this.openTabById("history", true);
        this.viewDeletedHistory = false;
        showSessionsList(this);
    }

    mainHistoryView: HistoryViewComponent | undefined;

    // @TODO remove this, not requred in home
    selectedListId: string | undefined = undefined;

    async changeSelectedListId(selectedListId: string | undefined) {
        this.selectedListId = selectedListId;
    }

    navigateToTab(tabId: string, itemId?: string) {
        const tabDefinition = this.findTabDefinition(tabId);
        if (tabDefinition) {
            tabs.openTabById(tabId, true);

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

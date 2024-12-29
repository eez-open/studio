import fs from "fs";
import { clipboard, ipcRenderer } from "electron";
import { getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    observable,
    action,
    runInAction,
    reaction,
    autorun,
    computed,
    makeObservable,
    IReactionDisposer
} from "mobx";
import * as path from "path";

import { onSimpleMessage } from "eez-studio-shared/util-renderer";

import {
    loadPreinstalledExtension,
    extensions
} from "eez-studio-shared/extensions/extensions";
import { IEditor, IHomeSection } from "eez-studio-shared/extensions/extension";

import { ITab } from "eez-studio-ui/tabs";

import * as notification from "eez-studio-ui/notification";

import type { InstrumentObject } from "instrument/instrument-object";
import type * as InstrumentObjectModule from "instrument/instrument-object";
import type { HistoryViewComponent } from "instrument/window/history/history-view";
import type * as HistoryViewModule from "instrument/window/history/history-view";

import type * as HomeTabModule from "home/home-tab";
import type * as HistoryModule from "home/history";
import type * as ShortcutsModule from "home/shortcuts";

import { Loader } from "eez-studio-ui/loader";

import { ProjectStore } from "project-editor/store";

import { ProjectContext } from "project-editor/project/context";
import { ProjectEditorView } from "project-editor/project/ui/ProjectEditor";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";
import {
    PROJECT_TAB_ID_PREFIX,
    RUN_PROJECT_TAB_ID_PREFIX
} from "home/tabs-store-conf";
import { getProjectIcon } from "home/helper";
import type { HomeTabCategory } from "eez-studio-shared/extensions/extension";
import { homeLayoutModels } from "home/home-layout-models";
import {
    getScrapbookItemEezProject,
    getScrapbookItemTabTitle,
    isScrapbookItemFilePath,
    model as scrapbookModel
} from "project-editor/store/scrapbook";
import { historySessions } from "instrument/window/history/session/store";

const MODIFED_MARK = "\u002A ";

////////////////////////////////////////////////////////////////////////////////

export interface IHomeTab extends ITab {
    editor?: IEditor;
    render(): React.ReactNode;
    attention?: boolean;
    modified?: boolean;
    beforeAppClose?(): Promise<boolean>;
    titleStr: string;
    category: HomeTabCategory;
}

////////////////////////////////////////////////////////////////////////////////

export class HomeTab implements IHomeTab {
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
    modified: boolean = false;

    id = "home";
    title = "Home";
    icon = "material:home";
    category: HomeTabCategory = "none";

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

    async beforeAppClose() {
        homeLayoutModels.save();
        return true;
    }
}

class HistoryTab implements IHomeTab {
    constructor(public tabs: Tabs) {
        makeObservable(this, {
            _active: observable,
            makeActive: action
        });
    }

    permanent: boolean = true;
    _active: boolean = false;
    loading: boolean = false;
    modified: boolean = false;

    id = "history";
    title = "History";
    icon = "material:history";
    category: HomeTabCategory = "instrument";

    dispose: IReactionDisposer;

    get titleStr() {
        return this.title;
    }

    get active() {
        return this._active;
    }

    set active(value: boolean) {
        if (value !== this._active) {
            runInAction(() => (this._active = value));

            if (this._active) {
                this.onActivate();
            } else {
                this.onDeactivate();
            }
        }
    }

    deleteSelectedHistoryItems = () => {
        const { getAppStore } = require("home/history") as typeof HistoryModule;
        const appStore = getAppStore();
        if (this.tabs.viewDeletedHistory) {
            appStore.deletedItemsHistory.deleteSelectedHistoryItems();
        } else {
            appStore.history.deleteSelectedHistoryItems();
        }
    };

    onActivate() {
        if (this.dispose) {
            this.dispose();
        }

        const { getAppStore } = require("home/history") as typeof HistoryModule;

        this.dispose = autorun(() => {
            if (
                this.tabs.viewDeletedHistory &&
                getAppStore().deletedItemsHistory.deletedCount === 0
            ) {
                runInAction(() => (this.tabs.viewDeletedHistory = false));
            }
        });

        ipcRenderer.on("delete", this.deleteSelectedHistoryItems);
    }

    onDeactivate() {
        if (this.dispose) {
            this.dispose();
        }
        ipcRenderer.removeListener("delete", this.deleteSelectedHistoryItems);
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
    modified: boolean = false;

    id = "shortcutsAndGroups";
    title = "Shortcuts and Groups";
    icon = "material:playlist_play";
    category: HomeTabCategory = "instrument";

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
    modified: boolean = false;
    get category() {
        return this.homeSection.category;
    }

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

export class InstrumentTab implements IHomeTab {
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
    modified: boolean = false;

    category: HomeTabCategory = "none";

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
                {this.object.connectionState.color == "loader" ? (
                    <Loader size={20} />
                ) : (
                    <span
                        style={{
                            backgroundColor: this.object.connectionState.color
                        }}
                    />
                )}

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

    showSessionsList() {
        const editor = this.object.getEditor();
        editor.navigationStore.navigateToSessionsList();
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ProjectEditorTab implements IHomeTab {
    constructor(
        public tabs: Tabs,
        public _filePath: string | undefined,
        public runMode?: boolean
    ) {
        makeObservable(this, {
            _active: observable,
            projectStore: observable,
            error: observable,
            makeActive: action,
            _icon: observable
        });
    }

    permanent: boolean = true;
    _active: boolean = false;
    loading: boolean = false;

    get modified() {
        return this.projectStore && this.projectStore.isModified;
    }

    projectStore: ProjectStore | undefined;

    error: string | undefined;

    ProjectContext: React.Context<ProjectStore>;
    ProjectEditor: typeof ProjectEditorView;

    closed: boolean = false;

    category: HomeTabCategory = "none";

    async loadProject() {
        try {
            this.ProjectContext = ProjectContext;

            this.ProjectEditor = ProjectEditorView;

            await initProjectEditor(tabs, ProjectEditorTab);
            const projectStore = ProjectStore.create(
                this.runMode
                    ? {
                          type: "run-tab"
                      }
                    : {
                          type: "project-editor"
                      }
            );

            projectStore.mount();

            if (this._filePath) {
                await projectStore.openFile(this._filePath);
            } else {
                await projectStore.newProject();
            }

            runInAction(() => {
                projectStore.project._fullyLoaded = true;
            });

            if (!projectStore.project._isDashboardBuild && !this.runMode) {
                setTimeout(() => projectStore.startBackgroundCheck(), 0);
            } else {
                projectStore.setRuntimeMode(false);
            }

            if (!this.closed) {
                runInAction(() => {
                    this.projectStore = projectStore;
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
        if (!this.projectStore && !this.error) {
            await this.loadProject();
        }

        const projectStore = this.projectStore;
        if (!projectStore) {
            return;
        }

        if (this.removeListeners) {
            this.removeListeners();
            this.removeListeners = undefined;
        }

        const save = () => {
            if (!this.runMode && projectStore.isModified) {
                projectStore.save();
            }
        };
        const saveAs = () => {
            if (!this.runMode) {
                projectStore.saveAs();
            }
        };
        const check = () => {
            if (!this.runMode) {
                projectStore.check();
            }
        };
        const build = () => {
            if (!this.runMode) {
                projectStore.build();
            }
        };
        const buildExtensions = () => {
            if (!this.runMode) {
                projectStore.buildExtensions();
            }
        };
        const buildAndInstallExtensions = () => {
            if (!this.runMode) {
                projectStore.buildAndInstallExtensions();
            }
        };
        const undo = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (!this.runMode) {
                projectStore.undoManager.undo();
            }
        };
        const redo = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (!this.runMode) {
                projectStore.undoManager.redo();
            }
        };
        const cut = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (!this.runMode) {
                projectStore.cut();
            }
        };
        const copy = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (!this.runMode) {
                projectStore.copy();
            }
        };
        const paste = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (!this.runMode) {
                projectStore.paste();
            }
        };
        const deleteSelection = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (!this.runMode) {
                if (
                    projectStore.navigationStore.selectedPanel &&
                    projectStore.navigationStore.selectedPanel.deleteSelection
                ) {
                    projectStore.navigationStore.selectedPanel.deleteSelection();
                }
            }
        };
        const selectAll = () => {
            if (scrapbookModel.focused) {
                return;
            }

            if (
                projectStore.navigationStore.selectedPanel &&
                projectStore.navigationStore.selectedPanel.selectAll
            ) {
                projectStore.navigationStore.selectedPanel.selectAll();
            }
        };
        const onToggleComponentsPalette = () => {
            projectStore.layoutModels.toggleComponentsPalette();
        };
        const onResetLayoutModels = () => {
            if (!this.runMode) {
                projectStore.layoutModels.reset();
            }
        };

        const onReloadProject = () => {
            this.reloadProject();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (scrapbookModel.focused) {
                return;
            }

            if (this.projectStore?.runtime) {
                this.projectStore.runtime.onKeyDown(event);
            } else {
                if (
                    !(event.target instanceof HTMLInputElement) &&
                    !(event.target instanceof HTMLTextAreaElement)
                ) {
                    if (
                        (event.ctrlKey || event.metaKey) &&
                        !event.shiftKey &&
                        !event.altKey
                    ) {
                        if (event.key == "z") {
                            undo();
                        } else if (event.key == "y") {
                            redo();
                        } else if (event.key == "x") {
                            cut();
                        } else if (event.key == "c") {
                            copy();
                        } else if (event.key == "v") {
                            paste();
                        } else if (event.key == "a") {
                            event.preventDefault();
                            selectAll();
                        }
                    } else if (
                        !event.ctrlKey &&
                        !event.metaKey &&
                        !event.shiftKey &&
                        !event.altKey
                    ) {
                        if (event.key == "Backspace" || event.key == "Delete") {
                            deleteSelection();
                        }
                    }
                }
            }
        };

        ipcRenderer.on("save", save);
        ipcRenderer.on("saveAs", saveAs);
        ipcRenderer.on("check", check);
        ipcRenderer.on("build", build);
        ipcRenderer.on("build-extensions", buildExtensions);
        ipcRenderer.on(
            "build-and-install-extensions",
            buildAndInstallExtensions
        );
        ipcRenderer.on("undo", undo);
        ipcRenderer.on("redo", redo);
        ipcRenderer.on("cut", cut);
        ipcRenderer.on("copy", copy);
        ipcRenderer.on("paste", paste);
        ipcRenderer.on("delete", deleteSelection);
        ipcRenderer.on("select-all", selectAll);

        ipcRenderer.on("toggleComponentsPalette", onToggleComponentsPalette);
        ipcRenderer.on("resetLayoutModels", onResetLayoutModels);

        ipcRenderer.on("reload-project", onReloadProject);

        document.addEventListener("keydown", onKeyDown);

        this.removeListeners = () => {
            ipcRenderer.removeListener("save", save);
            ipcRenderer.removeListener("saveAs", saveAs);
            ipcRenderer.removeListener("check", check);
            ipcRenderer.removeListener("build", build);
            ipcRenderer.removeListener("build-extensions", buildExtensions);
            ipcRenderer.removeListener(
                "build-and-install-extensions",
                buildAndInstallExtensions
            );
            ipcRenderer.removeListener("undo", undo);
            ipcRenderer.removeListener("redo", redo);
            ipcRenderer.removeListener("cut", cut);
            ipcRenderer.removeListener("copy", copy);
            ipcRenderer.removeListener("paste", paste);
            ipcRenderer.removeListener("delete", deleteSelection);
            ipcRenderer.removeListener("select-all", selectAll);

            ipcRenderer.removeListener(
                "toggleComponentsPalette",
                onToggleComponentsPalette
            );
            ipcRenderer.removeListener(
                "resetLayoutModels",
                onResetLayoutModels
            );

            ipcRenderer.removeListener("reload-project", onReloadProject);

            document.removeEventListener("keydown", onKeyDown);

            projectStore.onDeactivate();
        };

        projectStore.onActivate();
    }

    get filePath() {
        return (
            (this.projectStore && this.projectStore.filePath) ||
            this._filePath ||
            ""
        );
    }

    get id() {
        return this.runMode
            ? RUN_PROJECT_TAB_ID_PREFIX + this.filePath
            : PROJECT_TAB_ID_PREFIX + this.filePath;
    }

    get title() {
        return (this.modified ? MODIFED_MARK : "") + this.titleStr;
    }

    get titleStr() {
        if (this.projectStore) {
            return this.projectStore.title;
        }

        if (isScrapbookItemFilePath(this.filePath)) {
            return getScrapbookItemTabTitle(this.filePath);
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

    get tooltipTitle() {
        if (isScrapbookItemFilePath(this.filePath)) {
            return this.titleStr;
        }

        return this.filePath;
    }

    _iconPromise: Promise<void> | undefined;
    _icon: React.ReactNode;

    get icon() {
        if (
            this.projectStore &&
            this.projectStore.project.settings.general.projectType
        ) {
            return getProjectIcon(
                this.filePath,
                this.projectStore.project.settings.general.projectType,
                24,
                this.projectStore.projectTypeTraits.hasFlowSupport
            );
        }

        if (this._icon) {
            return this._icon;
        }

        if (!this._iconPromise) {
            this._iconPromise = (async () => {
                let jsonStr;
                if (isScrapbookItemFilePath(this.filePath)) {
                    try {
                        jsonStr = getScrapbookItemEezProject(this.filePath);
                    } catch (err) {
                        console.error(err);
                        return;
                    }
                } else {
                    jsonStr = await fs.promises.readFile(
                        this.filePath,
                        "utf-8"
                    );
                }

                const json = JSON.parse(jsonStr);
                const projectType = json.settings.general.projectType;
                const icon = getProjectIcon(
                    this.filePath,
                    projectType,
                    24,
                    this.projectStore?.projectTypeTraits.hasFlowSupport ?? false
                );
                runInAction(() => (this._icon = icon));
            })();
        }

        return undefined;
    }

    render() {
        if (!this.projectStore) {
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
            <this.ProjectContext.Provider value={this.projectStore}>
                <this.ProjectEditor showToolbar={true} />
            </this.ProjectContext.Provider>
        );
    }

    makeActive(): void {
        this.tabs.makeActive(this);
    }

    async close() {
        if (this.projectStore) {
            if (await this.projectStore.closeWindow()) {
                this.tabs.removeTab(this);
                this.projectStore.unmount();
                runInAction(() => {
                    this.projectStore = undefined;
                });
            }
        } else {
            this.tabs.removeTab(this);
        }

        if (this.removeListeners) {
            this.removeListeners();
            this.removeListeners = undefined;
        }

        this.closed = true;
    }

    async beforeAppClose() {
        if (this.projectStore) {
            return await this.projectStore.closeWindow();
        }

        return true;
    }

    async reloadProject() {
        if (!this.projectStore) {
            return;
        }

        await this.projectStore.closeWindow();
        this.projectStore.unmount();

        if (this.removeListeners) {
            this.removeListeners();
            this.removeListeners = undefined;
        }

        runInAction(() => {
            this.projectStore = undefined;
        });

        this.loadProject();

        if (this.active) {
            this.addListeners();
        }

        notification.info("Project reloaded");
    }

    loadDebugInfo(filePath: string) {
        if (this.projectStore) {
            this.projectStore.loadDebugInfo(filePath);
        }
    }

    saveDebugInfo() {
        if (this.projectStore) {
            this.projectStore.runtime?.saveDebugInfo();
        }
    }

    copyProjectPath() {
        if (this.projectStore && this.projectStore.filePath) {
            clipboard.writeText(this.projectStore.filePath);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export interface ITabDefinition {
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

        return allTabs;
    }

    constructor() {
        initProjectEditor(tabs, ProjectEditorTab);

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

        this.openTabById("home", true);

        loadPreinstalledExtension("instrument").then(async () => {
            const { instruments } = await import(
                "instrument/instrument-object"
            );

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

                // make sure Home tab is at the 1st place
                const homeTab = savedTabs.find(
                    savedTab => savedTab.id == "home"
                );
                if (!homeTab) {
                    savedTabs.splice(0, 0, {
                        id: "home",
                        active: false
                    });
                } else {
                    const homeTabIndex = savedTabs.indexOf(homeTab);
                    if (homeTabIndex != 0) {
                        savedTabs.splice(homeTabIndex, 1);
                        savedTabs.splice(0, 0, homeTab);
                    }
                }

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
                let title;

                if (this.activeTab) {
                    title = `${this.activeTab.modified ? MODIFED_MARK : ""}${
                        this.activeTab.titleStr
                    } - EEZ Studio`;
                } else {
                    title = `EEZ Studio`;
                }

                document.title = title;
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
        let tab;

        if (tabId == "extensions" || tabId == "settings") {
            const { homeTabStore } =
                require("home/home-tab") as typeof HomeTabModule;
            runInAction(() => (homeTabStore.activeTab = tabId));
            tab = this.findTab("home");
        } else {
            tab = this.findTab(tabId);

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
                } else if (tabId.startsWith(RUN_PROJECT_TAB_ID_PREFIX)) {
                    const filePath = tabId.substr(
                        RUN_PROJECT_TAB_ID_PREFIX.length
                    );
                    if (filePath === "undefined") {
                        return;
                    }
                    tab = this.addProjectTab(filePath, true);
                } else {
                    const { instruments } =
                        require("instrument/instrument-object") as typeof InstrumentObjectModule;
                    const instrument = instruments.get(tabId);
                    if (instrument) {
                        tab = this.addInstrumentTab(instrument);
                    }
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

    addProjectTab(filePath: string | undefined, runMode?: boolean) {
        const tab = new ProjectEditorTab(this, filePath, runMode);
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

        historySessions.setShowDeleted(false);
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
        if (this.activeTab instanceof InstrumentTab) {
            this.activeTab.showSessionsList();
        } else {
            this.openTabById("history", true);
            this.viewDeletedHistory = false;
            const { showSessionsList } =
                require("instrument/window/history/history-view") as typeof HistoryViewModule;
            showSessionsList(this);
        }
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

    findProjectEditorTab(filePath: string, runMode: boolean) {
        return this.tabs.find(
            tab =>
                tab instanceof ProjectEditorTab &&
                tab.filePath == filePath &&
                (tab.runMode ?? false) == (runMode ?? false)
        ) as ProjectEditorTab | undefined;
    }

    reloadProject(projectStore: ProjectStore) {
        const tab = this.tabs.find(
            tab =>
                tab instanceof ProjectEditorTab &&
                tab.projectStore == projectStore
        ) as ProjectEditorTab | undefined;
        if (tab) {
            tab.reloadProject();
        }
    }
}

export let tabs: Tabs;

export function loadTabs() {
    tabs = new Tabs();
}

export function openProject(filePath: string, runMode: boolean) {
    try {
        let tab = tabs.findProjectEditorTab(filePath, runMode);
        if (!tab) {
            tab = tabs.addProjectTab(filePath, runMode);
        }
        if (tab) {
            tab.makeActive();
        }
    } catch (err) {
        console.error(err);
    }
}

ipcRenderer.on("show-documentation-browser", async () => {
    if (
        tabs.activeTab instanceof ProjectEditorTab &&
        tabs.activeTab.projectStore &&
        tabs.activeTab.projectStore.runtime
    ) {
        return;
    }

    const { showDocumentationBrowser } = await import(
        "home/documentation-browser"
    );
    await initProjectEditor(tabs, ProjectEditorTab);
    showDocumentationBrowser();
});

import React from "react";
import { observable, action, runInAction, reaction, autorun } from "mobx";

import { isRenderer } from "eez-studio-shared/util-electron";

import { loadPreinstalledExtension } from "eez-studio-shared/extensions/extensions";
import { IEditor } from "eez-studio-shared/extensions/extension";

import { Icon } from "eez-studio-ui/icon";
import { ITab } from "eez-studio-ui/tabs";

import { WorkbenchObject, workbenchObjects } from "home/store";
import * as HomeComponentModule from "home/home-component";

////////////////////////////////////////////////////////////////////////////////

export interface IHomeTab extends ITab {
    editor?: IEditor;
    render(): JSX.Element;
}

class HomeTab implements IHomeTab {
    constructor(public tabs: Tabs) {}

    permanent: boolean = true;
    @observable active: boolean = false;
    loading: boolean = false;

    id = "home";
    title = (
        <React.Fragment>
            <Icon icon="material: home" />
            <span>Home</span>
        </React.Fragment>
    );

    render() {
        const { HomeComponent } = require("home/home-component") as typeof HomeComponentModule;
        return <HomeComponent />;
    }

    @action
    makeActive(): void {
        this.tabs.makeActive(this);
    }
}

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
}

interface ISavedTab {
    id: string;
    active: boolean;
}

class Tabs {
    @observable tabs: IHomeTab[] = [new HomeTab(this)];
    @observable activeTab: IHomeTab;

    constructor() {
        this.tabs[0].makeActive();

        loadPreinstalledExtension("instrument").then(() => {
            const tabsJSON = window.localStorage.getItem("home/tabs");
            if (tabsJSON) {
                try {
                    const savedTabs: ISavedTab[] = JSON.parse(tabsJSON);

                    savedTabs.forEach(savedTab => {
                        if (savedTab.id === this.tabs[0].id) {
                            if (savedTab.active) {
                                this.tabs[0].makeActive();
                            }
                        } else {
                            const object = workbenchObjects.get(savedTab.id);
                            if (object) {
                                const tab = this.addObjectTab(object);
                                if (savedTab.active) {
                                    tab.makeActive();
                                }
                            }
                        }
                    });
                } catch (err) {
                    console.error(err);
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
            tabs => window.localStorage.setItem("home/tabs", JSON.stringify(tabs))
        );

        autorun(() => {
            const tabsToClose = this.tabs.filter(
                tab => tab instanceof ObjectEditorTab && !workbenchObjects.get(tab.id)
            ) as ObjectEditorTab[];

            tabsToClose.forEach(tab => tab.close());
        });
    }

    findObjectTab(id: string) {
        for (let tabIndex = 0; tabIndex < this.tabs.length; tabIndex++) {
            const tab = this.tabs[tabIndex];
            if (tab instanceof ObjectEditorTab && tab.id === id) {
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

    get homeTab() {
        return this.tabs[0];
    }
}

export let tabs: Tabs;

if (isRenderer()) {
    tabs = new Tabs();
}

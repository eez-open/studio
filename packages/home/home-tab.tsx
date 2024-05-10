import React from "react";
import { action, observable, makeObservable, autorun } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";

import { Settings, settingsController } from "home/settings";
import {
    NewProjectWizard,
    wizardModelTemplates,
    wizardModelExamples
} from "project-editor/project/ui/Wizard";
import {
    ExtensionsManager,
    extensionsManagerStore
} from "./extensions-manager/extensions-manager";
import { Projects } from "home/open-projects";
import { Instruments, defaultInstrumentsStore } from "home/instruments";
import { HOME_TAB_OPEN_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const SAVED_OPTIONS_VERSION = 1;

class HomeTabStore {
    activeTab:
        | "open"
        | "create"
        | "examples"
        | "run"
        | "instruments"
        | "extensions"
        | "settings" = "open";

    constructor() {
        this.loadOptions();

        makeObservable(this, {
            activeTab: observable
        });

        autorun(() => this.saveOptions());
    }

    loadOptions() {
        const optionsJSON = window.localStorage.getItem("home-tab-options");
        if (optionsJSON) {
            try {
                const options = JSON.parse(optionsJSON);
                if (options.version == SAVED_OPTIONS_VERSION) {
                    this.activeTab = options.activeTab;
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    saveOptions() {
        window.localStorage.setItem(
            "home-tab-options",
            JSON.stringify({
                version: SAVED_OPTIONS_VERSION,

                activeTab: this.activeTab
            })
        );
    }
}

export const homeTabStore = new HomeTabStore();

////////////////////////////////////////////////////////////////////////////////

const HOME_TAB_CREATE_ICON = (
    <svg viewBox="0 0 24 24" fill="currentcolor">
        <path fill="none" d="M0 0h24v24H0z" />
        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5v2H5v14h14v-5h2z" />
        <path d="M21 7h-4V3h-2v4h-4v2h4v4h2V9h4z" />
    </svg>
);

const HOME_TAB_EXAMPLES_ICON = (
    <svg viewBox="0 0 32 32" fill="currentcolor">
        <path d="M20 2v12l10-6-10-6z" />
        <path d="M28 14v8H4V6h10V4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8v4H8v2h16v-2h-4v-4h8a2 2 0 0 0 2-2v-8h-2ZM18 28h-4v-4h4v4Z" />
        <path d="M0 0h32v32H0z" fill="none" />
    </svg>
);

const HOME_TAB_INSTRUMENTS_ICON = (
    <svg viewBox="-50 -50 1124 1124" fill="currentcolor">
        <path d="M128 896h896v128H0V0h128v896zm18.4-450.2 236.6-.2L443 205h81l74.4 318.6L662.6 314l81.4-.6L796.6 448l226.8-2.4.4 84H746.4l-41-104.2-60 289h-75l-89.6-333.2-32.6 148.4-301.8.2v-84z" />
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

export const Home = observer(
    class Home extends React.Component {
        render() {
            return (
                <div className="EezStudio_HomeTab">
                    <div className="EezStudio_HomeTab_Header">
                        <div className="EezStudio_HomeTab_Navigation">
                            <div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab == "open"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "open";
                                })}
                                title={
                                    "Open a local project or select one from the recent list"
                                }
                            >
                                <Icon icon={HOME_TAB_OPEN_ICON} size={32} />{" "}
                                Open
                            </div>
                            <div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab == "create"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "create";
                                })}
                                title="Create a new project"
                            >
                                <Icon icon={HOME_TAB_CREATE_ICON} size={32} />{" "}
                                Create
                            </div>
                            <div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab == "examples"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "examples";
                                })}
                                title="Example projects ready to run or edit"
                            >
                                <Icon icon={HOME_TAB_EXAMPLES_ICON} size={32} />{" "}
                                Examples
                            </div>
                            {/*<div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab == "run"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "run";
                                })}
                                title="Run dashboard projects from the list of shortcuts"
                            >
                                <Icon icon="material:apps" size={32} /> Run
                            </div>*/}
                            <div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab ==
                                            "instruments"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "instruments";
                                })}
                                title="Instruments manager"
                            >
                                <Icon
                                    icon={HOME_TAB_INSTRUMENTS_ICON}
                                    size={32}
                                />{" "}
                                Instruments
                            </div>
                            <div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab ==
                                            "extensions"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "extensions";
                                })}
                                title="Extensions manager"
                            >
                                <Icon
                                    icon={"material:extension"}
                                    size={32}
                                    attention={
                                        extensionsManagerStore
                                            .newVersionsInAllSections.length > 0
                                    }
                                />
                                Extensions
                            </div>
                            <div
                                className={classNames(
                                    "EezStudio_HomeTab_NavigationItem",
                                    {
                                        selected:
                                            homeTabStore.activeTab == "settings"
                                    }
                                )}
                                onClick={action(() => {
                                    homeTabStore.activeTab = "settings";
                                })}
                                title="Global user settings"
                            >
                                <Icon
                                    icon={"material:settings"}
                                    size={32}
                                    attention={
                                        settingsController.isCompactDatabaseAdvisable
                                    }
                                />
                                Settings
                            </div>
                        </div>
                        {/*
                        <div className="EezStudio_HomeTab_Tabs">
                            {tabs.allTabs
                                .filter(
                                    tab => tab.instance.category == "common"
                                )
                                .map(tab => (
                                    <TabButton
                                        key={tab.instance.id}
                                        tab={tab}
                                    />
                                ))}
                                </div>*/}
                    </div>

                    <div className="EezStudio_HomeTab_Body">
                        {homeTabStore.activeTab == "open" && <Projects />}
                        {homeTabStore.activeTab == "create" && (
                            <NewProjectWizard
                                wizardModel={wizardModelTemplates}
                                modalDialog={observable.box<any>()}
                            />
                        )}
                        {homeTabStore.activeTab == "examples" && (
                            <NewProjectWizard
                                wizardModel={wizardModelExamples}
                                modalDialog={observable.box<any>()}
                            />
                        )}
                        {/*
                        homeTabStore.activeTab == "run" && (
                            <div style={{ margin: "auto" }}></div>
                        )
                        */}
                        {homeTabStore.activeTab == "instruments" && (
                            <Instruments
                                instrumentsStore={defaultInstrumentsStore}
                                size="M"
                            />
                        )}
                        {homeTabStore.activeTab == "extensions" && (
                            <ExtensionsManager />
                        )}
                        {homeTabStore.activeTab == "settings" && <Settings />}
                    </div>
                </div>
            );
        }
    }
);

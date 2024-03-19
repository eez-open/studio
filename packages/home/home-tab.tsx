import path from "path";
import { clipboard, ipcRenderer } from "electron";
import { Menu, MenuItem } from "@electron/remote";
import React from "react";
import {
    computed,
    action,
    observable,
    toJS,
    runInAction,
    makeObservable,
    autorun
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";
import classNames from "classnames";

import {
    VerticalHeaderWithBody,
    Header,
    Body,
    ToolbarHeader
} from "eez-studio-ui/header-with-body";
import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import type { InstrumentObject } from "instrument/instrument-object";

import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import type { ITabDefinition } from "home/tabs-store";

import { tabs } from "home/tabs-store";
import { IListNode, List, ListContainer, ListItem } from "eez-studio-ui/list";
import { Settings, settingsController } from "home/settings";
import { IMruItem } from "main/settings";
import { SearchInput } from "eez-studio-ui/search-input";
import { getProjectIcon } from "home/helper";
import { homeLayoutModels } from "home/home-layout-models";
import {
    NewProjectWizard,
    wizardModel
} from "project-editor/project/ui/Wizard";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import {
    ExtensionsManager,
    extensionsManagerStore
} from "./extensions-manager/extensions-manager";

////////////////////////////////////////////////////////////////////////////////

export const selectedInstrument = observable.box<string | undefined>();

const SORT_ALPHA_ICON = (
    <svg
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <path d="M15 10v-5c0 -1.38 .62 -2 2 -2s2 .62 2 2v5m0 -3h-4"></path>
        <path d="M19 21h-4l4 -7h-4"></path>
        <path d="M4 15l3 3l3 -3"></path>
        <path d="M7 6v12"></path>
    </svg>
);

const SORT_RECENT_ICON = (
    <svg
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <line x1="4" y1="6" x2="13" y2="6"></line>
        <line x1="4" y1="12" x2="11" y2="12"></line>
        <line x1="4" y1="18" x2="11" y2="18"></line>
        <polyline points="15 15 18 18 21 15"></polyline>
        <line x1="18" y1="6" x2="18" y2="18"></line>
    </svg>
);

////////////////////////////////////////////////////////////////////////////////

function deleteInstrument(instrument: InstrumentObject) {
    const { instrumentStore } =
        require("instrument/instrument-object") as typeof import("instrument/instrument-object");
    instrumentStore.deleteObject({
        id: instrument.id
    });
}

function openEditor(
    instrument: InstrumentObject,
    target: "tab" | "window" | "default"
) {
    if (target === "default") {
        if (
            ipcRenderer.sendSync(
                "focusWindow",
                instrument.getEditorWindowArgs()
            )
        ) {
            return;
        }
        target = "tab";
    }

    if (target === "tab") {
        const tab = tabs.findTab(instrument.id);
        if (tab) {
            // tab already exists
            tabs.makeActive(tab);
        } else {
            // close window if open
            ipcRenderer.send(
                "closeWindow",
                toJS(instrument.getEditorWindowArgs())
            );

            // open tab
            const tab = tabs.addInstrumentTab(instrument);
            tab.makeActive();
        }
    } else {
        // close tab if open
        const tab = tabs.findTab(instrument.id);
        if (tab) {
            tabs.removeTab(tab);
        }

        // open window
        ipcRenderer.send("openWindow", toJS(instrument.getEditorWindowArgs()));
    }
}

window.addEventListener("message", (message: any) => {
    const { instruments } =
        require("instrument/instrument-object") as typeof import("instrument/instrument-object");
    for (let key of instruments.keys()) {
        const instrument = instruments.get(key);
        if (instrument && instrument.id === message.data.instrumentId) {
            if (message.data.type === "open-instrument-editor") {
                openEditor(instrument, message.data.target);
            } else if (message.data.type === "delete-instrument") {
                beginTransaction("Delete instrument");
                deleteInstrument(instrument);
                commitTransaction();
            }
            return;
        }
    }
});

const TabButton = observer(function ({ tab }: { tab: ITabDefinition }) {
    return (
        <button
            className="btn btn btn-secondary"
            onClick={() => tab.open().makeActive()}
            title={
                tab.instance.tooltipTitle
                    ? tab.instance.tooltipTitle
                    : `Show ${tab.instance.title} Tab`
            }
            style={{ display: "inline-flex", alignItems: "center" }}
        >
            <Icon icon={tab.instance.icon} attention={tab.instance.attention} />
            <span style={{ paddingLeft: 5, whiteSpace: "nowrap" }}>
                {tab.instance.title}
            </span>
        </button>
    );
});

////////////////////////////////////////////////////////////////////////////////

class WorkbenchDocument {
    constructor() {
        makeObservable(this, {
            instruments: computed
        });
    }

    get instruments() {
        const { instruments } =
            require("instrument/instrument-object") as typeof import("instrument/instrument-object");
        return Array.from(instruments.values());
    }

    deleteInstruments(instruments: InstrumentObject[]) {
        if (instruments.length > 0) {
            beginTransaction("Delete workbench items");
        } else {
            beginTransaction("Delete workbench item");
        }

        instruments.forEach(instrument =>
            deleteInstrument(instrument as InstrumentObject)
        );

        commitTransaction();
    }

    createContextMenu(instruments: InstrumentObject[]): Electron.Menu {
        const menu = new Menu();

        if (instruments.length === 1) {
            const instrument = instruments[0];

            if (instrument.isUnknownExtension) {
                if (menu.items.length > 0) {
                    menu.append(
                        new MenuItem({
                            type: "separator"
                        })
                    );
                }

                menu.append(
                    new MenuItem({
                        label: "Install Extension",
                        click: () => {
                            const { installExtension } =
                                require("instrument/instrument-object-details") as typeof import("instrument/instrument-object-details");
                            installExtension(instrument);
                        }
                    })
                );
            }

            if (menu.items.length > 0) {
                menu.append(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menu.append(
                new MenuItem({
                    label: "Open in Tab",
                    click: () => {
                        instrument.openEditor("tab");
                    }
                })
            );

            menu.append(
                new MenuItem({
                    label: "Open in New Window",
                    click: () => {
                        instrument.openEditor("window");
                    }
                })
            );
        }

        if (instruments.length > 0) {
            if (menu.items.length > 0) {
                menu.append(
                    new MenuItem({
                        type: "separator"
                    })
                );
            }

            menu.append(
                new MenuItem({
                    label: "Delete",
                    click: () => {
                        this.deleteInstruments(instruments);
                    }
                })
            );
        }

        return menu;
    }
}

export const workbenchDocument = new WorkbenchDocument();

////////////////////////////////////////////////////////////////////////////////

export const WorkbenchToolbar = observer(
    class WorkbenchToolbar extends React.Component<{
        collapseButtons: boolean;
    }> {
        render() {
            let buttons = [
                {
                    id: "instrument-add",
                    label: this.props.collapseButtons
                        ? "Add"
                        : "Add Instrument",
                    title: "Add instrument",
                    className: "btn-success",
                    onClick: () => {
                        const { showAddInstrumentDialog } =
                            require("instrument/add-instrument-dialog") as typeof import("instrument/add-instrument-dialog");

                        showAddInstrumentDialog(instrumentId => {
                            setTimeout(() => {
                                runInAction(() =>
                                    selectedInstrument.set(instrumentId)
                                );
                            }, 100);
                        });
                    }
                }
            ];

            const { showDeletedInstrumentsDialog, deletedInstruments } =
                require("instrument/deleted-instruments-dialog") as typeof import("instrument/deleted-instruments-dialog");

            if (deletedInstruments.size > 0) {
                buttons.push({
                    id: "show-deleted-instruments",
                    label: this.props.collapseButtons
                        ? "Deleted"
                        : "Deleted Instruments",
                    title: "Show deleted instruments",
                    className: "btn-secondary",
                    onClick: () => {
                        showDeletedInstrumentsDialog(selectedInstrument);
                    }
                });
            }

            return (
                <ToolbarHeader>
                    {buttons.map((button, i) => (
                        <ButtonAction
                            key={button.id}
                            text={button.label}
                            title={button.title}
                            className={button.className}
                            onClick={button.onClick}
                            style={{
                                marginRight: buttons.length - 1 == i ? 20 : 10
                            }}
                        />
                    ))}
                    {tabs.allTabs
                        .filter(tab => tab.instance.category == "instrument")
                        .map(tab => (
                            <TabButton key={tab.instance.id} tab={tab} />
                        ))}
                </ToolbarHeader>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const InstrumentToolbarEnclosure = observer(() => {
    const selectedInstrumentId = selectedInstrument.get();
    if (!selectedInstrumentId) {
        return null;
    }

    const { instruments } =
        require("instrument/instrument-object") as typeof import("instrument/instrument-object");

    const instrument = instruments.get(selectedInstrumentId);
    if (!instrument) {
        return null;
    }

    const { InstrumentToolbar } =
        require("instrument/instrument-object-details") as typeof import("instrument/instrument-object-details");

    return (
        <div className="EezStudio_InstrumentToolbarEnclosure">
            <InstrumentToolbar instrument={instrument} />
        </div>
    );
});

const InstrumentPropertiesEnclosure = observer(() => {
    const selectedInstrumentId = selectedInstrument.get();
    if (!selectedInstrumentId) {
        return null;
    }

    const { instruments } =
        require("instrument/instrument-object") as typeof import("instrument/instrument-object");

    const instrument = instruments.get(selectedInstrumentId);
    if (!instrument) {
        return null;
    }

    const { InstrumentProperties } =
        require("instrument/instrument-object-details") as typeof import("instrument/instrument-object-details");

    return (
        <div className="EezStudio_InstrumentPropertiesEnclosure">
            <InstrumentProperties instrument={instrument} />
        </div>
    );
});

const InstrumentConnectionEnclosure = observer(() => {
    const selectedInstrumentId = selectedInstrument.get();
    if (!selectedInstrumentId) {
        return null;
    }

    const { instruments } =
        require("instrument/instrument-object") as typeof import("instrument/instrument-object");

    const instrument = instruments.get(selectedInstrumentId);
    if (!instrument) {
        return null;
    }

    const { InstrumentConnection } =
        require("instrument/instrument-object-details") as typeof import("instrument/instrument-object-details");

    return (
        <div className="EezStudio_InstrumentConnectionEnclosure">
            <InstrumentConnection instrument={instrument} />
        </div>
    );
});

const HistoryEnclosure = observer(() => {
    const selectedInstrumentId = selectedInstrument.get();
    if (!selectedInstrumentId) {
        return null;
    }

    const { HistorySection } =
        require("home/history") as typeof import("home/history");

    return <HistorySection oids={[selectedInstrumentId]} simple={true} />;
});

export const Properties = observer(
    class Properties extends React.Component {
        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "Toolbar") {
                return <InstrumentToolbarEnclosure />;
            }

            if (component === "Properties") {
                return <InstrumentPropertiesEnclosure />;
            }

            if (component === "Connection") {
                return <InstrumentConnectionEnclosure />;
            }

            if (component === "History") {
                return <HistoryEnclosure />;
            }

            return null;
        };

        render() {
            const selectedInstrumentId = selectedInstrument.get();
            if (!selectedInstrumentId) {
                return null;
            }

            return (
                <FlexLayoutContainer
                    model={homeLayoutModels.instrumentProperties}
                    factory={this.factory}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const InstrumentComponent = observer(
    class InstrumentComponent extends React.Component<
        {
            instrument: InstrumentObject;
            isSelected: boolean;
            selectInstrument: (instrument: InstrumentObject) => void;
        },
        {}
    > {
        ref = React.createRef<HTMLDivElement>();

        open = () => {
            openEditor(this.props.instrument, "default");
        };

        componentDidUpdate() {
            if (this.props.isSelected) {
                this.ref.current!.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth"
                });
            }
        }

        render() {
            const { instrument } = this.props;

            return (
                <div
                    ref={this.ref}
                    className={classNames(
                        "EezStudio_InstrumentComponentEnclosure shadow-sm p-3 m-3 rounded bg-light",
                        {
                            selected: this.props.isSelected
                        }
                    )}
                    onClick={() => this.props.selectInstrument(instrument)}
                    onDoubleClick={this.open}
                    onContextMenu={() => {
                        runInAction(() =>
                            selectedInstrument.set(instrument.id)
                        );
                        const contextMenu = workbenchDocument.createContextMenu(
                            [instrument]
                        );
                        contextMenu.popup({});
                    }}
                >
                    <InstrumentContent instrument={instrument} />
                </div>
            );
        }
    }
);

export const WorkbenchDocumentComponent = observer(
    class WorkbenchDocumentComponent extends React.Component {
        render() {
            return (
                <div className="EezStudio_WorkbenchDocument d-flex flex-wrap justify-content-center align-items-center">
                    {workbenchDocument.instruments
                        .sort((a, b) => stringCompare(a.name, b.name))
                        .map(obj => (
                            <InstrumentComponent
                                key={obj.id}
                                instrument={obj}
                                isSelected={obj.id == selectedInstrument.get()}
                                selectInstrument={action(instrument =>
                                    selectedInstrument.set(instrument.id)
                                )}
                            />
                        ))}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const InstrumentContent = observer(
    class InstrumentContent extends React.Component<{
        instrument: InstrumentObject;
    }> {
        render() {
            const { instrument } = this.props;
            return (
                <div className="EezStudio_InstrumentContent">
                    {instrument.image && (
                        <img src={instrument.image} draggable={false} />
                    )}
                    <div className="EezStudio_InstrumentLabel">
                        {instrument.name}
                    </div>
                    <div className="EezStudio_InstrumentConnectionState">
                        <span
                            style={{
                                backgroundColor:
                                    instrument.connectionState.color
                            }}
                        />
                        <span>{instrument.connectionState.label}</span>
                        {instrument.connectionState.error && (
                            <Icon
                                className="text-danger"
                                icon="material:error"
                            />
                        )}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Workbench = observer(
    class Workbench extends React.Component {
        divRef = React.createRef<HTMLDivElement>();
        resizeObserver: ResizeObserver;
        collapseButtons: boolean;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                collapseButtons: observable
            });

            this.resizeObserver = new ResizeObserver(
                this.resizeObserverCallback
            );
        }

        componentDidMount(): void {
            if (this.divRef.current) {
                this.resizeObserver.observe(this.divRef.current);
            }
        }

        componentWillUnmount() {
            if (this.divRef.current) {
                this.resizeObserver.unobserve(this.divRef.current);
            }
        }

        resizeObserverCallback = action(() => {
            if (this.divRef.current) {
                let rect = this.divRef.current.getBoundingClientRect();

                runInAction(() => {
                    this.collapseButtons = rect.width < 860;
                });
            }
        });

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "Workbench") {
                return <WorkbenchDocumentComponent />;
            }

            if (component === "SelectedInstrument") {
                return <Properties />;
            }

            return null;
        };

        render() {
            return (
                <div
                    className="EezStudio_HomeTab_Instruments"
                    ref={this.divRef}
                >
                    <VerticalHeaderWithBody>
                        <Header>
                            <WorkbenchToolbar
                                collapseButtons={this.collapseButtons}
                            />
                        </Header>
                        <Body>
                            <FlexLayoutContainer
                                model={homeLayoutModels.instrumentsBody}
                                factory={this.factory}
                            />
                        </Body>
                    </VerticalHeaderWithBody>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Projects = observer(
    class Projects extends React.Component {
        selectedFilePath: string | undefined;

        searchText: string = "";

        sortAlphabetically: boolean = false;

        collapseButtons: boolean;

        constructor(props: any) {
            super(props);

            this.sortAlphabetically =
                localStorage.getItem("homeTabProjectsSort") == "alphabetically"
                    ? true
                    : false;

            makeObservable(this, {
                selectedFilePath: observable,
                searchText: observable,
                sortAlphabetically: observable,
                mru: computed,
                mruAlpha: computed,
                onSearchChange: action.bound,
                collapseButtons: observable
            });
        }

        get mruAlpha() {
            const mru = [...settingsController.mru];
            mru.sort((mruItem1, mruItem2) => {
                const baseName1 = path.basename(mruItem1.filePath);
                const baseName2 = path.basename(mruItem2.filePath);
                return stringCompare(baseName1, baseName2);
            });
            return mru;
        }

        get mru() {
            return this.sortAlphabetically
                ? this.mruAlpha
                : settingsController.mru;
        }

        toggleSort = () => {
            runInAction(
                () => (this.sortAlphabetically = !this.sortAlphabetically)
            );

            localStorage.setItem(
                "homeTabProjectsSort",
                this.sortAlphabetically ? "alphabetically" : "most-recent"
            );
        };

        onSearchChange(event: any) {
            this.searchText = ($(event.target).val() as string).trim();
        }

        onContextMenu = (node: IListNode<IMruItem>) => {
            runInAction(() => (this.selectedFilePath = node.data.filePath));

            const menu = new Menu();

            menu.append(
                new MenuItem({
                    label: "Run",
                    click: action(() => {
                        ipcRenderer.send("open-file", node.data.filePath, true);
                    })
                })
            );

            menu.append(
                new MenuItem({
                    label: "Remove From List",
                    click: action(() => {
                        settingsController.removeItemFromMRU(node.data);
                    })
                })
            );

            menu.append(
                new MenuItem({
                    label: "Copy Path",
                    click: action(() => {
                        clipboard.writeText(node.data.filePath);
                    })
                })
            );

            menu.popup();
        };

        render() {
            return (
                <div className="EezStudio_HomeTab_Projects">
                    <VerticalHeaderWithBody>
                        <Header>
                            <ButtonAction
                                text={
                                    this.collapseButtons
                                        ? "Open"
                                        : "Open Project"
                                }
                                title="Open Project"
                                className="btn-primary"
                                onClick={() => {
                                    ipcRenderer.send("open-project");
                                }}
                            />
                            <SearchInput
                                searchText={this.searchText}
                                onClear={action(() => {
                                    this.searchText = "";
                                })}
                                onChange={this.onSearchChange}
                                onKeyDown={this.onSearchChange}
                            />
                            <IconAction
                                icon={
                                    this.sortAlphabetically
                                        ? SORT_ALPHA_ICON
                                        : SORT_RECENT_ICON
                                }
                                title={
                                    this.sortAlphabetically
                                        ? "Sort alphabetically"
                                        : "Show most recent first"
                                }
                                onClick={this.toggleSort}
                            />
                        </Header>
                        <Body>
                            <ListContainer tabIndex={0}>
                                <List
                                    nodes={this.mru
                                        .filter(
                                            mruItem =>
                                                mruItem.filePath
                                                    .toLowerCase()
                                                    .indexOf(
                                                        this.searchText.toLowerCase()
                                                    ) != -1
                                        )
                                        .map(mruItem => ({
                                            id: mruItem.filePath,
                                            data: mruItem,
                                            selected:
                                                mruItem.filePath ==
                                                this.selectedFilePath
                                        }))}
                                    renderNode={(node: IListNode<IMruItem>) => {
                                        let mruItem = node.data;

                                        const isProject =
                                            mruItem.filePath.endsWith(
                                                ".eez-project"
                                            );

                                        let extension = isProject
                                            ? ".eez-project"
                                            : ".eez-dashboard";

                                        const baseName = path.basename(
                                            mruItem.filePath,
                                            extension
                                        );

                                        return (
                                            <ListItem
                                                leftIcon={getProjectIcon(
                                                    mruItem.filePath,
                                                    mruItem.projectType,
                                                    48,
                                                    mruItem.hasFlowSupport
                                                )}
                                                leftIconSize={48}
                                                label={
                                                    <div
                                                        className="EezStudio_HomeTab_ProjectItem"
                                                        title={mruItem.filePath}
                                                    >
                                                        <div className="first-line">
                                                            <span className="fw-bolder">
                                                                {baseName}
                                                            </span>
                                                            <span>
                                                                {extension}
                                                            </span>
                                                        </div>
                                                        <div className="text-secondary">
                                                            {path.dirname(
                                                                mruItem.filePath
                                                            )}
                                                        </div>
                                                    </div>
                                                }
                                            />
                                        );
                                    }}
                                    selectNode={(node: IListNode<IMruItem>) => {
                                        runInAction(
                                            () =>
                                                (this.selectedFilePath =
                                                    node.data.filePath)
                                        );

                                        ipcRenderer.send(
                                            "open-file",
                                            node.data.filePath
                                        );
                                    }}
                                    onContextMenu={this.onContextMenu}
                                ></List>
                            </ListContainer>
                        </Body>
                    </VerticalHeaderWithBody>
                </div>
            );
        }
    }
);

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

const HOME_TAB_OPEN_ICON = (
    <svg fill="currentColor" viewBox="0 0 256 256">
        <path d="M245 110.64a16 16 0 0 0-13-6.64h-16V88a16 16 0 0 0-16-16h-69.33l-27.73-20.8a16.14 16.14 0 0 0-9.6-3.2H40a16 16 0 0 0-16 16v144a8 8 0 0 0 8 8h179.1a8 8 0 0 0 7.59-5.47l28.49-85.47a16.05 16.05 0 0 0-2.18-14.42ZM93.34 64l27.73 20.8a16.12 16.12 0 0 0 9.6 3.2H200v16H69.77a16 16 0 0 0-15.18 10.94L40 158.7V64Z" />
    </svg>
);

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
                                    wizardModel.switchToTemplates();
                                })}
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
                                    wizardModel.switchToExamples();
                                })}
                            >
                                <Icon icon={HOME_TAB_EXAMPLES_ICON} size={32} />{" "}
                                Examples
                            </div>
                            <div
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
                            >
                                <Icon icon="material:apps" size={32} /> Run
                            </div>
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
                                modalDialog={observable.box<any>()}
                            />
                        )}
                        {homeTabStore.activeTab == "examples" && (
                            <NewProjectWizard
                                modalDialog={observable.box<any>()}
                            />
                        )}
                        {homeTabStore.activeTab == "run" && (
                            <div style={{ margin: "auto" }}></div>
                        )}
                        {homeTabStore.activeTab == "instruments" && (
                            <Workbench />
                        )}
                        {homeTabStore.activeTab == "extensions" && (
                            <ExtensionsManager />
                        )}
                        {homeTabStore.activeTab == "settings" && (
                            <div style={{ margin: "10px auto" }}>
                                <Settings />
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

import path from "path";
import { ipcRenderer } from "electron";
import { Menu, MenuItem } from "@electron/remote";
import React from "react";
import {
    computed,
    action,
    observable,
    toJS,
    runInAction,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import {
    VerticalHeaderWithBody,
    Header,
    Body,
    ToolbarHeader
} from "eez-studio-ui/header-with-body";
import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import type * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";

import {
    showDeletedInstrumentsDialog,
    deletedInstruments
} from "instrument/deleted-instruments-dialog";

import { HistorySection } from "home/history";

import classNames from "classnames";
import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import type { ITabDefinition } from "home/tabs-store";

import { instruments, InstrumentObject } from "instrument/instrument-object";
import { instrumentStore } from "instrument/instrument-object";
import {
    InstrumentDetails,
    installExtension
} from "instrument/instrument-object-details";
import { tabs } from "home/tabs-store";
import { IListNode, List, ListContainer, ListItem } from "eez-studio-ui/list";
import { settingsController } from "home/settings";
import { IMruItem } from "main/settings";
import { SearchInput } from "eez-studio-ui/search-input";
import { getProjectIcon } from "home/helper";
import { Setup } from "./setup";
import { firstTime } from "./first-time";
import { homeLayoutModels } from "home/home-layout-models";
import { NewProjectWizard } from "project-editor/project/ui/Wizard";

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
    class WorkbenchToolbar extends React.Component<{ onClose: () => void }> {
        get buttons() {
            let buttons = [
                {
                    id: "instrument-add",
                    label: "Add Instrument",
                    title: "Add instrument",
                    className: "btn-success",
                    onClick: () => {
                        const { showAddInstrumentDialog } =
                            require("instrument/add-instrument-dialog") as typeof AddInstrumentDialogModule;

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

            if (deletedInstruments.size > 0) {
                buttons.push({
                    id: "show-deleted-instruments",
                    label: "Deleted Instruments",
                    title: "Show deleted instruments",
                    className: "btn-secondary",
                    onClick: () => {
                        showDeletedInstrumentsDialog(selectedInstrument);
                    }
                });
            }

            return buttons;
        }

        render() {
            return (
                <ToolbarHeader>
                    <h5>Instruments</h5>
                    <div>
                        {this.buttons.map((button, i) => (
                            <ButtonAction
                                key={button.id}
                                text={button.label}
                                title={button.title}
                                className={button.className}
                                onClick={button.onClick}
                                style={{
                                    marginRight:
                                        this.buttons.length - 1 == i ? 20 : 10
                                }}
                            />
                        ))}
                        {tabs.allTabs
                            .filter(
                                tab => tab.instance.category == "instrument"
                            )
                            .map(tab => (
                                <TabButton key={tab.instance.id} tab={tab} />
                            ))}
                        {tabs.homeSectionsVisibilityOption == "both" && (
                            <IconAction
                                icon="material:close"
                                title="Hide this section"
                                onClick={this.props.onClose}
                            />
                        )}
                    </div>
                </ToolbarHeader>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return <div className="EezStudio_PanelTitle">{this.props.title}</div>;
    }
}

const InstrumentDetailsEnclosure = observer(() => {
    const selectedInstrumentId = selectedInstrument.get();
    if (!selectedInstrumentId) {
        return null;
    }
    const instrument = instruments.get(selectedInstrumentId);
    if (!instrument) {
        return null;
    }

    return (
        <div className="EezStudio_InstrumentDetailsEnclosure">
            <InstrumentDetails instrument={instrument} />
        </div>
    );
});

const HistoryEnclosure = observer(() => {
    const selectedInstrumentId = selectedInstrument.get();
    if (!selectedInstrumentId) {
        return null;
    }

    return (
        <div className="EezStudio_HistoryContainer">
            <PanelTitle title="History" />
            <div className="EezStudio_HistoryContent">
                <HistorySection oids={[selectedInstrumentId]} simple={true} />
            </div>
        </div>
    );
});

export const Properties = observer(
    class Properties extends React.Component {
        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "Details") {
                return <InstrumentDetailsEnclosure />;
            }

            if (component === "History") {
                return <HistoryEnclosure />;
            }

            return null;
        };

        render() {
            return (
                <FlexLayout.Layout
                    model={homeLayoutModels.instrumentProperties}
                    factory={this.factory}
                    realtimeResize={true}
                    font={{
                        size: "small"
                    }}
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
    class Workbench extends React.Component<{ onClose: () => void }> {
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
                <VerticalHeaderWithBody>
                    <Header>
                        <WorkbenchToolbar onClose={this.props.onClose} />
                    </Header>
                    <Body>
                        {firstTime.get() ? (
                            <Setup onlyBody={false} />
                        ) : (
                            <FlexLayout.Layout
                                model={homeLayoutModels.instrumentsBody}
                                factory={this.factory}
                                realtimeResize={true}
                                font={{
                                    size: "small"
                                }}
                            />
                        )}
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Projects = observer(
    class Projects extends React.Component<{ onClose: () => void }> {
        selectedFilePath: string | undefined;

        searchText: string = "";

        sortAlphabetically: boolean = false;

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
                onSearchChange: action.bound
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

        render() {
            return (
                <VerticalHeaderWithBody>
                    <Header>
                        <ToolbarHeader>
                            <h5>Projects</h5>
                            <div>
                                {tabs.homeSectionsVisibilityOption ==
                                    "both" && (
                                    <ButtonAction
                                        text="New Project"
                                        title="New Project"
                                        className="btn-success"
                                        onClick={async () => {
                                            const { showNewProjectWizard } =
                                                await import(
                                                    "project-editor/project/ui/Wizard"
                                                );
                                            showNewProjectWizard();
                                        }}
                                        style={{ height: 38 }}
                                    />
                                )}
                                <ButtonAction
                                    text="Open Project"
                                    title="Open Project"
                                    className="btn-primary"
                                    onClick={() => {
                                        ipcRenderer.send("open-project");
                                    }}
                                />
                                {tabs.homeSectionsVisibilityOption ==
                                    "both" && (
                                    <IconAction
                                        icon="material:close"
                                        title="Hide this section"
                                        onClick={this.props.onClose}
                                    />
                                )}
                            </div>
                        </ToolbarHeader>
                    </Header>
                    <Body>
                        <div className="d-flex">
                            <SearchInput
                                searchText={this.searchText}
                                onClear={action(() => {
                                    this.searchText = "";
                                })}
                                onChange={this.onSearchChange}
                                onKeyDown={this.onSearchChange}
                            />
                            <div className="sort-button">
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
                            </div>
                        </div>
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
                                                48
                                            )}
                                            leftIconSize={48}
                                            label={
                                                <div
                                                    className="EezStudio_HomeTab_ProjectItem"
                                                    title={mruItem.filePath}
                                                >
                                                    <div className="fist-line">
                                                        <span className="fw-bolder">
                                                            {baseName}
                                                        </span>
                                                        <span>{extension}</span>
                                                    </div>
                                                    <div className="text-secondary">
                                                        {path.dirname(
                                                            mruItem.filePath
                                                        )}
                                                    </div>
                                                    <Icon
                                                        className="remove-icon"
                                                        icon="material:close"
                                                        title="Remove project from the list"
                                                        onClick={event => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            settingsController.removeItemFromMRU(
                                                                mruItem
                                                            );
                                                        }}
                                                    />
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
                            ></List>
                        </ListContainer>
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const Home = observer(
    class Home extends React.Component {
        constructor(props: {}) {
            super(props);

            makeObservable(this, {
                selectInstrument: action.bound
            });
        }

        selectInstrument(instrument: InstrumentObject) {
            selectedInstrument.set(instrument.id);
        }

        get layoutModel() {
            if (tabs.homeSectionsVisibilityOption == "both") {
                return homeLayoutModels.projectsAndInstruments;
            } else if (tabs.homeSectionsVisibilityOption == "projects") {
                return homeLayoutModels.projects;
            } else {
                return homeLayoutModels.instruments;
            }
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "Projects") {
                return (
                    <div className="EezStudio_HomeTab_Projects">
                        <Projects
                            onClose={() =>
                                (tabs.homeSectionsVisibilityOption =
                                    "instruments")
                            }
                        />
                    </div>
                );
            }

            if (component === "Wizard") {
                return (
                    <VerticalHeaderWithBody className="EezStudio_HomeTab_NewProjectWizard">
                        <Header>
                            <ToolbarHeader>
                                <h5>New Project</h5>
                                <div></div>
                            </ToolbarHeader>
                        </Header>
                        <Body>
                            <NewProjectWizard
                                modalDialog={observable.box<any>()}
                            />
                        </Body>
                    </VerticalHeaderWithBody>
                );
            }

            if (component === "Instruments") {
                return (
                    <div className="EezStudio_HomeTab_Instruments">
                        <Workbench
                            onClose={() =>
                                (tabs.homeSectionsVisibilityOption = "projects")
                            }
                        />
                    </div>
                );
            }

            return null;
        };

        render() {
            const showSectionButtonText =
                tabs.homeSectionsVisibilityOption == "projects"
                    ? "Show Instruments"
                    : tabs.homeSectionsVisibilityOption == "instruments"
                    ? "Show Projects"
                    : null;

            return (
                <div className="EezStudio_HomeTab">
                    <div className="EezStudio_HomeTab_Tabs">
                        <div className="EezStudio_HomeTab_TabsContainer">
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
                        </div>
                        {showSectionButtonText && (
                            <button
                                key={"show-home-section"}
                                className="btn btn btn-secondary"
                                onClick={() =>
                                    (tabs.homeSectionsVisibilityOption = "both")
                                }
                                title={showSectionButtonText + " Section"}
                            >
                                <span>{showSectionButtonText}</span>
                            </button>
                        )}
                    </div>
                    <div className="EezStudio_HomeTab_Projects_And_Instruments">
                        <FlexLayout.Layout
                            model={this.layoutModel}
                            factory={this.factory}
                            realtimeResize={true}
                            font={{
                                size: "small"
                            }}
                        />
                    </div>
                </div>
            );
        }
    }
);

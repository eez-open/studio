import path from "path";
import React from "react";
import { computed, action, observable, toJS, runInAction } from "mobx";
import { observer } from "mobx-react";

import {
    VerticalHeaderWithBody,
    Header,
    Body,
    ToolbarHeader
} from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";
import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import type * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";
import type * as DeletedInstrumentsDialogModule from "instrument/deleted-instruments-dialog";

import { getAppStore, HistorySection } from "home/history";

import classNames from "classnames";
import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import type * as TabsStoreModule from "home/tabs-store";

const { Menu, MenuItem } = EEZStudio.remote;

import { instruments, InstrumentObject } from "instrument/instrument-object";
import { instrumentStore } from "instrument/instrument-object";
import {
    InstrumentDetails,
    installExtension
} from "instrument/instrument-object-details";
import { tabs } from "home/tabs-store";
import { SessionInfo } from "instrument/window/history/session/info-view";
import { IListNode, List, ListContainer, ListItem } from "eez-studio-ui/list";
import { settingsController } from "home/settings";
import { IMruItem } from "main/settings";

////////////////////////////////////////////////////////////////////////////////

const selectedInstrument = observable.box<string | undefined>();

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
            EEZStudio.electron.ipcRenderer.sendSync(
                "focusWindow",
                instrument.getEditorWindowArgs()
            )
        ) {
            return;
        }
        target = "tab";
    }

    const { tabs } = require("home/tabs-store") as typeof TabsStoreModule;

    if (target === "tab") {
        const tab = tabs.findTab(instrument.id);
        if (tab) {
            // tab already exists
            tabs.makeActive(tab);
        } else {
            // close window if open
            EEZStudio.electron.ipcRenderer.send(
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
        EEZStudio.electron.ipcRenderer.send(
            "openWindow",
            toJS(instrument.getEditorWindowArgs())
        );
    }
}

window.onmessage = (message: any) => {
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
};

////////////////////////////////////////////////////////////////////////////////

class WorkbenchDocument {
    @computed
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
                const { MenuItem } = EEZStudio.remote;

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

@observer
export class WorkbenchToolbar extends React.Component {
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

        const { showDeletedInstrumentsDialog, deletedInstruments } =
            require("instrument/deleted-instruments-dialog") as typeof DeletedInstrumentsDialogModule;

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
                    {this.buttons.map(button => (
                        <ButtonAction
                            key={button.id}
                            text={button.label}
                            title={button.title}
                            className={button.className}
                            onClick={button.onClick}
                        />
                    ))}
                </div>
            </ToolbarHeader>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return <div className="EezStudio_PanelTitle">{this.props.title}</div>;
    }
}

@observer
export class Properties extends React.Component<{
    selectedInstrumentId: string | undefined;
}> {
    render() {
        if (!this.props.selectedInstrumentId) {
            return <div />;
        }

        let history = (
            <div className="EezStudio_HistoryContainer">
                <PanelTitle title="History" />
                <div className="EezStudio_HistoryContent">
                    <HistorySection
                        oids={[this.props.selectedInstrumentId]}
                        simple={true}
                    />
                </div>
            </div>
        );

        const instrument = instruments.get(this.props.selectedInstrumentId);

        return (
            <Splitter
                type="vertical"
                sizes={"100%|240px"}
                persistId={"home/designer/properties/splitter"}
            >
                <div className="EezStudio_InstrumentDetailsEnclosure">
                    {instrument && (
                        <InstrumentDetails instrument={instrument} />
                    )}
                </div>
                {history}
            </Splitter>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
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
                    runInAction(() => selectedInstrument.set(instrument.id));
                    const contextMenu = workbenchDocument.createContextMenu([
                        instrument
                    ]);
                    contextMenu.popup({});
                }}
            >
                <InstrumentContent instrument={instrument} />
            </div>
        );
    }
}

@observer
export class WorkbenchDocumentComponent extends React.Component<{
    selectedInstrumentId: string | undefined;
    selectInstrument: (instrument: InstrumentObject) => void;
}> {
    render() {
        return (
            <div className="EezStudio_WorkbenchDocument d-flex flex-wrap justify-content-center align-items-center">
                {workbenchDocument.instruments
                    .sort((a, b) => stringCompare(a.name, b.name))
                    .map(obj => (
                        <InstrumentComponent
                            key={obj.id}
                            instrument={obj}
                            isSelected={
                                obj.id == this.props.selectedInstrumentId
                            }
                            selectInstrument={this.props.selectInstrument}
                        />
                    ))}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class InstrumentContent extends React.Component<{
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
                            backgroundColor: instrument.connectionState.color
                        }}
                    />
                    <span>{instrument.connectionState.label}</span>
                    {instrument.connectionState.error && (
                        <Icon className="text-danger" icon="material:error" />
                    )}
                </div>
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Workbench extends React.Component<{}, {}> {
    @action.bound
    selectInstrument(instrument: InstrumentObject) {
        selectedInstrument.set(instrument.id);
    }

    render() {
        return (
            <VerticalHeaderWithBody>
                <Header>
                    <WorkbenchToolbar />
                </Header>
                <Body>
                    <Splitter
                        type="horizontal"
                        sizes={/*"240px|100%|240px"*/ "100%|240px"}
                        persistId="home/designer/splitter"
                    >
                        <WorkbenchDocumentComponent
                            selectedInstrumentId={selectedInstrument.get()}
                            selectInstrument={this.selectInstrument}
                        />

                        <Properties
                            selectedInstrumentId={selectedInstrument.get()}
                        />
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

class AddTabPopupStuff {
    @computed get sessionInfo() {
        const appStore = getAppStore();
        return !appStore.history.sessions.activeSession;
    }
}

const theAddTabPopupStuff = new AddTabPopupStuff();

////////////////////////////////////////////////////////////////////////////////

@observer
class Projects extends React.Component {
    @observable selectedFilePath: string | undefined;

    render() {
        return (
            <VerticalHeaderWithBody>
                <Header>
                    <ToolbarHeader>
                        <h5>Projects</h5>
                        <div>
                            <ButtonAction
                                text="New Project"
                                title="New Project"
                                className="btn-success"
                                onClick={async () => {
                                    const { showNewProjectWizard } =
                                        await import(
                                            "project-editor/project/Wizard"
                                        );
                                    showNewProjectWizard();
                                }}
                            />
                            <ButtonAction
                                text="Open Project"
                                title="Open Project"
                                className="btn-primary"
                                onClick={() => {
                                    EEZStudio.electron.ipcRenderer.send(
                                        "open-project"
                                    );
                                }}
                            />
                        </div>
                    </ToolbarHeader>
                </Header>
                <Body>
                    <ListContainer tabIndex={0}>
                        <List
                            nodes={settingsController.mru.map(mruItem => ({
                                id: mruItem.filePath,
                                data: mruItem,
                                selected:
                                    mruItem.filePath == this.selectedFilePath
                            }))}
                            renderNode={(node: IListNode<IMruItem>) => {
                                let mruItem = node.data;

                                const isProject =
                                    mruItem.filePath.endsWith(".eez-project");

                                let extension = isProject
                                    ? ".eez-project"
                                    : ".eez-dashboard";

                                const baseName = path.basename(
                                    mruItem.filePath,
                                    extension
                                );

                                return (
                                    <ListItem
                                        leftIcon={
                                            isProject
                                                ? "../eez-studio-ui/_images/eez-project.png"
                                                : "../eez-studio-ui/_images/eez-dashboard.png"
                                        }
                                        leftIconSize={48}
                                        label={
                                            <div className="EezStudio_HomeTab_ProjectItem">
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
                                                <IconAction
                                                    icon="material:close"
                                                    title="Remove project from the list"
                                                    className="btn-secondary"
                                                    onClick={() => {
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

                                EEZStudio.electron.ipcRenderer.send(
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

////////////////////////////////////////////////////////////////////////////////

@observer
export class Home extends React.Component<{}, {}> {
    @action.bound
    selectInstrument(instrument: InstrumentObject) {
        selectedInstrument.set(instrument.id);
    }

    render() {
        let allTabs = (
            <div className="EezStudio_HomeTab_TabsContainer">
                {tabs.allTabs
                    .filter(tab => tab.instance.id != "home")
                    .map(tab => {
                        let icon;
                        if (typeof tab.instance.icon == "string") {
                            icon = <Icon icon={tab.instance.icon} />;
                        } else {
                            icon = tab.instance.icon;
                        }
                        return (
                            <button
                                key={tab.instance.id}
                                className="btn btn btn-secondary"
                                onClick={() => tab.open().makeActive()}
                                title={
                                    tab.instance.tooltipTitle
                                        ? tab.instance.tooltipTitle
                                        : `Show ${tab.instance.title} Tab`
                                }
                            >
                                {icon}
                                <span>{tab.instance.title}</span>
                            </button>
                        );
                    })}
            </div>
        );

        let sessionInfo;
        const appStore = getAppStore();
        if (theAddTabPopupStuff.sessionInfo) {
            sessionInfo = (
                <div className="EezStudio_SessionInfoContainer">
                    <SessionInfo appStore={appStore} />
                </div>
            );
        }

        return (
            <div className="EezStudio_HomeTab">
                <div className="EezStudio_HomeTab_Tabs_And_SessionInfo">
                    {allTabs}
                    {sessionInfo}
                </div>
                <div className="EezStudio_HomeTab_Projects_And_Instruments">
                    <Splitter
                        type="horizontal"
                        sizes={"35%|65%"}
                        persistId={
                            "home/home-tab/projects-and-instruments-splitter"
                        }
                    >
                        <div className="EezStudio_HomeTab_Projects">
                            <Projects />
                        </div>
                        <div className="EezStudio_HomeTab_Instruments">
                            <Workbench />
                        </div>
                    </Splitter>
                </div>
            </div>
        );
    }
}

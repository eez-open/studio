import { ipcRenderer } from "electron";
import { Menu, MenuItem, dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    computed,
    observable,
    toJS,
    runInAction,
    makeObservable,
    action
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { ToolbarHeader } from "eez-studio-ui/header-with-body";
import { ButtonAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import { instruments, InstrumentObject } from "instrument/instrument-object";

import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import type { ITabDefinition } from "home/tabs-store";

import { tabs } from "home/tabs-store";
import {
    deletedInstruments,
    showDeletedInstrumentsDialog
} from "home/instruments/deleted-instruments-dialog";
import { ConnectionParameters } from "instrument/connection/interface";
import { Loader } from "eez-studio-ui/loader";
import { SearchInput } from "eez-studio-ui/search-input";
import { showExportDialog } from "./export-dialog";
import { showImportDialog } from "./import-dialog";

////////////////////////////////////////////////////////////////////////////////

export class InstrumentsStore {
    _selectedInstrumentId: string | undefined;
    connectionParameters: ConnectionParameters | null;
    searchText: string;

    onSelectInstrument: (() => void) | undefined;

    constructor(public selectInstrument: boolean) {
        makeObservable(this, {
            _selectedInstrumentId: observable,
            searchText: observable,
            selectedInstrumentId: computed,
            selectedInstrument: computed,
            instruments: computed,
            onSearchChange: action.bound
        });
    }

    get selectedInstrumentId() {
        return this._selectedInstrumentId
            ? this._selectedInstrumentId
            : this.instruments.length > 0
            ? this.instruments[0].id
            : undefined;
    }

    set selectedInstrumentId(id: string | undefined) {
        runInAction(() => {
            this._selectedInstrumentId = id;
        });
    }

    get instruments() {
        return Array.from(instruments.values())
            .filter(
                instrument =>
                    (this.searchText || "").trim().length == 0 ||
                    instrument.name
                        .toLowerCase()
                        .indexOf(this.searchText.trim().toLowerCase()) != -1
            )
            .sort((a, b) => stringCompare(a.name, b.name));
    }

    get selectedInstrument() {
        const selectedInstrumentId = this.selectedInstrumentId;
        return selectedInstrumentId
            ? instruments.get(selectedInstrumentId)
            : undefined;
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

    createContextMenu(instrument: InstrumentObject) {
        const menu = new Menu();

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
                            require("home/instruments/instrument-object-details") as typeof import("home/instruments/instrument-object-details");
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

        menu.append(
            new MenuItem({
                type: "separator"
            })
        );

        menu.append(
            new MenuItem({
                label: "Delete",
                click: () => {
                    this.deleteInstruments([instrument]);
                }
            })
        );

        return menu;
    }

    selectedInstrumentConnect() {
        const instrument = this.selectedInstrument;
        if (!instrument) {
            return;
        }

        let connection = instrument.connection;
        if (!connection) {
            return;
        }

        if (this.connectionParameters) {
            instrument.setConnectionParameters(this.connectionParameters);
            this.connectionParameters = null;
        } else if (!instrument.lastConnection) {
            instrument.setConnectionParameters(
                instrument.defaultConnectionParameters
            );
        }

        connection.connect();
    }

    onSearchChange(event: any) {
        this.searchText = ($(event.target).val() as string).trim();

        if (this.instruments.length > 0) {
            this.selectedInstrumentId = this.instruments[0].id;
        } else {
            this.selectedInstrumentId = undefined;
        }
    }
}

export const defaultInstrumentsStore = new InstrumentsStore(false);

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

////////////////////////////////////////////////////////////////////////////////

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

///////////////////////////////////////////////////////////////////////////////

const Toolbar = observer(
    class Toolbar extends React.Component<{
        instrumentsStore: InstrumentsStore;
    }> {
        render() {
            let buttons: {
                id: string;
                label: string;
                icon?: any;
                title: string;
                className: string;
                style?: React.CSSProperties;
                onClick: () => void;
                enabled?: boolean;
            }[] = [
                {
                    id: "instrument-add",
                    label: "Add Instrument",
                    title: "Add instrument",
                    className: "btn-success",
                    style:
                        deletedInstruments.size == 0
                            ? {
                                  marginRight: 20
                              }
                            : undefined,
                    onClick: () => {
                        const { showAddInstrumentDialog } =
                            require("instrument/add-instrument-dialog") as typeof import("instrument/add-instrument-dialog");

                        showAddInstrumentDialog(instrumentId => {
                            setTimeout(() => {
                                this.props.instrumentsStore.selectedInstrumentId =
                                    instrumentId;
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
                    style: { marginRight: 20 },
                    onClick: () => {
                        showDeletedInstrumentsDialog(
                            this.props.instrumentsStore
                        );
                    }
                });
            }

            buttons.push({
                id: "export-instrument",
                label: "Export",
                icon: (
                    <svg viewBox="0 0 24 24" fill="currentcolor">
                        <path d="M8.71 7.71 11 5.41V15a1 1 0 0 0 2 0V5.41l2.29 2.3a1 1 0 0 0 1.42 0 1 1 0 0 0 0-1.42l-4-4a1 1 0 0 0-.33-.21 1 1 0 0 0-.76 0 1 1 0 0 0-.33.21l-4 4a1 1 0 1 0 1.42 1.42M21 14a1 1 0 0 0-1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 0-2 0v4a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4a1 1 0 0 0-1-1" />
                    </svg>
                ),
                title: "Export to database",
                className: "btn-secondary",
                onClick: () => {
                    showExportDialog(this.props.instrumentsStore);
                }
            });

            buttons.push({
                id: "import-instrument",
                label: "Import",
                icon: (
                    <svg viewBox="0 0 24 24" fill="currentcolor">
                        <path d="M21 14a1 1 0 0 0-1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 0-2 0v4a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4a1 1 0 0 0-1-1m-9.71 1.71a1 1 0 0 0 .33.21.94.94 0 0 0 .76 0 1 1 0 0 0 .33-.21l4-4a1 1 0 0 0-1.42-1.42L13 12.59V3a1 1 0 0 0-2 0v9.59l-2.29-2.3a1 1 0 1 0-1.42 1.42Z" />
                    </svg>
                ),
                title: "Import from database",
                className: "btn-secondary",
                onClick: async () => {
                    let defaultPath = window.localStorage.getItem(
                        "lastDatabaseOpenPath"
                    );

                    const result = await dialog.showOpenDialog(
                        getCurrentWindow(),
                        {
                            properties: ["openFile"],
                            filters: [
                                { name: "DB files", extensions: ["db"] },
                                { name: "All Files", extensions: ["*"] }
                            ],
                            defaultPath: defaultPath ?? undefined
                        }
                    );

                    const filePaths = result.filePaths;

                    if (filePaths && filePaths[0]) {
                        const filePath = filePaths[0];
                        showImportDialog(this.props.instrumentsStore, filePath);
                    }
                }
            });

            return (
                <ToolbarHeader>
                    {buttons.map((button, i) => (
                        <ButtonAction
                            key={button.id}
                            text={button.label}
                            title={button.title}
                            icon={button.icon}
                            className={button.className}
                            onClick={button.onClick}
                            style={Object.assign(
                                {
                                    marginRight:
                                        buttons.length - 1 == i ? 20 : 10
                                },
                                button.style
                            )}
                            enabled={button.enabled}
                        />
                    ))}
                    {!this.props.instrumentsStore.selectInstrument &&
                        tabs.allTabs
                            .filter(
                                tab => tab.instance.category == "instrument"
                            )
                            .map(tab => (
                                <TabButton key={tab.instance.id} tab={tab} />
                            ))}
                </ToolbarHeader>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const InstrumentToolbarEnclosure = observer(
    ({ instrumentsStore }: { instrumentsStore: InstrumentsStore }) => {
        if (!instrumentsStore.selectedInstrumentId) {
            return null;
        }

        const { instruments } =
            require("instrument/instrument-object") as typeof import("instrument/instrument-object");

        const instrument = instruments.get(
            instrumentsStore.selectedInstrumentId
        );
        if (!instrument) {
            return null;
        }

        const { InstrumentToolbar } =
            require("home/instruments/instrument-object-details") as typeof import("home/instruments/instrument-object-details");

        return (
            <div className="EezStudio_InstrumentToolbarEnclosure">
                <InstrumentToolbar
                    instrumentsStore={instrumentsStore}
                    instrument={instrument}
                />
            </div>
        );
    }
);

const InstrumentPropertiesEnclosure = observer(
    ({ instrumentsStore }: { instrumentsStore: InstrumentsStore }) => {
        if (!instrumentsStore.selectedInstrumentId) {
            return null;
        }

        const { instruments } =
            require("instrument/instrument-object") as typeof import("instrument/instrument-object");

        const instrument = instruments.get(
            instrumentsStore.selectedInstrumentId
        );
        if (!instrument) {
            return null;
        }

        const { InstrumentProperties } =
            require("home/instruments/instrument-object-details") as typeof import("home/instruments/instrument-object-details");

        return (
            <div className="EezStudio_HomeTab_Instruments_SelectedInstrument_Properties_Section">
                <h6>Properties</h6>
                <div>
                    <div className="EezStudio_InstrumentPropertiesEnclosure">
                        <InstrumentProperties instrument={instrument} />
                    </div>
                </div>
            </div>
        );
    }
);

const InstrumentConnectionEnclosure = observer(
    ({ instrumentsStore }: { instrumentsStore: InstrumentsStore }) => {
        if (!instrumentsStore.selectedInstrumentId) {
            return null;
        }

        const { instruments } =
            require("instrument/instrument-object") as typeof import("instrument/instrument-object");

        const instrument = instruments.get(
            instrumentsStore.selectedInstrumentId
        );
        if (!instrument) {
            return null;
        }

        const { InstrumentConnection } =
            require("home/instruments/instrument-object-details") as typeof import("home/instruments/instrument-object-details");

        return (
            <div className="EezStudio_HomeTab_Instruments_SelectedInstrument_Properties_Section">
                <h6>Connection</h6>
                <div>
                    <div className="EezStudio_InstrumentConnectionEnclosure">
                        <InstrumentConnection instrument={instrument} />
                    </div>
                </div>
            </div>
        );
    }
);

export const Properties = observer(
    class Properties extends React.Component<{
        instrumentsStore: InstrumentsStore;
    }> {
        render() {
            return (
                <div className="EezStudio_HomeTab_Instruments_SelectedInstrument_Properties">
                    <InstrumentToolbarEnclosure
                        instrumentsStore={this.props.instrumentsStore}
                    />
                    <InstrumentPropertiesEnclosure
                        instrumentsStore={this.props.instrumentsStore}
                    />
                    <InstrumentConnectionEnclosure
                        instrumentsStore={this.props.instrumentsStore}
                    />
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const InstrumentComponent = observer(
    class InstrumentComponent extends React.Component<
        {
            instrumentsStore: InstrumentsStore;
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
                        "EezStudio_InstrumentComponentEnclosure shadow-sm rounded bg-light",
                        {
                            selected: this.props.isSelected
                        }
                    )}
                    onClick={() => this.props.selectInstrument(instrument)}
                    onDoubleClick={() => {
                        if (this.props.instrumentsStore.selectInstrument) {
                            if (
                                this.props.instrumentsStore.onSelectInstrument
                            ) {
                                this.props.instrumentsStore.onSelectInstrument();
                            }
                        } else {
                            this.open();
                        }
                    }}
                    onContextMenu={event => {
                        event.preventDefault();
                        event.stopPropagation();

                        this.props.instrumentsStore.selectedInstrumentId =
                            instrument.id;

                        const contextMenu =
                            this.props.instrumentsStore.createContextMenu(
                                instrument
                            );
                        contextMenu.popup();
                    }}
                >
                    <InstrumentContent instrument={instrument} />
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
                        {instrument.connectionState.color == "loader" ? (
                            <Loader size={20} />
                        ) : (
                            <span
                                style={{
                                    backgroundColor:
                                        instrument.connectionState.color
                                }}
                            />
                        )}
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

export const Instruments = observer(
    class Instruments extends React.Component<{
        instrumentsStore: InstrumentsStore;
        size: "S" | "M" | "L";
    }> {
        render() {
            const instrumentsStore = this.props.instrumentsStore;

            return (
                <div className="EezStudio_HomeTab_Instruments">
                    <div className="EezStudio_HomeTab_Instruments_Header">
                        {!this.props.instrumentsStore.selectInstrument && (
                            <SearchInput
                                searchText={
                                    this.props.instrumentsStore.searchText
                                }
                                onClear={action(() => {
                                    this.props.instrumentsStore.searchText = "";
                                })}
                                onChange={
                                    this.props.instrumentsStore.onSearchChange
                                }
                                onKeyDown={
                                    this.props.instrumentsStore.onSearchChange
                                }
                            />
                        )}
                        <Toolbar instrumentsStore={instrumentsStore} />
                    </div>
                    <div className="EezStudio_HomeTab_Instruments_Body">
                        <div
                            className={classNames(
                                "EezStudio_Instruments",
                                "EezStudio_Instruments_Size_" + this.props.size
                            )}
                        >
                            {instrumentsStore.instruments.map(obj => (
                                <InstrumentComponent
                                    key={obj.id}
                                    instrumentsStore={instrumentsStore}
                                    instrument={obj}
                                    isSelected={
                                        obj.id ==
                                        instrumentsStore.selectedInstrumentId
                                    }
                                    selectInstrument={instrument =>
                                        (instrumentsStore.selectedInstrumentId =
                                            instrument.id)
                                    }
                                />
                            ))}
                        </div>
                        <Properties instrumentsStore={instrumentsStore} />
                    </div>
                </div>
            );
        }
    }
);

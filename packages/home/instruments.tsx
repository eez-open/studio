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
import classNames from "classnames";

import {
    VerticalHeaderWithBody,
    Header,
    Body,
    ToolbarHeader
} from "eez-studio-ui/header-with-body";
import { ButtonAction } from "eez-studio-ui/action";
import { Icon } from "eez-studio-ui/icon";

import type { InstrumentObject } from "instrument/instrument-object";

import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import type { ITabDefinition } from "home/tabs-store";

import { tabs } from "home/tabs-store";
import { homeLayoutModels } from "home/home-layout-models";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";

////////////////////////////////////////////////////////////////////////////////

export const selectedInstrument = observable.box<string | undefined>();

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

export const Instruments = observer(
    class Instruments extends React.Component {
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

import React from "react";
import { computed, action, observable, toJS } from "mobx";
import { observer } from "mobx-react";

import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { Splitter } from "eez-studio-ui/splitter";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";

import * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";
import * as DeletedInstrumentsDialogModule from "instrument/deleted-instruments-dialog";

import { HistorySection } from "home/history";

import classNames from "classnames";
import { stringCompare } from "eez-studio-shared/string";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { createInstrument } from "instrument/instrument-extension";

import * as TabsStoreModule from "home/tabs-store";

const { Menu, MenuItem } = EEZStudio.remote;

import { instruments, InstrumentObject } from "instrument/instrument-object";
import { instrumentStore } from "instrument/instrument-object";

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

            if (instrument.addToContextMenu) {
                instrument.addToContextMenu(menu);
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

                    showAddInstrumentDialog(extension => {
                        beginTransaction("Add instrument");
                        createInstrument(extension);
                        commitTransaction();
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
                className: "btn-default",
                onClick: () => {
                    showDeletedInstrumentsDialog();
                }
            });
        }

        return buttons;
    }

    render() {
        return (
            <Toolbar className="EezStudio_ToolbarHeader">
                {this.buttons.map(button => (
                    <ButtonAction
                        key={button.id}
                        text={button.label}
                        title={button.title}
                        className={button.className}
                        onClick={button.onClick}
                    />
                ))}
            </Toolbar>
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
    selectedInstrument: InstrumentObject | undefined;
}> {
    render() {
        if (!this.props.selectedInstrument) {
            return <div />;
        }

        let history = (
            <div className="EezStudio_HistoryContainer">
                <PanelTitle title="History" />
                <div className="EezStudio_HistoryContent">
                    <HistorySection
                        oids={[this.props.selectedInstrument.id]}
                        simple={true}
                    />
                </div>
            </div>
        );

        return (
            <Splitter
                type="vertical"
                sizes={"100%|240px"}
                persistId={"home/designer/properties/splitter"}
            >
                <div className="EezStudio_InstrumentDetailsEnclosure">
                    {this.props.selectedInstrument.details}
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
    open = () => {
        openEditor(this.props.instrument, "default");
    };

    render() {
        const { instrument } = this.props;

        return (
            <div
                className={classNames(
                    "EezStudio_InstrumentComponentEnclosure shadow p-3 m-3 bg-body rounded",
                    {
                        selected: this.props.isSelected
                    }
                )}
                onClick={() => this.props.selectInstrument(instrument)}
                onDoubleClick={this.open}
                onContextMenu={() => {
                    const contextMenu = workbenchDocument.createContextMenu([
                        instrument
                    ]);
                    contextMenu.popup({});
                }}
            >
                {instrument.content}
            </div>
        );
    }
}

@observer
export class WorkbenchDocumentComponent extends React.Component<{
    selectedInstrument: InstrumentObject | undefined;
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
                            isSelected={obj == this.props.selectedInstrument}
                            selectInstrument={this.props.selectInstrument}
                        />
                    ))}
            </div>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Workbench extends React.Component<{}, {}> {
    @observable selectedInstrument: InstrumentObject | undefined;

    @action.bound
    selectInstrument(instrument: InstrumentObject) {
        this.selectedInstrument = instrument;
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
                            selectedInstrument={this.selectedInstrument}
                            selectInstrument={this.selectInstrument}
                        />

                        <Properties
                            selectedInstrument={this.selectedInstrument}
                        />
                    </Splitter>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

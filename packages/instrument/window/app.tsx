import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { ButtonAction, IconAction } from "eez-studio-ui/action";
import { AppRootComponent } from "eez-studio-ui/app";
import { AlertDanger } from "eez-studio-ui/alert";
import { Loader } from "eez-studio-ui/loader";
import { Toolbar } from "eez-studio-ui/toolbar";
import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { PropertyList, TextInputProperty } from "eez-studio-ui/properties";

import { InstrumentAppStore } from "instrument/window/app-store";
import { getConnection } from "instrument/window/connection";
import { IInstrumentWindowNavigationItem } from "instrument/window/navigation-store";
import { InstrumentObject } from "instrument/instrument-object";
import { Header } from "eez-studio-ui/header-with-body";

////////////////////////////////////////////////////////////////////////////////

function EditInstrumentLabelDialog({
    instrument
}: {
    instrument: InstrumentObject;
}) {
    const [label, setLabel] = React.useState(instrument.label || "");

    return (
        <Dialog
            okButtonText="Connect"
            onOk={() => {
                instrument.setLabel(label.trim());
                return true;
            }}
        >
            <PropertyList>
                <TextInputProperty
                    key="label"
                    name="Label"
                    value={label}
                    onChange={setLabel}
                />
            </PropertyList>
        </Dialog>
    );
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class AppBar extends React.Component<
    {
        appStore: InstrumentAppStore;
        selectedItem: IInstrumentWindowNavigationItem;
    },
    {}
> {
    get instrument() {
        return this.props.appStore.instrument!;
    }

    get connection() {
        return getConnection(this.props.appStore);
    }

    @bind
    handleConnectClick() {
        this.connection.openConnectDialog();
    }

    @bind
    handleDisconnectClick() {
        this.instrument.connection.disconnect();
    }

    @bind
    onEditInstrumentLabel() {
        showDialog(
            <EditInstrumentLabelDialog
                instrument={this.props.appStore.instrument!}
            />
        );
    }

    render() {
        let connectionStatus;
        if (this.instrument.connection.isIdle) {
            connectionStatus = (
                <div>
                    <button
                        className="btn btn-success btn-sm"
                        onClick={this.handleConnectClick}
                    >
                        Connect
                    </button>
                </div>
            );
        } else if (this.instrument.connection.isConnected) {
            connectionStatus = (
                <div>
                    <div>{this.connection.interfaceInfo}</div>
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={this.handleDisconnectClick}
                    >
                        Disconnect
                    </button>
                </div>
            );
        } else {
            connectionStatus = (
                <div>
                    <div style={{ display: "inline-block" }}>
                        <Loader size={25} />
                    </div>
                    <button
                        className="btn btn-danger btn-sm"
                        onClick={this.handleDisconnectClick}
                    >
                        Abort
                    </button>
                </div>
            );
        }

        let sendFile;
        if (
            this.instrument.sendFileToInstrumentHandler &&
            this.instrument.connection.isConnected
        ) {
            if (this.props.appStore.history.sendFileStatus) {
                if (
                    this.props.appStore.navigationStore
                        .mainNavigationSelectedItem !=
                        this.props.appStore.navigationStore
                            .terminalNavigationItem &&
                    this.props.appStore.navigationStore
                        .mainNavigationSelectedItem !=
                        this.props.appStore.navigationStore
                            .startPageNavigationItem
                ) {
                    sendFile = this.props.appStore.history.sendFileStatus;
                }
            } else {
                sendFile = (
                    <ButtonAction
                        icon="material:file_upload"
                        text="Send File"
                        onClick={this.instrument.sendFileToInstrumentHandler}
                        title="Send file to instrument"
                        className={"btn-primary"}
                    ></ButtonAction>
                );
            }
        }

        let toolbarButtons =
            this.props.selectedItem &&
            this.props.selectedItem.renderToolbarButtons();

        return (
            <Header className="EezStudio_ConnectionBar">
                <div>
                    <img src={this.instrument.image} draggable={false} />{" "}
                </div>

                <div>
                    <div>
                        <span>
                            [{this.instrument.id}] {this.instrument.name}
                        </span>
                        <IconAction
                            icon="material:edit"
                            onClick={this.onEditInstrumentLabel}
                            title="Edit Instrument Label"
                        ></IconAction>
                    </div>
                    {connectionStatus}
                </div>

                <div>{sendFile}</div>

                <Toolbar>{toolbarButtons}</Toolbar>
            </Header>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class App extends React.Component<{ appStore: InstrumentAppStore }> {
    constructor(props: any) {
        super(props);
    }

    @bind
    onSelectionChange(item: IInstrumentWindowNavigationItem) {
        this.props.appStore.navigationStore.changeMainNavigationSelectedItem(
            item
        );
    }

    @computed
    get appBar() {
        const instrument = this.props.appStore.instrument;
        if (!instrument) {
            return undefined;
        }

        return (
            <div>
                {instrument.connection.error && (
                    <AlertDanger
                        className="mb-0"
                        onDismiss={() => instrument.connection.dismissError()}
                    >
                        {instrument.connection.error}
                    </AlertDanger>
                )}
                {
                    <AppBar
                        appStore={this.props.appStore}
                        selectedItem={
                            this.props.appStore.navigationStore
                                .mainNavigationSelectedItem
                        }
                    />
                }
            </div>
        );
    }

    render() {
        return (
            <AppRootComponent
                navigationItems={
                    this.props.appStore.navigationStore.navigationItems
                }
                appBar={this.appBar}
                selectedItem={
                    this.props.appStore.navigationStore
                        .mainNavigationSelectedItem
                }
                onSelectionChange={this.onSelectionChange}
            />
        );
    }
}

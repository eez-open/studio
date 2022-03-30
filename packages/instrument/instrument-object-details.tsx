import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";
import {
    PropertyList,
    StaticProperty,
    TextInputProperty,
    BooleanProperty
} from "eez-studio-ui/properties";
import { AlertDanger } from "eez-studio-ui/alert";
import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";
import * as notification from "eez-studio-ui/notification";

import { ConnectionProperties } from "instrument/window/connection-dialog";
import { InstrumentObject } from "instrument/instrument-object";

import { ConnectionParameters } from "instrument/connection/interface";

import type * as CatalogModule from "home/extensions-manager/catalog";
import type * as ExtensionManagerModule from "home/extensions-manager/extensions-manager";

////////////////////////////////////////////////////////////////////////////////

export const InstrumentDetails = observer(
    class InstrumentDetails extends React.Component<
        { instrument: InstrumentObject },
        {}
    > {
        onOpenInTab = () => {
            this.props.instrument.openEditor("tab");
        };

        onOpenInWindow = () => {
            this.props.instrument.openEditor("window");
        };

        onDelete = () => {
            window.postMessage(
                {
                    type: "delete-instrument",
                    instrumentId: this.props.instrument.id
                },
                "*"
            );
        };

        render() {
            let { instrument } = this.props;
            return (
                <Panels>
                    <Panel
                        title="Actions"
                        justify="flex-start"
                        scrollable={true}
                        grow={1}
                    >
                        <Toolbar>
                            {this.props.instrument.isUnknownExtension && (
                                <ButtonAction
                                    text="Install Extension"
                                    title="Install extension for this instrument"
                                    className="btn btn-default btn-primary"
                                    onClick={() =>
                                        installExtension(this.props.instrument)
                                    }
                                />
                            )}
                            <ButtonAction
                                text="Open in Tab"
                                title="Open instrument in new tab"
                                className="btn btn-secondary"
                                onClick={this.onOpenInTab}
                            />
                            <ButtonAction
                                text="Open in New Window"
                                title="Open instrument in new window"
                                className="btn btn-secondary"
                                onClick={this.onOpenInWindow}
                            />
                            <ButtonAction
                                text="Delete"
                                title="Delete instrument"
                                className="btn btn-danger"
                                onClick={this.onDelete}
                            />
                        </Toolbar>
                    </Panel>

                    <Panel
                        title="Properties"
                        justify="flex-start"
                        scrollable={true}
                        grow={1}
                    >
                        <Properties instrument={instrument} />
                    </Panel>

                    <Panel
                        title="Connection"
                        justify="flex-start"
                        scrollable={true}
                        grow={1}
                    >
                        <Connection instrument={instrument} />
                    </Panel>
                </Panels>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const ConnectionParametersDetails = observer(
    class ConnectionParametersDetails extends React.Component<{
        instrument: InstrumentObject;
    }> {
        render() {
            const { instrument } = this.props;

            if (instrument.lastConnection) {
                if (instrument.lastConnection.type === "ethernet") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="Ethernet" />
                            <StaticProperty
                                name="Server address"
                                value={
                                    instrument.lastConnection.ethernetParameters
                                        .address
                                }
                            />
                            <StaticProperty
                                name="Port"
                                value={instrument.lastConnection.ethernetParameters.port.toString()}
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "serial") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="Serial" />
                            <StaticProperty
                                name="Port"
                                value={
                                    instrument.lastConnection.serialParameters
                                        .port
                                }
                            />
                            <StaticProperty
                                name="Baud rate"
                                value={instrument.lastConnection.serialParameters.baudRate.toString()}
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "usbtmc") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="USBTMC" />
                            <StaticProperty
                                name="Vendor ID"
                                value={
                                    "0x" +
                                    instrument.lastConnection.usbtmcParameters.idVendor.toString(
                                        16
                                    )
                                }
                            />
                            <StaticProperty
                                name="Product ID"
                                value={
                                    "0x" +
                                    instrument.lastConnection.usbtmcParameters.idProduct.toString(
                                        16
                                    )
                                }
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "web-simulator") {
                    return (
                        <PropertyList>
                            <StaticProperty
                                name="Interface"
                                value="WebSimulator"
                            />
                        </PropertyList>
                    );
                } else if (instrument.lastConnection.type === "visa") {
                    return (
                        <PropertyList>
                            <StaticProperty name="Interface" value="VISA" />
                            <StaticProperty
                                name="Resource"
                                value={
                                    instrument.lastConnection.visaParameters
                                        .resource
                                }
                            />
                        </PropertyList>
                    );
                }
            }
            return null;
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export async function installExtension(instrument: InstrumentObject) {
    const { extensionsCatalog } =
        require("home/extensions-manager/catalog") as typeof CatalogModule;

    const extension = extensionsCatalog.catalog.find(
        extension => extension.id === instrument.extension!.id
    );
    if (extension) {
        const progressToastId = notification.info("Installing...", {
            autoClose: false
        });

        const { downloadAndInstallExtension } =
            require("home/extensions-manager/extensions-manager") as typeof ExtensionManagerModule;

        await downloadAndInstallExtension(extension, progressToastId);

        notification.update(progressToastId, {
            render: "Extensions successfully installed!",
            type: notification.SUCCESS,
            autoClose: 500
        });
    } else {
        notification.error("Instrument extension not found!");
    }
}

////////////////////////////////////////////////////////////////////////////////

class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return <div className="EezStudio_PanelTitle">{this.props.title}</div>;
    }
}

class Panel extends React.Component<
    {
        title?: string;
        justify?:
            | "flex-start"
            | "flex-end"
            | "center"
            | "space-between"
            | "space-around";
        scrollable?: boolean;
        grow?: number;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_InstrumentPanelContainer">
                {this.props.title && <PanelTitle title={this.props.title} />}
                <div
                    className="EezStudio_PanelContent"
                    style={{
                        flexGrow: this.props.grow,
                        overflow: this.props.scrollable ? "auto" : "hidden",
                        justifyContent: this.props.justify
                    }}
                >
                    {this.props.children}
                </div>
            </div>
        );
    }
}

class Panels extends React.Component<{}, {}> {
    render() {
        return <div className="EezStudio_Panels">{this.props.children}</div>;
    }
}

////////////////////////////////////////////////////////////////////////////////

const Properties = observer(
    class Properties extends React.Component<
        {
            instrument: InstrumentObject;
        },
        {}
    > {
        render() {
            const extension = this.props.instrument.extension;
            if (!extension) {
                return null;
            }

            return (
                <PropertyList>
                    <StaticProperty
                        name="Instrument"
                        value={extension!.displayName || extension!.name}
                    />
                    <StaticProperty
                        name="ID"
                        value={this.props.instrument.id}
                    />
                    <TextInputProperty
                        name="Label"
                        value={this.props.instrument.label || ""}
                        onChange={value =>
                            this.props.instrument.setLabel(value)
                        }
                    />
                    <StaticProperty
                        name="IDN"
                        value={this.props.instrument.idn || "Not found!"}
                    />
                    <BooleanProperty
                        name="Auto connect"
                        value={this.props.instrument.autoConnect}
                        onChange={value =>
                            this.props.instrument.setAutoConnect(value)
                        }
                    />
                </PropertyList>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Connection = observer(
    class Connection extends React.Component<{
        instrument: InstrumentObject;
    }> {
        connectionParameters: ConnectionParameters | null;

        dismissError = () => {
            this.props.instrument.connection.dismissError();
        };

        render() {
            let { instrument } = this.props;

            let connection = this.props.instrument.connection;

            let info;
            let error;
            let connectionParameters;
            let button;

            if (connection) {
                if (connection.isIdle) {
                    error = connection.error && (
                        <AlertDanger onDismiss={this.dismissError}>
                            {connection.error}
                        </AlertDanger>
                    );

                    connectionParameters = (
                        <ConnectionProperties
                            connectionParameters={instrument.getConnectionParameters(
                                [
                                    instrument.lastConnection,
                                    this.connectionParameters,
                                    instrument.defaultConnectionParameters
                                ]
                            )}
                            onConnectionParametersChanged={(
                                connectionParameters: ConnectionParameters
                            ) => {
                                this.connectionParameters =
                                    connectionParameters;
                            }}
                            availableConnections={
                                this.props.instrument.availableConnections
                            }
                            serialBaudRates={
                                this.props.instrument.serialBaudRates
                            }
                            unmount={() => {}}
                        />
                    );

                    button = (
                        <button
                            className="btn btn-success"
                            onClick={() => {
                                if (this.connectionParameters) {
                                    this.props.instrument.setConnectionParameters(
                                        this.connectionParameters
                                    );
                                    this.connectionParameters = null;
                                } else if (!instrument.lastConnection) {
                                    this.props.instrument.setConnectionParameters(
                                        instrument.defaultConnectionParameters
                                    );
                                }
                                connection!.connect();
                            }}
                        >
                            Connect
                        </button>
                    );
                } else {
                    if (connection.isTransitionState) {
                        info = <Loader className="mb-2" />;
                    }

                    connectionParameters = (
                        <ConnectionParametersDetails
                            instrument={this.props.instrument}
                        />
                    );

                    if (connection.isConnected) {
                        button = (
                            <button
                                className="btn btn-danger"
                                onClick={() => connection!.disconnect()}
                            >
                                Disconnect
                            </button>
                        );
                    } else {
                        button = (
                            <button
                                className="btn btn-danger"
                                onClick={() => connection!.disconnect()}
                            >
                                Abort
                            </button>
                        );
                    }
                }
            }

            return (
                <div>
                    <div>
                        {info}
                        {error}
                        {connectionParameters}
                        <div className="text-left">{button}</div>
                    </div>
                </div>
            );
        }
    }
);

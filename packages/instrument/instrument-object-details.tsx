import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
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

import { ConnectionProperties } from "instrument/window/connection-dialog";
import { InstrumentObject } from "instrument/instrument-object";

import { ConnectionParameters } from "instrument/connection/interface";

////////////////////////////////////////////////////////////////////////////////

const PanelTitleDiv = styled.div`
    display: flex;
    flex-direction: row;
    padding: 5px 10px;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    font-weight: bold;
`;

export class PanelTitle extends React.Component<{ title?: string }, {}> {
    render() {
        return <PanelTitleDiv>{this.props.title}</PanelTitleDiv>;
    }
}

const PanelContainerDiv = styled.div`
    display: flex;
    flex-direction: column;
    margin: 5px;
    background-color: white;
    border: 1px solid ${props => props.theme.borderColor};
`;

const PanelContentDiv = styled.div`
    display: flex;
    flex-direction: row;
    padding: 10px;
`;

export class Panel extends React.Component<
    {
        title?: string;
        justify?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around";
        scrollable?: boolean;
        grow?: number;
    },
    {}
> {
    render() {
        return (
            <PanelContainerDiv>
                {this.props.title && <PanelTitle title={this.props.title} />}
                <PanelContentDiv
                    style={{
                        flexGrow: this.props.grow,
                        overflow: this.props.scrollable ? "auto" : "hidden",
                        justifyContent: this.props.justify
                    }}
                >
                    {this.props.children}
                </PanelContentDiv>
            </PanelContainerDiv>
        );
    }
}

const PanelsDiv = styled.div`
    display: flex;
    flex-direction: column;
    padding: 5px;
    background-color: ${props => props.theme.panelHeaderColor};
`;

export class Panels extends React.Component<{}, {}> {
    render() {
        return <PanelsDiv>{this.props.children}</PanelsDiv>;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
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
                <TextInputProperty
                    name="Label"
                    value={this.props.instrument.label || ""}
                    onChange={value => this.props.instrument.setLabel(value)}
                />
                <StaticProperty name="IDN" value={this.props.instrument.idn || "Not found!"} />
                <BooleanProperty
                    name="Auto connect"
                    value={this.props.instrument.autoConnect}
                    onChange={value => this.props.instrument.setAutoConnect(value)}
                />
            </PropertyList>
        );
    }
}

@observer
class Connection extends React.Component<{
    instrument: InstrumentObject;
}> {
    connectionParameters: ConnectionParameters | null;

    @bind
    dismissError() {
        this.props.instrument.connection.dismissError();
    }

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
                    <AlertDanger onDismiss={this.dismissError}>{connection.error}</AlertDanger>
                );

                connectionParameters = (
                    <ConnectionProperties
                        connectionParameters={instrument.getConnectionParameters([
                            instrument.lastConnection,
                            this.connectionParameters,
                            instrument.defaultConnectionParameters
                        ])}
                        onConnectionParametersChanged={(
                            connectionParameters: ConnectionParameters
                        ) => {
                            this.connectionParameters = connectionParameters;
                        }}
                        availableConnections={this.props.instrument.availableConnections}
                        serialBaudRates={this.props.instrument.serialBaudRates}
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

                connectionParameters = instrument.connectionParametersDetails;

                if (connection.isConnected) {
                    button = (
                        <button className="btn btn-danger" onClick={() => connection!.disconnect()}>
                            Disconnect
                        </button>
                    );
                } else {
                    button = (
                        <button className="btn btn-danger" onClick={() => connection!.disconnect()}>
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

@observer
export class InstrumentDetails extends React.Component<{ instrument: InstrumentObject }, {}> {
    @bind
    onOpenInTab() {
        this.props.instrument.openEditor("tab");
    }

    @bind
    onOpenInWindow() {
        this.props.instrument.openEditor("window");
    }

    @bind
    onDelete() {
        window.postMessage(
            {
                type: "delete-object",
                object: {
                    id: this.props.instrument.id,
                    type: "instrument"
                }
            },
            "*"
        );
    }

    render() {
        let { instrument } = this.props;
        return (
            <Panels>
                <Panel title="Actions" justify="flex-start" scrollable={true} grow={1}>
                    <Toolbar>
                        {this.props.instrument.isUnknownExtension && (
                            <ButtonAction
                                text="Install Extension"
                                title="Install extension for this instrument"
                                className="btn btn-default btn-primary"
                                onClick={() => this.props.instrument.installExtension()}
                            />
                        )}
                        <ButtonAction
                            text="Open in Tab"
                            title="Open instrument in new tab"
                            className="btn btn-default"
                            onClick={this.onOpenInTab}
                        />
                        <ButtonAction
                            text="Open in Window"
                            title="Open instrument in new window"
                            className="btn btn-default"
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

                <Panel title="Properties" justify="flex-start" scrollable={true} grow={1}>
                    <Properties instrument={instrument} />
                </Panel>

                <Panel title="Connection" justify="flex-start" scrollable={true} grow={1}>
                    <Connection instrument={instrument} />
                </Panel>
            </Panels>
        );
    }
}

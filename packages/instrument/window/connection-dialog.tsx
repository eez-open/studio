import * as SerialPortModule from "serialport";
import * as React from "react";
import { observable, action, runInAction, reaction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { objectClone } from "eez-studio-shared/util";

import {
    PropertyList,
    TextInputProperty,
    NumberInputProperty,
    SelectProperty
} from "eez-studio-ui/properties";
import { Dialog, showDialog } from "eez-studio-ui/dialog";

import { ConnectionParameters } from "instrument/connection/interface";

interface ConnectionPropertiesProps {
    connectionParameters: ConnectionParameters;
    onConnectionParametersChanged: (connectionParameters: ConnectionParameters) => void;
    availableConnections: ("ethernet" | "serial" | "usbtmc")[];
    serialBaudRates: number[];
}

@observer
export class ConnectionProperties extends React.Component<ConnectionPropertiesProps, {}> {
    constructor(props: any) {
        super(props);

        this.applyConnectionParameters(this.props.connectionParameters);
    }

    refs: {
        div: HTMLDivElement;
        form: HTMLFormElement;
    };

    @observable
    serialPortPaths: {
        path: string;
        description: string;
    }[] = [];

    @observable iface: string;
    @observable ethernetAddress: string;
    @observable ethernetPort: number;
    @observable serialPortPath: string;
    @observable serialPortBaudRate: number;
    @observable idVendor: number;
    @observable idProduct: number;

    disposer: any;

    @action
    componentWillReceiveProps(nextProps: ConnectionPropertiesProps) {
        this.applyConnectionParameters(nextProps.connectionParameters);
    }

    applyConnectionParameters(connectionParameters: ConnectionParameters) {
        this.iface = connectionParameters.type;
        this.ethernetAddress = connectionParameters.ethernetParameters.address;
        this.ethernetPort = connectionParameters.ethernetParameters.port;
        this.serialPortPath = connectionParameters.serialParameters.port;
        this.serialPortBaudRate = connectionParameters.serialParameters.baudRate;
        this.idVendor = connectionParameters.usbtmcParameters.idVendor;
        this.idProduct = connectionParameters.usbtmcParameters.idProduct;
    }

    componentDidMount() {
        this.refreshSerialPortPaths();

        $(this.refs.div).modal();

        $(this.refs.div).on("hidden.bs.modal", () => {
            (this.refs.div.parentElement as HTMLElement).remove();
        });

        this.disposer = reaction(
            () => {
                let connectionParameters: ConnectionParameters = objectClone(
                    this.props.connectionParameters
                );

                if (this.iface === "ethernet") {
                    connectionParameters.type = "ethernet";
                    connectionParameters.ethernetParameters.address = this.ethernetAddress;
                    connectionParameters.ethernetParameters.port = this.ethernetPort;
                } else if (this.iface === "serial") {
                    connectionParameters.type = "serial";
                    connectionParameters.serialParameters.port = this.serialPortPath;
                    connectionParameters.serialParameters.baudRate = this.serialPortBaudRate;
                } else {
                    connectionParameters.type = "usbtmc";
                    connectionParameters.usbtmcParameters.idVendor = this.idVendor;
                    connectionParameters.usbtmcParameters.idProduct = this.idProduct;
                }

                return connectionParameters;
            },

            (connectionParameters: ConnectionParameters) => {
                this.props.onConnectionParametersChanged(connectionParameters);
            }
        );
    }

    componentWillUnmount() {
        this.disposer();
    }

    @action.bound
    onIfaceChange(value: string) {
        this.iface = value;
    }

    @action.bound
    onEthernetAddressChange(value: string) {
        this.ethernetAddress = value;
    }

    @action.bound
    onEthernetPortChange(value: number) {
        this.ethernetPort = value;
    }

    @action.bound
    onSerialPortPathChange(value: string) {
        this.serialPortPath = value;
    }

    @action.bound
    onSerialPortBaudRateChange(value: string) {
        this.serialPortBaudRate = parseInt(value);
    }

    @action.bound
    onIDVendorChange(value: string) {
        this.idVendor = parseInt(value);
    }

    @action.bound
    onIDProductChange(value: string) {
        this.idProduct = parseInt(value);
    }

    @bind
    onRefreshSerialPortPaths(event: React.MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        this.refreshSerialPortPaths();
    }

    refreshSerialPortPaths() {
        const SerialPort = require("serialport") as typeof SerialPortModule;
        SerialPort.list((err: any, ports: any[]) => {
            if (err) {
                console.error(err);
            } else {
                runInAction(() => {
                    let found;

                    this.serialPortPaths = [
                        {
                            path: "",
                            description: ""
                        }
                    ].concat(
                        ports.map(port => {
                            if (this.serialPortPath === port.comName) {
                                found = true;
                            }
                            return {
                                path: port.comName,
                                description:
                                    port.comName +
                                    (port.manufacturer ? " - " + port.manufacturer : "") +
                                    (port.productId ? " - " + port.productId : "")
                            };
                        })
                    );

                    if (!found) {
                        this.serialPortPath = "";
                    }
                });
            }
        });
    }

    render() {
        let options: JSX.Element[] | null = null;

        if (this.iface === "ethernet") {
            options = [
                <TextInputProperty
                    key="ethernetAddress"
                    name="Server address"
                    value={this.ethernetAddress}
                    onChange={this.onEthernetAddressChange}
                />,
                <NumberInputProperty
                    key="ethernetPort"
                    name="Port"
                    value={this.ethernetPort}
                    onChange={this.onEthernetPortChange}
                />
            ];
        } else if (this.iface === "serial") {
            options = [
                <SelectProperty
                    key="serialPort"
                    name="Port"
                    value={this.serialPortPath}
                    onChange={this.onSerialPortPathChange}
                    inputGroupButton={
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                title="Refresh list of available serial ports"
                                onClick={this.onRefreshSerialPortPaths}
                            >
                                Refresh
                            </button>
                        </div>
                    }
                >
                    {this.serialPortPaths.map(serialPortPath => (
                        <option key={serialPortPath.path} value={serialPortPath.path}>
                            {serialPortPath.description}
                        </option>
                    ))}
                </SelectProperty>,
                <SelectProperty
                    key="serialPortBaudRate"
                    name="Baud rate"
                    value={this.serialPortBaudRate.toString()}
                    onChange={this.onSerialPortBaudRateChange}
                >
                    {this.props.serialBaudRates.map(baudRate => (
                        <option key={baudRate} value={baudRate}>
                            {baudRate}
                        </option>
                    ))}
                </SelectProperty>
            ];
        } else {
            options = [
                <TextInputProperty
                    key="idVendor"
                    name="Vendor ID"
                    value={"0x" + this.idVendor.toString(16)}
                    onChange={this.onIDVendorChange}
                />,
                <TextInputProperty
                    key="idProduct"
                    name="Product ID"
                    value={"0x" + this.idProduct.toString(16)}
                    onChange={this.onIDProductChange}
                />
            ];
        }

        return (
            <PropertyList>
                <SelectProperty name="Interface" value={this.iface} onChange={this.onIfaceChange}>
                    {this.props.availableConnections.indexOf("ethernet") !== -1 && (
                        <option value="ethernet">Ethernet</option>
                    )}
                    {this.props.availableConnections.indexOf("serial") !== -1 && (
                        <option value="serial">Serial</option>
                    )}
                    {this.props.availableConnections.indexOf("usbtmc") !== -1 && (
                        <option value="usbtmc">USBTMC</option>
                    )}
                </SelectProperty>
                {options}
            </PropertyList>
        );
    }
}

@observer
class ConnectionDialog extends React.Component<
    {
        connectionParameters: ConnectionParameters;
        connect: (connectionParameters: ConnectionParameters) => void;
        availableConnections: ("ethernet" | "serial" | "usbtmc")[];
        serialBaudRates: number[];
    },
    {}
> {
    connectionParameters: ConnectionParameters;

    @bind
    onConnectionParametersChanged(connectionParameters: ConnectionParameters) {
        this.connectionParameters = connectionParameters;
    }

    @bind
    handleSumbit() {
        this.props.connect(this.connectionParameters);
        return true;
    }

    render() {
        return (
            <Dialog okButtonText="Connect" onOk={this.handleSumbit}>
                <ConnectionProperties
                    connectionParameters={this.props.connectionParameters}
                    onConnectionParametersChanged={this.onConnectionParametersChanged}
                    availableConnections={this.props.availableConnections}
                    serialBaudRates={this.props.serialBaudRates}
                />
            </Dialog>
        );
    }
}

export function showConnectionDialog(
    connectionParameters: ConnectionParameters,
    connect: (connectionParameters: ConnectionParameters) => void,
    availableConnections: ("ethernet" | "serial" | "usbtmc")[],
    serialBaudRates: number[]
) {
    showDialog(
        <ConnectionDialog
            connectionParameters={connectionParameters}
            connect={connect}
            availableConnections={availableConnections}
            serialBaudRates={serialBaudRates}
        />
    );
}

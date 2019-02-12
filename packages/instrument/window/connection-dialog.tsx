import SerialPortModule from "serialport";
import React from "react";
import { observable, action, runInAction, reaction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
const os = require("os");

import { objectClone } from "eez-studio-shared/util";

import {
    PropertyList,
    TextInputProperty,
    NumberInputProperty,
    SelectProperty
} from "eez-studio-ui/properties";
import { Dialog, showDialog } from "eez-studio-ui/dialog";

import { ConnectionParameters } from "instrument/connection/interface";
import * as UsbTmcModule from "instrument/connection/interfaces/usbtmc";

interface ConnectionPropertiesProps {
    connectionParameters: ConnectionParameters;
    onConnectionParametersChanged: (connectionParameters: ConnectionParameters) => void;
    availableConnections: ("ethernet" | "serial" | "usbtmc")[];
    serialBaudRates: number[];
}

@observer
export class ConnectionProperties extends React.Component<ConnectionPropertiesProps, {}> {
    static neverEnumeratedConnectionDevices = true;

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

    @observable usbDevices: {
        name?: string;
        idVendor: number;
        idProduct: number;
    }[] = [];
    @observable selectedUsbDeviceIndex: string;
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
        if (os.platform() !== "darwin") {
            if (ConnectionProperties.neverEnumeratedConnectionDevices) {
                ConnectionProperties.neverEnumeratedConnectionDevices = false;
                this.refreshSerialPortPaths();
                this.refreshUsbDevices();
            }
        }

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

    @bind
    onRefreshSerialPortPaths(event: React.MouseEvent) {
        event.preventDefault();
        this.refreshSerialPortPaths();
    }

    @action.bound
    onUsbDeviceChange(value: string) {
        this.selectedUsbDeviceIndex = value;

        const usbDeviceIndex = parseInt(value);
        if (usbDeviceIndex >= 0 && usbDeviceIndex < this.usbDevices.length) {
            this.idVendor = this.usbDevices[usbDeviceIndex].idVendor;
            this.idProduct = this.usbDevices[usbDeviceIndex].idProduct;
        }
    }

    async refreshUsbDevices() {
        const {
            getUsbDevices
        } = require("instrument/connection/interfaces/usbtmc") as typeof UsbTmcModule;

        const usbDevices = await getUsbDevices();

        runInAction(() => {
            this.usbDevices = usbDevices;

            let selectedUsbDeviceIndex = "0";
            for (let i = 0; i < this.usbDevices.length; ++i) {
                if (
                    this.usbDevices[i].idVendor === this.idVendor ||
                    this.usbDevices[i].idProduct === this.idProduct
                ) {
                    selectedUsbDeviceIndex = i.toString();
                    break;
                }
            }
            this.selectedUsbDeviceIndex = selectedUsbDeviceIndex;
        });
    }

    @bind
    onRefreshUsbDevices(event: React.MouseEvent) {
        event.preventDefault();
        this.refreshUsbDevices();
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
                <SelectProperty
                    key="usbDevice"
                    name="Device"
                    value={this.selectedUsbDeviceIndex}
                    onChange={this.onUsbDeviceChange}
                    inputGroupButton={
                        <div className="input-group-append">
                            <button
                                className="btn btn-secondary"
                                title="Refresh list of available USB devices"
                                onClick={this.onRefreshUsbDevices}
                            >
                                Refresh
                            </button>
                        </div>
                    }
                >
                    {this.usbDevices.map((usbDevice, i) => (
                        <option key={i} value={i}>
                            {usbDevice.name ||
                                `VID=0x${usbDevice.idVendor.toString(
                                    16
                                )}, PID=0x${usbDevice.idProduct.toString(16)}`}
                        </option>
                    ))}
                </SelectProperty>
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

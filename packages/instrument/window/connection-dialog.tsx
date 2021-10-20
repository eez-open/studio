import SerialPortModule from "serialport";
import React from "react";
import ReactDOM from "react-dom";
import { observable, action, runInAction, reaction } from "mobx";
import { observer } from "mobx-react";
const os = require("os");

import { objectClone } from "eez-studio-shared/util";

import {
    PropertyList,
    TextInputProperty,
    NumberInputProperty,
    SelectProperty
} from "eez-studio-ui/properties";
import { Dialog, showDialog } from "eez-studio-ui/dialog";

import type { ConnectionParameters } from "instrument/connection/interface";
import type * as UsbTmcModule from "instrument/connection/interfaces/usbtmc";

interface ConnectionPropertiesProps {
    connectionParameters: ConnectionParameters;
    onConnectionParametersChanged: (
        connectionParameters: ConnectionParameters
    ) => void;
    availableConnections: ("ethernet" | "serial" | "usbtmc")[];
    serialBaudRates: number[];
}

class Devices {
    neverEnumerated = true;

    @observable serialPortPaths: {
        path: string;
        description: string;
        uniqueId: string;
    }[] = [];

    @observable usbDevices: {
        name?: string;
        idVendor: number;
        idProduct: number;
    }[] = [];
}

const devices = new Devices();

@observer
export class ConnectionProperties extends React.Component<
    ConnectionPropertiesProps,
    {}
> {
    constructor(props: any) {
        super(props);

        this.applyConnectionParameters(this.props.connectionParameters);
    }

    div: HTMLDivElement;
    form: HTMLFormElement;

    @observable iface: string;
    @observable ethernetAddress: string;
    @observable ethernetPort: number;
    @observable serialPortPath: string;
    @observable serialPortBaudRate: number;

    @observable selectedUsbDeviceIndex: string;
    @observable idVendor: number;
    @observable idProduct: number;

    disposer: any;

    @action
    componentDidUpdate(prevProps: any) {
        if (this.props != prevProps) {
            this.applyConnectionParameters(this.props.connectionParameters);
        }
    }

    applyConnectionParameters(connectionParameters: ConnectionParameters) {
        this.iface = connectionParameters.type;
        this.ethernetAddress = connectionParameters.ethernetParameters.address;
        this.ethernetPort = connectionParameters.ethernetParameters.port;
        this.serialPortPath = connectionParameters.serialParameters.port;
        this.serialPortBaudRate =
            connectionParameters.serialParameters.baudRate;
        this.idVendor = connectionParameters.usbtmcParameters.idVendor;
        this.idProduct = connectionParameters.usbtmcParameters.idProduct;
    }

    componentDidMount() {
        if (os.platform() !== "darwin") {
            if (devices.neverEnumerated) {
                devices.neverEnumerated = false;
                this.refreshSerialPortPaths();
                this.refreshUsbDevices();
            }
        }

        $(this.div).modal();

        $(this.div).on("hidden.bs.modal", () => {
            const parent = this.div.parentElement as HTMLElement;
            ReactDOM.unmountComponentAtNode(parent);
            parent.remove();
        });

        this.disposer = reaction(
            () => {
                let connectionParameters: ConnectionParameters = objectClone(
                    this.props.connectionParameters
                );

                if (this.iface === "ethernet") {
                    connectionParameters.type = "ethernet";
                    connectionParameters.ethernetParameters.address =
                        this.ethernetAddress;
                    connectionParameters.ethernetParameters.port =
                        this.ethernetPort;
                } else if (this.iface === "serial") {
                    connectionParameters.type = "serial";
                    connectionParameters.serialParameters.port =
                        this.serialPortPath;
                    connectionParameters.serialParameters.baudRate =
                        this.serialPortBaudRate;
                } else {
                    connectionParameters.type = "usbtmc";
                    connectionParameters.usbtmcParameters.idVendor =
                        this.idVendor;
                    connectionParameters.usbtmcParameters.idProduct =
                        this.idProduct;
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

    async refreshSerialPortPaths() {
        const SerialPort = require("serialport") as typeof SerialPortModule;
        try {
            const ports = await SerialPort.list();
            runInAction(() => {
                let found;

                devices.serialPortPaths = [
                    {
                        path: "",
                        description: "",
                        uniqueId: ""
                    }
                ].concat(
                    ports.map(port => {
                        if (this.serialPortPath === port.path) {
                            found = true;
                        }
                        return {
                            path: port.path,
                            description:
                                port.path +
                                (port.manufacturer
                                    ? " - " + port.manufacturer
                                    : "") +
                                (port.productId ? " - " + port.productId : ""),
                            uniqueId: port.pnpId || port.path
                        };
                    })
                );

                if (!found) {
                    this.serialPortPath = "";
                }
            });
        } catch (err) {
            console.error(err);
        }
    }

    onRefreshSerialPortPaths = (event: React.MouseEvent) => {
        event.preventDefault();
        this.refreshSerialPortPaths();
    };

    @action.bound
    onUsbDeviceChange(value: string) {
        this.selectedUsbDeviceIndex = value;

        const usbDeviceIndex = parseInt(value);
        if (usbDeviceIndex >= 0 && usbDeviceIndex < devices.usbDevices.length) {
            this.idVendor = devices.usbDevices[usbDeviceIndex].idVendor;
            this.idProduct = devices.usbDevices[usbDeviceIndex].idProduct;
        }
    }

    async refreshUsbDevices() {
        const { getUsbDevices } =
            require("instrument/connection/interfaces/usbtmc") as typeof UsbTmcModule;

        const usbDevices = await getUsbDevices();

        runInAction(() => {
            devices.usbDevices = usbDevices;

            let selectedUsbDeviceIndex = "0";
            for (let i = 0; i < devices.usbDevices.length; ++i) {
                if (
                    devices.usbDevices[i].idVendor === this.idVendor ||
                    devices.usbDevices[i].idProduct === this.idProduct
                ) {
                    selectedUsbDeviceIndex = i.toString();
                    break;
                }
            }
            this.selectedUsbDeviceIndex = selectedUsbDeviceIndex;
        });
    }

    onRefreshUsbDevices = (event: React.MouseEvent) => {
        event.preventDefault();
        this.refreshUsbDevices();
    };

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
                        <button
                            className="btn btn-secondary"
                            title="Refresh list of available serial ports"
                            onClick={this.onRefreshSerialPortPaths}
                        >
                            Refresh
                        </button>
                    }
                >
                    {devices.serialPortPaths.map(serialPortPath => (
                        <option
                            key={serialPortPath.uniqueId}
                            value={serialPortPath.path}
                        >
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
                        <button
                            className="btn btn-secondary"
                            title="Refresh list of available USB devices"
                            onClick={this.onRefreshUsbDevices}
                        >
                            Refresh
                        </button>
                    }
                >
                    {devices.usbDevices.map((usbDevice, i) => (
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
                <SelectProperty
                    name="Interface"
                    value={this.iface}
                    onChange={this.onIfaceChange}
                >
                    {this.props.availableConnections.indexOf("ethernet") !==
                        -1 && <option value="ethernet">Ethernet</option>}
                    {this.props.availableConnections.indexOf("serial") !==
                        -1 && <option value="serial">Serial</option>}
                    {this.props.availableConnections.indexOf("usbtmc") !==
                        -1 && <option value="usbtmc">USBTMC</option>}
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

    onConnectionParametersChanged = (
        connectionParameters: ConnectionParameters
    ) => {
        this.connectionParameters = connectionParameters;
    };

    handleSubmit = () => {
        this.props.connect(this.connectionParameters);
        return true;
    };

    render() {
        return (
            <Dialog okButtonText="Connect" onOk={this.handleSubmit}>
                <ConnectionProperties
                    connectionParameters={this.props.connectionParameters}
                    onConnectionParametersChanged={
                        this.onConnectionParametersChanged
                    }
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

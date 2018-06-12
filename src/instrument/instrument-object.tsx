import * as React from "react";
import { observable, computed, action, toJS } from "mobx";

import {
    createStore,
    types,
    createStoreObjectsCollection,
    beginTransaction,
    commitTransaction
} from "shared/store";
import { IExtension } from "shared/extensions/extension";
import { loadExtensionById } from "shared/extensions/extensions";
import { log, IActivityLogEntry } from "shared/activity-log";
import { objectEqual, isRenderer } from "shared/util";
import { IUnit } from "shared/units";
import { db } from "shared/db";
import { activityLogStore } from "shared/activity-log";
import { _defer } from "shared/algorithm";

import * as MainWindowModule from "main/window";

import { store as workbenchObjectsStore } from "home/store";

import { IInstrumentExtensionProperties } from "instrument/instrument-extension";
import { DEFAULT_INSTRUMENT_PROPERTIES } from "instrument/import";
import { IInstrumentProperties } from "instrument/export";

import { createHistoryItem } from "instrument/window/history/item-factory";
import { IConnection } from "instrument/connection/connection";
import { createConnection } from "instrument/connection/connection";
import { ConnectionErrorCode, ConnectionParameters } from "instrument/connection/interface";
import { IFileUploadInstructions } from "instrument/connection/file-upload";

import * as UiPropertiesModule from "shared/ui/properties";

import * as AppStoreModule from "instrument/window/app-store";

////////////////////////////////////////////////////////////////////////////////

const CONF_LISTS_MAX_POINTS = 256;
const CONF_LISTS_MIN_DWELL = 0.0001;
const CONF_LISTS_MAX_DWELL = 65535;
const CONF_LISTS_DWELL_DIGITS = 4;
const CONF_LISTS_VOLTAGE_DIGITS = 3;
const CONF_LISTS_CURRENT_DIGITS = 3;

if (isRenderer()) {
    const { addCssStylesheet } = require("shared/util");
    addCssStylesheet(
        "EezStudio_Instrument_Css",
        `file://${__dirname.replace(/\\/g, "/")}/_stylesheets/instrument.css`
    );
}

export interface IInstrumentObjectProps {
    id: string;
    instrumentExtensionId: string;
    label?: string;
    idn?: string;
    lastConnection?: ConnectionParameters;
    autoConnect: boolean;
    lastFileUploadInstructions?: IFileUploadInstructions;
    selectedShortcutGroups: string[];
}

const UNKNOWN_INSTRUMENT_EXTENSION: IExtension = {
    id: "",
    preInstalled: false,
    name: "Unknown instrument",
    version: "no version",
    author: "no author",
    image: "../shared/_images/object-implementation-not-found.svg",
    properties: {}
};

export class InstrumentObject {
    constructor(props: IInstrumentObjectProps) {
        this.id = props.id;
        this.instrumentExtensionId = props.instrumentExtensionId;
        this.label = props.label;
        this.idn = props.idn;
        if (props.lastConnection && props.lastConnection.ethernetParameters) {
            this.lastConnection = props.lastConnection;
        }
        this.autoConnect = props.autoConnect;

        this.lastFileUploadInstructions = props.lastFileUploadInstructions;

        this.selectedShortcutGroups = props.selectedShortcutGroups;

        if (!this.selectedShortcutGroups) {
            this.selectedShortcutGroups = ["Default"];
        }

        this.connection = createConnection(this);
    }

    id: string;

    @observable instrumentExtensionId: string;
    @observable label: string | undefined;
    @observable idn: string | undefined;
    @observable lastConnection: ConnectionParameters | undefined;
    @observable autoConnect: boolean;
    @observable lastFileUploadInstructions: IFileUploadInstructions | undefined;
    @observable selectedShortcutGroups: string[];

    connection: IConnection;

    isResizable: false;

    _creationDate: Date | null | undefined;

    // This complication with extension loading
    // is because we want to load extension only
    // when and if needed.
    @observable _extension: IExtension | undefined;
    _loadingExtension: boolean;
    @computed
    get extension() {
        if (this._extension) {
            return this._extension;
        }

        if (this.instrumentExtensionId) {
            if (!this._loadingExtension) {
                this._loadingExtension = true;
                _defer(() => {
                    loadExtensionById(this.instrumentExtensionId)
                        .then(extension => {
                            action(() => {
                                this._extension = extension;
                            })();
                        })
                        .catch(() => {
                            action(() => {
                                this._extension = Object.assign({}, UNKNOWN_INSTRUMENT_EXTENSION, {
                                    id: this.instrumentExtensionId
                                });
                            })();
                        });
                });
            }

            return undefined;
        }

        this._extension = Object.assign({}, UNKNOWN_INSTRUMENT_EXTENSION, {
            id: this.instrumentExtensionId
        });
        return this._extension;
    }

    @computed
    get properties(): IInstrumentProperties | undefined {
        if (!this.extension) {
            return undefined;
        }
        return (this.extension.properties as IInstrumentExtensionProperties).properties;
    }

    @computed
    get channelsProperty() {
        return this.properties ? this.properties.channels : undefined;
    }

    @computed
    get firstChannel() {
        const channels = this.channelsProperty;
        if (channels && channels.length > 0) {
            return channels[0];
        }
        return undefined;
    }

    @computed
    get listsProperty() {
        return this.properties ? this.properties.lists : undefined;
    }

    @computed
    get listsMaxPointsProperty(): number {
        const lists = this.listsProperty;
        if (lists && typeof lists.maxPoints === "number") {
            return lists.maxPoints!;
        }
        return CONF_LISTS_MAX_POINTS;
    }

    @computed
    get listsMinDwellProperty(): number {
        const lists = this.listsProperty;
        if (lists && typeof lists.minDwell === "number") {
            return lists.minDwell;
        }
        return CONF_LISTS_MIN_DWELL;
    }

    @computed
    get listsMaxDwellProperty(): number {
        const lists = this.listsProperty;
        if (lists && typeof lists.maxDwell === "number") {
            return lists.maxDwell;
        }
        return CONF_LISTS_MAX_DWELL;
    }

    @computed
    get listsDwellDigitsProperty(): number {
        const lists = this.listsProperty;
        if (lists && typeof lists.dwellDigits === "number") {
            return lists.dwellDigits;
        }
        return CONF_LISTS_DWELL_DIGITS;
    }

    @computed
    get listsVoltageDigitsProperty(): number {
        const lists = this.listsProperty;
        if (lists && typeof lists.voltageDigits === "number") {
            return lists.voltageDigits;
        }
        return CONF_LISTS_VOLTAGE_DIGITS;
    }

    @computed
    get listsCurrentDigitsProperty(): number {
        const lists = this.listsProperty;
        if (lists && typeof lists.currentDigits === "number") {
            return lists.currentDigits;
        }
        return CONF_LISTS_CURRENT_DIGITS;
    }

    getDigits(unit: IUnit) {
        if (unit.name === "time") {
            return this.listsDwellDigitsProperty;
        } else if (unit.name === "voltage") {
            return this.listsVoltageDigitsProperty;
        } else {
            return this.listsCurrentDigitsProperty;
        }
    }

    getConnectionProperty() {
        return this.properties ? this.properties.connection : undefined;
    }

    get defaultConnectionParameters(): ConnectionParameters {
        let type: "ethernet" | "serial" | "usbtmc" | undefined;
        let ethernetPort: number | undefined;
        let baudRate: number | undefined;
        let idVendor: number | undefined;
        let idProduct: number | undefined;

        const connection = this.getConnectionProperty();
        if (connection) {
            if (connection.ethernet) {
                type = "ethernet";
                ethernetPort = connection.ethernet.port;
            }

            if (connection.serial) {
                if (type === undefined) {
                    type = "serial";
                }
                baudRate = connection.serial.defaultBaudRate;
            }

            if (connection.usbtmc) {
                if (type === undefined) {
                    type = "usbtmc";
                }
                idVendor = connection.usbtmc.idVendor;
                idProduct = connection.usbtmc.idProduct;
            }
        }

        if (type === undefined) {
            type = "ethernet";
        }

        if (ethernetPort === undefined) {
            ethernetPort = DEFAULT_INSTRUMENT_PROPERTIES.properties.connection!.ethernet!.port;
        }

        if (baudRate === undefined) {
            baudRate = DEFAULT_INSTRUMENT_PROPERTIES.properties.connection!.serial!.defaultBaudRate;
        }

        if (idVendor === undefined) {
            idVendor = 0;
        }

        if (idProduct === undefined) {
            idProduct = 0;
        }

        return {
            type,
            ethernetParameters: {
                port: ethernetPort,
                address: "localhost"
            },
            serialParameters: {
                port: "",
                baudRate
            },
            usbtmcParameters: {
                idVendor: idVendor,
                idProduct: idProduct
            }
        };
    }

    get availableConnections(): ("ethernet" | "serial" | "usbtmc")[] {
        let availableConnections: ("ethernet" | "serial" | "usbtmc")[] = [];

        const connection = this.getConnectionProperty();
        if (connection) {
            if (connection.ethernet) {
                availableConnections.push("ethernet");
            }
            if (connection.serial) {
                availableConnections.push("serial");
            }
            if (connection.usbtmc) {
                availableConnections.push("usbtmc");
            }
        }

        if (availableConnections.length === 0) {
            availableConnections.push("ethernet", "serial", "usbtmc");
        }

        return availableConnections;
    }

    get serialBaudRates(): number[] {
        const connection = this.getConnectionProperty();
        if (
            connection &&
            connection.serial &&
            connection.serial.baudRates !== undefined &&
            Array.isArray(connection.serial.baudRates) &&
            connection.serial.baudRates.length > 0
        ) {
            return connection.serial.baudRates;
        }
        return DEFAULT_INSTRUMENT_PROPERTIES.properties.connection!.serial!.baudRates;
    }

    getFileDownloadProperty() {
        return this.properties ? this.properties.fileDownload : undefined;
    }

    get defaultFileUploadInstructions() {
        const instructions = this.getFileDownloadProperty();
        if (instructions) {
            return {
                sourceFilePath: "",
                destinationFileName: "",
                destinationFolderPath: "/",
                shortFileName:
                    instructions.shortFileName !== undefined ? instructions.shortFileName : true,
                startCommandTemplate: instructions.startCommand || "",
                fileSizeCommandTemplate: instructions.fileSizeCommand || "",
                sendChunkCommandTemplate: instructions.sendChunkCommand || "",
                finishCommandTemplate: instructions.finishCommand || "",
                abortCommandTemplate: instructions.abortCommand || "",
                chunkSize: instructions.chunkSize || 1024
            };
        } else {
            return undefined;
        }
    }

    get connectionState(): {
        color: string;
        label: string;
        error?: string;
    } {
        if (!this.lastConnection) {
            return {
                color: "#666",
                label: "Newly added"
            };
        } else {
            if (this.connection.isConnected) {
                return {
                    color: "green",
                    label: "Connected"
                };
            } else {
                if (this.connection.errorCode === ConnectionErrorCode.NOT_FOUND) {
                    return {
                        color: "#ccc",
                        label: "Not found"
                    };
                } else if (this.connection.errorCode !== ConnectionErrorCode.NONE) {
                    return {
                        color: "#ccc",
                        label: "Disconnected",
                        error: this.connection.error
                    };
                } else {
                    return {
                        color: "red",
                        label: "Disconnected"
                    };
                }
            }
        }
    }

    get connectionParametersDetails() {
        const {
            PropertyList,
            StaticProperty
        } = require("shared/ui/properties") as typeof UiPropertiesModule;

        if (this.lastConnection) {
            if (this.lastConnection.type === "ethernet") {
                return (
                    <PropertyList>
                        <StaticProperty name="Interface" value="Ethernet" />
                        <StaticProperty
                            name="Server address"
                            value={this.lastConnection.ethernetParameters.address}
                        />
                        <StaticProperty
                            name="Port"
                            value={this.lastConnection.ethernetParameters.port.toString()}
                        />
                    </PropertyList>
                );
            } else if (this.lastConnection.type === "serial") {
                return (
                    <PropertyList>
                        <StaticProperty name="Interface" value="Serial" />
                        <StaticProperty
                            name="Port"
                            value={this.lastConnection.serialParameters.port}
                        />
                        <StaticProperty
                            name="Baud rate"
                            value={this.lastConnection.serialParameters.baudRate.toString()}
                        />
                    </PropertyList>
                );
            } else if (this.lastConnection.type === "usbtmc") {
                return (
                    <PropertyList>
                        <StaticProperty name="Interface" value="USBTMC" />
                        <StaticProperty
                            name="Vendor ID"
                            value={
                                "0x" + this.lastConnection.usbtmcParameters.idVendor.toString(16)
                            }
                        />
                        <StaticProperty
                            name="Product ID"
                            value={
                                "0x" + this.lastConnection.usbtmcParameters.idProduct.toString(16)
                            }
                        />
                    </PropertyList>
                );
            }
        }
        return null;
    }

    get image() {
        return this.extension && this.extension.image;
    }

    @computed
    get name() {
        return (
            this.label ||
            this.idn ||
            (this.extension && this.extension.name) ||
            "Unknown instrument"
        );
    }

    @computed
    get content() {
        const { Icon } = require("shared/ui/icon");

        if (this.extension) {
            return (
                <div className="EezStudio_Instrument">
                    <img src={this.extension.image} draggable={false} />
                    <div className="EezStudio_Instrument_Label">{this.name}</div>
                    <div className="EezStudio_Instrument_ConnectionState">
                        <span
                            style={{
                                backgroundColor: this.connectionState.color
                            }}
                        />
                        <span>{this.connectionState.label}</span>
                        {this.connectionState.error && (
                            <Icon className="text-danger" icon="material:error" />
                        )}
                    </div>
                </div>
            );
        } else {
            return <div className="EezStudio_NotFoundObject" />;
        }
    }

    get creationDate() {
        if (this._creationDate === undefined) {
            let result;
            try {
                result = db
                    .prepare(
                        `SELECT * FROM "activityLog" WHERE oid=? AND type="instrument/created"`
                    )
                    .get(this.id);
            } catch (err) {
                console.error(err);
            }
            if (result) {
                this._creationDate = new Date(result.date.toNumber());
            } else {
                this._creationDate = null;
            }
        }

        return this._creationDate;
    }

    activityLogEntryInfo(logEntry: IActivityLogEntry) {
        if (this.extension) {
            const historyItem = createHistoryItem(logEntry);
            return {
                name: this.name,
                content: historyItem.info
            };
        } else {
            return null;
        }
    }

    @computed
    get details() {
        const { InstrumentDetails } = require("instrument/instrument-object-details");
        return <InstrumentDetails instrument={this} />;
    }

    afterCreate() {
        if (!isRenderer()) {
            log(
                {
                    oid: this.id,
                    type: "instrument/created"
                },
                {
                    undoable: false
                }
            );
        }
    }

    afterRestore() {
        if (!isRenderer()) {
            log(
                {
                    oid: this.id,
                    type: "instrument/restored"
                },
                {
                    undoable: false
                }
            );
        }
    }

    afterDelete() {
        if (!isRenderer()) {
            this.connection.destroy();

            log(
                {
                    oid: this.id,
                    type: "instrument/deleted"
                },
                {
                    undoable: false
                }
            );

            const { closeWindow } = require("main/window") as typeof MainWindowModule;
            closeWindow(this.getEditorWindowArgs());
        }
    }

    isEditable = true;

    getEditor() {
        const { AppStore } = require("instrument/window/app-store") as typeof AppStoreModule;
        return new AppStore(this.id);
    }

    getEditorWindowArgs() {
        return {
            url: "instrument/index.html?" + this.id,
            args: this.id
        };
    }

    openEditor(target: "tab" | "window" | "default") {
        window.postMessage(
            {
                type: "open-object-editor",
                object: {
                    id: this.id,
                    type: "instrument"
                },
                target
            },
            "*"
        );
    }

    @action
    setLabel(label: string) {
        if (label !== this.label) {
            beginTransaction("Change instrument label");
            store.updateObject({
                id: this.id,
                label
            });
            commitTransaction();
        }
    }

    @action
    setIdn(idn: string) {
        if (idn !== this.idn) {
            beginTransaction("Change instrument IDN");
            store.updateObject({
                id: this.id,
                idn
            });
            commitTransaction();
        }
    }

    @action
    setConnectionParameters(connectionParameters: ConnectionParameters) {
        if (!objectEqual(connectionParameters, this.lastConnection)) {
            beginTransaction("Change instrument connection settings");
            store.updateObject({
                id: this.id,
                lastConnection: toJS(connectionParameters)
            });
            commitTransaction();
        }
    }

    @action
    setLastFileUploadInstructions(fileUploadInstructions: IFileUploadInstructions) {
        if (!objectEqual(fileUploadInstructions, this.lastFileUploadInstructions)) {
            beginTransaction("Change instrument upload settings");
            store.updateObject({
                id: this.id,
                lastFileUploadInstructions: toJS(fileUploadInstructions)
            });
            commitTransaction();
        }
    }

    @action
    setAutoConnect(autoConnect: boolean) {
        if (autoConnect !== this.autoConnect) {
            beginTransaction("Change instrument auto connect");
            store.updateObject({
                id: this.id,
                autoConnect
            });
            commitTransaction();
        }
    }

    addShortcutGroupToInstrument(groupName: string) {
        if (this.selectedShortcutGroups.indexOf(groupName) === -1) {
            let selectedShortcutGroups = this.selectedShortcutGroups.concat([groupName]);
            store.updateObject({
                id: this.id,
                selectedShortcutGroups
            });
        }
    }

    removeShortcutGroupFromInstrument(groupName: string) {
        let i = this.selectedShortcutGroups.indexOf(groupName);
        if (i !== -1) {
            let selectedShortcutGroups = this.selectedShortcutGroups.slice();
            selectedShortcutGroups.splice(i, 1);
            store.updateObject({
                id: this.id,
                selectedShortcutGroups
            });
        }
    }

    restore() {
        let workbenchObject = workbenchObjectsStore.findByOid(this.id);

        beginTransaction("Restore instrument");
        store.undeleteObject(this);
        workbenchObjectsStore.undeleteObject(workbenchObject);
        commitTransaction();
    }

    deletePermanently() {
        workbenchObjectsStore.deleteObject({ oid: this.id }, { deletePermanently: true });
        activityLogStore.deleteObject({ oid: this.id }, { deletePermanently: true });
        store.deleteObject(this, { deletePermanently: true });
    }
}

export const store = createStore({
    storeName: "instrument",
    versionTables: ["instrument/version"],
    versions: [
        // version 1
        `DROP TABLE IF EXISTS "instrument/version";
        CREATE TABLE "instrument/version"(version INT NOT NULL);
        INSERT INTO "instrument/version"(version) VALUES (1);
        DROP TABLE IF EXISTS "instrument";
        CREATE TABLE "instrument"(
            deleted INTEGER NOT NULL,
            instrumentExtensionId TEXT NOT NULL,
            label TEXT,
            idn TEXT,
            lastConnection TEXT,
            autoConnect INTEGER,
            lastFileDownloadInstructions TEXT,
            selectedShortcutGroups TEXT
        );`,

        // version 2
        `DROP TABLE IF EXISTS "instrument";
        CREATE TABLE "instrument"(
            deleted INTEGER NOT NULL,
            instrumentExtensionId TEXT NOT NULL,
            label TEXT,
            idn TEXT,
            lastConnection TEXT,
            autoConnect INTEGER,
            lastFileDownloadInstructions TEXT,
            selectedShortcutGroups TEXT
        );
        UPDATE "instrument/version" SET version = 2;`,

        // version 3
        `CREATE TABLE "instrument-new"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            deleted INTEGER NOT NULL,
            instrumentExtensionId TEXT NOT NULL,
            label TEXT,
            idn TEXT,
            lastConnection TEXT,
            autoConnect INTEGER,
            lastFileDownloadInstructions TEXT,
            selectedShortcutGroups TEXT);
        INSERT INTO "instrument-new"(id, deleted, instrumentExtensionId, label, idn, lastConnection, autoConnect, lastFileDownloadInstructions, selectedShortcutGroups)
            SELECT ROWID, deleted, instrumentExtensionId, label, idn, lastConnection, autoConnect, lastFileDownloadInstructions, selectedShortcutGroups FROM "instrument";
        DROP TABLE "instrument";
        ALTER TABLE "instrument-new" RENAME TO "instrument";
        UPDATE "instrument/version" SET version = 3;`,

        // version 4
        `CREATE TABLE "instrument-new"(
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE,
            deleted INTEGER NOT NULL,
            instrumentExtensionId TEXT NOT NULL,
            label TEXT,
            idn TEXT,
            lastConnection TEXT,
            autoConnect INTEGER,
            lastFileUploadInstructions TEXT,
            selectedShortcutGroups TEXT);
        INSERT INTO "instrument-new"(id, deleted, instrumentExtensionId, label, idn, lastConnection, autoConnect, lastFileUploadInstructions, selectedShortcutGroups)
            SELECT id, deleted, instrumentExtensionId, label, idn, lastConnection, autoConnect, lastFileDownloadInstructions, selectedShortcutGroups FROM "instrument";
        DROP TABLE "instrument";
        ALTER TABLE "instrument-new" RENAME TO "instrument";
        UPDATE "instrument/version" SET version = 4;`
    ],
    properties: {
        id: types.id,
        deleted: types.boolean,
        instrumentExtensionId: types.string,
        label: types.string,
        idn: types.string,
        lastConnection: types.object,
        autoConnect: types.boolean,
        lastFileUploadInstructions: types.object,
        selectedShortcutGroups: types.object
    },
    create(props: IInstrumentObjectProps) {
        return new InstrumentObject(props);
    }
});

////////////////////////////////////////////////////////////////////////////////

export const instrumentStore = store;

const instrumentCollection = createStoreObjectsCollection<InstrumentObject>();
store.watch(instrumentCollection);
export const instruments = instrumentCollection.objects;

export function changeGroupNameInInstruments(oldName: string, newName?: string) {
    instruments.forEach((instrument: InstrumentObject) => {
        let i = instrument.selectedShortcutGroups.indexOf(oldName);
        if (i !== -1) {
            let selectedShortcutGroups = instrument.selectedShortcutGroups.slice();
            selectedShortcutGroups.splice(i, 1);
            if (newName) {
                selectedShortcutGroups.push(newName);
            }

            store.updateObject({
                id: instrument.id,
                selectedShortcutGroups
            });
        }
    });
}

export function deleteGroupInInstruments(groupName: string) {
    changeGroupNameInInstruments(groupName);
}

import React from "react";
import { observable, computed, action, runInAction, toJS, autorun } from "mobx";

import {
    createStore,
    types,
    createStoreObjectsCollection,
    beginTransaction,
    commitTransaction
} from "eez-studio-shared/store";
import { IExtension } from "eez-studio-shared/extensions/extension";
import {
    loadExtensionById,
    extensions
} from "eez-studio-shared/extensions/extensions";
import { activityLogStore, log } from "eez-studio-shared/activity-log";
import { objectEqual } from "eez-studio-shared/util";
import { isRenderer } from "eez-studio-shared/util-electron";
import { IUnit } from "eez-studio-shared/units";
import { db } from "eez-studio-shared/db-path";
import { _defer } from "eez-studio-shared/algorithm";

import * as notification from "eez-studio-ui/notification";

import type * as MainWindowModule from "main/window";

import type * as ExtensionMangerModule from "home/extensions-manager/extensions-manager";
import type * as CatalogModule from "home/extensions-manager/catalog";

import type { IInstrumentExtensionProperties } from "instrument/instrument-extension";
import { DEFAULT_INSTRUMENT_PROPERTIES } from "instrument/DEFAULT_INSTRUMENT_PROPERTIES";
import type { IInstrumentProperties } from "instrument/export";
import type { ICommandSyntax, IQuerySyntax } from "instrument/commands-tree";

import type { IConnection } from "instrument/connection/connection-base";
import type { ConnectionParameters } from "instrument/connection/interface";
import { ConnectionErrorCode } from "instrument/connection/ConnectionErrorCode";
import type { IFileUploadInstructions } from "instrument/connection/file-upload";

import type * as UiPropertiesModule from "eez-studio-ui/properties";
import type * as AppStoreModule from "instrument/window/app-store";
import type * as Bb3Module from "instrument/bb3";
import { CommandsTree, getCommandsTree } from "./window/terminal/commands-tree";

import type * as ConnectionMainModule from "instrument/connection/connection-main";
import type * as ConnectionRendererModule from "instrument/connection/connection-renderer";

////////////////////////////////////////////////////////////////////////////////

const CONF_LISTS_MAX_POINTS = 256;
const CONF_LISTS_MIN_DWELL = 0.0001;
const CONF_LISTS_MAX_DWELL = 65535;
const CONF_LISTS_DWELL_DIGITS = 4;
const CONF_LISTS_VOLTAGE_DIGITS = 3;
const CONF_LISTS_CURRENT_DIGITS = 3;

export interface IInstrumentObjectProps {
    id: string;
    instrumentExtensionId: string;
    label?: string;
    idn?: string;
    lastConnection?: ConnectionParameters;
    autoConnect: boolean;
    lastFileUploadInstructions?: IFileUploadInstructions;
    selectedShortcutGroups: string[];
    custom?: any;
}

const UNKNOWN_INSTRUMENT_EXTENSION: IExtension = {
    id: "",
    name: "Unknown instrument",
    version: "no version",
    author: "no author",
    image: "../eez-studio-ui/_images/object-implementation-not-found.svg",
    properties: {}
};

export class InstrumentObject {
    id: string;

    @observable instrumentExtensionId: string;
    @observable label: string | undefined;
    @observable idn: string | undefined;
    @observable lastConnection: ConnectionParameters | undefined;
    @observable autoConnect: boolean;
    @observable lastFileUploadInstructions: IFileUploadInstructions | undefined;
    @observable selectedShortcutGroups: string[];
    @observable custom: any;

    connection: IConnection;

    _creationDate: Date | null | undefined;

    commandsTree: CommandsTree;

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

        this.custom = props.custom || {};

        if (isRenderer()) {
            const { createRendererProcessConnection } =
                require("instrument/connection/connection-renderer") as typeof ConnectionRendererModule;
            this.connection = createRendererProcessConnection(this);
            this.commandsTree = getCommandsTree(this.instrumentExtensionId);
        } else {
            const { createMainProcessConnection } =
                require("instrument/connection/connection-main") as typeof ConnectionMainModule;
            this.connection = createMainProcessConnection(this);
        }

        autorun(() => {
            if (this._extension) {
                if (this.isUnknownExtension) {
                    // check if extension is installed in the meantime
                    if (extensions.get(this.instrumentExtensionId)) {
                        runInAction(() => {
                            this._extension = undefined;
                        });
                    }
                } else {
                    // check if extension is uninstalled in the meantime
                    if (!extensions.get(this.instrumentExtensionId)) {
                        runInAction(() => {
                            this._extension = undefined;
                        });
                    }
                }
            }
        });
    }

    toString() {
        return `Instrument: ${this.name} [${this.id}]`;
    }

    get isUnknownExtension() {
        return (
            this.extension &&
            this.extension.name === UNKNOWN_INSTRUMENT_EXTENSION.name &&
            this.extension.version === UNKNOWN_INSTRUMENT_EXTENSION.version &&
            this.extension.author === UNKNOWN_INSTRUMENT_EXTENSION.author
        );
    }

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
                        .then(
                            action((extension: IExtension) => {
                                this._loadingExtension = false;
                                this._extension = extension;
                            })
                        )
                        .catch(
                            action(() => {
                                this._loadingExtension = false;
                                this._extension = Object.assign(
                                    {},
                                    UNKNOWN_INSTRUMENT_EXTENSION,
                                    {
                                        id: this.instrumentExtensionId
                                    }
                                );
                            })
                        );
                });
            }

            return undefined;
        }

        const extension = Object.assign({}, UNKNOWN_INSTRUMENT_EXTENSION, {
            id: this.instrumentExtensionId
        });

        _defer(() => {
            this._extension = extension;
        });

        return extension;
    }

    @computed
    get properties(): IInstrumentProperties | undefined {
        if (!this.extension) {
            return undefined;
        }
        return (this.extension.properties as IInstrumentExtensionProperties)
            .properties;
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

    getConnectionParameters(parameters: any[]): ConnectionParameters {
        let finalParameters: any = {};

        for (let i = parameters.length - 1; i >= 0; i--) {
            if (parameters[i]) {
                finalParameters = Object.assign(finalParameters, parameters[i]);
            }
        }

        return finalParameters;
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

                if (typeof connection.usbtmc.idVendor === "number") {
                    idVendor = connection.usbtmc.idVendor;
                } else if (typeof connection.usbtmc.idVendor === "string") {
                    idVendor = parseInt(connection.usbtmc.idVendor);
                } else {
                    idVendor = 0;
                }

                if (typeof connection.usbtmc.idProduct === "number") {
                    idProduct = connection.usbtmc.idProduct;
                } else if (typeof connection.usbtmc.idProduct === "string") {
                    idProduct = parseInt(connection.usbtmc.idProduct);
                } else {
                    idProduct = 0;
                }
            }
        }

        if (type === undefined) {
            type = "ethernet";
        }

        if (ethernetPort === undefined) {
            ethernetPort =
                DEFAULT_INSTRUMENT_PROPERTIES.properties.connection!.ethernet!
                    .port;
        }

        if (baudRate === undefined) {
            baudRate =
                DEFAULT_INSTRUMENT_PROPERTIES.properties.connection!.serial!
                    .defaultBaudRate;
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
        return DEFAULT_INSTRUMENT_PROPERTIES.properties.connection!.serial!
            .baudRates;
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
                    instructions.shortFileName !== undefined
                        ? instructions.shortFileName
                        : true,
                startCommandTemplate: instructions.startCommand || "",
                fileSizeCommandTemplate: instructions.fileSizeCommand || "",
                sendChunkCommandTemplate: instructions.sendChunkCommand || "",
                finishCommandTemplate: instructions.finishCommand || "",
                abortCommandTemplate: instructions.abortCommand || "",
                chunkSize: instructions.chunkSize || 1024,
                favoriteDestinationPaths:
                    instructions.favoriteDestinationPaths || undefined
            };
        } else {
            return undefined;
        }
    }

    get isConnected() {
        return this.connection.isConnected;
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
                if (
                    this.connection.errorCode === ConnectionErrorCode.NOT_FOUND
                ) {
                    return {
                        color: "#ccc",
                        label: "Not found"
                    };
                } else if (
                    this.connection.errorCode !== ConnectionErrorCode.NONE
                ) {
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
        const { PropertyList, StaticProperty } =
            require("eez-studio-ui/properties") as typeof UiPropertiesModule;

        if (this.lastConnection) {
            if (this.lastConnection.type === "ethernet") {
                return (
                    <PropertyList>
                        <StaticProperty name="Interface" value="Ethernet" />
                        <StaticProperty
                            name="Server address"
                            value={
                                this.lastConnection.ethernetParameters.address
                            }
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
                                "0x" +
                                this.lastConnection.usbtmcParameters.idVendor.toString(
                                    16
                                )
                            }
                        />
                        <StaticProperty
                            name="Product ID"
                            value={
                                "0x" +
                                this.lastConnection.usbtmcParameters.idProduct.toString(
                                    16
                                )
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
            (this.extension &&
                (this.extension.displayName || this.extension.name)) ||
            ""
        );
    }

    @computed
    get content() {
        const { Icon } = require("eez-studio-ui/icon");

        return (
            <div className="EezStudio_InstrumentContent">
                {this.image && <img src={this.image} draggable={false} />}
                <div className="EezStudio_InstrumentLabel">{this.name}</div>
                <div className="EezStudio_InstrumentConnectionState">
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
                this._creationDate = new Date(Number(result.date));
            } else {
                this._creationDate = null;
            }
        }

        return this._creationDate;
    }

    @computed
    get details() {
        const {
            InstrumentDetails
        } = require("instrument/instrument-object-details");
        return <InstrumentDetails instrument={this} />;
    }

    afterCreate() {
        if (!isRenderer()) {
            log(
                activityLogStore,
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
                activityLogStore,
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
                activityLogStore,
                {
                    oid: this.id,
                    type: "instrument/deleted"
                },
                {
                    undoable: false
                }
            );

            const { closeWindow } =
                require("main/window") as typeof MainWindowModule;
            closeWindow(this.getEditorWindowArgs());
        }
    }

    _instrumentAppStore: AppStoreModule.InstrumentAppStore;

    getEditor() {
        if (!this._instrumentAppStore) {
            const { InstrumentAppStore } =
                require("instrument/window/app-store") as typeof AppStoreModule;
            this._instrumentAppStore = new InstrumentAppStore(this);
        }

        return this._instrumentAppStore;
    }

    getEditorWindowArgs() {
        return {
            url: "home/index.html?" + this.id,
            args: this.id
        };
    }

    openEditor(target: "tab" | "window" | "default") {
        window.postMessage(
            {
                type: "open-instrument-editor",
                instrumentId: this.id,
                target
            },
            "*"
        );
    }

    @action
    setLabel(label: string) {
        if (label !== this.label) {
            this.label = label;

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
    setLastFileUploadInstructions(
        fileUploadInstructions: IFileUploadInstructions
    ) {
        if (
            !objectEqual(
                fileUploadInstructions,
                this.lastFileUploadInstructions
            )
        ) {
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
            let selectedShortcutGroups = this.selectedShortcutGroups.concat([
                groupName
            ]);
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
        beginTransaction("Restore instrument");
        store.undeleteObject(this);
        commitTransaction();
    }

    deletePermanently() {
        activityLogStore.deleteObject(
            { oid: this.id },
            { deletePermanently: true }
        );
        store.deleteObject(this, { deletePermanently: true });
    }

    async installExtension() {
        const { extensionsCatalog } =
            require("home/extensions-manager/catalog") as typeof CatalogModule;

        const extension = extensionsCatalog.catalog.find(
            extension => extension.id === this.extension!.id
        );
        if (extension) {
            const progressToastId = notification.info("Installing...", {
                autoClose: false
            });

            const { downloadAndInstallExtension } =
                require("home/extensions-manager/extensions-manager") as typeof ExtensionMangerModule;

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

    addToContextMenu(menu: Electron.Menu) {
        if (this.isUnknownExtension) {
            const { MenuItem } = EEZStudio.remote;

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
                        this.installExtension();
                    }
                })
            );
        }
    }

    getQueryResponseType(query: string) {
        const command = this.commandsTree.findCommand(query);
        const response = command && (command as IQuerySyntax).response;
        if (response && response.type && response.type.length > 0) {
            return response.type[0].type;
        }
        return undefined;
    }

    isCommandSendsBackDataBlock(commandName: string) {
        const command = this.commandsTree.findCommand(commandName);
        return command && (command as ICommandSyntax).sendsBackDataBlock;
    }

    @computed
    get sendFileToInstrumentHandler() {
        if (this.getFileDownloadProperty()) {
            const fileUploadInstructions =
                this.lastFileUploadInstructions ||
                this.defaultFileUploadInstructions;

            if (fileUploadInstructions) {
                const instrument = this;

                return async () => {
                    if (this.defaultFileUploadInstructions) {
                        fileUploadInstructions.favoriteDestinationPaths =
                            this.defaultFileUploadInstructions.favoriteDestinationPaths;
                    }

                    const { showFileUploadDialog } = await import(
                        "instrument/window/terminal/file-upload-dialog"
                    );

                    showFileUploadDialog(
                        fileUploadInstructions,
                        instructions => {
                            instrument.connection.doUpload(instructions);
                        }
                    );
                };
            }
        }

        return undefined;
    }

    @action
    setCustomProperty(customPropertyName: string, customPropertyValue: any) {
        beginTransaction(
            `Change instrument ${customPropertyName} custom property`
        );
        store.updateObject({
            id: this.id,
            custom: toJS(
                Object.assign(this.custom, {
                    [customPropertyName]: customPropertyValue
                })
            )
        });
        commitTransaction();
    }

    getIcon() {
        return this.image;
    }

    @computed
    get isBB3() {
        return (
            this.instrumentExtensionId ==
                "687b6dee-2093-4c36-afb7-cfc7ea2bf262" ||
            this.instrumentExtensionId == "7cab6860-e593-4ba2-ee68-57fe84460fa4"
        );
    }

    terminate() {
        if (this.isBB3) {
            const { getBB3Instrument } =
                require("instrument/bb3") as typeof Bb3Module;
            const bb3Instrument = getBB3Instrument(
                this._instrumentAppStore,
                false
            );
            if (bb3Instrument) {
                bb3Instrument.terminate();
            }
        }
    }
}

// Legacy: we don't user 'workbench/objects' anymore, but if exists then remove all instruments not referenced by the 'workbench/objects'.
try {
    db.prepare(
        `DELETE FROM instrument WHERE id NOT IN (SELECT oid FROM 'workbench/objects')`
    ).run();
} catch (err) {}

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
        UPDATE "instrument/version" SET version = 4;`,

        // version 5
        // migrate version to versions table
        `DROP TABLE "instrument/version";
        CREATE TABLE IF NOT EXISTS versions(tableName TEXT PRIMARY KEY, version INT NOT NULL);
        INSERT INTO versions(tableName, version) VALUES ('instrument', 5);
        `,

        // version 6
        `ALTER TABLE instrument ADD COLUMN custom TEXT;
        UPDATE versions SET version = 6 WHERE tableName = 'instrument';`
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
        selectedShortcutGroups: types.object,
        custom: types.object
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

export function changeGroupNameInInstruments(
    oldName: string,
    newName?: string
) {
    instruments.forEach((instrument: InstrumentObject) => {
        let i = instrument.selectedShortcutGroups.indexOf(oldName);
        if (i !== -1) {
            let selectedShortcutGroups =
                instrument.selectedShortcutGroups.slice();
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

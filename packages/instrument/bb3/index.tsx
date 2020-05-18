import React from "react";
import { observable, runInAction } from "mobx";

import { ButtonAction } from "eez-studio-ui/action";

import { InstrumentObject } from "instrument/instrument-object";
import { InstrumentAppStore } from "instrument/window/app-store";
import { getConnection } from "instrument/window/connection";

const FIRMWARE_RELEASES_URL = "https://api.github.com/repos/eez-open/modular-psu-firmware/releases";
const SCRIPTS_CATALOG_URL =
    "https://github.com/eez-open/modular-psu-firmware/raw/master/scripts/scripts-catalog.json";

interface IMcu {
    firmwareVersion: string;
}

interface ISlot {
    model: string;
    version: string;
}

type Slots = (ISlot | undefined)[];

interface IOverview {
    mcu: IMcu;
    slots: Slots;
}

interface IScript {
    name: string;
    version: string;
}

function removeQuotes(str: string) {
    if (str.length >= 2 && str[0] == '"' && str[str.length - 1] == '"') {
        return str.substr(1, str.length - 2);
    }
    return str;
}

class Overview implements IOverview {
    @observable mcu: IMcu;
    @observable slots: Slots;
    @observable scripts: IScript[];

    constructor(private appStore: InstrumentAppStore, instrument: InstrumentObject) {
        Object.assign(this, instrument.custom.overview);

        if (!this.mcu) {
            this.mcu = {
                firmwareVersion: ""
            };
        }

        if (!this.slots) {
            this.slots = [];
        }

        if (!this.scripts) {
            this.scripts = [];
        }
    }

    async refresh() {
        this.loadScriptsCatalog();

        const connection = getConnection(this.appStore);

        if (!connection.isConnected) {
            return;
        }

        connection.acquire(false);

        ////////////////////////////

        let slots: Slots = [];

        const numChannels = await connection.query("SYST:CHAN?");
        for (let i = 0; i < numChannels; i++) {
            connection.command("INST CH" + (i + 1));
            const slotIndex = await connection.query("SYST:CHAN:SLOT?");
            const model = removeQuotes(await connection.query("SYST:CHAN:MOD?"));
            const version = removeQuotes(await connection.query("SYST:CHAN:VERS?"));
            slots[slotIndex - 1] = {
                model,
                version
            };
        }

        ////////////////////////////

        const firmwareVersion = removeQuotes(await connection.query("SYST:CPU:FIRM?"));

        ////////////////////////////

        const filesInScriptsFolderAsOneString = await connection.query('MMEM:CAT? "/Scripts"');
        const filesInScriptsFolderAsArray = removeQuotes(filesInScriptsFolderAsOneString).split(
            '","'
        );
        const oldScripts = this.scripts;
        const newScripts: IScript[] = [];
        filesInScriptsFolderAsArray.forEach(fileInfoLine => {
            const fileName = fileInfoLine.split(",")[0];
            if (fileName.toLowerCase().endsWith(".py")) {
                const scriptName = fileName.substring(0, fileName.length - 3);
                const oldScript = oldScripts.find(oldScript => oldScript.name == scriptName);
                newScripts.push({
                    name: scriptName,
                    version: oldScript ? oldScript.version : "unknown"
                });
            }
        });

        ////////////////////////////

        connection.release();

        ////////////////////////////

        runInAction(() => {
            this.mcu.firmwareVersion = firmwareVersion;
            this.slots = slots;
            this.scripts = newScripts;
        });
    }

    loadFirmwareReleases() {
        let req = new XMLHttpRequest();
        req.responseType = "json";
        req.open("GET", FIRMWARE_RELEASES_URL);

        req.addEventListener("load", async () => {
            console.log(req.response);
        });

        req.addEventListener("error", error => {
            console.error(error);
        });

        req.send();
    }

    loadScriptsCatalog() {
        let req = new XMLHttpRequest();
        req.responseType = "json";
        req.open("GET", SCRIPTS_CATALOG_URL);

        req.addEventListener("load", async () => {
            console.log(req.response);
        });

        req.addEventListener("error", error => {
            console.error(error);
        });

        req.send();
    }
}

const overviews = new Map<string, Overview>();

function getInstrumentOverview(appStore: InstrumentAppStore) {
    if (!appStore.instrument) {
        return undefined;
    }
    let overview = overviews.get(appStore.instrument.id);
    if (!overview) {
        overview = new Overview(appStore, appStore.instrument);
        overviews.set(appStore.instrument.id, overview);
    }
    return overview;
}

export function render(appStore: InstrumentAppStore) {
    const instrumentOverview = getInstrumentOverview(appStore);

    if (!instrumentOverview) {
        return <div />;
    }

    return (
        <div>
            <h1>Firmware version: {instrumentOverview.mcu.firmwareVersion}</h1>
            <section>
                <h3>Modules:</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Slot #</th>
                            <th>Model</th>
                            <th>Version</th>
                        </tr>
                    </thead>
                    <tbody>
                        {instrumentOverview.slots.map((slot, i) => (
                            <tr key={i}>
                                <td>{i + 1}</td>
                                <td>{slot ? slot.model : "None"}</td>
                                <td>{slot ? slot.version : "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            <section>
                <h3>Scripts:</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Script name</th>
                            <th>Version</th>
                        </tr>
                    </thead>
                    <tbody>
                        {instrumentOverview.scripts.map(script => (
                            <tr key={script.name}>
                                <td>{script.name}</td>
                                <td>{script.version}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}

export function toolbarButtonsRender(appStore: InstrumentAppStore) {
    if (!appStore.instrument) {
        return <div />;
    }

    return (
        <React.Fragment>
            {appStore.instrument.connection.isConnected && (
                <ButtonAction
                    text="Refresh"
                    icon="material:refresh"
                    className="btn-secondary"
                    title="Refresh"
                    onClick={() => {
                        const instrumentOverview = getInstrumentOverview(appStore);
                        if (instrumentOverview) {
                            instrumentOverview.refresh();
                        }
                    }}
                />
            )}
        </React.Fragment>
    );
}

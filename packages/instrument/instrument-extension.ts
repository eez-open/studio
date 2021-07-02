import { computed, values } from "mobx";

import {
    IExtensionDefinition,
    IExtension,
    IExtensionProperties,
    IExtensionHost
} from "eez-studio-shared/extensions/extension";
import { extensions } from "eez-studio-shared/extensions/extensions";
import { isRenderer } from "eez-studio-shared/util-electron";
import { stringCompare } from "eez-studio-shared/string";

import { loadInstrumentExtension } from "instrument/import";
import {
    instrumentStore,
    InstrumentObject
} from "instrument/instrument-object";
import { IInstrumentProperties } from "instrument/export";

import * as ConnectionModule from "instrument/connection/connection";

import { createInstrumentListStore } from "instrument/window/lists/store";

import * as InstrumentAppStoreModule from "instrument/window/app-store";
import * as ScriptsModule from "instrument/window/scripts";
import * as DlogModule from "instrument/window/waveform/dlog";

if (!isRenderer()) {
    createInstrumentListStore(null);
}

export interface IInstrumentExtensionProperties extends IExtensionProperties {
    properties: IInstrumentProperties;
}

export const instrumentExtensions = computed(() => {
    return values(extensions)
        .filter(extension => extension.type === "instrument")
        .sort((a, b) =>
            stringCompare(a.displayName || a.name, b.displayName || b.name)
        );
});

export function createInstrument(extension: IExtension) {
    return instrumentStore.createObject({
        instrumentExtensionId: extension.id,
        autoConnect: false
    }) as InstrumentObject;
}

const instrumentExtension: IExtensionDefinition = {
    preInstalled: true,

    init() {
        if (!isRenderer()) {
            const { setupIpcServer } =
                require("instrument/connection/connection") as typeof ConnectionModule;

            setupIpcServer();

            require("instrument/connection/list-operations");
        }
    },

    destroy() {},

    loadExtension: loadInstrumentExtension,

    handleDragAndDropFile: async (filePath: string, host: IExtensionHost) => {
        const { InstrumentAppStore } =
            require("instrument/window/app-store") as typeof InstrumentAppStoreModule;
        const { importScript } =
            require("instrument/window/scripts") as typeof ScriptsModule;
        const { importDlog } =
            require("instrument/window/waveform/dlog") as typeof DlogModule;

        if (host.activeTab.editor instanceof InstrumentAppStore) {
            const appStore = host.activeTab.editor;
            if (await importScript(appStore, filePath)) {
                return true;
            }

            if (await importDlog(appStore, filePath)) {
                return true;
            }
        }

        return false;
    }
};

export default instrumentExtension;

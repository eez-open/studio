import { computed, values } from "mobx";

import type {
    IExtensionDefinition,
    IExtensionProperties,
    IExtensionHost
} from "eez-studio-shared/extensions/extension";
import { extensions } from "eez-studio-shared/extensions/extensions";
import { isRenderer } from "eez-studio-shared/util-electron";
import { stringCompare } from "eez-studio-shared/string";

import { loadInstrumentExtension } from "instrument/import";
import type { IInstrumentProperties } from "instrument/export";

import type * as ConnectionModule from "instrument/connection/connection-main";

import type * as InstrumentAppStoreModule from "instrument/window/app-store";
import type * as ScriptsModule from "instrument/window/scripts";
import type * as DlogModule from "instrument/window/waveform/dlog";

import "instrument/instrument-object";

const { createInstrumentListStore } =
    require("instrument/window/lists/store") as typeof import("instrument/window/lists/store");

createInstrumentListStore(null);

export interface IInstrumentExtensionProperties extends IExtensionProperties {
    properties: IInstrumentProperties;
}

export const instrumentExtensions = computed(() => {
    return values(extensions)
        .filter(extension => extension.extensionType === "iext")
        .sort((a, b) =>
            stringCompare(a.displayName || a.name, b.displayName || b.name)
        );
});

const instrumentExtension: IExtensionDefinition = {
    preInstalled: true,
    extensionType: "built-in",

    init() {
        if (!isRenderer()) {
            const { setupIpcServer } =
                require("instrument/connection/connection-main") as typeof ConnectionModule;

            setupIpcServer();

            require("instrument/connection/list-operations-main");
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

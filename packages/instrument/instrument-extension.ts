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
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import { IDesignerContext } from "home/designer/designer-interfaces";

import { loadInstrumentExtension } from "instrument/import";
import { instrumentStore, instruments } from "instrument/instrument-object";
import * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";
import * as DeletedInstrumentsDialogModule from "instrument/deleted-instruments-dialog";
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
        .sort((a, b) => stringCompare(a.displayName || a.name, b.displayName || b.name));
});

function createInstrument(extension: IExtension) {
    return {
        type: "instrument",
        oid: instrumentStore.createObject({
            instrumentExtensionId: extension.id,
            autoConnect: false
        }),
        rect: {
            left: 0,
            top: 0,
            width: 128,
            height: 164
        }
    };
}

const instrumentExtension: IExtensionDefinition = {
    preInstalled: true,

    init() {
        if (!isRenderer()) {
            const {
                setupIpcServer
            } = require("instrument/connection/connection") as typeof ConnectionModule;

            setupIpcServer();

            require("instrument/connection/list-operations");
        }
    },

    destroy() {},

    get toolbarButtons() {
        let buttons = [
            {
                id: "instrument-add",
                label: "Add Instrument",
                title: "Add instrument",
                className: "btn-success",
                onClick: (context: IDesignerContext) => {
                    const {
                        showAddInstrumentDialog
                    } = require("instrument/add-instrument-dialog") as typeof AddInstrumentDialogModule;

                    showAddInstrumentDialog(extension => {
                        beginTransaction("Add instrument");
                        let params = createInstrument(extension);
                        params.rect.left =
                            context.viewState.transform.centerPoint.x - params.rect.width / 2;
                        params.rect.top =
                            context.viewState.transform.centerPoint.y - params.rect.height / 2;
                        context.document.createObject(params);
                        commitTransaction();
                    });
                }
            }
        ];

        const {
            showDeletedInstrumentsDialog,
            deletedInstruments
        } = require("instrument/deleted-instruments-dialog") as typeof DeletedInstrumentsDialogModule;

        if (deletedInstruments.size > 0) {
            buttons.push({
                id: "show-deleted-instruments",
                label: "Deleted Instruments",
                title: "Show deleted instruments",
                className: "btn-default",
                onClick: (context: IDesignerContext) => {
                    showDeletedInstrumentsDialog();
                }
            });
        }

        return buttons;
    },

    objectTypes: {
        instrument: (id: string) => instruments.get(id)
    },

    loadExtension: loadInstrumentExtension,

    handleDragAndDropFile: async (filePath: string, host: IExtensionHost) => {
        const {
            InstrumentAppStore
        } = require("instrument/window/app-store") as typeof InstrumentAppStoreModule;
        const { importScript } = require("instrument/window/scripts") as typeof ScriptsModule;
        const { importDlog } = require("instrument/window/waveform/dlog") as typeof DlogModule;

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

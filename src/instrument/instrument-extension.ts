import { observable, computed, values } from "mobx";

import { IExtension, IExtensionProperties } from "shared/extensions/extension";
import { extensions } from "shared/extensions/extensions";
import { isRenderer } from "shared/util";
import { stringCompare } from "shared/string";
import { beginTransaction, commitTransaction } from "shared/store";
import { createCreateObjectToolHandler, ICanvas } from "shared/ui/designer";

import { loadInstrumentExtension } from "instrument/import";
import { instrumentStore, instruments } from "instrument/instrument-object";
import * as AddInstrumentDialogModule from "instrument/add-instrument-dialog";
import * as DeletedInstrumentsDialogModule from "instrument/deleted-instruments-dialog";
import { IInstrumentProperties } from "instrument/export";

import * as ConnectionModule from "instrument/connection/connection";

import { createInstrumentListStore } from "instrument/window/lists/store";

if (!isRenderer()) {
    createInstrumentListStore(null);
}

export interface IInstrumentExtensionProperties extends IExtensionProperties {
    properties: IInstrumentProperties;
}

export const instrumentExtensions = computed(() => {
    return values(extensions)
        .filter(extension => extension.type === "instrument")
        .sort((a, b) => stringCompare(a.name, b.name));
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

const instrumentToolboxGroup = computed(() => ({
    id: "instruments",
    label: "Instruments",
    title: "Instruments",
    tools: instrumentExtensions.get().map((extension: IExtension) =>
        observable({
            id: extension.id,
            icon: extension.image,
            iconSize: 48,
            label: extension.name,
            title: extension.name,
            selected: false,
            toolHandler: createCreateObjectToolHandler("Add instrument", () =>
                createInstrument(extension)
            )
        })
    )
}));

const instrumentExtension: IExtension = {
    id: "instrument",
    preInstalled: true,
    name: "Instrument",
    version: "0.1",
    author: "Envox",
    image: "",

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
                onClick: (canvas: ICanvas) => {
                    const {
                        showAddInstrumentDialog
                    } = require("instrument/add-instrument-dialog") as typeof AddInstrumentDialogModule;

                    showAddInstrumentDialog(extension => {
                        beginTransaction("Add instrument");
                        let { type, oid, rect } = createInstrument(extension);
                        canvas.createObject(type, oid, {
                            left: canvas.centerPoint.x - rect.width / 2,
                            top: canvas.centerPoint.y - rect.height / 2,
                            width: rect.width,
                            height: rect.height
                        });
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
                onClick: (canvas: ICanvas) => {
                    showDeletedInstrumentsDialog();
                }
            });
        }

        return buttons;
    },

    get toolboxGroups() {
        return [instrumentToolboxGroup.get()];
    },

    objectTypes: {
        instrument: (id: string) => instruments.get(id)
    },

    loadExtension: loadInstrumentExtension,

    properties: {}
};

export default instrumentExtension;

import React from "react";
import { observable, computed, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { _uniqBy } from "eez-studio-shared/algorithm";

import { IExtension } from "eez-studio-shared/extensions/extension";
import { getManufacturer, isInstrumentExtension } from "eez-studio-shared/extensions/extensions";
import { List, IListNode, ListItem } from "eez-studio-ui/list";
import * as notification from "eez-studio-ui/notification";
import { Loader } from "eez-studio-ui/loader";

import {
    ExtensionsManagerStore,
    ViewFilter,
    downloadAndInstallExtension
} from "home/extensions-manager/extensions-manager";
import { tabs } from "./tabs-store";

import { createInstrument } from "instrument/instrument-extension";
import { workbenchDocument } from "home/designer/store";

const BB3_INSTRUMENT_EXTENSION_ID = "687b6dee-2093-4c36-afb7-cfc7ea2bf262";
const BB3_INSTRUMENT_MANUFACTURER = "EEZ";

class SetupState {
    @observable selectedExtensionId: string | undefined = BB3_INSTRUMENT_EXTENSION_ID;
    @observable selectedManufacturer: string | undefined = BB3_INSTRUMENT_MANUFACTURER;

    extensionsManagerStore: ExtensionsManagerStore;

    constructor() {
        this.extensionsManagerStore = new ExtensionsManagerStore();
        this.extensionsManagerStore.viewFilter = ViewFilter.ALL;
    }

    @computed
    get instrumentExtensionNodes() {
        return this.extensionsManagerStore.all.filter(extension =>
            isInstrumentExtension(extension.latestVersion)
        );
    }

    @computed
    get manufacturers() {
        return _uniqBy(this.instrumentExtensionNodes, extension =>
            getManufacturer(extension.latestVersion)
        ).map(extension => ({
            id: extension.latestVersion.id,
            data: extension.latestVersion,
            selected: getManufacturer(extension.latestVersion) == this.selectedManufacturer
        }));
    }

    @computed
    get extensionNodes() {
        return this.instrumentExtensionNodes
            .filter(
                extension => getManufacturer(extension.latestVersion) == this.selectedManufacturer
            )
            .map(extension => ({
                id: extension.latestVersion.id,
                data: extension.latestVersion,
                selected: extension.latestVersion.id == this.selectedExtensionId
            }));
    }

    selectManufacturer = action((node: IListNode) => {
        this.selectedManufacturer = getManufacturer(node.data);
        this.selectedExtensionId = undefined;
    });

    selectExtension = action((node: IListNode) => {
        this.selectedExtensionId = (node.data as IExtension).id;
    });

    @observable extensionInstalling:
        | {
              inProgress: boolean;
              infoNode: React.ReactNode;
              infoType?: notification.Type;
          }
        | undefined;
}

const setupState = new SetupState();

function renderManufacturer(node: IListNode) {
    let instrumentExtension = node.data as IExtension;
    return <ListItem label={getManufacturer(instrumentExtension)} />;
}

function getExtensionName(extension: IExtension) {
    const manufacturer = getManufacturer(extension);
    const name = extension.displayName || extension.name;
    if (name.startsWith(manufacturer)) {
        return name.substr(manufacturer.length).trim();
    }
    return name;
}

function renderExtension(node: IListNode) {
    let instrumentExtension = node.data as IExtension;
    return (
        <ListItem
            leftIcon={instrumentExtension.image}
            leftIconSize={48}
            label={getExtensionName(instrumentExtension)}
        />
    );
}

function onSkip() {
    tabs.firstTime = false;
}

async function onAdd() {
    const extensionVersions = setupState.extensionsManagerStore.all.find(
        extensionVersions => extensionVersions.latestVersion.id == setupState.selectedExtensionId
    );

    if (!extensionVersions) {
        return;
    }

    let installedVersion = extensionVersions.installedVersion;
    if (!installedVersion) {
        runInAction(() => {
            setupState.extensionInstalling = {
                inProgress: true,
                infoNode: null
            };
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            installedVersion = await downloadAndInstallExtension(
                extensionVersions.latestVersion,
                0,
                {
                    update(
                        progressId: string | number,
                        options: {
                            render: React.ReactNode;
                            type: notification.Type;
                        }
                    ) {
                        runInAction(() => {
                            if (setupState.extensionInstalling) {
                                setupState.extensionInstalling.infoNode = options.render;
                                setupState.extensionInstalling.infoType = options.type;
                            }
                        });
                    }
                }
            );
        } catch (err) {
            console.error(err);
        }

        runInAction(() => {
            if (setupState.extensionInstalling) {
                setupState.extensionInstalling.inProgress = false;
            }
        });

        if (!installedVersion) {
            return;
        }
    }

    let params = createInstrument(installedVersion);
    params.rect.left = 0 - params.rect.width / 2;
    params.rect.top = 0 - params.rect.height / 2;
    const objectId = workbenchDocument.createObject(params);

    runInAction(() => {
        tabs.firstTime = false;
    });

    setTimeout(() => {
        tabs.openTabById(objectId, true);
    }, 50);
}

function onTryAgain() {
    runInAction(() => {
        setupState.extensionInstalling = undefined;
        onAdd();
    });
}

export const Setup = observer(() => {
    if (setupState.extensionInstalling) {
        const buttonsContainerClassName = classNames("d-flex justify-content-between mt-3 mb-5", {
            "invisible ": setupState.extensionInstalling.infoType !== notification.ERROR
        });

        return (
            <div className="d-flex flex-column justify-content-center align-items-center h-100">
                {setupState.extensionInstalling.inProgress && (
                    <div>
                        <h3>Installing Extension</h3>
                        <Loader />
                    </div>
                )}
                <h5
                    className="d-flex flex-column justify-content-center align-items-center"
                    style={{ minHeight: 120 }}
                >
                    {setupState.extensionInstalling.infoNode}
                </h5>
                <div className={buttonsContainerClassName} style={{ width: 400 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={action(() => (setupState.extensionInstalling = undefined))}
                    >
                        Back
                    </button>
                    <button
                        className="btn btn-primary"
                        disabled={
                            !setupState.selectedManufacturer || !setupState.selectedExtensionId
                        }
                        onClick={onTryAgain}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    } else {
        return (
            <div className="d-flex flex-column justify-content-center align-items-center h-100">
                <h3>Add Instrument</h3>
                <div className="d-flex h-50 mt-3" style={{ maxHeight: 400 }}>
                    <List
                        nodes={setupState.manufacturers}
                        renderNode={renderManufacturer}
                        selectNode={setupState.selectManufacturer}
                        className="overflow-auto border"
                        style={{ width: 240 }}
                        tabIndex={0}
                    />
                    <List
                        nodes={setupState.extensionNodes}
                        renderNode={renderExtension}
                        selectNode={setupState.selectExtension}
                        className="overflow-auto border ml-2"
                        style={{ width: 320 }}
                        tabIndex={0}
                    />
                </div>
                <div className="d-flex justify-content-between mt-3 mb-5" style={{ width: 400 }}>
                    <button className="btn px-3" onClick={onSkip}>
                        Skip
                    </button>
                    <button
                        className="btn btn-lg btn-primary px-5"
                        disabled={
                            !setupState.selectedManufacturer || !setupState.selectedExtensionId
                        }
                        onClick={onAdd}
                    >
                        Add
                    </button>
                </div>
            </div>
        );
    }
});

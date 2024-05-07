import React from "react";
import { observer } from "mobx-react";
import {
    action,
    observable,
    makeObservable,
    computed,
    runInAction
} from "mobx";
import classNames from "classnames";
import { uniqBy } from "lodash";

import { IExtension } from "eez-studio-shared/extensions/extension";
import {
    getManufacturer,
    isInstrumentExtension
} from "eez-studio-shared/extensions/extensions";

import { BootstrapDialog, showDialog } from "eez-studio-ui/dialog";
import { List, IListNode, ListItem } from "eez-studio-ui/list";
import * as notification from "eez-studio-ui/notification";
import { Loader } from "eez-studio-ui/loader";

import {
    ExtensionsManagerStore,
    ViewFilter,
    downloadAndInstallExtension
} from "home/extensions-manager/extensions-manager";

////////////////////////////////////////////////////////////////////////////////

const BB3_INSTRUMENT_EXTENSION_ID = "687b6dee-2093-4c36-afb7-cfc7ea2bf262";
const BB3_INSTRUMENT_MANUFACTURER = "EEZ";

class SetupState {
    selectedManufacturer: string | undefined = BB3_INSTRUMENT_MANUFACTURER;
    selectedExtensionId: string | undefined = BB3_INSTRUMENT_EXTENSION_ID;

    extensionsManagerStore: ExtensionsManagerStore;

    constructor() {
        makeObservable(this, {
            selectedExtensionId: observable,
            selectedManufacturer: observable,
            reset: action,
            instrumentExtensionNodes: computed,
            manufacturers: computed,
            extensionNodes: computed,
            extensionInstalling: observable
        });

        this.extensionsManagerStore = new ExtensionsManagerStore();
        this.extensionsManagerStore.viewFilter = ViewFilter.ALL;
    }

    reset() {
        this.extensionInstalling = undefined;
    }

    get instrumentExtensionNodes() {
        return this.extensionsManagerStore.all.filter(extension =>
            isInstrumentExtension(extension.latestVersion)
        );
    }

    get manufacturers() {
        return uniqBy(this.instrumentExtensionNodes, extension =>
            getManufacturer(extension.latestVersion)
        ).map(extension => ({
            id: extension.latestVersion.id,
            data: extension.latestVersion,
            selected:
                getManufacturer(extension.latestVersion) ==
                this.selectedManufacturer
        }));
    }

    get extensionNodes() {
        return this.instrumentExtensionNodes
            .filter(
                extension =>
                    getManufacturer(extension.latestVersion) ==
                    this.selectedManufacturer
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

    extensionInstalling:
        | {
              inProgress: boolean;
              infoNode: React.ReactNode;
              infoType?: notification.Type;
          }
        | undefined;
}

export const setupState = new SetupState();

function renderManufacturer(node: IListNode) {
    let instrumentExtension = node.data as IExtension;
    return <ListItem label={getManufacturer(instrumentExtension)} />;
}

function getExtensionName(extension: IExtension) {
    const manufacturer = getManufacturer(extension);
    let name = extension.displayName || extension.name;
    if (name.startsWith(manufacturer)) {
        const nameWithoutManufacturer = name.substr(manufacturer.length).trim();
        if (nameWithoutManufacturer != "") {
            name = nameWithoutManufacturer;
        }
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

async function onAddInstrument(onAddCallback: (instrumentId: string) => void) {
    const extensionVersions = setupState.extensionsManagerStore.all.find(
        extensionVersions =>
            extensionVersions.latestVersion.id == setupState.selectedExtensionId
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
                                setupState.extensionInstalling.infoNode =
                                    options.render;
                                setupState.extensionInstalling.infoType =
                                    options.type;
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
            return undefined;
        }
    }

    const { createInstrument } = await import("instrument/instrument-object");

    let instrumentId = createInstrument(installedVersion);

    onAddCallback(instrumentId);

    return instrumentId;
}

const Setup = observer(() => {
    if (setupState.extensionInstalling) {
        const buttonsContainerClassName = classNames(
            "d-flex justify-content-between mt-3 mb-5",
            {
                invisible:
                    setupState.extensionInstalling.infoType !==
                    notification.ERROR
            }
        );

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
                <div
                    className={buttonsContainerClassName}
                    style={{ width: "400" }}
                >
                    <button
                        className="btn btn-secondary"
                        onClick={action(event => {
                            event.preventDefault();
                            runInAction(() => {
                                setupState.extensionInstalling = undefined;
                            });
                        })}
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    } else {
        return (
            <div className="d-flex flex-column justify-content-center align-items-center h-100">
                <div
                    className={classNames("d-flex justify-content-center h-50")}
                    style={{ minHeight: 220, maxHeight: 400, width: "100%" }}
                >
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
            </div>
        );
    }
});

////////////////////////////////////////////////////////////////////////////////

const AddInstrumentDialog = observer(
    class AddInstrumentDialog extends React.Component<{
        callback: (instrumentId: string) => void;
    }> {
        open = true;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                open: observable,
                onOk: action.bound,
                onCancel: action.bound
            });
        }

        async onOk() {
            const instrumentId = await onAddInstrument(instrumentId =>
                this.props.callback(instrumentId)
            );
            if (instrumentId) {
                runInAction(() => {
                    this.open = false;
                });
            }
        }

        onCancel() {
            this.open = false;
        }

        render() {
            return (
                <BootstrapDialog
                    modal={true}
                    title="Add Instrument"
                    open={this.open}
                    size={"large"}
                    onCancel={this.onCancel}
                    disableButtons={false}
                    okEnabled={() => false}
                    backdrop="static"
                    buttons={[
                        {
                            id: "cancel",
                            type: "secondary",
                            position: "right",
                            onClick: this.onCancel,
                            disabled:
                                setupState.extensionInstalling != undefined &&
                                setupState.extensionInstalling.infoType !==
                                    notification.ERROR,
                            style: {},
                            text: "Cancel"
                        },
                        {
                            id: "ok",
                            type: "primary",
                            position: "right",
                            onClick: this.onOk,
                            disabled:
                                setupState.extensionInstalling != undefined,
                            style: {},
                            text: "OK"
                        }
                    ]}
                >
                    <Setup />
                </BootstrapDialog>
            );
        }
    }
);

export function showAddInstrumentDialog(
    callback: (instrumentId: string) => void
) {
    setupState.reset();
    showDialog(<AddInstrumentDialog callback={callback} />);
}

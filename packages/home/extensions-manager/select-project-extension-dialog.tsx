import { observer } from "mobx-react";
import React from "react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import {
    ExtensionsList,
    ViewFilter,
    extensionsManagerStore
} from "home/extensions-manager/extensions-manager";
import { extensions } from "eez-studio-shared/extensions/extensions";
import { runInAction } from "mobx";

const SelectProjectExtensionDialog = observer(
    class SelectProjectExtensionDialog extends React.Component<{
        onOk: (value: string) => void;
        onCancel: () => void;
    }> {
        get selectedExtension() {
            const extension =
                extensionsManagerStore.selectedExtension &&
                extensions.get(extensionsManagerStore.selectedExtension.id);

            return extension;
        }

        onOkEnabled = () => {
            return this.selectedExtension ? true : false;
        };

        onOk = () => {
            if (this.selectedExtension) {
                this.props.onOk(this.selectedExtension.name);
                return true;
            }

            return false;
        };

        render() {
            return (
                <Dialog
                    modal={false}
                    okButtonText="Select"
                    okEnabled={this.onOkEnabled}
                    onOk={this.onOk}
                    onCancel={this.props.onCancel}
                >
                    <div className="EezStudio_ExtensionsManager_SelectProjectExtensionDialog">
                        <ExtensionsList />
                    </div>
                </Dialog>
            );
        }
    }
);
export async function showSelectProjectExtensionDialog(
    excludeExtensions: string[]
) {
    let disposed = false;

    return new Promise<string>((resolve, reject) => {
        const onDispose = () => {
            if (!disposed) {
                disposed = true;

                if (modalDialog) {
                    modalDialog.close();
                }

                runInAction(() => {
                    extensionsManagerStore.excludeExtensions = undefined;
                });
            }
        };

        const onOk = (value: string) => {
            resolve(value);
            onDispose();
        };

        extensionsManagerStore.switchToProjectExtensions();

        runInAction(() => {
            extensionsManagerStore.viewFilter = ViewFilter.ALL;
            extensionsManagerStore.excludeExtensions = excludeExtensions;

            extensionsManagerStore.selectedExtension =
                extensionsManagerStore.extensionNodes.length > 0
                    ? extensionsManagerStore.extensionNodes[0].data
                    : undefined;
        });

        const [modalDialog] = showDialog(
            <SelectProjectExtensionDialog onOk={onOk} onCancel={onDispose} />,
            {
                jsPanel: {
                    id: "select-project-extension-dialog",
                    title: "Select Project Editor Extension",
                    width: 1024,
                    height: 600,
                    onclosed: onDispose
                }
            }
        );
    });
}

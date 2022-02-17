import React from "react";
import { observer } from "mobx-react";

import { ProjectEditor } from "project-editor/project-editor-interface";

import { showDialog, Dialog, IDialogButton } from "eez-studio-ui/dialog";
import { RuntimeBase } from "project-editor/flow/runtime";
import { Icon } from "eez-studio-ui/icon";
import { observable, runInAction, makeObservable } from "mobx";

const ErrorBox = observer(
    class ErrorBox extends React.Component<{ runtime: RuntimeBase }> {
        additionalButton: IDialogButton | undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                additionalButton: observable.shallow
            });

            this.additionalButton = {
                id: "saveDebugInfo",
                type: "secondary",
                position: "left",
                onClick: this.onSaveDebugInfo,
                disabled: false,
                style: { marginRight: "auto" },
                text: "Save Debug Info"
            };
        }

        onSaveDebugInfo = async () => {
            if (await this.props.runtime.saveDebugInfo()) {
                runInAction(() => (this.additionalButton = undefined));
            }
        };

        onClose = () => {
            const tab = ProjectEditor.homeTabs.findProjectEditorTab(
                this.props.runtime.DocumentStore.filePath!
            );
            if (tab) {
                ProjectEditor.homeTabs.removeTab(tab);
            }
        };

        onRestart = () => {
            this.props.runtime.DocumentStore.onRestart();
            return true;
        };

        render() {
            return (
                <Dialog
                    okButtonText="Restart"
                    cancelButtonText="Close"
                    onOk={this.onRestart}
                    onCancel={this.onClose}
                    backdrop="static"
                    title="Unhandled error in flow"
                    titleIcon={
                        <Icon
                            icon="material:error"
                            className="text-danger pe-1"
                            size={32}
                        />
                    }
                    additionalButton={this.additionalButton}
                >
                    <h5 className="p-3 text-danger text-center">
                        {this.props.runtime.error?.toString()}
                    </h5>
                </Dialog>
            );
        }
    }
);

export function showErrorBox(runtime: RuntimeBase) {
    showDialog(<ErrorBox runtime={runtime} />);
}

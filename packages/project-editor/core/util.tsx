import React from "react";
import ReactDOM from "react-dom";

import { IDialogOptions, showDialog } from "eez-studio-ui/dialog";
import {
    DialogDefinition,
    GenericDialog,
    GenericDialogResult
} from "eez-studio-ui/generic-dialog";

import type { DocumentStoreClass } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";

export async function confirm(
    message: string,
    detail: string | undefined,
    callback: () => void
) {
    const result = await EEZStudio.remote.dialog.showMessageBox(
        EEZStudio.remote.getCurrentWindow(),
        {
            type: "question",
            title: "Project Editor - EEZ Studio",
            message: message,
            detail: detail,
            noLink: true,
            buttons: ["Yes", "No"],
            cancelId: 1
        }
    );
    const buttonIndex = result.response;
    if (buttonIndex == 0) {
        callback();
    }
}

export function info(message: string, detail?: string) {
    return EEZStudio.remote.dialog.showMessageBox(
        EEZStudio.remote.getCurrentWindow(),
        {
            type: "info",
            title: "Project Editor - EEZ Studio",
            message: message,
            detail: detail,
            noLink: true,
            buttons: ["OK"],
            cancelId: 1
        }
    );
}

export function showGenericDialog(
    DocumentStore: DocumentStoreClass,
    conf: {
        dialogDefinition: DialogDefinition;
        values: any;
        okButtonText?: string;
        okEnabled?: (result: GenericDialogResult) => boolean;
        showOkButton?: boolean;
        opts?: IDialogOptions;
    }
) {
    return new Promise<GenericDialogResult>((resolve, reject) => {
        const [modalDialog, element] = showDialog(
            <ProjectContext.Provider value={DocumentStore}>
                <GenericDialog
                    dialogDefinition={conf.dialogDefinition}
                    dialogContext={undefined}
                    values={conf.values}
                    opts={conf.opts}
                    okButtonText={conf.okButtonText}
                    okEnabled={conf.okEnabled}
                    onOk={
                        conf.showOkButton === undefined || conf.showOkButton
                            ? values => {
                                  if (modalDialog) {
                                      ReactDOM.unmountComponentAtNode(element);
                                      modalDialog.close();
                                  }
                                  resolve(values);
                              }
                            : undefined
                    }
                    onCancel={() => {
                        if (modalDialog) {
                            ReactDOM.unmountComponentAtNode(element);
                            modalDialog.close();
                        }
                        reject();
                    }}
                />
            </ProjectContext.Provider>,
            conf.opts
        );
    });
}

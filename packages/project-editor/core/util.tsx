import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import { URL } from "url";

import { IDialogOptions, showDialog } from "eez-studio-ui/dialog";
import {
    DialogDefinition,
    GenericDialog,
    GenericDialogResult
} from "eez-studio-ui/generic-dialog";

import { ProjectStore, getClassInfo } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import type { IEezObject } from "./object";

import { isArray } from "eez-studio-shared/util";

export async function confirm(
    message: string,
    detail: string | undefined,
    callback: () => void
) {
    const result = await dialog.showMessageBox(getCurrentWindow(), {
        type: "question",
        title: "Project Editor - EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["Yes", "No"],
        cancelId: 1
    });
    const buttonIndex = result.response;
    if (buttonIndex == 0) {
        callback();
    }
}

export function info(message: string, detail?: string) {
    return dialog.showMessageBox(getCurrentWindow(), {
        type: "info",
        title: "Project Editor - EEZ Studio",
        message: message,
        detail: detail,
        noLink: true,
        buttons: ["OK"],
        cancelId: 1
    });
}

export function showGenericDialog(
    projectStore: ProjectStore,
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
        const [modalDialog] = showDialog(
            <ProjectContext.Provider value={projectStore}>
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
                                      modalDialog.close();
                                  }
                                  resolve(values);
                              }
                            : undefined
                    }
                    onCancel={() => {
                        if (modalDialog) {
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

export function onAfterPaste(
    newObjectOrObjects: IEezObject | IEezObject[],
    fromObjectOrObjects: IEezObject | IEezObject[]
) {
    let newObjects: IEezObject[];
    if (isArray(newObjectOrObjects)) {
        newObjects = newObjectOrObjects;
    } else {
        newObjects = [newObjectOrObjects];
    }

    let fromObjects: IEezObject[];
    if (isArray(fromObjectOrObjects)) {
        fromObjects = fromObjectOrObjects as IEezObject[];
    } else {
        fromObjects = [fromObjectOrObjects];
    }

    newObjects.forEach((object, i) => {
        const classInfo = getClassInfo(object);
        if (classInfo.onAfterPaste) {
            classInfo.onAfterPaste(object, fromObjects[i]);
        }
    });
}

export const SCRAPBOOK_ITEM_FILE_PREFIX = "scrapbook://";

export function isValidUrl(s: string) {
    try {
        if (s.startsWith(SCRAPBOOK_ITEM_FILE_PREFIX)) {
            return true;
        }

        const url = new URL(s);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
        return false;
    }
}

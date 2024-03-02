import path from "path";
import React from "react";
import { observable, makeObservable } from "mobx";

import {
    registerClass,
    PropertyType,
    EezObject,
    ClassInfo
} from "project-editor/core/object";
import { ProjectContext } from "project-editor/project/context";
import { CodeEditor } from "eez-studio-ui/code-editor";
import * as notification from "eez-studio-ui/notification";
import { updateObject } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { showSelectInstrumentDialog } from "project-editor/flow/components/actions/instrument";
import { EditorComponent } from "project-editor/project/ui/EditorComponent";
import type { ProjectEditorFeature } from "project-editor/store/features";
import { MICROPYTHON_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

export class MicroPythonEditor extends EditorComponent {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    render() {
        return (
            <CodeEditor
                value={this.context.project.micropython.code}
                onChange={(value: string) => {
                    updateObject(this.context.project.micropython, {
                        code: value
                    });
                }}
                mode={"python"}
                style={{ height: "100%" }}
            />
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export class MicroPython extends EezObject {
    code: string;

    static classInfo: ClassInfo = {
        properties: [
            {
                name: "code",
                type: PropertyType.MultilineText,
                hideInPropertyGrid: true
            }
        ],
        icon: MICROPYTHON_ICON(24)
    };

    override makeEditable() {
        super.makeEditable();
        makeObservable(this, {
            code: observable
        });
    }

    async runScript() {
        const projectStore = ProjectEditor.getProjectStore(this);

        const partsPromise = projectStore.build();

        const instrument = await showSelectInstrumentDialog(undefined);

        if (!instrument) {
            return;
        }

        const parts = await partsPromise;
        if (!parts) {
            notification.error("Build error...", {
                autoClose: false
            });
            return;
        }

        const toastId = notification.info("Uploading ...", {
            autoClose: false
        });

        const connection = instrument.connection;
        connection.connect();

        for (let i = 0; i < 10; i++) {
            if (instrument.isConnected) {
                break;
            }
            await new Promise<void>(resolve => setTimeout(resolve, 100));
        }

        if (!instrument.isConnected) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Instrument not connected`,
                autoClose: 1000
            });
            return;
        }

        let acquired = false;
        let acquireError;
        for (let i = 0; i < 10; i++) {
            try {
                await connection.acquire(false);
                acquired = true;
                break;
            } catch (err) {
                acquireError = err;
                await new Promise<void>(resolve => setTimeout(resolve, 100));
            }
        }

        if (!acquired) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${acquireError.toString()}`,
                autoClose: 1000
            });
            return;
        }

        try {
            const destinationFolderPath = projectStore.getAbsoluteFilePath(
                projectStore.project.settings.build.destinationFolder || "."
            );

            const resDestinationFileName = `${path.basename(
                projectStore.filePath || "",
                ".eez-project"
            )}.res`;
            const resSourceFilePath = `${destinationFolderPath}/${resDestinationFileName}`;

            const pyDestinationFileName = `${path.basename(
                projectStore.filePath || "",
                ".eez-project"
            )}.py`;
            const pySourceFilePath = `${destinationFolderPath}/${pyDestinationFileName}`;

            await new Promise<void>((resolve, reject) => {
                const uploadInstructions = Object.assign(
                    {},
                    instrument.defaultFileUploadInstructions,
                    {
                        sourceFilePath: resSourceFilePath,
                        destinationFileName: resDestinationFileName,
                        destinationFolderPath: "/Scripts"
                    }
                );

                connection.upload(uploadInstructions, resolve, reject);
            });

            await new Promise<void>((resolve, reject) => {
                const uploadInstructions = Object.assign(
                    {},
                    instrument.defaultFileUploadInstructions,
                    {
                        sourceFilePath: pySourceFilePath,
                        destinationFileName: pyDestinationFileName,
                        destinationFolderPath: "/Scripts"
                    }
                );

                connection.upload(uploadInstructions, resolve, reject);
            });

            connection.command(`SYST:DEL 100`);

            const runningScript = await connection.query(`SCR:RUN?`);
            if (runningScript != "" && runningScript != `""`) {
                connection.command(`SCR:STOP`);
                connection.command(`SYST:DEL 100`);
            }

            connection.command(`SCR:RUN "/Scripts/${pyDestinationFileName}"`);

            notification.update(toastId, {
                type: notification.SUCCESS,
                render: `Script started`,
                autoClose: 1000
            });

            return;
        } catch (err) {
            notification.update(toastId, {
                type: notification.ERROR,
                render: `Error: ${err.toString()}`,
                autoClose: 1000
            });

            return;
        } finally {
            connection.release();
        }
    }
}

registerClass("MicroPython", MicroPython);

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-micropython",
    version: "0.1.0",
    description: "MicroPython",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "MicroPython",
    mandatory: false,
    key: "micropython",
    type: PropertyType.Object,
    typeClass: MicroPython,
    icon: MICROPYTHON_ICON(24),
    create: () => {
        return {
            code: ""
        };
    }
};

export default feature;

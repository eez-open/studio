import fs from "fs";
import { makeObservable, observable, toJS, runInAction, action } from "mobx";

import * as notification from "eez-studio-ui/notification";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { IObjectVariableValue } from "project-editor/features/variable/value-type";
import { IVariable } from "project-editor/flow/flow-interfaces";
import type { ProjectStore } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export class RuntimeSettings {
    settings: {
        __persistentVariables?: {
            [variableName: string]: any;
        };
        __embeddedDashboards?: {
            [dashboardPath: string]: any;
        };
        __dockingManagerContainerLayouts?: {
            [containerPath: string]: any;
        };
        [key: string]: any;
    } = {};
    modified = false;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            settings: observable,
            setVariableValue: action,
            writeSettings: action,
            writeDockingManagerContainerLayout: action
        });
    }

    getVariableValue(variable: IVariable) {
        const persistentVariables = this.settings.__persistentVariables;

        if (!persistentVariables) {
            return undefined;
        }

        let value = persistentVariables[variable.fullName];
        if (value == undefined) {
            return undefined;
        }

        const objectVariableType = ProjectEditor.getObjectVariableTypeFromType(
            this.projectStore,
            variable.type
        );

        if (objectVariableType) {
            if (
                variable.type == "object:Instrument" &&
                this.projectStore.context.type == "instrument-dashboard"
            ) {
                return this.projectStore.context.instrument;
            }

            const constructorParams = value;
            return objectVariableType.createValue(
                constructorParams,
                this.projectStore.runtime ? true : false
            );
        }

        if (variable.type == "date") {
            return new Date(value);
        }

        return value;
    }

    setVariableValue(variable: IVariable, value: any) {
        if (!this.settings.__persistentVariables) {
            this.settings.__persistentVariables = {};
        }
        this.settings.__persistentVariables[variable.fullName] = toJS(value);
        this.modified = true;
    }

    async loadPersistentVariables() {
        const projectStore = this.projectStore;
        const globalVariables = projectStore.project.allGlobalVariables;
        const dataContext = projectStore.dataContext;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.getVariableValue(variable);
                if (value !== undefined) {
                    dataContext.set(variable.fullName, value);
                }
            }
        }
    }

    async savePersistentVariables() {
        const globalVariables = this.projectStore.project.allGlobalVariables;
        for (const variable of globalVariables) {
            if (variable.persistent) {
                const value = this.projectStore.dataContext.get(
                    variable.fullName
                );
                if (value != null) {
                    const objectVariableType =
                        ProjectEditor.getObjectVariableTypeFromType(
                            this.projectStore,
                            variable.type
                        );
                    if (objectVariableType) {
                        const objectVariableValue:
                            | IObjectVariableValue
                            | undefined = value;

                        const constructorParams =
                            objectVariableValue?.constructorParams ?? null;

                        this.setVariableValue(variable, constructorParams);
                    } else {
                        this.setVariableValue(variable, value);
                    }
                }
            }
        }
    }

    getSettingsFilePath() {
        if (this.projectStore.filePath) {
            return this.projectStore.filePath + "-runtime-settings";
        }
        return undefined;
    }

    async load() {
        if (this.projectStore.context.type == "run-embedded") {
            const embeddedDashboards =
                this.projectStore.context.parentProjectStore.runtimeSettings
                    .settings.__embeddedDashboards;
            if (embeddedDashboards) {
                const settings =
                    embeddedDashboards[this.projectStore.context.dashboardPath];
                if (settings) {
                    runInAction(() => {
                        this.settings = settings;
                    });
                }
            }
        } else {
            const filePath = this.getSettingsFilePath();
            if (!filePath) {
                return;
            }

            try {
                const data = await fs.promises.readFile(filePath, "utf8");

                runInAction(() => {
                    try {
                        this.settings = JSON.parse(data);
                    } catch (err) {
                        this.settings = {};
                    }
                });
            } catch (err) {}
        }
    }

    async save() {
        if (this.projectStore.context.type == "run-embedded") {
            if (!this.modified) {
                return;
            }

            const dashboardPath = this.projectStore.context.dashboardPath;
            const dashboardSettings = toJS(this.settings);

            if (
                this.projectStore.context.parentProjectStore.runtimeSettings
                    .settings.__embeddedDashboards
            ) {
                this.projectStore.context.parentProjectStore.runtimeSettings.settings.__embeddedDashboards[
                    dashboardPath
                ] = dashboardSettings;
            } else {
                this.projectStore.context.parentProjectStore.runtimeSettings.settings.__embeddedDashboards =
                    {
                        [dashboardPath]: dashboardSettings
                    };
            }

            this.projectStore.context.parentProjectStore.runtimeSettings.modified =
                true;

            await this.projectStore.context.parentProjectStore.runtimeSettings.save();
        } else {
            if (!this.modified) {
                return;
            }

            const filePath = this.getSettingsFilePath();
            if (!filePath) {
                return;
            }

            try {
                await fs.promises.writeFile(
                    filePath,
                    JSON.stringify(toJS(this.settings), undefined, "  "),
                    "utf8"
                );
            } catch (err) {
                notification.error("Failed to save runtime settings: " + err);
            }
        }
    }

    readSettings(key: string) {
        return this.settings[key];
    }

    writeSettings(key: string, value: any) {
        this.settings[key] = value;
        this.modified = true;
    }

    readDockingManagerContainerLayout(containerPath: string) {
        if (!this.settings.__dockingManagerContainerLayouts) {
            return undefined;
        }
        return this.settings.__dockingManagerContainerLayouts[containerPath];
    }

    writeDockingManagerContainerLayout(containerPath: string, layout: any) {
        if (this.settings.__dockingManagerContainerLayouts) {
            this.settings.__dockingManagerContainerLayouts[containerPath] =
                layout;
        } else {
            this.settings.__dockingManagerContainerLayouts = {
                [containerPath]: layout
            };
        }
        this.modified = true;
    }
}

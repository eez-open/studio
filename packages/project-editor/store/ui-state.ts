import fs from "fs";
import { computed, makeObservable } from "mobx";
import { observable, extendObservable, action, toJS, runInAction } from "mobx";

import { _each } from "eez-studio-shared/algorithm";
import * as notification from "eez-studio-ui/notification";
import { IEezObject } from "project-editor/core/object";
import type { Component } from "project-editor/flow/component";
import { getObjectPathAsString } from "project-editor/store/helper";
import type { ProjectEditorStore } from "project-editor/store";
import { Section } from "project-editor/store/output-sections";
import type { LVGLParts } from "project-editor/lvgl/style";

////////////////////////////////////////////////////////////////////////////////

export type LogPanelFilter = "all" | "scpi" | "error" | "info" | "debug";

export class UIStateStore {
    selectedBuildConfiguration: string;
    features: any;
    savedState: any;
    searchPattern: string;
    searchMatchCase: boolean;
    searchMatchWholeWord: boolean;
    activeOutputSection = Section.CHECKS;
    _pageEditorFrontFace: boolean = false;
    _pageRuntimeFrontFace: boolean = true;
    showCommandPalette: boolean = false;
    showComponentDescriptions: boolean = true;
    selectedLanguageID: string;
    lvglPart: LVGLParts = "main";
    lvglState: string = "default";
    lvglExpandedPropertiesGroup: string[] = [];

    objectUIStates = new Map<string, any>();

    logsPanelFilter: LogPanelFilter = "all";

    get pageEditorFrontFace() {
        return this._pageEditorFrontFace;
    }

    set pageEditorFrontFace(value: boolean) {
        runInAction(() => (this._pageEditorFrontFace = value));
    }

    get pageRuntimeFrontFace() {
        return this.projectEditorStore.runtime &&
            !this.projectEditorStore.runtime.isDebuggerActive
            ? true
            : this._pageRuntimeFrontFace;
    }

    set pageRuntimeFrontFace(value: boolean) {
        runInAction(() => (this._pageRuntimeFrontFace = value));
    }

    constructor(public projectEditorStore: ProjectEditorStore) {
        makeObservable(this, {
            selectedBuildConfiguration: observable,
            features: observable,
            savedState: observable,
            searchPattern: observable,
            searchMatchCase: observable,
            searchMatchWholeWord: observable,
            activeOutputSection: observable,
            _pageEditorFrontFace: observable,
            _pageRuntimeFrontFace: observable,
            showCommandPalette: observable,
            showComponentDescriptions: observable,
            selectedLanguageID: observable,
            getFeatureParam: action,
            setSelectedBuildConfiguration: action,
            breakpoints: observable,
            selectedBreakpoint: observable,
            addBreakpoint: action,
            removeBreakpoint: action,
            enableBreakpoint: action,
            disableBreakpoint: action,
            watchExpressions: observable,
            selectedLanguage: computed,
            logsPanelFilter: observable,
            lvglPart: observable,
            lvglState: observable,
            lvglExpandedPropertiesGroup: observable
        });
    }

    unmount() {}

    loadObjects(objects: any) {
        this.objectUIStates.clear();
        _each(objects, (value: any, objectPath: any) => {
            this.objectUIStates.set(objectPath, value);
        });
    }

    getUIStateFilePath() {
        if (this.projectEditorStore.filePath) {
            return this.projectEditorStore.filePath + "-ui-state";
        }
        return undefined;
    }

    async load() {
        const filePath = this.getUIStateFilePath();
        if (!filePath) {
            return;
        }

        let uiState: any = {};
        try {
            const data = await fs.promises.readFile(filePath, "utf8");
            try {
                uiState = JSON.parse(data);
            } catch (err) {
                console.error(err);
            }
        } catch (err) {}

        runInAction(() => {
            this.projectEditorStore.navigationStore.loadState(
                uiState.navigation
            );

            this.loadObjects(uiState.objects);

            this.projectEditorStore.layoutModels.load(uiState.layoutModel);

            this.selectedBuildConfiguration =
                uiState.selectedBuildConfiguration || "Default";

            this.features = observable(uiState.features || {});

            this.activeOutputSection =
                uiState.activeOutputSection ?? Section.CHECKS;

            this._pageEditorFrontFace = uiState.pageEditorFrontFace;

            this._pageRuntimeFrontFace = uiState.pageRuntimeFrontFace;

            if (uiState.breakpoints) {
                for (const key in uiState.breakpoints) {
                    const component =
                        this.projectEditorStore.getObjectFromStringPath(
                            key
                        ) as Component;
                    if (component) {
                        this.breakpoints.set(
                            component,
                            uiState.breakpoints[key]
                        );
                    }
                }
            }

            if (uiState.watchExpressions) {
                this.watchExpressions = uiState.watchExpressions;
            } else {
                this.watchExpressions = [];
            }

            if (uiState.showComponentDescriptions != undefined) {
                this.showComponentDescriptions =
                    uiState.showComponentDescriptions;
            }

            if (uiState.selectedLanguageID != undefined) {
                this.selectedLanguageID = uiState.selectedLanguageID;
            }

            if (this.projectEditorStore.project.changes) {
                this.projectEditorStore.project.changes._state.selectedRevisionHash =
                    uiState.selectedRevisionHash;
            }

            if (uiState.logsPanelFilter != undefined) {
                this.logsPanelFilter = uiState.logsPanelFilter;
            }

            if (uiState.lvglPart) {
                this.lvglPart = uiState.lvglPart;
            }

            if (uiState.lvglState) {
                this.lvglState = uiState.lvglState;
            }

            if (uiState.lvglExpandedPropertiesGroup) {
                this.lvglExpandedPropertiesGroup =
                    uiState.lvglExpandedPropertiesGroup;
            }
        });
    }

    get featuresJS() {
        return toJS(this.features);
    }

    get objectsJS() {
        this.projectEditorStore.editorsStore.saveState();

        let map: any = {};
        for (let [key, value] of this.objectUIStates) {
            const i = key.indexOf("[");
            let objectPath;
            if (i != -1) {
                objectPath = key.substring(0, i);
            } else {
                objectPath = key;
            }
            if (this.projectEditorStore.getObjectFromStringPath(objectPath)) {
                map[key] = value;
            }
        }
        return map;
    }

    get toJS() {
        const state = {
            navigation: this.projectEditorStore.navigationStore.saveState(),
            editors: this.projectEditorStore.editorsStore.saveState(),
            layoutModel: this.projectEditorStore.layoutModels.save(),
            selectedBuildConfiguration: this.selectedBuildConfiguration,
            features: this.featuresJS,
            objects: this.objectsJS,
            activeOutputSection: this.activeOutputSection,
            pageEditorFrontFace: this._pageEditorFrontFace,
            pageRuntimeFrontFace: this._pageRuntimeFrontFace,
            breakpoints: Array.from(this.breakpoints).reduce(
                (obj, [key, value]) =>
                    Object.assign(obj, {
                        [getObjectPathAsString(key)]: value
                    }),
                {}
            ),
            watchExpressions: toJS(this.watchExpressions),
            showComponentDescriptions: this.showComponentDescriptions,
            selectedLanguageID: this.selectedLanguageID,
            selectedRevisionHash: this.projectEditorStore.project.changes
                ? this.projectEditorStore.project.changes._state
                      .selectedRevisionHash
                : undefined,
            logsPanelFilter: this.logsPanelFilter,
            lvglPart: this.lvglPart,
            lvglState: this.lvglState,
            lvglExpandedPropertiesGroup: this.lvglExpandedPropertiesGroup
        };

        return state;
    }

    async save() {
        const filePath = this.getUIStateFilePath();
        if (!filePath) {
            return;
        }

        try {
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(this.toJS, undefined, 2),
                "utf8"
            );
        } catch (err) {
            notification.error("Failed to save UI state: " + err);
        }
    }

    getFeatureParam<T>(
        extensionName: string,
        paramName: string,
        defaultValue: T
    ): T {
        let extension = this.features[extensionName];
        if (!extension) {
            extension = observable({});
            extendObservable(this.features, {
                [extensionName]: extension
            });
        }
        let paramValue = extension[paramName];
        if (!paramValue) {
            extendObservable(extension, {
                [paramName]: defaultValue
            });
            return defaultValue;
        }
        return paramValue as T;
    }

    setSelectedBuildConfiguration(selectedBuildConfiguration: string) {
        this.selectedBuildConfiguration = selectedBuildConfiguration;
    }

    getObjectUIState(object: IEezObject, option: string) {
        const key = getObjectPathAsString(object) + `[${option}]`;
        return this.objectUIStates.get(key);
    }

    updateObjectUIState(object: IEezObject, option: string, changes: any) {
        const key = getObjectPathAsString(object) + `[${option}]`;
        let objectUIState = this.objectUIStates.get(key);
        if (objectUIState) {
            Object.assign(objectUIState, changes);
        } else {
            this.objectUIStates.set(key, changes);
        }
    }

    ////////////////////////////////////////
    // BREAKPOINTS

    breakpoints = new Map<Component, boolean>();
    selectedBreakpoint = observable.box<Component | undefined>(undefined);

    isBreakpointAddedForComponent(component: Component) {
        return this.breakpoints.has(component);
    }

    isBreakpointEnabledForComponent(component: Component) {
        return this.breakpoints.get(component) == true;
    }

    addBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
        if (this.projectEditorStore.runtime) {
            this.projectEditorStore.runtime.onBreakpointAdded(component);
        }
    }

    removeBreakpoint(component: Component) {
        this.breakpoints.delete(component);
        if (this.projectEditorStore.runtime) {
            this.projectEditorStore.runtime.onBreakpointRemoved(component);
        }
    }

    enableBreakpoint(component: Component) {
        this.breakpoints.set(component, true);
        if (this.projectEditorStore.runtime) {
            this.projectEditorStore.runtime.onBreakpointEnabled(component);
        }
    }

    disableBreakpoint(component: Component) {
        this.breakpoints.set(component, false);
        if (this.projectEditorStore.runtime) {
            this.projectEditorStore.runtime.onBreakpointDisabled(component);
        }
    }

    ////////////////////////////////////////
    // WATCH EXPRESSIONS

    watchExpressions: string[] = [];

    ////////////////////////////////////////
    get selectedLanguage() {
        let language = this.projectEditorStore.project.texts?.languages.find(
            language => language.languageID == this.selectedLanguageID
        );
        if (!language) {
            language = this.projectEditorStore.project.texts?.languages[0];
        }
        return language;
    }
}

import React from "react";
import {
    makeObservable,
    observable,
    runInAction,
    IObservableValue
} from "mobx";

import { observer } from "mobx-react";

import * as notification from "eez-studio-ui/notification";

import type * as InstrumentObjectModule from "instrument/instrument-object";

import { ProjectContext } from "project-editor/project/context";

import {
    ProjectStore,
    getClassInfo,
    getObjectPathAsString,
    LayoutModels,
    Section
} from "project-editor/store";

import {
    RemoteRuntime,
    DebuggerConnectionBase,
    MessagesToDebugger
} from "project-editor/flow//runtime/remote-runtime";

import type {
    IEvalProperty,
    IGlobalVariable,
    RendererToWorkerMessage
} from "project-editor/flow/runtime/wasm-worker-interfaces";

import type {
    ScpiCommand,
    WorkerToRenderMessage,
    IPropertyValue,
    ValueWithType,
    AssetsMap
} from "eez-studio-types";

import {
    getObjectVariableTypeFromType,
    IObjectVariableValue,
    isArrayType,
    isStructType
} from "project-editor/features/variable/value-type";

import {
    ArrayValue,
    clearJSObjects,
    createJsArrayValue,
    createWasmValue,
    getValue,
    initJSObjectsMap
} from "project-editor/flow/runtime/wasm-value";

import {
    isFlowProperty,
    Widget as Component,
    Widget
} from "project-editor/flow/component";

import { ProjectEditor } from "project-editor/project-editor-interface";
import type { IFlowContext } from "project-editor/flow/flow-interfaces";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import type {
    IObjectVariableType,
    IVariable,
    ValueType
} from "eez-studio-types";
import type { Page } from "project-editor/features/page/page";
import { createWasmWorker } from "project-editor/flow/runtime/wasm-worker";
import { LVGLPageViewerRuntime } from "project-editor/lvgl/page-runtime";
import { getClassByName } from "project-editor/core/object";
import { FLOW_EVENT_KEYDOWN } from "project-editor/flow/runtime/flow-events";
import { preloadAllBitmaps } from "project-editor/features/bitmap/bitmap";
import { releaseRuntimeDashboardStates } from "project-editor/flow/runtime/component-execution-states";
import { findBitmap } from "project-editor/project/assets";
import { hasClass } from "eez-studio-shared/dom";

interface IGlobalVariableBase {
    variable: IVariable;
    globalVariableIndex: number;
}

interface IBasicGlobalVariable extends IGlobalVariableBase {
    kind: "basic";
    value: null | undefined | number | boolean | string;
}

interface IStructGlobalVariable extends IGlobalVariableBase {
    kind: "struct";
    value: ArrayValue;
}

interface IObjectGlobalVariable extends IGlobalVariableBase {
    kind: "object";
    value: ArrayValue | null;

    objectVariableValue: IObjectVariableValue | null;
    objectVariableType: IObjectVariableType;

    studioModified: boolean;
}

type IRuntimeGlobalVariable =
    | IBasicGlobalVariable
    | IStructGlobalVariable
    | IObjectGlobalVariable;

let nextWasmModuleId = 1;

export class WasmRuntime extends RemoteRuntime {
    wasmModuleId: number;

    debuggerConnection = new WasmDebuggerConnection(this);

    worker: ReturnType<typeof createWasmWorker>;

    assetsData: any;
    assetsDataMapJs: AssetsMap;

    globalVariables: IRuntimeGlobalVariable[] = [];

    ctx: CanvasRenderingContext2D | undefined;
    displayWidth: number;
    displayHeight: number;

    pointerEvents: {
        x: number;
        y: number;
        pressed: number;
    }[] = [];

    wheelUpdated = false;
    wheelDeltaY = 0;
    wheelPressed = 0;

    keysPressed: number[] = [];
    screen: any;
    lastScreen: any;

    mainLoopTimeoutId: any;
    requestAnimationFrameId: number | undefined;

    componentProperties = new ComponentProperties(this);

    lgvlPageRuntime: LVGLPageViewerRuntime | undefined;

    selectedDashboardTheme: string | undefined;

    onInitialized: (() => void) | undefined;

    ////////////////////////////////////////////////////////////////////////////////

    constructor(public projectStore: ProjectStore) {
        super(projectStore);

        makeObservable(this, {
            worker: observable.shallow,
            displayWidth: observable,
            displayHeight: observable,
            selectedDashboardTheme: observable
        });
    }

    getWasmModuleId() {
        return this.wasmModuleId;
    }

    ////////////////////////////////////////////////////////////////////////////////

    async doStartRuntime(isDebuggerActive: boolean) {
        let result;

        if (this.projectStore.context.type == "standalone") {
            try {
                const fs = await import("fs");
                result = JSON.parse(
                    await fs.promises.readFile(
                        this.projectStore.filePath + "-build",
                        "utf8"
                    )
                );
                // convert plain javascript array of numbers to buffer
                result.GUI_ASSETS_DATA = Buffer.from(
                    result.GUI_ASSETS_DATA,
                    "base64"
                );
            } catch (err) {}
        }

        if (!result) {
            result = await this.projectStore.buildAssets();
        }

        const outputSection = this.projectStore.outputSectionsStore.getSection(
            Section.OUTPUT
        );
        if (outputSection.numErrors > 0 || outputSection.numWarnings > 0) {
            this.projectStore.layoutModels.selectTab(
                this.projectStore.layoutModels.root,
                LayoutModels.OUTPUT_TAB_ID
            );
            if (outputSection.numErrors > 0) {
                this.stopRuntimeWithError("Build error");
                this.projectStore.setEditorMode();
                return;
            }
        }

        this.assetsMap = result.GUI_ASSETS_DATA_MAP_JS as AssetsMap;
        if (!this.assetsMap) {
            this.stopRuntimeWithError("Build error");
            this.projectStore.setEditorMode();
            return;
        }

        runInAction(() => {
            this.displayWidth = this.assetsMap.displayWidth;
            this.displayHeight = this.assetsMap.displayHeight;
        });

        this.assetsData = result.GUI_ASSETS_DATA;

        if (this.projectStore.projectTypeTraits.isDashboard) {
            await this.loadGlobalVariables();
        }

        if (!isDebuggerActive) {
            this.resumeAtStart = true;
        }

        // create WASM worker
        this.wasmModuleId = nextWasmModuleId++;

        if (this.projectStore.projectTypeTraits.isDashboard) {
            initJSObjectsMap(this.assetsMap, this.wasmModuleId);
        }

        if (this.projectStore.projectTypeTraits.isLVGL) {
            await preloadAllBitmaps(this.projectStore);
        }

        this.worker = createWasmWorker(
            this.wasmModuleId,
            isDebuggerActive
                ? 0xffffffff
                : (1 << MessagesToDebugger.MESSAGE_TO_DEBUGGER_STATE_CHANGED) |
                      (1 <<
                          MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_TIMELINE_CHANGED) |
                      (1 <<
                          MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_CREATED) |
                      (1 <<
                          MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_DESTROYED) |
                      (1 <<
                          MessagesToDebugger.MESSAGE_TO_DEBUGGER_FLOW_STATE_ERROR) |
                      (1 <<
                          MessagesToDebugger.MESSAGE_TO_DEBUGGER_PAGE_CHANGED) |
                      (1 <<
                          MessagesToDebugger.MESSAGE_TO_DEBUGGER_COMPONENT_EXECUTION_STATE_CHANGED),
            this.onWorkerMessage,
            this.projectStore.projectTypeTraits.isLVGL
                ? this.projectStore.project.settings.general.lvglVersion
                : undefined,
            this.displayWidth,
            this.displayHeight,
            this.projectStore.project.settings.general.darkTheme,
            this.projectStore.project.settings.build.screensLifetimeSupport,
            (className: string) => getClassByName(this.projectStore, className),
            (key: string) => {
                return this.projectStore.runtimeSettings.readSettings(key);
            },
            (key: string, value: any) => {
                this.projectStore.runtimeSettings.writeSettings(key, value);
            },
            this.hasWidgetHandle,
            this.getWidgetHandle,
            this.getWidgetHandleInfo
        );

        if (this.projectStore.projectTypeTraits.isLVGL) {
            this.lgvlPageRuntime = new LVGLPageViewerRuntime(this);
        }
    }

    async doStopRuntime(notifyUser: boolean) {
        if (this.worker?.wasm?._flowCleanup) {
            this.worker.wasm._flowCleanup();
        }

        if (this.projectStore.context.type == "instrument-dashboard") {
            notifyUser = false;
        }

        if (this.mainLoopTimeoutId) {
            window.cancelAnimationFrame(this.mainLoopTimeoutId);
        }

        if (this.requestAnimationFrameId) {
            window.cancelAnimationFrame(this.requestAnimationFrameId);
        }

        this.destroyGlobalVariables();

        clearJSObjects(this.wasmModuleId);

        if (this.lgvlPageRuntime) {
            this.lgvlPageRuntime.unmount();
        }

        if (this.worker) {
            this.worker.terminate();
            this.ctx = undefined;
        }

        if (this.error) {
            if (notifyUser) {
                notification.error(
                    `Flow stopped with error: ${this.error.toString()}`
                );
            }
        }

        releaseRuntimeDashboardStates(this.wasmModuleId);

        this.cleanup();
    }

    stop() {
        if (this.worker) {
            this.worker.postMessage({
                stopScript: true
            });
        }
        this.projectStore.setEditorMode();
    }

    onDebuggerActiveChanged() {
        if (this.isDebuggerActive) {
            this.worker?.wasm._setDebuggerMessageSubsciptionFilter(0xffffffff);
        }

        super.onDebuggerActiveChanged();
    }

    ////////////////////////////////////////////////////////////////////////////////

    onWorkerMessage = (workerToRenderMessage: WorkerToRenderMessage) => {
        if (workerToRenderMessage.getObjectVariableMemberValue) {
            const arrayValue = getValue(
                this.worker.wasm,
                workerToRenderMessage.getObjectVariableMemberValue.arrayValuePtr
            );

            let result = undefined;

            const objectVariableType = getObjectVariableTypeFromType(
                this.projectStore,
                arrayValue.valueType
            );
            if (objectVariableType) {
                const objectValue = objectVariableType.getValue
                    ? objectVariableType.getValue(arrayValue.value)
                    : undefined;
                if (objectValue) {
                    result =
                        objectVariableType.valueFieldDescriptions[
                            workerToRenderMessage.getObjectVariableMemberValue
                                .memberIndex
                        ].getFieldValue(objectValue);
                }
            }

            return result;
        } else if (workerToRenderMessage.getBitmapAsDataURL) {
            const bitmap = findBitmap(
                this.projectStore.project,
                workerToRenderMessage.getBitmapAsDataURL.name
            );
            if (bitmap) {
                return bitmap.imageSrc;
            }
            return null;
        } else if (workerToRenderMessage.setDashboardColorTheme) {
            const themeName =
                workerToRenderMessage.setDashboardColorTheme.themeName;
            runInAction(() => (this.selectedDashboardTheme = themeName));
        } else if (workerToRenderMessage.getLvglScreenByName) {
            return this.lgvlPageRuntime?.getLvglScreenByName(
                workerToRenderMessage.getLvglScreenByName.name
            );
        } else if (workerToRenderMessage.getLvglObjectByName) {
            return this.lgvlPageRuntime?.getLvglObjectByName(
                workerToRenderMessage.getLvglObjectByName.name,
                []
            );
        } else if (workerToRenderMessage.getLvglGroupByName) {
            return this.lgvlPageRuntime?.getLvglGroupByName(
                workerToRenderMessage.getLvglGroupByName.name
            );
        } else if (workerToRenderMessage.getLvglStyleByName) {
            return this.lgvlPageRuntime?.getLvglStyleByName(
                workerToRenderMessage.getLvglStyleByName.name
            );
        } else if (workerToRenderMessage.getLvglImageByName) {
            return (
                this.lgvlPageRuntime?.getBitmapPtrByName(
                    workerToRenderMessage.getLvglImageByName.name
                ) ?? 0
            );
        } else if (workerToRenderMessage.lvglObjAddStyle) {
            this.lgvlPageRuntime?.addStyle(
                workerToRenderMessage.lvglObjAddStyle.targetObj,
                workerToRenderMessage.lvglObjAddStyle.styleIndex
            );
        } else if (workerToRenderMessage.lvglObjRemoveStyle) {
            this.lgvlPageRuntime?.removeStyle(
                workerToRenderMessage.lvglObjRemoveStyle.targetObj,
                workerToRenderMessage.lvglObjRemoveStyle.styleIndex
            );
        } else if (workerToRenderMessage.lvglSetColorTheme) {
            this.lgvlPageRuntime?.setColorTheme(
                workerToRenderMessage.lvglSetColorTheme.themeName
            );
        } else if (workerToRenderMessage.lvglCreateScreen) {
            this.lgvlPageRuntime?.lvglCreateScreen(
                workerToRenderMessage.lvglCreateScreen.screenIndex
            );
        } else if (workerToRenderMessage.lvglDeleteScreen) {
            this.lgvlPageRuntime?.lvglDeleteScreen(
                workerToRenderMessage.lvglDeleteScreen.screenIndex
            );
        } else if (workerToRenderMessage.lvglScreenTick) {
            this.lgvlPageRuntime?.lvglScreenTick();
        } else if (workerToRenderMessage.lvglOnEventHandler) {
            this.lgvlPageRuntime?.lvglOnEventHandler(
                workerToRenderMessage.lvglOnEventHandler.obj,
                workerToRenderMessage.lvglOnEventHandler.eventCode,
                workerToRenderMessage.lvglOnEventHandler.event
            );
        }
        this.onWorkerMessageAsync(workerToRenderMessage);
        return undefined;
    };

    onWorkerMessageAsync = async (
        workerToRenderMessage: WorkerToRenderMessage
    ) => {
        if (workerToRenderMessage.init) {
            const message: RendererToWorkerMessage = {};

            let globalVariableValues: IGlobalVariable[];
            if (this.projectStore.projectTypeTraits.isDashboard) {
                globalVariableValues = this.globalVariables.map(
                    globalVariable => {
                        if (globalVariable.kind == "basic") {
                            return {
                                kind: "basic",
                                globalVariableIndex:
                                    globalVariable.globalVariableIndex,
                                value: globalVariable.value
                            };
                        }
                        return {
                            kind: "array",
                            globalVariableIndex:
                                globalVariable.globalVariableIndex,
                            value: globalVariable.value
                        };
                    }
                );
            } else {
                globalVariableValues = [];
            }

            message.init = {
                assetsData: this.assetsData,
                assetsMap: this.assetsMap,
                globalVariableValues,
                displayWidth: this.displayWidth,
                displayHeight: this.displayHeight
            };

            await this.worker.postMessage(message);

            if (this.onInitialized) {
                this.onInitialized();
            }

            this.runMainLoop();

            if (this.lgvlPageRuntime) {
                this.lgvlPageRuntime.mount();
            }

            this.debuggerConnection.onConnected();
        } else {
            if (workerToRenderMessage.scpiCommand) {
                this.executeScpiCommand(workerToRenderMessage.scpiCommand);
                return;
            }

            if (workerToRenderMessage.freeArrayValue) {
                console.log(
                    "freeArrayValue",
                    workerToRenderMessage.freeArrayValue
                );

                const valueType =
                    workerToRenderMessage.freeArrayValue.valueType;

                if (
                    valueType != "object:Instrument" ||
                    this.projectStore.context.type != "instrument-dashboard"
                ) {
                    const objectVariableType = getObjectVariableTypeFromType(
                        this.projectStore,
                        valueType
                    );
                    if (objectVariableType) {
                        let value = objectVariableType.getValue
                            ? objectVariableType.getValue(
                                  workerToRenderMessage.freeArrayValue.value
                              )
                            : undefined;
                        if (value) {
                            objectVariableType.destroyValue(value);
                        }
                    }
                }

                return;
            }

            if (workerToRenderMessage.propertyValues) {
                // console.log(workerToRenderMessage.propertyValues);
                this.componentProperties.valuesFromWorker(
                    workerToRenderMessage.propertyValues
                );
            }

            if (workerToRenderMessage.messageToDebugger) {
                this.debuggerConnection.onMessageToDebugger(
                    arrayBufferToBinaryString(
                        workerToRenderMessage.messageToDebugger
                    )
                );
            }

            this.screen = workerToRenderMessage.screen;

            runInAction(() => {
                if (
                    workerToRenderMessage.isRTL != undefined &&
                    this.isRTL !== workerToRenderMessage.isRTL
                ) {
                    this.isRTL = workerToRenderMessage.isRTL ? true : false;
                }
            });

            this.requestAnimationFrameId = window.requestAnimationFrame(
                this.animationFrameLoop
            );
        }
    };

    //mainLoopCounter = 0;
    //mainLoopCounterTime = performance.now();

    runMainLoop = () => {
        // this.mainLoopCounter++;
        // if (performance.now() - this.mainLoopCounterTime >= 1000) {
        //     console.log(this.mainLoopCounter);
        //     this.mainLoopCounterTime = performance.now();
        //     this.mainLoopCounter = 0;
        // }

        if (this.isStopped) {
            return;
        }

        this.worker.wasm._mainLoop(); // should run max. 5 ms so it doesn't block the UI

        this.mainLoopTimeoutId = setTimeout(this.runMainLoop, 0);
    };

    animationFrameLoop = () => {
        if (this.isStopped) {
            return;
        }

        if (this.componentProperties.selectedPage != this.selectedPage) {
            this.componentProperties.selectedPage = this.selectedPage;
            this.componentProperties.reset();
        }

        this.requestAnimationFrameId = undefined;

        if (this.screen) {
            this.lastScreen = this.screen;
            this.updateCanvasContext();
        }

        const message: RendererToWorkerMessage = {
            wheel: this.isPaused
                ? undefined
                : {
                      updated: this.wheelUpdated,
                      deltaY: this.wheelDeltaY,
                      pressed: this.wheelPressed
                  },
            pointerEvents: this.isPaused ? undefined : this.pointerEvents,
            keysPressed: this.isPaused ? undefined : this.keysPressed,
            updateGlobalVariableValues:
                this.getUpdatedObjectGlobalVariableValues(),
            evalProperties: this.componentProperties.evalProperties
        };

        this.worker.postMessage(message);

        this.wheelUpdated = false;
        this.wheelDeltaY = 0;
        this.pointerEvents = [];
        this.keysPressed = [];
    };

    setCanvasContext(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
        this.updateCanvasContext();
    }

    updateCanvasContext() {
        if (!this.lastScreen || !this.ctx) {
            return;
        }

        var imgData = new ImageData(
            this.lastScreen,
            this.displayWidth,
            this.displayHeight
        );

        const left = this.selectedPage.left;
        const top = this.selectedPage.top;
        const width = this.selectedPage.width;
        const height = this.selectedPage.height;

        this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
        this.ctx.putImageData(
            imgData,
            this.isDebuggerActive ? 0 : left + (this.displayWidth - width) / 2,
            this.isDebuggerActive ? 0 : top + (this.displayHeight - height) / 2,
            left,
            top,
            width,
            height
        );
    }

    ////////////////////////////////////////////////////////////////////////////////

    async loadGlobalVariables() {
        await this.projectStore.runtimeSettings.loadPersistentVariables();

        let firstDashboardInstrument = true;

        for (const variable of this.projectStore.project.allGlobalVariables) {
            const globalVariableInAssetsMap =
                this.assetsMap.globalVariables.find(
                    globalVariableInAssetsMap =>
                        globalVariableInAssetsMap.name == variable.fullName
                );
            const globalVariableIndex = globalVariableInAssetsMap!.index;

            let value =
                variable.type == "object:Instrument" &&
                firstDashboardInstrument &&
                this.projectStore.context.type == "instrument-dashboard"
                    ? this.projectStore.context.instrument
                    : this.projectStore.dataContext.get(variable.fullName);

            if (variable.type == "object:Instrument") {
                firstDashboardInstrument = false;
            }

            const objectVariableType = getObjectVariableTypeFromType(
                this.projectStore,
                variable.type
            );
            if (objectVariableType) {
                if (value == null) {
                    if (
                        variable.persistent &&
                        this.projectStore.context.type != "run-embedded" &&
                        objectVariableType.editConstructorParams
                    ) {
                        const constructorParams =
                            await objectVariableType.editConstructorParams(
                                variable,
                                undefined,
                                true
                            );

                        if (constructorParams) {
                            value = objectVariableType.createValue(
                                constructorParams,
                                true
                            );

                            this.projectStore.dataContext.set(
                                variable.fullName,
                                value
                            );
                        }
                    }
                }

                if (value != null) {
                    const arrayValue = createJsArrayValue(
                        +this.assetsMap.typeIndexes[variable.type],
                        value,
                        this.assetsMap,
                        (type: string) => {
                            return getObjectVariableTypeFromType(
                                this.projectStore,
                                type
                            );
                        }
                    );

                    this.globalVariables.push({
                        kind: "object",
                        globalVariableIndex,
                        variable,
                        value: arrayValue,

                        objectVariableValue: value,
                        objectVariableType,

                        studioModified: false
                    });
                } else {
                    this.globalVariables.push({
                        kind: "object",
                        globalVariableIndex,
                        variable,
                        value: null,

                        objectVariableValue: null,
                        objectVariableType,

                        studioModified: false
                    });
                }
            } else if (variable.persistent) {
                if (isStructType(variable.type) || isArrayType(variable.type)) {
                    const arrayValue = createJsArrayValue(
                        +this.assetsMap.typeIndexes[variable.type],
                        value,
                        this.assetsMap,
                        undefined
                    );

                    this.globalVariables.push({
                        kind: "struct",
                        globalVariableIndex,
                        variable,
                        value: arrayValue
                    });
                } else {
                    this.globalVariables.push({
                        kind: "basic",
                        globalVariableIndex,
                        variable,
                        value
                    });
                }
            }
        }
    }

    override setObjectVariableValue(
        variableName: string,
        objectVariableValue: IObjectVariableValue
    ) {
        for (const globalVariable of this.globalVariables) {
            if (
                globalVariable.variable.name == variableName &&
                globalVariable.kind == "object"
            ) {
                globalVariable.value = createJsArrayValue(
                    +this.assetsMap.typeIndexes[globalVariable.variable.type],
                    objectVariableValue,
                    this.assetsMap,
                    (type: string) => {
                        return getObjectVariableTypeFromType(
                            this.projectStore,
                            type
                        );
                    }
                );
                globalVariable.objectVariableValue = objectVariableValue;
                globalVariable.studioModified = true;
                this.projectStore.dataContext.set(
                    globalVariable.variable.name,
                    objectVariableValue
                );
                return;
            }
        }
    }

    getUpdatedObjectGlobalVariableValues(): IGlobalVariable[] {
        const updatedGlobalVariableValues: IGlobalVariable[] = [];

        for (const globalVariable of this.globalVariables) {
            const engineValuePtr = this.worker.wasm._getGlobalVariable(
                globalVariable.globalVariableIndex
            );

            if (
                globalVariable.kind == "object" &&
                globalVariable.studioModified
            ) {
                updatedGlobalVariableValues.push({
                    kind: "array",
                    globalVariableIndex: globalVariable.globalVariableIndex,
                    value: globalVariable.value
                });
                globalVariable.studioModified = false;
            } else {
                const engineValueWithType = getValue(
                    this.worker.wasm,
                    engineValuePtr
                );

                this.projectStore.dataContext.set(
                    globalVariable.variable.name,
                    engineValueWithType.value
                );
            }
        }

        return updatedGlobalVariableValues;
    }

    async destroyGlobalVariables() {
        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                this.projectStore.dataContext.set(
                    globalVariable.variable.name,
                    globalVariable.objectVariableValue
                );
            } else {
                const engineValuePtr = this.worker.wasm._getGlobalVariable(
                    globalVariable.globalVariableIndex
                );
                const engineValueWithType = getValue(
                    this.worker.wasm,
                    engineValuePtr
                );
                this.projectStore.dataContext.set(
                    globalVariable.variable.name,
                    engineValueWithType.value
                );
            }
        }

        if (!this.error) {
            await this.projectStore.runtimeSettings.savePersistentVariables();
        }

        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                const engineValuePtr = this.worker.wasm._getGlobalVariable(
                    globalVariable.globalVariableIndex
                );

                const engineValueWithType = getValue(
                    this.worker.wasm,
                    engineValuePtr
                );

                if (typeof engineValueWithType.value == "object") {
                    let objectValue = globalVariable.objectVariableType.getValue
                        ? globalVariable.objectVariableType.getValue(
                              engineValueWithType.value
                          )
                        : undefined;
                    if (objectValue) {
                        globalVariable.objectVariableType.destroyValue(
                            objectValue
                        );
                    }
                }
            }
        }
    }

    ////////////////////////////////////////////////////////////////////////////////

    findInstrument(scpiCommand: ScpiCommand) {
        for (let i = 0; i < this.globalVariables.length; i++) {
            const globalVariable = this.globalVariables[i];
            if (globalVariable.kind == "object") {
                const instrument = globalVariable.objectVariableValue;

                const { InstrumentObject } =
                    require("instrument/instrument-object") as typeof InstrumentObjectModule;

                if (instrument instanceof InstrumentObject) {
                    if (scpiCommand.instrumentId == instrument.id) {
                        return instrument;
                    }
                }
            }
        }
        return undefined;
    }

    async executeScpiCommand(scpiCommand: ScpiCommand) {
        const instrument = this.findInstrument(scpiCommand);

        if (!instrument) {
            this.worker.postMessage({
                scpiResult: {
                    errorMessage: "instrument not found"
                }
            });
            return;
        }

        if (
            !instrument.isConnected &&
            (this.projectStore.context.type != "instrument-dashboard" ||
                instrument != this.projectStore.context.instrument)
        ) {
            const CONNECTION_TIMEOUT = 3000;
            const startTime = Date.now();
            do {
                if (!instrument.connection.isTransitionState) {
                    instrument.connection.connect();
                }
                await new Promise<boolean>(resolve => setTimeout(resolve, 10));
            } while (
                !instrument.isConnected &&
                Date.now() - startTime < CONNECTION_TIMEOUT
            );
        }

        if (!instrument.isConnected) {
            this.worker.postMessage({
                scpiResult: {
                    errorMessage: "instrument not connected"
                }
            });
            return;
        }

        const connection = instrument.connection;

        try {
            await connection.acquire(false);
        } catch (err) {
            this.worker.postMessage({
                scpiResult: {
                    errorMessage: err.toString()
                }
            });
            return;
        }

        const command = arrayBufferToBinaryString(scpiCommand.command);

        const timeout =
            scpiCommand.timeout > 0 ? scpiCommand.timeout : undefined;
        const delay = scpiCommand.delay >= 0 ? scpiCommand.delay : undefined;

        let result: any = "";
        try {
            if (scpiCommand.isQuery) {
                //console.log("SCPI query", command);
                result = await connection.query(command, { timeout, delay });
                //console.log("SCPI result", result);
            } else {
                //console.log("SCPI command", command);
                await connection.command(command, { timeout, delay });
                result = "";
            }
        } catch (err) {
            this.worker.postMessage({
                scpiResult: {
                    errorMessage: err.toString()
                }
            });
            return;
        } finally {
            connection.release();
        }

        const { FileHistoryItem } = await import(
            "instrument/window/history/items/file"
        );

        if (result instanceof FileHistoryItem) {
            const data = result.data;

            const { logDelete, activityLogStore } = await import(
                "instrument/window/history/activity-log"
            );

            logDelete(activityLogStore, result, {
                undoable: false
            });

            result = data;
        }

        let data: RendererToWorkerMessage;
        if (result instanceof Uint8Array) {
            data = {
                scpiResult: {
                    result
                }
            };
        } else if (typeof result == "number") {
            data = {
                scpiResult: {
                    result: binaryStringToArrayBuffer(result.toString())
                }
            };
        } else if (typeof result == "string") {
            data = {
                scpiResult: {
                    result: binaryStringToArrayBuffer(result)
                }
            };
        } else {
            data = {
                scpiResult: {
                    errorMessage: result.error
                        ? result.error
                        : "unknown SCPI result"
                }
            };
        }

        this.worker.postMessage(data);

        return;
    }

    ////////////////////////////////////////////////////////////////////////////////

    evalProperty(
        flowContext: IFlowContext,
        component: Component,
        propertyName: string
    ) {
        return this.componentProperties.evalProperty(
            flowContext,
            component,
            propertyName
        );
    }

    evalPropertyWithType(
        flowContext: IFlowContext,
        component: Component,
        propertyName: string
    ) {
        return this.componentProperties.evalPropertyWithType(
            flowContext,
            component,
            propertyName
        );
    }

    executeWidgetAction(
        flowContext: IFlowContext,
        widget: Widget,
        actionName: string,
        value: any,
        valueType: ValueType
    ) {
        const flowState = flowContext.flowState!;

        const flowStateIndex = this.flowStateToFlowIndexMap.get(flowState);
        if (flowStateIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const flow = ProjectEditor.getFlow(widget);
        const flowPath = getObjectPathAsString(flow);
        const flowIndex = this.assetsMap.flowIndexes[flowPath];
        if (flowIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const componentPath = getObjectPathAsString(widget);
        let componentIndex =
            this.assetsMap.flows[flowIndex].componentIndexes[componentPath];
        if (componentIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        let outputIndex =
            this.assetsMap.flows[flowIndex].components[componentIndex]
                .outputIndexes[actionName];
        if (outputIndex == undefined) {
            // console.error("Unexpected!");
            return;
        }

        const output =
            this.assetsMap.flows[flowIndex].components[componentIndex].outputs[
                outputIndex
            ];

        if (output.actionFlowIndex != -1) {
            console.log("output.actionFlowIndex", output.actionFlowIndex);
            componentIndex = -1;
            outputIndex = output.actionFlowIndex;
        }

        const valueTypeIndex = this.assetsMap.typeIndexes[valueType];
        if (valueTypeIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        const arrayValue = createJsArrayValue(
            +valueTypeIndex,
            value,
            this.assetsMap,
            (type: string) => {
                return getObjectVariableTypeFromType(this.projectStore, type);
            }
        );

        if (arrayValue == undefined) {
            console.error("Unexpected!");
            return;
        }

        const message: RendererToWorkerMessage = {};
        message.executeWidgetAction = {
            flowStateIndex,
            componentIndex,
            outputIndex,
            arrayValue
        };
        this.worker.postMessage(message);
    }

    onKeyDown(e: KeyboardEvent) {
        if (!this.projectStore.projectTypeTraits.isDashboard) {
            return;
        }

        if (!this.projectStore.runtime) {
            return;
        }

        if (this.projectStore.runtime.isDebuggerActive && this.isPaused) {
            return;
        }

        if (!this.selectedPage) {
            return;
        }

        const flowState = this.getFlowState(this.selectedPage);
        if (!flowState) {
            return;
        }

        const flowStateIndex = this.flowStateToFlowIndexMap.get(flowState);
        if (flowStateIndex == undefined) {
            console.error("Unexpected!");
            return;
        }

        let key: string | undefined;

        if (e.key != "Shift" && e.key != "Control" && e.key != "Alt") {
            key =
                (e.ctrlKey ? "Control" : "") +
                (e.altKey ? "Alt" : "") +
                (e.shiftKey ? "Shift" : "") +
                e.key;
        } else {
            //key = e.key;
        }

        const passKey =
            (key != undefined && key.startsWith("F") && key.length > 1) ||
            key == "Escape";

        if (!passKey) {
            if (e.target instanceof HTMLInputElement) {
                if (
                    (key != "Tab" && key != "ShiftTab") ||
                    !hasClass(
                        e.target,
                        "eez-studio-disable-default-tab-handling"
                    )
                ) {
                    // do not pass key
                    return;
                }
            }

            if (
                e.target instanceof HTMLSelectElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                // do not pass key
                return;
            }
        }

        if (key == undefined) {
            return;
        }

        /*
        e.preventDefault();
        e.stopPropagation();
        */

        let valuePtr = createWasmValue(this.worker.wasm, key);

        if (!valuePtr) {
            console.error("Out of memory");
            return;
        }

        this.worker.wasm._onEvent(flowStateIndex, FLOW_EVENT_KEYDOWN, valuePtr);

        this.worker.wasm._valueFree(valuePtr);
    }

    ////////////////////////////////////////////////////////////////////////////////

    widgetHandles: {
        flowStateIndex: number;
        componentIndex: number;
    }[] = [];

    hasWidgetHandle = (flowStateIndex: number, componentIndex: number) => {
        return (
            this.widgetHandles.find(
                widgetHandle =>
                    widgetHandle.flowStateIndex == flowStateIndex &&
                    widgetHandle.componentIndex == componentIndex
            ) != null
        );
    };

    getWidgetHandle = (flowStateIndex: number, componentIndex: number) => {
        this.widgetHandles.push({
            flowStateIndex,
            componentIndex
        });
        return this.widgetHandles.length;
    };

    getWidgetHandleInfo = (widgetHandle: number) => {
        return this.widgetHandles[widgetHandle - 1];
    };

    ////////////////////////////////////////////////////////////////////////////////

    renderPage() {
        return <WasmCanvas />;
    }
}

////////////////////////////////////////////////////////////////////////////////

export const WasmCanvas = observer(
    class WasmCanvas extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        canvasRef = React.createRef<HTMLCanvasElement>();

        sendPointerEvent(event: PointerEvent) {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }
            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            var bbox = canvas.getBoundingClientRect();

            const left = wasmRuntime.selectedPage.left;
            const top = wasmRuntime.selectedPage.top;
            const width = wasmRuntime.selectedPage.width;
            const height = wasmRuntime.selectedPage.height;

            const x =
                (event.clientX -
                    bbox.left -
                    (wasmRuntime.isDebuggerActive
                        ? 0
                        : left + (wasmRuntime.displayWidth - width) / 2)) *
                (canvas.width / bbox.width);

            const y =
                (event.clientY -
                    bbox.top -
                    (wasmRuntime.isDebuggerActive
                        ? 0
                        : top + (wasmRuntime.displayHeight - height) / 2)) *
                (canvas.height / bbox.height);

            const pressed = event.buttons == 1 ? 1 : 0;

            wasmRuntime.pointerEvents.push({ x, y, pressed });

            event.preventDefault();
            event.stopPropagation();
        }

        onPointerDown = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }

            canvas.focus();

            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            if (event.buttons == 4) {
                wasmRuntime.wheelUpdated = true;
                wasmRuntime.wheelPressed = 1;
            }

            canvas.setPointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onPointerMove = (event: PointerEvent) => {
            this.sendPointerEvent(event);
        };

        onPointerUp = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }

            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (wasmRuntime) {
                wasmRuntime.wheelUpdated = true;
                wasmRuntime.wheelPressed = 0;
            }

            canvas.releasePointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onPointerCancel = (event: PointerEvent) => {
            const canvas = this.canvasRef.current;
            if (!canvas) {
                return;
            }

            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (wasmRuntime) {
                wasmRuntime.wheelUpdated = true;
                wasmRuntime.wheelPressed = 0;
            }

            canvas.releasePointerCapture(event.pointerId);
            this.sendPointerEvent(event);
        };

        onWheel = (event: WheelEvent) => {
            if (!this.canvasRef.current) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            this.canvasRef.current.focus();

            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }
            wasmRuntime.wheelUpdated = true;
            wasmRuntime.wheelDeltaY += event.deltaY;
        };

        onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
            const wasmRuntime = this.context.runtime as WasmRuntime;
            if (!wasmRuntime) {
                return;
            }

            const LV_KEY_UP = 17; /*0x11*/
            const LV_KEY_DOWN = 18; /*0x12*/
            const LV_KEY_RIGHT = 19; /*0x13*/
            const LV_KEY_LEFT = 20; /*0x14*/
            const LV_KEY_ESC = 27; /*0x1B*/
            const LV_KEY_DEL = 127; /*0x7F*/
            const LV_KEY_BACKSPACE = 8; /*0x08*/
            const LV_KEY_ENTER = 10; /*0x0A, '\n'*/
            const LV_KEY_NEXT = 9; /*0x09, '\t'*/
            const LV_KEY_PREV = 11; /*0x0B, '*/
            const LV_KEY_HOME = 2; /*0x02, STX*/
            const LV_KEY_END = 3; /*0x03, ETX*/

            let key = 0;

            if (event.key == "ArrowRight") {
                key = LV_KEY_RIGHT;
            } else if (event.key == "ArrowLeft") {
                key = LV_KEY_LEFT;
            } else if (event.key == "ArrowUp") {
                key = LV_KEY_UP;
            } else if (event.key == "ArrowDown") {
                key = LV_KEY_DOWN;
            } else if (event.key == "Escape") {
                key = LV_KEY_ESC;
            } else if (event.key == "Backspace") {
                key = LV_KEY_BACKSPACE;
            } else if (event.key == "Delete") {
                key = LV_KEY_DEL;
            } else if (event.key == "Enter") {
                key = LV_KEY_ENTER;
            } else if (event.key == "Tab") {
                key = LV_KEY_NEXT;
            } else if (event.key == "ShiftTab") {
                key = LV_KEY_PREV;
            } else if (event.key == "Home") {
                key = LV_KEY_HOME;
            } else if (event.key == "End") {
                key = LV_KEY_END;
            } else if (event.key.length == 1) {
                key = event.key.charCodeAt(0);
            }

            if (key != 0) {
                event.preventDefault();
                event.stopPropagation();
                wasmRuntime.keysPressed.push(key);
            }
        };

        componentDidMount() {
            const canvasElement = this.canvasRef.current;
            if (!canvasElement) {
                return;
            }
            const canvas = canvasElement;

            const wasmRuntime = this.context.runtime as WasmRuntime;

            wasmRuntime.setCanvasContext(canvas.getContext("2d")!);

            canvas.addEventListener("pointerdown", this.onPointerDown, true);
            canvas.addEventListener("pointermove", this.onPointerMove, true);
            canvas.addEventListener("pointerup", this.onPointerUp, true);
            canvas.addEventListener(
                "pointercancel",
                this.onPointerCancel,
                true
            );
            canvas.addEventListener("wheel", this.onWheel, {
                passive: false
            });

            canvas.focus();
        }

        componentWillUnmount() {
            const canvasElement = this.canvasRef.current;
            if (canvasElement) {
                const canvas = canvasElement;

                canvas.removeEventListener(
                    "pointerdown",
                    this.onPointerDown,
                    true
                );
                canvas.removeEventListener(
                    "pointermove",
                    this.onPointerMove,
                    true
                );
                canvas.removeEventListener("pointerup", this.onPointerUp, true);
                canvas.removeEventListener(
                    "pointercancel",
                    this.onPointerCancel,
                    true
                );
                canvas.removeEventListener("wheel", this.onWheel, false);
            }
        }

        render() {
            const wasmRuntime = this.context.runtime as WasmRuntime;

            return (
                <canvas
                    tabIndex={0}
                    ref={this.canvasRef}
                    width={wasmRuntime.displayWidth}
                    height={wasmRuntime.displayHeight}
                    style={
                        this.context.project.settings.general.circularDisplay
                            ? {
                                  borderRadius: Math.min(
                                      wasmRuntime.displayWidth,
                                      wasmRuntime.displayWidth
                                  )
                              }
                            : this.context.project.settings.general
                                  .displayBorderRadius != 0
                            ? {
                                  borderRadius:
                                      this.context.project.settings.general
                                          .displayBorderRadius
                              }
                            : undefined
                    }
                    onKeyDown={this.onKeyDown}
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class WasmDebuggerConnection extends DebuggerConnectionBase {
    constructor(private wasmRuntime: WasmRuntime) {
        super(wasmRuntime);
    }

    start() {}

    stop() {}

    sendMessageFromDebugger(data: string) {
        if (this.wasmRuntime.worker) {
            const message: RendererToWorkerMessage = {
                messageFromDebugger: binaryStringToArrayBuffer(data)
            };
            this.wasmRuntime.worker.postMessage(message);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class ComponentProperties {
    selectedPage: Page;

    // eval
    evalFlowStates = new Map<
        number,
        {
            evalComponents: Map<
                Component,
                {
                    componentIndex: number;
                    evalProperties: {
                        [propertyName: string]: {
                            propertyIndex: number;
                            propertyValueIndexes: {
                                [indexesPath: string]: number;
                            };
                        };
                    };
                }
            >;
        }
    >();
    evalProperties: IEvalProperty[] | undefined;
    propertyValues: IObservableValue<ValueWithType>[] = [];
    nextPropertyValueIndex: number = 0;

    // assign
    assignFlowStates = new Map<
        number,
        {
            assignComponents: Map<
                Component,
                {
                    componentIndex: number;
                }
            >;
        }
    >();

    constructor(public wasmRuntime: WasmRuntime) {
        makeObservable(this, {
            propertyValues: observable
        });
    }

    reset() {
        this.evalFlowStates = new Map();
        this.evalProperties = undefined;
        runInAction(() => {
            this.propertyValues = [];
        });
        this.nextPropertyValueIndex = 0;
    }

    evalPropertyWithType(
        flowContext: IFlowContext,
        component: Component,
        propertyName: string
    ) {
        const flowState = flowContext.flowState!;

        const flowStateIndex =
            this.wasmRuntime.flowStateToFlowIndexMap.get(flowState);
        if (flowStateIndex == undefined) {
            console.error("Unexpected!");
            return undefined;
        }

        let evalFlowState = this.evalFlowStates.get(flowStateIndex);
        if (!evalFlowState) {
            // add new evalFlowState
            evalFlowState = {
                evalComponents: new Map()
            };
            this.evalFlowStates.set(flowStateIndex, evalFlowState);
        }

        let evalComponent = evalFlowState.evalComponents.get(component);
        if (!evalComponent) {
            // add new evalComponent
            const flow = ProjectEditor.getFlow(component);
            const flowPath = getObjectPathAsString(flow);
            const flowIndex = this.wasmRuntime.assetsMap.flowIndexes[flowPath];
            if (flowIndex == undefined) {
                console.error("Unexpected!");
                return undefined;
            }

            const componentPath = getObjectPathAsString(component);
            const componentIndex =
                this.wasmRuntime.assetsMap.flows[flowIndex].componentIndexes[
                    componentPath
                ];
            if (componentIndex == undefined) {
                console.error("Unexpected!");
                return undefined;
            }

            evalComponent = {
                componentIndex,
                evalProperties: {}
            };

            evalFlowState.evalComponents.set(component, evalComponent);
        }

        let indexes = flowContext.dataContext.get(
            FLOW_ITERATOR_INDEXES_VARIABLE
        );
        if (indexes == undefined) {
            indexes = [0];
        }
        let indexesPath = indexes.join("/");

        let evalProperty = evalComponent.evalProperties[propertyName];
        if (evalProperty == undefined) {
            // add new evalProperty
            const propertyIndex = this.getPropertyIndex(
                component,
                propertyName
            );
            if (propertyIndex == -1) {
                console.error("Unexpected!");
                return undefined;
            }

            evalProperty = {
                propertyIndex,
                propertyValueIndexes: {
                    [indexesPath]: this.nextPropertyValueIndex
                }
            };

            evalComponent.evalProperties[propertyName] = evalProperty;

            if (this.evalProperties == undefined) {
                this.evalProperties = [];
            }

            this.evalProperties[this.nextPropertyValueIndex] = {
                flowStateIndex,
                componentIndex: evalComponent.componentIndex,
                propertyIndex: evalProperty.propertyIndex,
                propertyValueIndex: this.nextPropertyValueIndex,
                indexes
            };
            this.nextPropertyValueIndex++;
        } else {
            if (evalProperty.propertyValueIndexes[indexesPath] == undefined) {
                evalProperty.propertyValueIndexes[indexesPath] =
                    this.nextPropertyValueIndex;

                if (this.evalProperties == undefined) {
                    this.evalProperties = [];
                }

                this.evalProperties[this.nextPropertyValueIndex] = {
                    flowStateIndex,
                    componentIndex: evalComponent.componentIndex,
                    propertyIndex: evalProperty.propertyIndex,
                    propertyValueIndex: this.nextPropertyValueIndex,
                    indexes
                };

                this.nextPropertyValueIndex++;
            }
        }

        let propertyValueIndex = evalProperty.propertyValueIndexes[indexesPath];

        if (propertyValueIndex < this.propertyValues.length) {
            // get evaluated value
            return this.propertyValues[propertyValueIndex].get();
        }

        // not evaluated yet
        return undefined;
    }

    evalProperty(
        flowContext: IFlowContext,
        component: Component,
        propertyName: string
    ) {
        const result = this.evalPropertyWithType(
            flowContext,
            component,
            propertyName
        );
        if (result) {
            return result.value;
        }
        return undefined;
    }

    valuesFromWorker(widgetPropertyValues: IPropertyValue[]) {
        if (widgetPropertyValues.length > 0) {
            for (const propertyValue of widgetPropertyValues) {
                for (
                    let i = this.propertyValues.length;
                    i < propertyValue.propertyValueIndex + 1;
                    i++
                ) {
                    runInAction(() => {
                        this.propertyValues[i] = observable.box({
                            value: undefined,
                            valueType: "undefined"
                        });
                    });
                }

                runInAction(() => {
                    this.propertyValues[propertyValue.propertyValueIndex].set(
                        propertyValue.valueWithType
                    );
                });
            }
        }
    }

    private getPropertyIndex(component: Component, propertyName: string) {
        const classInfo = getClassInfo(component);

        let properties = classInfo.properties.filter(propertyInfo =>
            isFlowProperty(component, propertyInfo, [
                "input",
                "template-literal",
                "assignable"
            ])
        );

        if (classInfo.getAdditionalFlowProperties) {
            properties = [
                ...properties,
                ...classInfo.getAdditionalFlowProperties(component)
            ];
        }

        return properties.findIndex(property => property.name == propertyName);
    }
}

////////////////////////////////////////////////////////////////////////////////

function arrayBufferToBinaryString(data: ArrayBuffer) {
    const buffer = Buffer.from(data);
    return buffer.toString("binary");
}

function binaryStringToArrayBuffer(data: string) {
    const buffer = Buffer.from(data, "binary");
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );
}

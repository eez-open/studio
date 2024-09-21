import React from "react";

import { tmpdir } from "os";
import { sep } from "path";
import { writeFileSync, unlinkSync } from "fs";
import type { PythonShell, Options } from "python-shell";

import type {
    IDashboardComponentContext,
    IWasmFlowRuntime
} from "eez-studio-types";

import { onWasmFlowRuntimeTerminate } from "project-editor/flow/runtime/wasm-worker";

import { registerActionComponents } from "project-editor/flow/component";
import { PYTHON_ICON, RightArrow } from "project-editor/ui-components/icons";
import { settingsController } from "home/settings";

const componentHeaderColor = "#BBE4E0";

registerActionComponents("Python", [
    {
        name: "PythonRun",
        icon: PYTHON_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "handle",
                type: "integer",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            {
                name: "message",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ],
        properties: [
            {
                name: "scriptSourceOption",
                type: "enum",
                enumItems: [
                    {
                        id: "inline-script",
                        label: "Inline script"
                    },
                    {
                        id: "inline-script-as-expression",
                        label: "Inline script as expression"
                    },
                    {
                        id: "script-file",
                        label: "Script file"
                    }
                ]
            },
            {
                name: "scriptSourceInline",
                displayName: "Inline script",
                type: "inline-code",
                language: "Python",
                disabled: (...props: string[]) => {
                    return props[0] != "inline-script";
                }
            },
            {
                name: "scriptSourceInlineFromExpression",
                displayName: "Inline script as expression",
                type: "expression",
                valueType: "string",
                disabled: (...props: string[]) => {
                    return props[0] != "inline-script-as-expression";
                }
            },
            {
                name: "scriptSourceFile",
                displayName: "Script file",
                type: "expression",
                valueType: "string",
                disabled: (...props: string[]) => {
                    return props[0] != "script-file";
                }
            },
            {
                name: "pythonPath",
                type: "expression",
                valueType: "string"
            }
        ],
        defaults: {
            scriptSourceOption: "inline-script",
            pythonPath: '""'
        },
        bodyPropertyCallback: (...props: string[]) => {
            if (props[0] == "inline-script") {
                return (
                    <pre
                        style={{
                            maxHeight: 480,
                            overflow: "auto"
                        }}
                    >
                        {props[1]}
                    </pre>
                );
            } else if (props[0] == "inline-script-as-expression") {
                return props[2];
            } else {
                return props[3];
            }
        },
        execute: (context: IDashboardComponentContext) => {
            const scriptSourceOption = context.getStringParam(0);

            let scriptSource;
            let isInlineScript: boolean;
            if (scriptSourceOption == "inline-script") {
                scriptSource = context.getStringParam(4);
                isInlineScript = true;
            } else if (scriptSourceOption == "inline-script-as-expression") {
                scriptSource = context.evalProperty<string>(
                    "scriptSourceInlineFromExpression"
                );
                isInlineScript = true;
            } else {
                scriptSource = context.evalProperty<string>("scriptSourceFile");
                isInlineScript = false;
            }

            if (scriptSource == undefined) {
                context.throwError(`Invalid script source`);
                return;
            }

            const handle = getNextPythonShellHandle();

            let scriptFilePath: string;
            if (isInlineScript) {
                scriptFilePath =
                    tmpdir() + sep + `eez-runtime-python-script-${handle}.py`;
                writeFileSync(scriptFilePath, scriptSource);
            } else {
                scriptFilePath = scriptSource;
            }

            let pythonPath = context.evalProperty<string>("pythonPath");
            if (!pythonPath) {
                if (settingsController.pythonUseCustomPath) {
                    pythonPath = settingsController.pythonCustomPath;
                }
            }

            const options: Options = {
                pythonPath
            };
            const { PythonShell } =
                require("python-shell") as typeof import("python-shell");
            const pythonShell = new PythonShell(scriptFilePath, options);
            addPythonShell(context.WasmFlowRuntime, pythonShell);

            pythonShell.on("message", message => {
                const { wasmFlowRuntimeTerminated } = getPythonShell(handle);
                if (!wasmFlowRuntimeTerminated) {
                    context.propagateValue("message", message);
                }
            });

            let wasError = false;

            function cleanup() {
                removePythonShell(handle);

                if (isInlineScript) {
                    unlinkSync(scriptFilePath);
                }
            }

            pythonShell.on("close", () => {
                if (!wasError) {
                    const { wasmFlowRuntimeTerminated } =
                        getPythonShell(handle);

                    if (!wasmFlowRuntimeTerminated) {
                        context.propagateValueThroughSeqout();
                    }

                    cleanup();
                }
            });

            pythonShell.on("pythonError", err => {
                wasError = true;

                const { wasmFlowRuntimeTerminated } = getPythonShell(handle);
                if (!wasmFlowRuntimeTerminated) {
                    context.throwError(err.toString());
                }

                cleanup();
            });

            pythonShell.on("error", err => {
                wasError = true;

                const { wasmFlowRuntimeTerminated } = getPythonShell(handle);
                if (!wasmFlowRuntimeTerminated) {
                    context.throwError(err.toString());
                }

                cleanup();
            });

            context.propagateValue("handle", handle);
        }
    },
    {
        name: "PythonSendMessage",
        icon: PYTHON_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "handle",
                type: "expression",
                valueType: "integer"
            },
            {
                name: "message",
                type: "expression",
                valueType: "string"
            }
        ],
        bodyPropertyCallback(...props) {
            return (
                <pre>
                    <span
                        style={{ display: "inline-flex", alignItems: "center" }}
                    >
                        {props[1]}
                        <RightArrow />
                        {props[0]}
                    </span>
                </pre>
            );
        },
        defaults: {
            handle: "handle",
            customInputs: [
                {
                    name: "handle",
                    type: "integer"
                }
            ]
        },
        execute: (context: IDashboardComponentContext) => {
            const handle = context.evalProperty<number>("handle");
            if (!handle) {
                context.throwError(`Handle not defined`);
                return;
            }
            const { pythonShell } = getPythonShell(handle);
            if (!pythonShell) {
                context.throwError(`Invalid handle ` + handle);
                return;
            }

            const message = context.evalProperty<string>("message");
            if (!message) {
                context.throwError(`Message not defined`);
                return;
            }

            pythonShell.send(message.toString());

            context.propagateValueThroughSeqout();
        }
    },
    {
        name: "PythonEnd",
        icon: PYTHON_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "handle",
                type: "expression",
                valueType: "integer"
            }
        ],
        defaults: {
            handle: "handle",
            customInputs: [
                {
                    name: "handle",
                    type: "integer"
                }
            ]
        },
        bodyPropertyName: "handle",
        execute: (context: IDashboardComponentContext) => {
            const handle = context.evalProperty<number>("handle");
            if (!handle) {
                context.throwError(`Handle not defined`);
                return;
            }
            const { pythonShell } = getPythonShell(handle);
            if (!pythonShell) {
                context.throwError(`Invalid handle ` + handle);
                return;
            }

            pythonShell.end(() => {
                context.propagateValueThroughSeqout();
            });
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

const handleToPythonShell = new Map<
    number,
    {
        wasmFlowRuntime: IWasmFlowRuntime;
        wasmFlowRuntimeTerminated: boolean;
        pythonShell: PythonShell;
    }
>();
let lastPythonShellHandle = 0;

function getNextPythonShellHandle() {
    return lastPythonShellHandle + 1;
}

function addPythonShell(
    wasmFlowRuntime: IWasmFlowRuntime,
    pythonShell: PythonShell
) {
    lastPythonShellHandle = getNextPythonShellHandle();

    handleToPythonShell.set(lastPythonShellHandle, {
        wasmFlowRuntime,
        wasmFlowRuntimeTerminated: false,
        pythonShell
    });

    return lastPythonShellHandle;
}

function getPythonShell(handle: number) {
    return (
        handleToPythonShell.get(handle) || {
            pythonShell: undefined,
            wasmFlowRuntime: undefined,
            wasmFlowRuntimeTerminated: true
        }
    );
}

function removePythonShell(handle: number) {
    handleToPythonShell.delete(handle);
}

onWasmFlowRuntimeTerminate((wasmFlowRuntime: IWasmFlowRuntime) => {
    for (const item of handleToPythonShell) {
        if (item[1].wasmFlowRuntime == wasmFlowRuntime) {
            item[1].wasmFlowRuntimeTerminated = true;
            item[1].pythonShell.end(() => {});
        }
    }
});

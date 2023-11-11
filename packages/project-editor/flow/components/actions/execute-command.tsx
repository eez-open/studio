import React from "react";
import { PassThrough } from "stream";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import type {
    IDashboardComponentContext,
    IWasmFlowRuntime
} from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";

import { onWasmFlowRuntimeTerminate } from "project-editor/flow/runtime/wasm-worker";

import { isArray } from "eez-studio-shared/util";

////////////////////////////////////////////////////////////////////////////////

const activeExecuteProcesses = new Map<
    number,
    ChildProcessWithoutNullStreams[]
>();

(window as any).activeExecuteProcesses = activeExecuteProcesses;

onWasmFlowRuntimeTerminate((wasmFlowRuntime: IWasmFlowRuntime) => {
    const processes = activeExecuteProcesses.get(wasmFlowRuntime.wasmModuleId);
    if (processes) {
        processes.forEach(process => {
            process.kill();
        });
        activeExecuteProcesses.delete(wasmFlowRuntime.wasmModuleId);
    }
});

function registerProcess(
    wasmFlowRuntime: IWasmFlowRuntime,
    process: ChildProcessWithoutNullStreams
) {
    let processes = activeExecuteProcesses.get(wasmFlowRuntime.wasmModuleId);
    if (!processes) {
        processes = [];
        activeExecuteProcesses.set(wasmFlowRuntime.wasmModuleId, processes);
    }
    processes.push(process);
}

function unregisterProcess(
    wasmFlowRuntime: IWasmFlowRuntime,
    process: ChildProcessWithoutNullStreams
) {
    let processes = activeExecuteProcesses.get(wasmFlowRuntime.wasmModuleId);
    if (processes) {
        const index = processes.indexOf(process);
        if (index != -1) {
            processes.splice(index, 1);
        }
    }
}

const executeCommandIcon: any = (
    <svg
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
        <polyline points="5 7 10 12 5 17"></polyline>
        <line x1="13" y1="17" x2="19" y2="17"></line>
    </svg>
);

const componentHeaderColor = "#FFDFD3";

registerActionComponents("Dashboard Specific", [
    {
        name: "ExecuteCommand",
        icon: executeCommandIcon,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "stdout",
                type: "stream",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            {
                name: "stderr",
                type: "stream",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            {
                name: "finished",
                type: "integer",
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ],
        properties: [
            {
                name: "command",
                type: "expression",
                valueType: "string"
            },
            {
                name: "arguments",
                type: "expression",
                valueType: "array:string"
            }
        ],
        bodyPropertyCallback: (command, args) => {
            return `${command}\n${args}`;
        },
        execute: (context: IDashboardComponentContext) => {
            const commandValue: any = context.evalProperty("command");
            if (typeof commandValue != "string") {
                context.throwError("command is not a string");
                return;
            }
            const argsValue: any = context.evalProperty("arguments");
            if (!isArray(argsValue)) {
                context.throwError("arguments is not an array");
                return;
            }

            const i = argsValue.findIndex((arg: any) => typeof arg != "string");
            if (i != -1) {
                context.throwError(
                    `argument at position ${i + 1} is not a string`
                );
                return;
            }

            try {
                let childProcess = spawn(commandValue, argsValue);

                const passThroughStdout = new PassThrough();
                childProcess.stdout.pipe(passThroughStdout);
                context.propagateValue("stdout", passThroughStdout);

                const passThroughStderr = new PassThrough();
                childProcess.stderr.pipe(passThroughStderr);
                context.propagateValue("stderr", passThroughStderr);

                let processFinished = false;
                context = context.startAsyncExecution();
                registerProcess(context.WasmFlowRuntime, childProcess);

                function endAsyncExecution() {
                    context.endAsyncExecution();
                    processFinished = true;
                    unregisterProcess(context.WasmFlowRuntime, childProcess);
                }

                childProcess.on("exit", code => {
                    if (!processFinished) {
                        context.propagateValue("finished", code);
                        endAsyncExecution();
                    }
                });

                childProcess.on("error", err => {
                    if (!processFinished) {
                        context.throwError(err.toString());
                        endAsyncExecution();
                    }
                });

                childProcess.on("close", code => {
                    if (!processFinished) {
                        context.propagateValue("finished", code);
                        endAsyncExecution();
                    }
                });
                childProcess.on("disconnect", () => {
                    if (!processFinished) {
                        context.propagateValue("finished", -1);
                        endAsyncExecution();
                    }
                });

                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(err.toString());
            }
        }
    }
]);

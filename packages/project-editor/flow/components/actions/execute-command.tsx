import React from "react";
import { PassThrough } from "stream";
import { spawn } from "child_process";

import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

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
            if (!Array.isArray(argsValue)) {
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

            context = context.startAsyncExecution();

            try {
                let processFinished = false;

                let childProcess = spawn(commandValue, argsValue);

                const passThroughStdout = new PassThrough();
                childProcess.stdout.pipe(passThroughStdout);
                context.propagateValue("stdout", passThroughStdout);

                const passThroughStderr = new PassThrough();
                childProcess.stderr.pipe(passThroughStderr);
                context.propagateValue("stderr", passThroughStderr);

                childProcess.on("exit", code => {
                    if (!processFinished) {
                        context.propagateValue("finished", code);
                        context.endAsyncExecution();
                        processFinished = true;
                    }
                });

                childProcess.on("error", err => {
                    if (!processFinished) {
                        context.throwError(err.toString());
                        context.endAsyncExecution();
                        processFinished = true;
                    }
                });

                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(
                    `argument at position ${i + 1} is not a string`
                );
            } finally {
                context.endAsyncExecution();
            }
        }
    }
]);

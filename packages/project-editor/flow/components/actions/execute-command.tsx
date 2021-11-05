import React from "react";

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

const componentHeaderColor = "#cca3ba";

registerActionComponents("Dashboard Specific", [
    {
        name: "ExecuteCommand",
        icon: executeCommandIcon,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "stdout",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            {
                name: "stderr",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            {
                name: "finished",
                type: "integer",
                isSequenceOutput: false,
                isOptionalOutput: false
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
        execute: async (flowState, ...[command, args]) => {
            const commandValue: any = flowState.evalExpression(command);
            if (typeof commandValue != "string") {
                throw "command is not a string";
            }
            const argsValue: any = flowState.evalExpression(args);
            if (!Array.isArray(argsValue)) {
                throw "arguments is not an array";
            }

            const i = argsValue.findIndex((arg: any) => typeof arg != "string");
            if (i != -1) {
                throw `argument at position ${i + 1} is not a string`;
            }

            const { spawn } = await import("child_process");

            let process = spawn(commandValue, argsValue);
            let processFinished = false;

            flowState.propagateValue("stdout", process.stdout);
            flowState.propagateValue("stderr", process.stderr);

            process.on("close", code => {
                flowState.propagateValue("finished", code);
                processFinished = true;
            });

            process.on("error", err => {
                flowState.throwError(err.toString());
                processFinished = true;
            });

            return () => {
                if (!processFinished) {
                    process.kill();
                }
            };
        }
    }
]);

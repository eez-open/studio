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
        }
    }
]);

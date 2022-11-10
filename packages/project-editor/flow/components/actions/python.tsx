import React from "react";

import { registerActionComponents } from "project-editor/flow/component";
import { RightArrow } from "project-editor/ui-components/icons";

const pythonIcon: any = (
    <svg
        strokeWidth="2"
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
    >
        <path d="M0 0h24v24H0z" stroke="none" />
        <path d="M12 9H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3m4-2h7a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3" />
        <path d="M8 9V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4m-5-9v.01M13 18v.01" />
    </svg>
);

const componentHeaderColor = "#BBE4E0";

registerActionComponents("Python", [
    {
        name: "PythonRun",
        icon: pythonIcon,
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
                displayName: "Script source",
                type: "inline-code",
                language: "Python",
                enabled: (...props: string[]) => {
                    return props[0] != "inline-script";
                }
            },
            {
                name: "scriptSourceInlineFromExpression",
                displayName: "Script source",
                type: "expression",
                valueType: "string",
                enabled: (...props: string[]) => {
                    return props[0] != "inline-script-as-expression";
                }
            },
            {
                name: "scriptSourceFile",
                displayName: "Script source",
                type: "expression",
                valueType: "string",
                enabled: (...props: string[]) => {
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
        }
    },
    {
        name: "PythonSendMessage",
        icon: pythonIcon,
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
        }
    },
    {
        name: "PythonEnd",
        icon: pythonIcon,
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
        bodyPropertyName: "handle"
    }
]);

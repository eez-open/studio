import React from "react";

import { registerActionComponents } from "project-editor/flow/component";

////////////////////////////////////////////////////////////////////////////////

const httpGetIcon: any = (
    <svg viewBox="0 0 48 48">
        <path d="M9 22H5v-4H2v12h3v-5h4v5h3V18H9v4zm5-1h3v9h3v-9h3v-3h-9v3zm11 0h3v9h3v-9h3v-3h-9v3zm18-3h-7v12h3v-4h4c1.7 0 3-1.3 3-3v-2c0-1.7-1.3-3-3-3zm0 5h-4v-2h4v2z" />
    </svg>
);

const componentHeaderColor = "#FFDFD3";

registerActionComponents("Dashboard Specific", [
    {
        name: "HTTP",
        componentPaletteLabel: "HTTP",
        icon: httpGetIcon,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "status",
                type: "integer",
                isSequenceOutput: false,
                isOptionalOutput: true
            },
            {
                name: "result",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ],
        properties: [
            {
                name: "method",
                type: "enum",
                enumItems: [
                    {
                        id: "get",
                        label: "GET"
                    },
                    {
                        id: "post",
                        label: "POST"
                    },
                    {
                        id: "put",
                        label: "PUT"
                    },
                    {
                        id: "patch",
                        label: "PATCH"
                    },
                    {
                        id: "delete",
                        label: "DELETE"
                    },
                    {
                        id: "head",
                        label: "HEAD"
                    },
                    {
                        id: "options",
                        label: "OPTIONS"
                    },
                    {
                        id: "connect",
                        label: "CONNECT"
                    },
                    {
                        id: "trace",
                        label: "TRACE"
                    }
                ]
            },
            {
                name: "url",
                type: "expression",
                valueType: "string"
            },
            {
                name: "headers",
                type: "list",
                properties: [
                    {
                        name: "name",
                        type: "expression",
                        valueType: "string"
                    },
                    {
                        name: "value",
                        type: "expression",
                        valueType: "string"
                    }
                ],
                defaults: {}
            },
            {
                name: "body",
                type: "expression",
                valueType: "string",
                enabled: (...props: string[]) =>
                    !(
                        props[0] == "post" ||
                        props[0] == "put" ||
                        props[0] == "patch"
                    )
            }
        ],
        bodyPropertyCallback: (...props) => {
            let body = `${props[0].toUpperCase()} ${props[1]}`;

            /*
            if (props[2].length > 0) {
                body += "\n\nHeaders:\n";
                for (const item of props[2] as any) {
                    body += "\n" + item.name + ": " + item.value;
                }
            }

            if (props[3]) {
                body += "\n\nBody:\n\n" + props[3];
            }
            */

            return body;
        },
        defaults: {
            method: "get",
            body: `""`
        },
        migrateProperties: component => {
            if (component.method == undefined) {
                component.method = "get";
            }
        }
    }
]);

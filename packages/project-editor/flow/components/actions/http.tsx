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
        name: "HTTPGet",
        componentPaletteLabel: "HTTPGet",
        icon: httpGetIcon,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "result",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [
            {
                name: "url",
                type: "expression",
                valueType: "string"
            }
        ],
        bodyPropertyCallback: url => {
            return `URL: ${url}`;
        }
    }
]);

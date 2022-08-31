import React from "react";

import { registerActionComponents } from "project-editor/flow/component";

import {
    registerSystemStructure,
    ValueType
} from "project-editor/features/variable/value-type";

////////////////////////////////////////////////////////////////////////////////

const regexpIcon: any = (
    <svg viewBox="0 0 512 512">
        <path d="M309.677124,349.2086182V230.9143524l-97.4385986,59.7092743l-34.350647-59.8398743l101.6825867-55.6431732l-101.6825867-56.4703445l34.5251465-58.7483673l97.2640991,59.4459915V0.6174708h69.4211121v118.7503891l98.1610413-59.4459915L512,118.6702347l-102.1397705,56.4703445L512,230.7837524l-34.877594,60.111908l-98.0241699-59.981308v118.2942657H309.677124z M145.1727905,438.7961426c0-55.6698914-60.6798172-90.6524658-108.961525-62.8175354c-48.2816963,27.8349609-48.2816849,97.8001099,0.0000191,125.6350708C84.4929886,529.4486084,145.1727905,494.4660339,145.1727905,438.7961426z" />
    </svg>
);

const componentHeaderColor = "#E0BBE4";

const REGEXP_RESULT_STRUCT_NAME = "$RegExpResult";

registerSystemStructure({
    name: REGEXP_RESULT_STRUCT_NAME,
    fields: [
        {
            name: "index",
            type: "integer"
        },
        {
            name: "texts",
            type: "array:string"
        },
        {
            name: "indices",
            type: "array:array:integer"
        }
    ],
    fieldsMap: new Map()
});

registerActionComponents("Dashboard Specific", [
    {
        name: "Regexp",
        icon: regexpIcon,
        componentHeaderColor,
        inputs: [
            {
                name: "next",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ],
        outputs: [
            {
                name: "match",
                type: `struct:${REGEXP_RESULT_STRUCT_NAME}`,
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            {
                name: "done",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ],
        properties: [
            {
                name: "pattern",
                type: "expression",
                valueType: "string"
            },
            {
                name: "text",
                type: "expression",
                valueType: "string"
            },
            {
                name: "global",
                type: "expression",
                valueType: "boolean"
            },
            {
                name: "caseInsensitive",
                type: "expression",
                valueType: "boolean"
            }
        ],
        bodyPropertyName: "pattern",
        defaults: {
            global: "true",
            caseInsensitive: "false"
        },
        migrateProperties: component => {
            if (component.text == undefined) {
                component.text = component.data;
            }
        }
    }
]);

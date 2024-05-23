import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";
import { toJS } from "mobx";
import { JSON_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const componentHeaderColor = "#FFDFD3";

registerActionComponents("Dashboard Specific", [
    {
        name: "JSONParse",
        componentPaletteLabel: "JSONParse",
        icon: JSON_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        defaults: {
            customInputs: [
                {
                    name: "text",
                    type: "string"
                }
            ],
            customOutputs: [
                {
                    name: "result",
                    type: "json"
                }
            ],
            value: "text"
        },
        properties: [
            {
                name: "value",
                type: "expression",
                valueType: "string"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const value = context.evalProperty<string>("value");
            if (value == undefined || typeof value != "string") {
                context.throwError(`Invalid value property`);
                return;
            }

            try {
                context.propagateValue("result", JSON.parse(value));
                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(err.toString());
            }
        }
    },
    {
        name: "JSONStringify",
        componentPaletteLabel: "JSONStringify",
        icon: JSON_ICON as any,
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
        defaults: {
            indentation: "2"
        },
        properties: [
            {
                name: "value",
                type: "expression",
                valueType: "any"
            },
            {
                name: "indentation",
                type: "expression",
                valueType: "integer"
            }
        ],
        bodyPropertyName: "value",
        execute: (context: IDashboardComponentContext) => {
            const value = context.evalProperty("value");
            if (value == undefined) {
                context.throwError(`Invalid value property`);
                return;
            }

            const indentation = context.evalProperty("indentation");

            try {
                const result = JSON.stringify(toJS(value), null, indentation);
                context.propagateValue("result", result);
                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(err.toString());
            }
        }
    }
]);

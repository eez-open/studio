import { stringify } from "csv-stringify";
import * as csvParseModule from "csv-parse";

import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";
import { toJS } from "mobx";
import { CSV_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const componentHeaderColor = "#FFDFD3";

registerActionComponents("Dashboard Specific", [
    {
        name: "CSVParse",
        componentPaletteLabel: "CSVParse",
        icon: CSV_ICON as any,
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
                    type: "any"
                }
            ],
            input: "text",
            delimiter: `","`
        },
        properties: [
            {
                name: "input",
                type: "expression",
                valueType: "string"
            },
            {
                name: "delimiter",
                type: "expression",
                valueType: "string"
            },
            {
                name: "from",
                type: "expression",
                valueType: "integer",
                optional: () => true
            },
            {
                name: "to",
                type: "expression",
                valueType: "integer",
                optional: () => true
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const input = context.evalProperty<string>("input");
            if (input == undefined || typeof input != "string") {
                context.throwError(`Invalid Input property`);
                return;
            }

            const delimiter = context.evalProperty<string>("delimiter");
            if (delimiter == undefined || typeof delimiter != "string") {
                context.throwError(`Invalid Delimiter property`);
                return;
            }

            const from = context.evalProperty<number>("from");
            if (from != undefined && typeof from != "number") {
                context.throwError(`Invalid From property`);
                return;
            }

            const to = context.evalProperty<number>("to");
            if (to != undefined && typeof to != "number") {
                context.throwError(`Invalid To property`);
                return;
            }

            const outputType = context.getOutputType("result");
            if (outputType == undefined) {
                context.throwError(`Result output not found`);
                return;
            }

            if (
                outputType.kind != "array" &&
                !(outputType.kind == "basic" && outputType.valueType == "json")
            ) {
                context.throwError(
                    `Result output type is not an array or json`
                );
                return;
            }

            let columns;
            if (outputType.kind == "array") {
                const elementType = outputType.elementType;

                if (elementType.kind != "object") {
                    context.throwError(
                        `Result output value type is not an array of struct`
                    );
                    return;
                }

                columns = elementType.fields.map(field => field.name);
            }

            try {
                context.startAsyncExecution();

                const { parse } = require("csv-parse") as typeof csvParseModule;

                parse(
                    input,
                    {
                        delimiter,
                        columns,
                        from,
                        to
                    },
                    function (err, records) {
                        if (err) {
                            context.throwError(err.toString());
                            return;
                        }

                        context.propagateValue("result", records);

                        context.endAsyncExecution();
                    }
                );

                context.propagateValueThroughSeqout();
            } catch (err) {
                context.endAsyncExecution();
                context.throwError(err.toString());
            }
        }
    },
    {
        name: "CSVStringify",
        componentPaletteLabel: "CSVStringify",
        icon: CSV_ICON as any,
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
            customInputs: [
                {
                    name: "input",
                    type: "string"
                }
            ],
            input: "input",
            delimiter: `","`,
            header: "true",
            quoted: "true"
        },
        properties: [
            {
                name: "input",
                type: "expression",
                valueType: "any"
            },
            {
                name: "delimiter",
                type: "expression",
                valueType: "string"
            },
            {
                name: "header",
                type: "expression",
                valueType: "boolean"
            },
            {
                name: "quoted",
                type: "expression",
                valueType: "boolean"
            }
        ],
        bodyPropertyName: "input",
        execute: (context: IDashboardComponentContext) => {
            const input = context.evalProperty("input");
            if (input == undefined) {
                context.throwError(`Invalid Input property`);
                return;
            }

            const delimiter = context.evalProperty<string>("delimiter");
            if (delimiter == undefined || typeof delimiter != "string") {
                context.throwError(`Invalid Delimiter property`);
                return;
            }

            const header = context.evalProperty("header");
            const quoted = context.evalProperty("quoted");

            try {
                context.startAsyncExecution();

                stringify(
                    toJS(input),
                    {
                        delimiter,
                        header: !!header,
                        quoted: !!quoted
                    },
                    function (err, str) {
                        context.endAsyncExecution();

                        if (err) {
                            context.throwError(err.toString());
                            return;
                        }

                        context.propagateValue("result", str);
                    }
                );

                context.propagateValueThroughSeqout();
            } catch (err) {
                context.endAsyncExecution();
                context.throwError(err.toString());
            }
        }
    }
]);

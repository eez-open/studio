import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";
import { DashboardComponentContext } from "project-editor/flow/runtime/worker-dashboard-component-context";
import { TABULATOR_ICON } from "project-editor/ui-components/icons";
import type { TabulatorExecutionState } from "project-editor/flow/components/widgets/dashboard/tabulator";
import { humanize } from "eez-studio-shared/string";

const componentHeaderColor = "#DEB887";

registerActionComponents("GUI", [
    {
        name: "TabulatorAction",
        icon: TABULATOR_ICON as any,
        componentHeaderColor,
        inputs: [],
        outputs: (...props: string[]) =>
            props[1] == "getSheetData"
                ? [
                      {
                          name: "data",
                          type: "json",
                          isSequenceOutput: false,
                          isOptionalOutput: false
                      }
                  ]
                : [],
        properties: [
            {
                name: "widget",
                type: "expression",
                valueType: "widget"
            },
            {
                name: "tabulatorAction",
                type: "enum",
                enumItems: [
                    {
                        id: "getSheetData"
                    },
                    {
                        id: "download"
                    }
                ]
            },
            {
                name: "lookup",
                type: "expression",
                valueType: "string",
                disabled: (...props: string[]) => props[1] != "getSheetData",
                optional: () => true
            },
            {
                name: "fileName",
                type: "expression",
                valueType: "string",
                optional: () => true
            },
            {
                name: "downloadType",
                type: "enum",
                enumItems: [
                    {
                        id: "csv",
                        label: "CSV"
                    },
                    {
                        id: "json",
                        label: "JSON"
                    },
                    {
                        id: "html",
                        label: "HTML"
                    }
                ],
                disabled: (...props: string[]) => props[1] != "download"
            }
        ],
        defaults: {
            tabulatorAction: "download",
            downloadType: "csv"
        },
        bodyPropertyCallback: (...props: string[]) => {
            return (
                humanize(props[1]) +
                (props[1] == "download" ? `: ${props[4]}` : "")
            );
        },
        execute: (context: IDashboardComponentContext) => {
            const widget = context.evalProperty<number>("widget");
            if (widget == undefined) {
                context.throwError(`Invalid Widget property`);
                return;
            }

            const widgetInfo =
                context.WasmFlowRuntime.getWidgetHandleInfo(widget);

            if (!widgetInfo) {
                context.throwError(`Invalid Widget handle`);
                return;
            }

            const widgetContext = new DashboardComponentContext(
                context.WasmFlowRuntime,
                widgetInfo.flowStateIndex,
                widgetInfo.componentIndex
            );

            const executionState =
                widgetContext.getComponentExecutionState<TabulatorExecutionState>();

            if (!executionState) {
                context.throwError(`Widget not initialized`);
                return;
            }

            const tabulatorAction = context.getStringParam(0);

            if (tabulatorAction == "getSheetData") {
                const lookup = context.evalProperty<string>("lookup");
                if (lookup != undefined && typeof lookup != "string") {
                    context.throwError(
                        `Invalid Lookup property value, should be string or empty`
                    );
                }

                if (!executionState.getSheetData) {
                    context.throwError(`Widget doesn't support getSheetData`);
                    return;
                }

                const data = executionState.getSheetData(lookup ?? "");

                context.propagateValue("data", data);
            } else if (tabulatorAction == "download") {
                const fileName = context.evalProperty<string>("fileName");
                if (fileName == undefined) {
                    context.throwError(`Invalid File name property`);
                    return;
                }

                const downloadType = context.getStringParam(4);

                if (!executionState.download) {
                    context.throwError(`Widget doesn't support download`);
                    return;
                }

                executionState.download(
                    downloadType as any,
                    fileName,
                    downloadType == "html" ? { style: true } : undefined,
                    undefined
                );
            }

            context.propagateValueThroughSeqout();
        }
    }
]);

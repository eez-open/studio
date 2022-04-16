import type { IDashboardComponentContext } from "eez-studio-types";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";
import { Duplex, Readable } from "stream";

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "LineChartWidget",
    function (context: IDashboardComponentContext) {
        const xValue = context.evalProperty("xValue");
        const labels = context.getExpressionListParam(0);
        const values = context.getExpressionListParam(8);
        context.sendMessageToComponent({
            xValue,
            labels,
            values
        });
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "GaugeWidget",
    function (context: IDashboardComponentContext) {}
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "TextInputWidget",
    function (context: IDashboardComponentContext) {}
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "CheckboxWidget",
    function (context: IDashboardComponentContext) {}
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "TerminalWidget",
    function (context: IDashboardComponentContext) {
        const data = context.evalProperty("data");

        if (typeof data === "string" && data.length > 0) {
            context.sendMessageToComponent(data);
        } else if (data instanceof Readable || data instanceof Duplex) {
            data.on("data", (chunk: Buffer) => {
                context.sendMessageToComponent(chunk.toString());
            });
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "MarkdownWidget",
    function (context: IDashboardComponentContext) {}
);

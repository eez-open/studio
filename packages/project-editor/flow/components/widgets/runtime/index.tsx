import type { IDashboardComponentContext } from "eez-studio-types";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";
import { Duplex, Readable } from "stream";

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "LineChartWidget",
    function (context: IDashboardComponentContext) {
        const data = context.evalProperty("data");
        context.sendMessageToComponent(data);
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "GaugeWidget",
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

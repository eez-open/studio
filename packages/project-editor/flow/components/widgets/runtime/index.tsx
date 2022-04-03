import type { IDashboardComponentContext } from "eez-studio-types";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";

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

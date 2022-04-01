import type { DashboardComponentContext } from "project-editor/flow/runtime/wasm-worker";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "LineChartWidget",
    function (context: DashboardComponentContext) {
        const data = context.evalProperty("data");
        context.sendMessageToWidget(data);
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "GaugeWidget",
    function (context: DashboardComponentContext) {}
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "CheckboxWidget",
    function (context: DashboardComponentContext) {}
);

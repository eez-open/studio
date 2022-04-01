import type { DashboardComponentContext } from "project-editor/flow/runtime/wasm-worker";
import type { WorkerToRenderMessage } from "project-editor/flow/runtime/wasm-worker-interfaces";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "EvalJSExprActionComponent",
    function (context: DashboardComponentContext) {
        const expression = context.getStringParam(0);
        const expressionValues = context.getExpressionListParam(4);

        const values: any = {};
        for (let i = 0; i < expressionValues.length; i++) {
            const name = `_val${i}`;
            values[name] = expressionValues[i];
        }

        try {
            let result = eval(expression);

            context.propagateValue("result", result);
            context.propagateValueThroughSeqout();
        } catch (err) {
            console.info(
                "Error in EvalJSExprActionComponent_execute",
                err.toString()
            );
            context.throwError(err.toString());
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "DateNowActionComponent",
    function (context: DashboardComponentContext) {
        context.propagateValue("value", Date.now());
        context.propagateValueThroughSeqout();
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "DynamicCallActionActionComponent",
    function (context: DashboardComponentContext) {
        const actionName = context.evalProperty<string>(0, ["string"]);

        if (actionName == undefined || typeof actionName != "string") {
            context.throwError(`Invalid action name property`);
            return;
        }

        const flowIndex =
            WasmFlowRuntime.assetsMap.actionFlowIndexes[actionName];
        if (flowIndex == undefined) {
            context.throwError(`Invalid action name: ${actionName}`);
        }

        context.executeCallAction(flowIndex);
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "ConnectInstrumentActionComponent",
    function (context: DashboardComponentContext) {
        interface InstrumentVariableTypeConstructorParams {
            id: string;
        }

        const instrument =
            context.evalProperty<InstrumentVariableTypeConstructorParams>(0, [
                "object:Instrument"
            ]);

        if (instrument == undefined || typeof instrument.id != "string") {
            context.throwError(`Invalid instrument property`);
            return;
        }

        const data: WorkerToRenderMessage = {
            connectToInstrumentId: instrument.id
        };

        postMessage(data);

        context.propagateValueThroughSeqout();
    }
);

registerExecuteFunction(
    "ExecuteCommand",
    function (context: DashboardComponentContext) {
        context.propagateValue("finished", null);
    }
);

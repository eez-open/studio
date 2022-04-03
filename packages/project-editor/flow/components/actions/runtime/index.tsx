import type { IDashboardComponentContext } from "eez-studio-types";
import type { WorkerToRenderMessage } from "project-editor/flow/runtime/wasm-worker-interfaces";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "EvalJSExprActionComponent",
    function (context: IDashboardComponentContext) {
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
    function (context: IDashboardComponentContext) {
        context.propagateValue("value", Date.now());
        context.propagateValueThroughSeqout();
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "DynamicCallActionActionComponent",
    function (context: IDashboardComponentContext) {
        const actionName = context.evalProperty<string>("data");

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
    function (context: IDashboardComponentContext) {
        interface InstrumentVariableTypeConstructorParams {
            id: string;
        }

        const instrument =
            context.evalProperty<InstrumentVariableTypeConstructorParams>(
                "instrument"
            );

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

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "ExecuteCommand",
    function (context: IDashboardComponentContext) {
        context.propagateValue("finished", null);
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "FileRead",
    function (context: IDashboardComponentContext) {
        const filePathValue = context.evalProperty<string>("filePath");
        if (typeof filePathValue != "string") {
            context.throwError("filePath is not a string");
        }

        const encodingValue = context.evalProperty("encoding");
        if (typeof encodingValue != "string") {
            context.throwError("encoding is not a string");
        }

        const encodings = [
            "ascii",
            "base64",
            "hex",
            "ucs2",
            "ucs-2",
            "utf16le",
            "utf-16le",
            "utf8",
            "utf-8",
            "binary",
            "latin1"
        ];
        if (encodings.indexOf(encodingValue) == -1) {
            context.throwError(
                `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                    ", "
                )}`
            );
        }

        context = context.startAsyncExecution();

        (async function () {
            try {
                const fs = await import("fs");
                const content = await fs.promises.readFile(
                    filePathValue as string,
                    encodingValue as any
                );
                context.propagateValue("content", content);
                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(err.toString());
            } finally {
                context.endAsyncExecution();
            }
        })();
    }
);

registerExecuteFunction(
    "FileWrite",
    function (context: IDashboardComponentContext) {
        const filePathValue = context.evalProperty("filePath");
        if (typeof filePathValue != "string") {
            context.throwError("filePath is not a string");
        }

        const encodingValue = context.evalProperty("encoding");
        if (typeof encodingValue != "string") {
            context.throwError("${encoding} is not a string");
        }

        const encodings = [
            "ascii",
            "base64",
            "hex",
            "ucs2",
            "ucs-2",
            "utf16le",
            "utf-16le",
            "utf8",
            "utf-8",
            "binary",
            "latin1"
        ];
        if (encodings.indexOf(encodingValue) == -1) {
            context.throwError(
                `Unsupported encoding value ${encodingValue}, supported: ${encodings.join(
                    ", "
                )}`
            );
        }

        const contentValue = context.evalProperty("content");

        context = context.startAsyncExecution();

        (async function () {
            try {
                const fs = await import("fs");
                await fs.promises.writeFile(
                    filePathValue,
                    contentValue,
                    encodingValue as any
                );
                context.propagateValueThroughSeqout();
            } catch (err) {
                context.throwError(err.toString());
            } finally {
                context.endAsyncExecution();
            }
        })();

        return undefined;
    }
);

registerExecuteFunction(
    "FileSaveDialog",
    function (context: IDashboardComponentContext) {
        const fileNameValue = context.evalProperty("fileName");
        if (fileNameValue && typeof fileNameValue != "string") {
            context.throwError("fileName is not a string");
        }

        context = context.startAsyncExecution();

        context.sendMessageToComponent(fileNameValue, result => {
            if (!result.canceled) {
                context.propagateValue("file_path", result.filePath);
            }
            context.propagateValueThroughSeqout();
            context.endAsyncExecution();
        });
    }
);

registerExecuteFunction(
    "ShowFileInFolder",
    function (context: IDashboardComponentContext) {
        const filePathValue = context.evalProperty("filePath");
        if (typeof filePathValue != "string") {
            context.throwError("filePathValue is not a string");
        }

        context.sendMessageToComponent(filePathValue);
        context.propagateValueThroughSeqout();
    }
);

////////////////////////////////////////////////////////////////////////////////

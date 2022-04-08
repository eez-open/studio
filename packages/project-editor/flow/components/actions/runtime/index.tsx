import type { IDashboardComponentContext } from "eez-studio-types";
import type { WorkerToRenderMessage } from "project-editor/flow/runtime/wasm-worker-interfaces";

import { registerExecuteFunction } from "project-editor/flow/runtime/wasm-execute-functions";
import { Duplex, Readable, Stream, Writable } from "stream";

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
        const actionName = context.evalProperty<string>("action");

        if (actionName == undefined || typeof actionName != "string") {
            context.throwError(`Invalid action name property`);
            return;
        }

        const flowIndex =
            WasmFlowRuntime.assetsMap.actionFlowIndexes[actionName];
        if (flowIndex == undefined) {
            context.throwError(`Invalid action name: ${actionName}`);
            return;
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
    "FileRead",
    function (context: IDashboardComponentContext) {
        const filePathValue = context.evalProperty<string>("filePath");
        if (typeof filePathValue != "string") {
            context.throwError("filePath is not a string");
            return;
        }

        const encodingValue = context.evalProperty("encoding");
        if (typeof encodingValue != "string") {
            context.throwError("encoding is not a string");
            return;
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
            return;
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
            return;
        }

        const encodingValue = context.evalProperty("encoding");
        if (typeof encodingValue != "string") {
            context.throwError("${encoding} is not a string");
            return;
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
            return;
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
            return;
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
            return;
        }

        context.sendMessageToComponent(filePathValue);
        context.propagateValueThroughSeqout();
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "SerialConnect",
    function (context: IDashboardComponentContext) {
        const serialConnection = context.evalProperty("connection");
        if (!serialConnection) {
            context.throwError(`invalid connection`);
            return;
        }

        context = context.startAsyncExecution();

        context.sendMessageToComponent(serialConnection, result => {
            if (result.serialConnectionId != undefined) {
                if (result.serialConnectionId != serialConnection.id) {
                    try {
                        context.setPropertyField(
                            "connection",
                            "id",
                            result.serialConnectionId
                        );
                        context.propagateValueThroughSeqout();
                    } catch (err) {
                        context.throwError(err.toString());
                    }
                }
            } else {
                context.throwError(result.error);
            }
            context.endAsyncExecution();
        });
    }
);

registerExecuteFunction(
    "SerialDisconnect",
    function (context: IDashboardComponentContext) {
        const serialConnection = context.evalProperty("connection");
        if (!serialConnection) {
            context.throwError(`invalid connection`);
            return;
        }

        context = context.startAsyncExecution();

        context.sendMessageToComponent(serialConnection, result => {
            if (result) {
                context.throwError(result);
            } else {
                context.propagateValueThroughSeqout();
            }
            context.endAsyncExecution();
        });
    }
);

registerExecuteFunction(
    "SerialRead",
    function (context: IDashboardComponentContext) {
        const serialConnection = context.evalProperty("connection");
        if (!serialConnection) {
            context.throwError(`invalid connection`);
            return;
        }

        context = context.startAsyncExecution();

        const readableStream = new Stream.Readable();
        readableStream._read = () => {};

        context.propagateValue("data", readableStream);

        context.sendMessageToComponent(serialConnection, result => {
            if (result && result.error) {
                context.throwError(result.error);
                context.endAsyncExecution();
            } else {
                if (result.data) {
                    readableStream.push(result.data);
                } else {
                    readableStream.destroy();
                    context.endAsyncExecution();
                }
            }
        });
    }
);

registerExecuteFunction(
    "SerialWrite",
    function (context: IDashboardComponentContext) {
        const serialConnection = context.evalProperty("connection");
        if (!serialConnection) {
            context.throwError(`invalid connection`);
            return;
        }

        const data = context.evalProperty("data");

        context = context.startAsyncExecution();

        context.sendMessageToComponent(
            {
                serialConnection,
                data
            },
            result => {
                if (result) {
                    context.throwError(result);
                } else {
                    context.propagateValueThroughSeqout();
                }
                context.endAsyncExecution();
            }
        );
    }
);

registerExecuteFunction(
    "SerialListPorts",
    function (context: IDashboardComponentContext) {
        context = context.startAsyncExecution();

        context.sendMessageToComponent(undefined, result => {
            if (result.ports) {
                context.propagateValue("ports", result.ports);
                context.propagateValueThroughSeqout();
            } else {
                context.throwError(result.error);
            }
            context.endAsyncExecution();
        });
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "ExecuteCommand",
    async function (context: IDashboardComponentContext) {
        const commandValue: any = context.evalProperty("command");
        if (typeof commandValue != "string") {
            context.throwError("command is not a string");
            return;
        }
        const argsValue: any = context.evalProperty("arguments");
        if (!Array.isArray(argsValue)) {
            context.throwError("arguments is not an array");
            return;
        }

        const i = argsValue.findIndex((arg: any) => typeof arg != "string");
        if (i != -1) {
            context.throwError(`argument at position ${i + 1} is not a string`);
            return;
        }

        context = context.startAsyncExecution();

        try {
            const { spawn } = await import("child_process");

            let process = spawn(commandValue, argsValue);
            let processFinished = false;

            context.propagateValue("stdout", process.stdout);
            context.propagateValue("stderr", process.stderr);

            process.on("exit", code => {
                if (!processFinished) {
                    context.propagateValue("finished", code);
                    context.endAsyncExecution();
                    processFinished = true;
                }
            });

            process.on("error", err => {
                if (!processFinished) {
                    context.throwError(err.toString());
                    context.endAsyncExecution();
                }
            });

            context.propagateValueThroughSeqout();
        } catch (err) {
            context.throwError(`argument at position ${i + 1} is not a string`);
        } finally {
            context.endAsyncExecution();
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "CollectStream",
    function (context: IDashboardComponentContext) {
        const streamValue = context.evalProperty("stream");

        if (streamValue) {
            if (
                streamValue instanceof Readable ||
                streamValue instanceof Duplex
            ) {
                let accData = "";

                context.startAsyncExecution();

                streamValue.on("data", (data: Buffer) => {
                    accData += data.toString();
                    context.propagateValue("data", accData);
                });

                streamValue.on("end", (data: Buffer) => {
                    context.propagateValueThroughSeqout();
                    context.endAsyncExecution();
                });
            } else {
                //context.throwError("not a readable stream");
            }
        }

        return undefined;
    }
);

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "Regexp",
    function (context: IDashboardComponentContext) {
        const runningState =
            context.getComponentExecutionState<RegexpExecutionState>();

        if (!runningState) {
            const patternValue: any = context.evalProperty("pattern");
            if (typeof patternValue != "string") {
                context.throwError("pattern is not a string");
                return;
            }

            const re = new RegExp(patternValue, "gm");

            const dataValue: any = context.evalProperty("data");
            if (typeof dataValue == "string") {
                const m = re.exec(dataValue);
                if (m) {
                    context.propagateValue("match", m);
                }
                context.propagateValue("done", null);
            } else if (
                dataValue instanceof Readable ||
                dataValue instanceof Duplex
            ) {
                context.setComponentExecutionState(
                    new RegexpExecutionState(context, re, dataValue)
                );
            } else {
                context.throwError("data is not a string or stream");
            }
        } else {
            runningState.getNext();
        }
    }
);

class RegexpExecutionState {
    private propagate = true;
    private isDone = false;
    private matches: RegExpMatchArray[] = [];

    constructor(
        private context: IDashboardComponentContext,
        re: RegExp,
        dataValue: Readable
    ) {
        const streamSnitch = new StreamSnitch(
            re,
            (m: RegExpMatchArray) => {
                if (this.propagate) {
                    context.propagateValue("match", m);
                    this.propagate = false;
                } else {
                    this.matches.push(m);
                }
            },
            () => {
                if (this.propagate) {
                    context.propagateValue("done", null);
                    this.context.setComponentExecutionState(undefined);
                    this.propagate = false;
                }
                this.isDone = true;
            }
        );

        dataValue.pipe(streamSnitch);
        dataValue.on("close", () => {
            streamSnitch.destroy();
        });
    }

    getNext() {
        if (this.matches.length > 0) {
            this.context.propagateValue("match", this.matches.shift());
        } else if (this.isDone) {
            this.context.propagateValue("done", null);
            this.context.setComponentExecutionState(undefined);
        } else {
            this.propagate = true;
        }
    }
}

class StreamSnitch extends Writable {
    _buffer = "";
    bufferCap = 1048576;

    constructor(
        public regex: RegExp,
        private onDataCallback: (m: RegExpMatchArray) => void,
        onCloseCallback: () => void
    ) {
        super({
            decodeStrings: false
        });

        this.on("close", onCloseCallback);
    }

    async _write(chunk: any, encoding: any, cb: any) {
        let match;
        let lastMatch;

        if (Buffer.byteLength(this._buffer) > this.bufferCap)
            this.clearBuffer();

        this._buffer += chunk;

        while ((match = this.regex.exec(this._buffer))) {
            this.onDataCallback(match);

            lastMatch = match;

            if (!this.regex.global) {
                break;
            }
        }

        if (lastMatch) {
            this._buffer = this._buffer.slice(
                lastMatch.index + lastMatch[0].length
            );
        }

        // if (this.regex.multiline) {
        //     this._buffer = this._buffer.slice(this._buffer.lastIndexOf("\n"));
        // }

        cb();
    }

    clearBuffer() {
        this._buffer = "";
    }
}

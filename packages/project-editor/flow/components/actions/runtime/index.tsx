import { tmpdir } from "os";
import { sep } from "path";
import { writeFileSync, unlinkSync } from "fs";
import { PythonShell, Options } from "python-shell";
import { PassThrough } from "stream";
import { spawn } from "child_process";

import type {
    IDashboardComponentContext,
    IWasmFlowRuntime
} from "eez-studio-types";
import type { WorkerToRenderMessage } from "project-editor/flow/runtime/wasm-worker-interfaces";

import {
    registerExecuteFunction,
    onWasmFlowRuntimeTerminate
} from "project-editor/flow/runtime/wasm-execute-functions";
import { Duplex, Readable, Stream, Writable } from "stream";
import { toJS } from "mobx";

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
            context.WasmFlowRuntime.assetsMap.actionFlowIndexes[actionName];
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

        context.WasmFlowRuntime.postWorkerToRendererMessage(data);

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
    "FileAppend",
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
                await fs.promises.appendFile(
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
    "FileOpenDialog",
    function (context: IDashboardComponentContext) {
        context = context.startAsyncExecution();

        context.sendMessageToComponent(undefined, result => {
            if (!result.canceled) {
                context.propagateValue("file_path", result.filePath);
            }
            context.propagateValueThroughSeqout();
            context.endAsyncExecution();
        });
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
            let processFinished = false;

            let childProcess = spawn(commandValue, argsValue);

            const passThroughStdout = new PassThrough();
            childProcess.stdout.pipe(passThroughStdout);
            context.propagateValue("stdout", passThroughStdout);

            const passThroughStderr = new PassThrough();
            childProcess.stderr.pipe(passThroughStderr);
            context.propagateValue("stderr", passThroughStderr);

            childProcess.on("exit", code => {
                if (!processFinished) {
                    context.propagateValue("finished", code);
                    context.endAsyncExecution();
                    processFinished = true;
                }
            });

            childProcess.on("error", err => {
                if (!processFinished) {
                    context.throwError(err.toString());
                    context.endAsyncExecution();
                    processFinished = true;
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
        let runningState: RegexpExecutionState | undefined;
        if (context.getInputValue("@seqin") !== undefined) {
            context.setComponentExecutionState(undefined);
            runningState = undefined;
        } else {
            runningState =
                context.getComponentExecutionState<RegexpExecutionState>();
            if (!runningState) {
                context.throwError("Never started");
            }
        }

        if (!runningState) {
            const patternValue: any = context.evalProperty("pattern");
            if (typeof patternValue != "string") {
                context.throwError("pattern is not a string");
                return;
            }

            const global: any = context.evalProperty("global");
            if (typeof global != "boolean") {
                context.throwError("Global is not a boolean");
                return;
            }

            const caseInsensitive: any =
                context.evalProperty("caseInsensitive");
            if (typeof caseInsensitive != "boolean") {
                context.throwError("Case insensitive is not a boolean");
                return;
            }

            const re = new RegExp(
                patternValue,
                "md" + (global ? "g" : "") + (caseInsensitive ? "i" : "")
            );

            const textValue: any = context.evalProperty("text");
            if (typeof textValue == "string") {
                context.setComponentExecutionState(
                    new RegexpExecutionStateForString(context, re, textValue)
                );
            } else if (textValue instanceof Readable) {
                context.setComponentExecutionState(
                    new RegexpExecutionStateForStream(context, re, textValue)
                );
            } else {
                context.throwError("text is not a string or readable stream");
            }
        } else {
            runningState.getNext();
        }
    }
);

abstract class RegexpExecutionState {
    abstract getNext(): void;
}

function getMatchStruct(m: RegExpExecArray) {
    return {
        index: m.index,
        texts: m.map(x => x),
        indices: (m as any).indices.map((a: any) => a.map((x: any) => x))
    };
}

class RegexpExecutionStateForString extends RegexpExecutionState {
    done: boolean = false;

    constructor(
        private context: IDashboardComponentContext,
        private re: RegExp,
        private text: string
    ) {
        super();

        this.getNext();
    }

    getNext() {
        let m: RegExpExecArray | null;

        if (!this.done && (m = this.re.exec(this.text)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === this.re.lastIndex) {
                this.re.lastIndex++;
            }

            this.context.propagateValue("match", getMatchStruct(m));

            if (!this.re.global) {
                this.done = true;
            }
        } else {
            this.context.propagateValue("done", null);
            this.context.setComponentExecutionState(undefined);
        }
    }
}

class RegexpExecutionStateForStream extends RegexpExecutionState {
    private propagate = true;
    private isDone = false;
    private matches: RegExpExecArray[] = [];

    constructor(
        private context: IDashboardComponentContext,
        re: RegExp,
        stream: Readable
    ) {
        super();

        const streamSnitch = new StreamSnitch(
            re,
            (m: RegExpExecArray) => {
                if (this.propagate) {
                    this.context.propagateValue("match", getMatchStruct(m));
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
        stream.pipe(streamSnitch);
        stream.on("close", () => {
            streamSnitch.destroy();
        });
    }

    getNext() {
        if (this.matches.length > 0) {
            const m = this.matches.shift();
            this.context.propagateValue("match", getMatchStruct(m!));
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

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction("HTTP", function (context: IDashboardComponentContext) {
    const method = context.getStringParam(0);

    const url = context.evalProperty<string>("url");
    if (url == undefined || typeof url != "string") {
        context.throwError(`Invalid URL property`);
        return;
    }

    const headers = new Headers();
    const numHeaders = context.getListParamSize(4);
    for (let i = 0; i < numHeaders; i++) {
        const name = context.evalListParamElementExpression<string>(
            4,
            i,
            0,
            `Failed to evaluate ${i + 1}. header name`
        );

        const value = context.evalListParamElementExpression<string>(
            4,
            i,
            4,
            `Failed to evaluate ${i + 1}. header value`
        );

        if (name && value) {
            headers.append(name, value);
        }
    }

    let body;
    if (method == "post" || method == "put" || method == "patch") {
        body = context.evalProperty<string>("body");
        if (body && typeof body != "string") {
            context.throwError(`Body is not a string`);
            return;
        }
    }
    context = context.startAsyncExecution();

    (async function () {
        try {
            const response = await fetch(url, {
                method: method.toUpperCase(),
                headers,
                body
            });
            if (!response.ok) {
                context.throwError(
                    "Failed: " +
                        (response.statusText || response.status.toString())
                );
            } else {
                context.propagateValue("status", response.status);
                const result = await response.text();
                context.propagateValue("result", result);
                context.propagateValueThroughSeqout();
            }
        } catch (err) {
            context.throwError(err.toString());
        } finally {
            context.endAsyncExecution();
        }
    })();
});

////////////////////////////////////////////////////////////////////////////////

registerExecuteFunction(
    "JSONParse",
    function (context: IDashboardComponentContext) {
        const value = context.evalProperty<string>("value");
        if (value == undefined || typeof value != "string") {
            context.throwError(`Invalid value property`);
            return;
        }

        try {
            const result = JSON.parse(value);
            context.propagateValue("result", result);
            context.propagateValueThroughSeqout();
        } catch (err) {
            context.throwError(err.toString());
        }
    }
);

registerExecuteFunction(
    "JSONStringify",
    function (context: IDashboardComponentContext) {
        const value = context.evalProperty("value");
        if (value == undefined) {
            context.throwError(`Invalid value property`);
            return;
        }

        try {
            const result = JSON.stringify(toJS(value));
            context.propagateValue("result", result);
            context.propagateValueThroughSeqout();
        } catch (err) {
            context.throwError(err.toString());
        }
    }
);

////////////////////////////////////////////////////////////////////////////////
// Python components

const handleToPythonShell = new Map<
    number,
    {
        wasmFlowRuntime: IWasmFlowRuntime;
        wasmFlowRuntimeTerminated: boolean;
        pythonShell: PythonShell;
    }
>();
let lastPythonShellHandle = 0;

function getNextPythonShellHandle() {
    return lastPythonShellHandle + 1;
}

function addPythonShell(
    wasmFlowRuntime: IWasmFlowRuntime,
    pythonShell: PythonShell
) {
    lastPythonShellHandle = getNextPythonShellHandle();

    handleToPythonShell.set(lastPythonShellHandle, {
        wasmFlowRuntime,
        wasmFlowRuntimeTerminated: false,
        pythonShell
    });

    return lastPythonShellHandle;
}

function getPythonShell(handle: number) {
    return (
        handleToPythonShell.get(handle) || {
            pythonShell: undefined,
            wasmFlowRuntime: undefined,
            wasmFlowRuntimeTerminated: true
        }
    );
}

function removePythonShell(handle: number) {
    handleToPythonShell.delete(handle);
}

onWasmFlowRuntimeTerminate((wasmFlowRuntime: IWasmFlowRuntime) => {
    for (const item of handleToPythonShell) {
        if (item[1].wasmFlowRuntime == wasmFlowRuntime) {
            item[1].wasmFlowRuntimeTerminated = true;
            item[1].pythonShell.end(() => {});
        }
    }
});

registerExecuteFunction(
    "PythonRun",
    function (context: IDashboardComponentContext) {
        const scriptSourceOption = context.getStringParam(0);

        let scriptSource;
        let isInlineScript: boolean;
        if (scriptSourceOption == "inline-script") {
            scriptSource = context.getStringParam(4);
            isInlineScript = true;
        } else if (scriptSourceOption == "inline-script-as-expression") {
            scriptSource = context.evalProperty<string>(
                "scriptSourceInlineFromExpression"
            );
            isInlineScript = true;
        } else {
            scriptSource = context.evalProperty<string>("scriptSourceFile");
            isInlineScript = false;
        }

        if (scriptSource == undefined) {
            context.throwError(`Invalid script source`);
            return;
        }

        const handle = getNextPythonShellHandle();

        let scriptFilePath: string;
        if (isInlineScript) {
            scriptFilePath =
                tmpdir() + sep + `eez-runtime-python-script-${handle}.py`;
            writeFileSync(scriptFilePath, scriptSource);
        } else {
            scriptFilePath = scriptSource;
        }

        const options: Options = {
            pythonPath: context.evalProperty<string>("pythonPath")
        };
        const pythonShell = new PythonShell(scriptFilePath, options);
        addPythonShell(context.WasmFlowRuntime, pythonShell);

        pythonShell.on("message", message => {
            const { wasmFlowRuntimeTerminated } = getPythonShell(handle);
            if (!wasmFlowRuntimeTerminated) {
                context.propagateValue("message", message);
            }
        });

        let wasError = false;

        function cleanup() {
            removePythonShell(handle);

            if (isInlineScript) {
                unlinkSync(scriptFilePath);
            }
        }

        pythonShell.on("close", () => {
            if (!wasError) {
                const { wasmFlowRuntimeTerminated } = getPythonShell(handle);

                if (!wasmFlowRuntimeTerminated) {
                    context.propagateValueThroughSeqout();
                }

                cleanup();
            }
        });

        pythonShell.on("pythonError", err => {
            wasError = true;

            const { wasmFlowRuntimeTerminated } = getPythonShell(handle);
            if (!wasmFlowRuntimeTerminated) {
                context.throwError(err.toString());
            }

            cleanup();
        });

        pythonShell.on("error", err => {
            wasError = true;

            const { wasmFlowRuntimeTerminated } = getPythonShell(handle);
            if (!wasmFlowRuntimeTerminated) {
                context.throwError(err.toString());
            }

            cleanup();
        });

        context.propagateValue("handle", handle);
    }
);

registerExecuteFunction(
    "PythonSendMessage",
    function (context: IDashboardComponentContext) {
        const handle = context.evalProperty<number>("handle");
        if (!handle) {
            context.throwError(`Handle not defined`);
            return;
        }
        const { pythonShell } = getPythonShell(handle);
        if (!pythonShell) {
            context.throwError(`Invalid handle ` + handle);
            return;
        }

        const message = context.evalProperty<string>("message");
        if (!message) {
            context.throwError(`Message not defined`);
            return;
        }

        pythonShell.send(message.toString());

        context.propagateValueThroughSeqout();
    }
);

registerExecuteFunction(
    "PythonEnd",
    function (context: IDashboardComponentContext) {
        const handle = context.evalProperty<number>("handle");
        if (!handle) {
            context.throwError(`Handle not defined`);
            return;
        }
        const { pythonShell } = getPythonShell(handle);
        if (!pythonShell) {
            context.throwError(`Invalid handle ` + handle);
            return;
        }

        pythonShell.end(() => {
            context.propagateValueThroughSeqout();
        });
    }
);

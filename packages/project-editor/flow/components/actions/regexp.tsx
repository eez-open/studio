import React from "react";

import { registerActionComponents } from "project-editor/flow/component";

import { Readable, Writable, Duplex } from "stream";
import { ValueType } from "project-editor/features/variable/value-type";
import { IComponentFlowState } from "eez-studio-types";

////////////////////////////////////////////////////////////////////////////////

const regexpIcon: any = (
    <svg viewBox="0 0 512 512">
        <path d="M309.677124,349.2086182V230.9143524l-97.4385986,59.7092743l-34.350647-59.8398743l101.6825867-55.6431732l-101.6825867-56.4703445l34.5251465-58.7483673l97.2640991,59.4459915V0.6174708h69.4211121v118.7503891l98.1610413-59.4459915L512,118.6702347l-102.1397705,56.4703445L512,230.7837524l-34.877594,60.111908l-98.0241699-59.981308v118.2942657H309.677124z M145.1727905,438.7961426c0-55.6698914-60.6798172-90.6524658-108.961525-62.8175354c-48.2816963,27.8349609-48.2816849,97.8001099,0.0000191,125.6350708C84.4929886,529.4486084,145.1727905,494.4660339,145.1727905,438.7961426z" />
    </svg>
);

const componentHeaderColor = "#E0BBE4";

registerActionComponents("Dashboard Specific", [
    {
        name: "Regexp",
        icon: regexpIcon,
        componentHeaderColor,
        inputs: [
            {
                name: "next",
                type: "null" as ValueType,
                isSequenceInput: true,
                isOptionalInput: false
            }
        ],
        outputs: [
            {
                name: "match",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            },
            {
                name: "done",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: true
            }
        ],
        properties: [
            {
                name: "pattern",
                type: "expression",
                valueType: "string"
            },
            {
                name: "data",
                type: "expression",
                valueType: "string"
            }
        ],
        bodyPropertyName: "pattern",
        execute: async (flowState, pattern, data) => {
            const runningState =
                flowState.getComponentRunningState<RegexpRunningState>();

            if (!runningState) {
                const patternValue: any = flowState.evalExpression(pattern);
                if (typeof patternValue != "string") {
                    throw "pattern is not a string";
                }

                const re = new RegExp(patternValue, "gm");

                const dataValue: any = flowState.evalExpression(data);
                if (typeof dataValue == "string") {
                    const m = re.exec(dataValue);
                    if (m) {
                        flowState.propagateValue("match", m);
                    }
                    flowState.propagateValue("done", null);
                } else if (
                    dataValue instanceof Readable ||
                    dataValue instanceof Duplex
                ) {
                    flowState.setComponentRunningState(
                        new RegexpRunningState(flowState, re, dataValue)
                    );
                } else {
                    throw "data is not a string or stream";
                }
            } else {
                runningState.getNext();
            }

            return undefined;
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

class RegexpRunningState {
    propagate = true;
    isDone = false;
    matches: RegExpMatchArray[] = [];

    constructor(
        private flowState: IComponentFlowState,
        re: RegExp,
        dataValue: any
    ) {
        const streamSnitch = new StreamSnitch(
            re,
            (m: RegExpMatchArray) => {
                if (this.propagate) {
                    flowState.propagateValue("match", m);
                    this.propagate = false;
                } else {
                    this.matches.push(m);
                }
            },
            () => {
                if (this.propagate) {
                    flowState.propagateValue("done", null);
                    this.propagate = false;
                }
                this.isDone = true;
            }
        );

        dataValue.pipe(streamSnitch);
    }

    getNext() {
        if (this.matches.length > 0) {
            this.flowState.propagateValue("match", this.matches.shift());
        } else if (this.isDone) {
            this.flowState.propagateValue("done", null);
        } else {
            this.propagate = true;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

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

        if (this.regex.multiline) {
            this._buffer = this._buffer.slice(this._buffer.lastIndexOf("\n"));
        }

        cb();
    }

    clearBuffer() {
        this._buffer = "";
    }
}

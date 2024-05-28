import React from "react";
import { Readable, Writable } from "stream";

import { registerActionComponents } from "project-editor/flow/component";

import type { IDashboardComponentContext } from "eez-studio-types";

import {
    registerSystemStructure,
    ValueType
} from "project-editor/features/variable/value-type";

////////////////////////////////////////////////////////////////////////////////

const regexpIcon: any = (
    <svg viewBox="0 0 512 512" fill="currentColor">
        <path d="M309.677124,349.2086182V230.9143524l-97.4385986,59.7092743l-34.350647-59.8398743l101.6825867-55.6431732l-101.6825867-56.4703445l34.5251465-58.7483673l97.2640991,59.4459915V0.6174708h69.4211121v118.7503891l98.1610413-59.4459915L512,118.6702347l-102.1397705,56.4703445L512,230.7837524l-34.877594,60.111908l-98.0241699-59.981308v118.2942657H309.677124z M145.1727905,438.7961426c0-55.6698914-60.6798172-90.6524658-108.961525-62.8175354c-48.2816963,27.8349609-48.2816849,97.8001099,0.0000191,125.6350708C84.4929886,529.4486084,145.1727905,494.4660339,145.1727905,438.7961426z" />
    </svg>
);

const componentHeaderColor = "#E0BBE4";

const REGEXP_RESULT_STRUCT_NAME = "$RegExpResult";

registerSystemStructure({
    name: REGEXP_RESULT_STRUCT_NAME,
    fields: [
        {
            name: "index",
            type: "integer"
        },
        {
            name: "texts",
            type: "array:string"
        },
        {
            name: "indices",
            type: "array:array:integer"
        }
    ]
});

registerActionComponents("Dashboard Specific", [
    {
        name: "Regexp",
        icon: regexpIcon,
        componentHeaderColor,
        inputs: [
            {
                name: "next",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            },
            {
                name: "stop",
                type: "any" as ValueType,
                isSequenceInput: true,
                isOptionalInput: true
            }
        ],
        outputs: [
            {
                name: "match",
                type: `struct:${REGEXP_RESULT_STRUCT_NAME}`,
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
                name: "text",
                type: "expression",
                valueType: "string"
            },
            {
                name: "global",
                type: "expression",
                valueType: "boolean"
            },
            {
                name: "caseInsensitive",
                type: "expression",
                valueType: "boolean"
            }
        ],
        bodyPropertyName: "pattern",
        defaults: {
            global: "true",
            caseInsensitive: "false"
        },
        migrateProperties: component => {
            if (component.text == undefined) {
                component.text = component.data;
            }
        },
        execute: (context: IDashboardComponentContext) => {
            let executionState: RegexpExecutionState | undefined;
            if (context.getInputValue("@seqin") !== undefined) {
                context.setComponentExecutionState(undefined);
                executionState = undefined;
            } else {
                executionState =
                    context.getComponentExecutionState<RegexpExecutionState>();
                if (!executionState) {
                    context.throwError("Never started");
                    return;
                }
            }

            if (!executionState) {
                const patternValue: any = context.evalProperty("pattern");
                if (typeof patternValue != "string") {
                    context.throwError("pattern is not a string");
                    return;
                }

                const global: any = !!context.evalProperty("global");

                const caseInsensitive: any =
                    !!context.evalProperty("caseInsensitive");

                let re;
                try {
                    re = new RegExp(
                        patternValue,
                        "md" +
                            (global ? "g" : "") +
                            (caseInsensitive ? "i" : "")
                    );
                } catch (err) {
                    context.throwError(
                        "Invalid regular expression" + err.toString()
                    );
                    return;
                }

                const textValue: any = context.evalProperty("text");
                if (typeof textValue == "string") {
                    context.setComponentExecutionState(
                        new RegexpExecutionStateForString(
                            context,
                            re,
                            textValue
                        )
                    );
                } else if (textValue instanceof Readable) {
                    context.setComponentExecutionState(
                        new RegexpExecutionStateForStream(
                            context,
                            re,
                            textValue
                        )
                    );
                } else {
                    context.throwError(
                        "text is not a string or readable stream"
                    );
                }
            } else if (context.getInputValue("next") !== undefined) {
                executionState.getNext();
            } else if (context.getInputValue("stop") !== undefined) {
                executionState.stop();
            }
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

abstract class RegexpExecutionState {
    abstract getNext(): void;
    abstract stop(): void;
}

function getMatchStruct(m: RegExpExecArray) {
    return {
        index: m.index,
        texts: m.map(x => x),
        indices: (m as any).indices.map((a: any) => {
            try {
                return a.map((x: any) => x);
            } catch (err) {
                return [];
            }
        })
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

    stop() {
        this.context.propagateValue("done", null);
        this.context.setComponentExecutionState(undefined);
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
                    if (!this.isDone) {
                        context.propagateValue("done", null);
                        this.context.setComponentExecutionState(undefined);
                    }
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

    stop() {
        this.context.propagateValue("done", null);
        this.context.setComponentExecutionState(undefined);
        this.isDone = true;
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

        if (typeof chunk == "string") {
            this._buffer += chunk;
        } else if (chunk instanceof Buffer) {
            this._buffer += chunk.toString();
        }

        for (
            let i = 0;
            i < 100 && (match = this.regex.exec(this._buffer));
            i++
        ) {
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

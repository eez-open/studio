import { Duplex, Readable } from "stream";

import type { IDashboardComponentContext } from "eez-studio-types";

import { registerActionComponents } from "project-editor/flow/component";
import {
    COLLECT_STREAM_ICON,
    CLOSE_STREAM_ICON
} from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

const componentHeaderColor = "#F6F6EB";

registerActionComponents("Dashboard Specific", [
    {
        name: "CollectStream",
        icon: COLLECT_STREAM_ICON,
        componentHeaderColor,
        inputs: [],
        outputs: [
            {
                name: "data",
                type: "string",
                isSequenceOutput: false,
                isOptionalOutput: false
            }
        ],
        properties: [
            {
                name: "stream",
                type: "expression",
                valueType: "any"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const streamValue = context.evalProperty("stream");

            if (streamValue) {
                if (
                    streamValue instanceof Readable ||
                    streamValue instanceof Duplex
                ) {
                    context.startAsyncExecution();

                    streamValue.on("data", (data: Buffer) => {
                        context.propagateValue("data", data.toString());
                    });

                    let isDone = false;
                    const onDone = (data: Buffer) => {
                        if (!isDone) {
                            isDone = true;
                            context.propagateValueThroughSeqout();
                            context.endAsyncExecution();
                        }
                    };

                    streamValue.on("end", onDone);
                    streamValue.on("close", onDone);
                } else {
                    //context.throwError("not a readable stream");
                }
            }

            return undefined;
        }
    },
    {
        name: "CloseStream",
        icon: CLOSE_STREAM_ICON,
        componentHeaderColor,
        inputs: [],
        outputs: [],
        properties: [
            {
                name: "stream",
                type: "expression",
                valueType: "any"
            }
        ],
        execute: (context: IDashboardComponentContext) => {
            const streamValue = context.evalProperty("stream");

            if (streamValue) {
                if (
                    streamValue instanceof Readable ||
                    streamValue instanceof Duplex
                ) {
                    streamValue.destroy();
                    context.propagateValueThroughSeqout();
                } else {
                    //context.throwError("not a readable stream");
                }
            }

            return undefined;
        }
    }
]);

////////////////////////////////////////////////////////////////////////////////

import React from "react";
import { Duplex, Readable } from "stream";

import type { IDashboardComponentContext } from "eez-studio-types";

import {
    registerClass,
    makeDerivedClassInfo,
    ProjectType
} from "project-editor/core/object";

import {
    ComponentOutput,
    Widget,
    makeDataPropertyInfo,
    makeStylePropertyInfo
} from "project-editor/flow/component";
import { IFlowContext, IFlowState } from "project-editor/flow/flow-interfaces";
import { addCssStylesheet } from "eez-studio-shared/dom";
import { observer } from "mobx-react";
import { registerSystemStructure } from "project-editor/features/variable/value-type";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";

////////////////////////////////////////////////////////////////////////////////

class RunningState {
    onData: ((value: string) => void) | undefined = undefined;
}

export class TerminalWidget extends Widget {
    static classInfo = makeDerivedClassInfo(Widget.classInfo, {
        enabledInComponentPalette: (projectType: ProjectType) =>
            projectType === ProjectType.DASHBOARD,

        componentPaletteGroupName: "!1Input",

        defaultValue: {
            left: 0,
            top: 0,
            width: 240,
            height: 240
        },

        properties: [
            makeDataPropertyInfo("data", {}, "string"),
            makeStylePropertyInfo("style", "Default style")
        ],

        icon: (
            <svg
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M8 9l3 3l-3 3"></path>
                <line x1="13" y1="15" x2="16" y2="15"></line>
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            </svg>
        ),

        execute: (context: IDashboardComponentContext) => {
            const data = context.evalProperty("data");

            if (typeof data === "string" && data.length > 0) {
                context.sendMessageToComponent(data);
            } else if (data instanceof Readable || data instanceof Duplex) {
                data.on("data", (chunk: Buffer) => {
                    context.sendMessageToComponent(chunk.toString());
                });
            }
        }
    });

    getOutputs(): ComponentOutput[] {
        return [
            {
                name: "onData",
                type: `struct:${ON_DATA_PARAMS_STRUCT_NAME}`,
                isOptionalOutput: false,
                isSequenceOutput: false
            },
            ...super.getOutputs()
        ];
    }

    render(
        flowContext: IFlowContext,
        width: number,
        height: number
    ): React.ReactNode {
        return (
            <>
                <TerminalElement
                    widget={this}
                    flowContext={flowContext}
                    width={width}
                    height={height}
                />
                {super.render(flowContext, width, height)}
            </>
        );
    }

    async onWasmWorkerMessage(flowState: IFlowState, message: any) {
        let runningState =
            flowState.getComponentRunningState<RunningState>(this);

        if (!runningState) {
            runningState = new RunningState();
            flowState.setComponentRunningState(this, runningState);
        }

        const value = message;

        if (runningState.onData && value) {
            runningState.onData(value);
        }
    }
}

registerClass("TerminalWidget", TerminalWidget);

////////////////////////////////////////////////////////////////////////////////

export const ON_DATA_PARAMS_STRUCT_NAME = "$TerminalWidgetOnDataParams";

registerSystemStructure({
    name: ON_DATA_PARAMS_STRUCT_NAME,
    fields: [
        {
            name: "index",
            type: "integer"
        },
        {
            name: "indexes",
            type: "array:integer"
        },
        {
            name: "data",
            type: "string"
        }
    ]
});

interface OnDataParamsValue {
    index: number;
    indexes: number[];
    data: string;
}

function makeOnDataParamsValue(
    flowContext: IFlowContext,
    data: string
): OnDataParamsValue {
    let onDataParamsValue: OnDataParamsValue;

    let indexes = flowContext.dataContext.get(FLOW_ITERATOR_INDEXES_VARIABLE);
    if (indexes) {
        onDataParamsValue = {
            index: indexes[0],
            indexes,
            data
        };
    } else {
        onDataParamsValue = {
            index: 0,
            indexes: [0],
            data
        };
    }

    return onDataParamsValue;
}

////////////////////////////////////////////////////////////////////////////////

const TerminalElement = observer(
    class TerminalElement extends React.Component<{
        widget: TerminalWidget;
        flowContext: IFlowContext;
        width: number;
        height: number;
    }> {
        ref = React.createRef<HTMLDivElement>();

        terminal: any;
        fitAddon: any;

        dispose: any;

        async componentDidMount() {
            if (!this.ref.current) {
                return;
            }

            addCssStylesheet(
                "xterm-css",
                "../../node_modules/xterm/css/xterm.css"
            );

            const { Terminal } = await import("xterm");
            const { FitAddon } = await import("xterm-addon-fit");
            this.terminal = new Terminal({
                rendererType: "dom"
            });
            this.fitAddon = new FitAddon();
            this.terminal.loadAddon(this.fitAddon);
            this.terminal.open(this.ref.current);
            this.terminal.write("$ ");
            this.fitAddon.fit();

            this.terminal.onData((data: string) => {
                try {
                    this.terminal.write(data);
                } catch (err) {
                    console.error(err);
                }

                if (this.props.flowContext.flowState) {
                    this.props.flowContext.flowState.runtime.executeWidgetAction(
                        this.props.flowContext,
                        this.props.widget,
                        "onData",
                        makeOnDataParamsValue(this.props.flowContext, data),
                        `struct:${ON_DATA_PARAMS_STRUCT_NAME}`
                    );
                }
            });

            if (this.props.flowContext.flowState) {
                let runningState =
                    this.props.flowContext.flowState.getComponentRunningState<RunningState>(
                        this.props.widget
                    );
                if (!runningState) {
                    runningState = new RunningState();
                    this.props.flowContext.flowState.setComponentRunningState(
                        this.props.widget,
                        runningState
                    );
                }
                if (runningState) {
                    runningState.onData = data => {
                        this.terminal.write(data);
                    };
                }
            }
        }

        componentDidUpdate() {
            if (this.fitAddon) {
                this.fitAddon.fit();
            }
        }

        componentWillUnmount() {
            if (this.dispose) {
                this.dispose();
            }
        }

        render() {
            return (
                <div
                    ref={this.ref}
                    style={{
                        width: this.props.width,
                        height: this.props.height
                    }}
                ></div>
            );
        }
    }
);

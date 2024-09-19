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
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import { addCssStylesheet } from "eez-studio-shared/dom";
import { observer } from "mobx-react";
import { registerSystemStructure } from "project-editor/features/variable/value-type";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import { TERMINAL_WIDGET_ICON } from "project-editor/ui-components/icons";

////////////////////////////////////////////////////////////////////////////////

class ExecutionState {
    data: string = "";
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

        icon: TERMINAL_WIDGET_ICON,

        execute: (context: IDashboardComponentContext) => {
            Widget.classInfo.execute!(context);

            const data = context.evalProperty("data");

            if (typeof data === "string" && data.length > 0) {
                let executionState =
                    context.getComponentExecutionState<ExecutionState>();
                if (!executionState) {
                    executionState = new ExecutionState();
                    context.setComponentExecutionState(executionState);
                }

                if (executionState.onData) {
                    executionState.onData(data);
                } else {
                    executionState.data += data;
                }
            } else if (data instanceof Readable || data instanceof Duplex) {
                data.on("data", (chunk: Buffer) => {
                    let executionState =
                        context.getComponentExecutionState<ExecutionState>();
                    if (!executionState) {
                        executionState = new ExecutionState();
                        context.setComponentExecutionState(executionState);
                    }

                    if (executionState.onData) {
                        executionState.onData(chunk.toString());
                    }
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

    override render(
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

        updateComponentExecutionState() {
            if (this.props.flowContext.flowState) {
                let executionState =
                    this.props.flowContext.flowState.getComponentExecutionState<ExecutionState>(
                        this.props.widget
                    );
                if (executionState) {
                    executionState.onData = data => {
                        this.terminal.write(data);
                    };
                    if (executionState.data) {
                        this.terminal.write(executionState.data);
                        executionState.data = "";
                    }
                }
            }
        }

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

            this.updateComponentExecutionState();
        }

        componentDidUpdate() {
            if (this.fitAddon) {
                this.fitAddon.fit();
            }

            this.updateComponentExecutionState();
        }

        componentWillUnmount() {
            if (this.dispose) {
                this.dispose();
            }
        }

        render() {
            this.props.flowContext.flowState?.getComponentExecutionState<ExecutionState>(
                this.props.widget
            );

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

import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { LogsPanel } from "project-editor/flow/debugger/LogsPanel";
import { ActiveFlowsPanel } from "project-editor/flow/debugger/ActiveFlowsPanel";
import { WatchPanel } from "project-editor/flow/debugger/WatchPanel";
import { QueuePanel } from "project-editor/flow/debugger/QueuePanel";
import { RuntimeBase } from "project-editor/flow/runtime";
import { LayoutModel } from "project-editor/core/store";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

@observer
export class DebuggerPanel extends React.Component<{ runtime: RuntimeBase }> {
    static contextType = ProjectContext;
    declare context: React.ContextType<typeof ProjectContext>;

    get model() {
        return FlexLayout.Model.fromJson({
            global: LayoutModel.GLOBAL_OPTIONS,
            borders: [],
            layout: {
                type: "row",
                children: [
                    {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 25,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Queue",
                                        component: "queue"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 75,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Watch",
                                        component: "watch"
                                    },
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Active Flows",
                                        component: "active-flows"
                                    },
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Logs",
                                        component: "logs"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        });
    }

    factory = (node: FlexLayout.TabNode) => {
        var component = node.getComponent();

        if (component === "queue") {
            return <QueuePanel runtime={this.props.runtime} />;
        }

        if (component === "watch") {
            return <WatchPanel runtime={this.props.runtime} />;
        }

        if (component === "active-flows") {
            return <ActiveFlowsPanel runtime={this.props.runtime} />;
        }

        if (component === "logs") {
            return <LogsPanel runtime={this.props.runtime} />;
        }

        return null;
    };

    render() {
        return (
            <div className="EezStudio_DebuggerPanel">
                <FlexLayout.Layout
                    model={this.model}
                    factory={this.factory}
                    realtimeResize={true}
                    font={LayoutModel.FONT_SUB}
                />
            </div>
        );
    }
}

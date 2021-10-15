import React from "react";
import { computed, observable, action } from "mobx";
import { observer } from "mobx-react";
import { LogsPanel } from "project-editor/flow/debugger/LogsPanel";
import { ActiveFlowsPanel } from "project-editor/flow/debugger/ActiveFlowsPanel";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { WatchPanel } from "project-editor/flow/debugger/WatchPanel";
import { QueuePanel } from "project-editor/flow/debugger/QueuePanel";
import { Splitter } from "eez-studio-ui/splitter";
import { RuntimeBase } from "project-editor/flow/runtime";

////////////////////////////////////////////////////////////////////////////////

interface CollapsedState {
    queuePanel: boolean;
    variablesPanel: boolean;
    breakpointsPanel: boolean;
    activeFlowsPanel: boolean;
    logsPanel: boolean;
}

@observer
export class DebuggerPanel extends React.Component<{ runtime: RuntimeBase }> {
    queuePanelCollapsed = observable.box(false);
    watchPanelCollapsed = observable.box(false);
    breakpointsPanelCollapsed = observable.box(false);
    activeFlowsPanelCollapsed = observable.box(false);
    logsPanelCollapsed = observable.box(false);

    @observable maximizedPanel:
        | "queue"
        | "watch"
        | "breakpoints"
        | "active-flows"
        | "logs"
        | undefined;

    constructor(props: any) {
        super(props);

        const collapsedStateStr = localStorage.getItem(
            "project-editor/debugger-pannel/collapsed-state"
        );

        if (collapsedStateStr) {
            const collapsedState = JSON.parse(
                collapsedStateStr
            ) as CollapsedState;

            this.queuePanelCollapsed.set(collapsedState.queuePanel);
            this.watchPanelCollapsed.set(collapsedState.variablesPanel);
            this.breakpointsPanelCollapsed.set(collapsedState.breakpointsPanel);
            this.activeFlowsPanelCollapsed.set(collapsedState.activeFlowsPanel);
            this.logsPanelCollapsed.set(collapsedState.logsPanel);
        }
    }

    componentWillUnmount() {
        const collapsedState: CollapsedState = {
            queuePanel: this.queuePanelCollapsed.get(),
            variablesPanel: this.watchPanelCollapsed.get(),
            breakpointsPanel: this.breakpointsPanelCollapsed.get(),
            activeFlowsPanel: this.activeFlowsPanelCollapsed.get(),
            logsPanel: this.logsPanelCollapsed.get()
        };

        localStorage.setItem(
            "project-editor/debugger-pannel/collapsed-state",
            JSON.stringify(collapsedState)
        );
    }

    @computed get sizes() {
        let sizes = "";

        let expanded = false;

        if (this.queuePanelCollapsed.get()) {
            if (this.watchPanelCollapsed.get()) {
                sizes += "38px!";
            } else {
                sizes += "37px!";
            }
        } else {
            expanded = true;
            sizes += "100px";
        }

        sizes += "|";

        if (this.watchPanelCollapsed.get()) {
            if (!expanded || this.breakpointsPanelCollapsed.get()) {
                sizes += "38px!";
            } else {
                sizes += "37px!";
            }
        } else {
            expanded = true;
            sizes += "100px";
        }

        sizes += "|";

        if (this.breakpointsPanelCollapsed.get()) {
            if (!expanded || this.activeFlowsPanelCollapsed.get()) {
                sizes += "38px!";
            } else {
                sizes += "37px!";
            }
        } else {
            expanded = true;
            sizes += "100px";
        }

        sizes += "|";

        if (this.activeFlowsPanelCollapsed.get()) {
            if (!expanded || this.logsPanelCollapsed.get()) {
                sizes += "38px!";
            } else {
                sizes += "37px!";
            }
        } else {
            sizes += "100px";
        }

        sizes += "|";

        if (this.logsPanelCollapsed.get()) {
            sizes += "38px!";
        } else {
            sizes += "100px";
        }

        return sizes;
    }

    onQueuePanelHeaderMaximize = action(() => {
        if (!this.maximizedPanel) {
            this.maximizedPanel = "queue";
        } else {
            this.maximizedPanel = undefined;
        }
    });
    onWatchPanelHeaderMaximize = action(() => {
        if (!this.maximizedPanel) {
            this.maximizedPanel = "watch";
        } else {
            this.maximizedPanel = undefined;
        }
    });
    onBreakpointsPanelHeaderMaximize = action(() => {
        if (!this.maximizedPanel) {
            this.maximizedPanel = "breakpoints";
        } else {
            this.maximizedPanel = undefined;
        }
    });
    onActiveFlowsPanelHeaderMaximize = action(() => {
        if (!this.maximizedPanel) {
            this.maximizedPanel = "active-flows";
        } else {
            this.maximizedPanel = undefined;
        }
    });
    onLogsPanelHeaderMaximize = action(() => {
        if (!this.maximizedPanel) {
            this.maximizedPanel = "logs";
        } else {
            this.maximizedPanel = undefined;
        }
    });

    render() {
        if (this.maximizedPanel == "queue") {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <QueuePanel
                        runtime={this.props.runtime}
                        maximized={true}
                        onToggleMaximized={this.onQueuePanelHeaderMaximize}
                    />
                </div>
            );
        } else if (this.maximizedPanel == "watch") {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <WatchPanel
                        runtime={this.props.runtime}
                        maximized={true}
                        onToggleMaximized={this.onWatchPanelHeaderMaximize}
                    />
                </div>
            );
        } else if (this.maximizedPanel == "breakpoints") {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <BreakpointsPanel
                        maximized={true}
                        onToggleMaximized={
                            this.onBreakpointsPanelHeaderMaximize
                        }
                    />
                </div>
            );
        } else if (this.maximizedPanel == "active-flows") {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <ActiveFlowsPanel
                        runtime={this.props.runtime}
                        maximized={true}
                        onToggleMaximized={
                            this.onActiveFlowsPanelHeaderMaximize
                        }
                    />
                </div>
            );
        } else if (this.maximizedPanel == "logs") {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <LogsPanel
                        runtime={this.props.runtime}
                        maximized={true}
                        onToggleMaximized={this.onLogsPanelHeaderMaximize}
                    />
                </div>
            );
        }

        return (
            <Splitter
                persistId={`project-editor/debugger-pannel/splitter`}
                className="EezStudio_DebuggerPanel"
                type="vertical"
                sizes={this.sizes}
                childrenOverflow="hidden|hidden|hidden|hidden|hidden"
            >
                <QueuePanel
                    runtime={this.props.runtime}
                    collapsed={this.queuePanelCollapsed}
                    maximized={false}
                    onToggleMaximized={this.onQueuePanelHeaderMaximize}
                />
                <WatchPanel
                    runtime={this.props.runtime}
                    collapsed={this.watchPanelCollapsed}
                    maximized={false}
                    onToggleMaximized={this.onWatchPanelHeaderMaximize}
                />
                <BreakpointsPanel
                    collapsed={this.breakpointsPanelCollapsed}
                    maximized={false}
                    onToggleMaximized={this.onBreakpointsPanelHeaderMaximize}
                />
                <ActiveFlowsPanel
                    runtime={this.props.runtime}
                    collapsed={this.activeFlowsPanelCollapsed}
                    maximized={false}
                    onToggleMaximized={this.onActiveFlowsPanelHeaderMaximize}
                />
                <LogsPanel
                    runtime={this.props.runtime}
                    collapsed={this.logsPanelCollapsed}
                    maximized={false}
                    onToggleMaximized={this.onLogsPanelHeaderMaximize}
                />
            </Splitter>
        );
    }
}

import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { LogsPanel } from "project-editor/flow/debugger/LogsPanel";
import { ActiveFlowsPanel } from "project-editor/flow/debugger/ActiveFlowsPanel";
import { WatchPanel } from "project-editor/flow/debugger/WatchPanel";
import { QueuePanel } from "project-editor/flow/debugger/QueuePanel";
import { RuntimeBase } from "project-editor/flow/runtime";
import { LayoutModels } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";

////////////////////////////////////////////////////////////////////////////////

export const DebuggerPanel = observer(
    class DebuggerPanel extends React.Component<{ runtime: RuntimeBase }> {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

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

        onRenderTab = (
            node: FlexLayout.TabNode,
            renderValues: FlexLayout.ITabRenderValues
        ) => {
            if (node.getId() == LayoutModels.DEBUGGER_LOGS_TAB_ID) {
                if (this.context.runtime && this.context.runtime.error) {
                    renderValues.leading = (
                        <div className="EezStudio_AttentionContainer">
                            <span></span>
                            <div className="EezStudio_AttentionDiv" />
                        </div>
                    );
                }
            }
        };

        render() {
            // to make sure onRenderTab is observable
            this.context.runtime && this.context.runtime.error;

            return (
                <div className="EezStudio_DebuggerPanel">
                    <FlexLayout.Layout
                        model={this.context.layoutModels.debugger}
                        factory={this.factory}
                        realtimeResize={true}
                        font={LayoutModels.FONT_SUB}
                        onRenderTab={this.onRenderTab}
                    />
                </div>
            );
        }
    }
);

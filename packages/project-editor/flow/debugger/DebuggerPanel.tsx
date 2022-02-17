import React from "react";
import { observer } from "mobx-react";
import * as FlexLayout from "flexlayout-react";

import { LogsPanel } from "project-editor/flow/debugger/LogsPanel";
import { ActiveFlowsPanel } from "project-editor/flow/debugger/ActiveFlowsPanel";
import { WatchPanel } from "project-editor/flow/debugger/WatchPanel";
import { QueuePanel } from "project-editor/flow/debugger/QueuePanel";
import { RuntimeBase } from "project-editor/flow/runtime";
import { LayoutModels } from "project-editor/core/store";
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

        render() {
            return (
                <div className="EezStudio_DebuggerPanel">
                    <FlexLayout.Layout
                        model={this.context.layoutModels.debugger}
                        factory={this.factory}
                        realtimeResize={true}
                        font={LayoutModels.FONT_SUB}
                    />
                </div>
            );
        }
    }
);

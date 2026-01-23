import React from "react";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";
import { ProjectContext } from "project-editor/project/context";
import { dockerBuildState, PreviewLogType } from "./docker-build-state";

////////////////////////////////////////////////////////////////////////////////

export const PreviewLogsPanel = observer(
    class PreviewLogsPanel extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        contentRef = React.createRef<HTMLDivElement>();

        componentDidUpdate() {
            // Auto-scroll to bottom
            if (this.contentRef.current) {
                this.contentRef.current.scrollTop =
                    this.contentRef.current.scrollHeight;
            }
        }

        get projectState() {
            return dockerBuildState.getProjectState(this.context?.filePath);
        }

        handleClear = () => {
            this.projectState.clearPreviewLogs();
        };

        getTypeClassName(type: PreviewLogType): string {
            switch (type) {
                case "error":
                    return "EezStudio_PreviewLogsPanel_LogEntry_error";
                case "warn":
                    return "EezStudio_PreviewLogsPanel_LogEntry_warning";
                case "info":
                    return "EezStudio_PreviewLogsPanel_LogEntry_info";
                case "debug":
                    return "EezStudio_PreviewLogsPanel_LogEntry_debug";
                default:
                    return "EezStudio_PreviewLogsPanel_LogEntry_log";
            }
        }

        render() {
            const projectState = this.projectState;

            return (
                <div className="EezStudio_PreviewLogsPanel">
                    <div className="EezStudio_PreviewLogsPanel_Header">
                        <div className="actions">
                            <IconAction
                                icon="material:clear_all"
                                title="Clear logs"
                                onClick={this.handleClear}
                            />
                        </div>
                    </div>
                    <div
                        className="EezStudio_PreviewLogsPanel_Content"
                        ref={this.contentRef}
                    >
                        {projectState.previewLogs.map(log => (
                            <div
                                key={log.id}
                                className={`EezStudio_PreviewLogsPanel_LogEntry ${this.getTypeClassName(
                                    log.type
                                )}`}
                            >
                                <span className="timestamp">
                                    {log.timestamp.toLocaleTimeString()}
                                </span>
                                <span className="type">
                                    [{log.type.toUpperCase()}]
                                </span>
                                <span className="message">{log.message}</span>
                            </div>
                        ))}
                        {projectState.previewLogs.length === 0 && (
                            <div className="EezStudio_PreviewLogsPanel_Empty">
                                No logs yet.
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

import React from "react";
import { observer } from "mobx-react";
import { makeObservable, observable, action } from "mobx";

import { IconAction } from "eez-studio-ui/action";

////////////////////////////////////////////////////////////////////////////////

export type PreviewLogType = "log" | "info" | "warn" | "error" | "debug";

export interface PreviewLogEntry {
    id: number;
    timestamp: Date;
    type: PreviewLogType;
    message: string;
}

export class PreviewLogsStore {
    logs: PreviewLogEntry[] = [];
    private nextId = 1;

    constructor() {
        makeObservable(this, {
            logs: observable,
            addLog: action,
            clear: action
        });
    }

    addLog(type: PreviewLogType, message: string) {
        this.logs.push({
            id: this.nextId++,
            timestamp: new Date(),
            type,
            message
        });

        // Keep only last 1000 logs
        if (this.logs.length > 1000) {
            this.logs.shift();
        }
    }

    clear() {
        this.logs = [];
        this.nextId = 1;
    }
}

// Global store instance
export const previewLogsStore = new PreviewLogsStore();

// Function to log from external sources
export function previewLog(type: PreviewLogType, message: string) {
    previewLogsStore.addLog(type, message);
}

////////////////////////////////////////////////////////////////////////////////

export const PreviewLogsPanel = observer(
    class PreviewLogsPanel extends React.Component {
        contentRef = React.createRef<HTMLDivElement>();

        componentDidUpdate() {
            // Auto-scroll to bottom
            if (this.contentRef.current) {
                this.contentRef.current.scrollTop =
                    this.contentRef.current.scrollHeight;
            }
        }

        handleClear = () => {
            previewLogsStore.clear();
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
                        {previewLogsStore.logs.map(log => (
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
                        {previewLogsStore.logs.length === 0 && (
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

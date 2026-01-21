import React from "react";
import { observer } from "mobx-react";
import { makeObservable, observable, action, runInAction } from "mobx";
import classNames from "classnames";

import { IconAction, TextAction } from "eez-studio-ui/action";
import { ProjectContext } from "project-editor/project/context";
import { dockerBuildManager } from "./build-manager";
import { dockerSimulatorPreviewStore } from "./DockerSimulatorPreviewPanel";

////////////////////////////////////////////////////////////////////////////////

export interface LogEntry {
    id: number;
    message: string;
    type: "info" | "success" | "error" | "warning";
    timestamp: Date;
}

export class DockerSimulatorLogsStore {
    logs: LogEntry[] = [];
    private nextId = 1;

    constructor() {
        makeObservable(this, {
            logs: observable,
            addLog: action,
            clear: action
        });
    }

    addLog(
        message: string,
        type: "info" | "success" | "error" | "warning" = "info"
    ) {
        this.logs.push({
            id: this.nextId++,
            message,
            type,
            timestamp: new Date()
        });
    }

    clear() {
        this.logs = [];
    }
}

// Global logs store instance
export const dockerSimulatorLogsStore = new DockerSimulatorLogsStore();

// Log function compatible with docker-build-lib
export const dockerBuildLogFunction = (
    message: string,
    type?: "info" | "success" | "error" | "warning"
) => {
    runInAction(() => {
        dockerSimulatorLogsStore.addLog(message, type || "info");
    });
};

////////////////////////////////////////////////////////////////////////////////

export const DockerSimulatorLogsPanel = observer(
    class DockerSimulatorLogsPanel extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        logsEndRef = React.createRef<HTMLDivElement>();

        componentDidUpdate() {
            this.scrollToBottom();
        }

        scrollToBottom = () => {
            this.logsEndRef.current?.scrollIntoView({ behavior: "instant" });
        };

        handleClear = () => {
            dockerSimulatorLogsStore.clear();
        };

        handleBuild = async () => {
            if (this.context) {
                await dockerBuildManager.startFullSimulator(this.context, true);
            }
        };

        handleCleanBuild = async () => {
            if (this.context) {
                await dockerBuildManager.cleanBuildCache(this.context);
            }
        };

        handleCleanAll = async () => {
            if (this.context) {
                await dockerBuildManager.cleanAll(this.context);
            }
        };

        handleStop = async () => {
            await dockerBuildManager.stopFullSimulator();
        };

        render() {
            const isBuilding = dockerSimulatorPreviewStore.state === "building";

            return (
                <div className="EezStudio_DockerSimulatorLogsPanel">
                    <div className="EezStudio_DockerSimulatorLogsPanel_Header">
                        <div className="EezStudio_DockerSimulatorLogsPanel_LeftButtons">
                            {!isBuilding && (
                                <>
                                    <TextAction
                                        icon="material:build"
                                        title="Build and start simulator"
                                        text="Build"
                                        iconSize={20}
                                        onClick={this.handleBuild}
                                    />
                                    <TextAction
                                        icon="material:delete"
                                        title="Clean Build (remove build cache and rebuild)"
                                        text="Clean Build"
                                        onClick={this.handleCleanBuild}
                                    />
                                    <TextAction
                                        icon="material:delete_sweep"
                                        title="Clean All (remove volume and rebuild from scratch)"
                                        text="Clean All"
                                        onClick={this.handleCleanAll}
                                    />
                                </>
                            )}
                            {isBuilding && (
                                <TextAction
                                    icon="material:stop"
                                    title="Stop build"
                                    text="Stop"
                                    onClick={this.handleStop}
                                />
                            )}
                        </div>
                        <div className="EezStudio_DockerSimulatorLogsPanel_RightButtons">
                            <IconAction
                                icon="material:clear_all"
                                title="Clear logs"
                                onClick={this.handleClear}
                            />
                        </div>
                    </div>
                    <div className="EezStudio_DockerSimulatorLogsPanel_Content">
                        {dockerSimulatorLogsStore.logs.map(log => (
                            <div
                                key={log.id}
                                className={classNames(
                                    "EezStudio_DockerSimulatorLogsPanel_LogEntry",
                                    `EezStudio_DockerSimulatorLogsPanel_LogEntry_${log.type}`
                                )}
                            >
                                <span className="timestamp">
                                    {log.timestamp.toLocaleTimeString()}
                                </span>
                                <span className="message">{log.message}</span>
                            </div>
                        ))}
                        <div ref={this.logsEndRef} />
                    </div>
                </div>
            );
        }
    }
);

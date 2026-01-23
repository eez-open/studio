import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { IconAction, TextAction } from "eez-studio-ui/action";
import { ProjectContext } from "project-editor/project/context";
import { dockerBuildManager } from "./build-manager";
import { dockerBuildState } from "./docker-build-state";

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

        get projectState() {
            return dockerBuildState.getProjectState(this.context?.filePath);
        }

        handleClear = () => {
            this.projectState.clearLogs();
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
            await dockerBuildManager.stopFullSimulator(this.context?.filePath);
        };

        render() {
            const projectState = this.projectState;
            const isBuilding = projectState.state === "building";

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
                                        title="Clean All (remove Docker volume and rebuild from scratch)"
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
                        {projectState.logs.map(log => (
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

import React from "react";
import { observer } from "mobx-react";

import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";
import { Loader } from "eez-studio-ui/loader";
import { ProjectContext } from "project-editor/project/context";
import { dockerBuildState } from "./docker-build-state";

////////////////////////////////////////////////////////////////////////////////

// Re-export types for backward compatibility
export type { SimulatorState } from "./docker-build-state";

////////////////////////////////////////////////////////////////////////////////

export const DockerSimulatorPreviewPanel = observer(
    class DockerSimulatorPreviewPanel extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        iframeRef = React.createRef<HTMLIFrameElement>();
        private messageHandler: ((event: MessageEvent) => void) | null = null;

        componentDidMount() {
            // Listen for console messages from the iframe
            this.messageHandler = (event: MessageEvent) => {
                if (event.data && event.data.type === "console") {
                    const projectState = dockerBuildState.getProjectState(
                        this.context?.filePath
                    );
                    projectState.addPreviewLog(
                        event.data.level || "log",
                        event.data.message
                    );
                }
            };
            window.addEventListener("message", this.messageHandler);
        }

        componentWillUnmount() {
            if (this.messageHandler) {
                window.removeEventListener("message", this.messageHandler);
            }
        }

        get projectState() {
            return dockerBuildState.getProjectState(this.context?.filePath);
        }

        handleRefresh = () => {
            const projectState = this.projectState;
            if (this.iframeRef.current && projectState.previewUrl) {
                this.iframeRef.current.src = projectState.previewUrl;
            }
        };

        render() {
            const projectState = this.projectState;
            const isOutOfDate = projectState.hasProjectChangedSinceBuild(
                this.context?.lastRevisionStable
            );

            return (
                <div className="EezStudio_DockerSimulatorPreviewPanel">
                    {projectState.state === "running" && (
                        <div className="EezStudio_DockerSimulatorPreviewPanel_Header">
                            <div className="actions">
                                <IconAction
                                    icon="material:refresh"
                                    title="Refresh preview"
                                    onClick={this.handleRefresh}
                                />
                            </div>
                        </div>
                    )}
                    {projectState.state === "running" && isOutOfDate && (
                        <div
                            className="alert alert-warning d-flex align-items-center justify-content-center mb-0 py-2 rounded-0"
                            role="alert"
                        >
                            <Icon icon="material:warning" size={18} />
                            <span className="ms-2">
                                Preview may be out of date. Rebuild to see
                                latest changes.
                            </span>
                        </div>
                    )}
                    <div className="EezStudio_DockerSimulatorPreviewPanel_Content">
                        {projectState.state === "idle" && (
                            <div className="EezStudio_DockerSimulatorPreviewPanel_Placeholder">
                                <Icon
                                    icon="material:play_circle_outline"
                                    size={64}
                                />
                                <p>Click "Run in Full Simulator" to start</p>
                            </div>
                        )}

                        {projectState.state === "building" && (
                            <div className="EezStudio_DockerSimulatorPreviewPanel_Building">
                                <Loader />
                                <p>Building...</p>
                                <p className="phase">{projectState.buildPhase}</p>
                            </div>
                        )}

                        {projectState.state === "error" && (
                            <div className="EezStudio_DockerSimulatorPreviewPanel_Error">
                                <Icon icon="material:error_outline" size={64} />
                                <p>Build Failed</p>
                                <p className="error-message">
                                    {projectState.errorMessage}
                                </p>
                            </div>
                        )}

                        {projectState.state === "running" &&
                            projectState.previewUrl && (
                                <iframe
                                    ref={this.iframeRef}
                                    src={projectState.previewUrl}
                                    className="EezStudio_DockerSimulatorPreviewPanel_Iframe"
                                    title="LVGL Full Simulator"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            )}
                    </div>
                </div>
            );
        }
    }
);

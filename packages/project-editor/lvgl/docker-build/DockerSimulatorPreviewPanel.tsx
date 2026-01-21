import React from "react";
import { observer } from "mobx-react";
import { makeObservable, observable, action, computed } from "mobx";

import { Icon } from "eez-studio-ui/icon";
import { IconAction } from "eez-studio-ui/action";
import { Loader } from "eez-studio-ui/loader";

////////////////////////////////////////////////////////////////////////////////

export type SimulatorState = "idle" | "building" | "running" | "error";

export class DockerSimulatorPreviewStore {
    state: SimulatorState = "idle";
    previewUrl: string | undefined = undefined;
    errorMessage: string | undefined = undefined;
    buildPhase: string = "";

    constructor() {
        makeObservable(this, {
            state: observable,
            previewUrl: observable,
            errorMessage: observable,
            buildPhase: observable,
            setBuilding: action,
            setRunning: action,
            setError: action,
            setIdle: action,
            isLoading: computed
        });
    }

    setBuilding(phase: string) {
        this.state = "building";
        this.buildPhase = phase;
        this.errorMessage = undefined;
    }

    setRunning(url: string) {
        this.state = "running";
        this.previewUrl = url;
        this.errorMessage = undefined;
        this.buildPhase = "";
    }

    setError(message: string) {
        this.state = "error";
        this.errorMessage = message;
        this.buildPhase = "";
    }

    setIdle() {
        this.state = "idle";
        this.previewUrl = undefined;
        this.errorMessage = undefined;
        this.buildPhase = "";
    }

    get isLoading() {
        return this.state === "building";
    }
}

// Global preview store instance
export const dockerSimulatorPreviewStore = new DockerSimulatorPreviewStore();

////////////////////////////////////////////////////////////////////////////////

export const DockerSimulatorPreviewPanel = observer(
    class DockerSimulatorPreviewPanel extends React.Component {
        iframeRef = React.createRef<HTMLIFrameElement>();
        private messageHandler: ((event: MessageEvent) => void) | null = null;

        componentDidMount() {
            // Listen for console messages from the iframe
            this.messageHandler = (event: MessageEvent) => {
                if (event.data && event.data.type === "console") {
                    const { previewLog } = require("./PreviewLogsPanel");
                    previewLog(event.data.level || "log", event.data.message);
                }
            };
            window.addEventListener("message", this.messageHandler);
        }

        componentWillUnmount() {
            if (this.messageHandler) {
                window.removeEventListener("message", this.messageHandler);
            }
        }

        handleRefresh = () => {
            if (
                this.iframeRef.current &&
                dockerSimulatorPreviewStore.previewUrl
            ) {
                this.iframeRef.current.src =
                    dockerSimulatorPreviewStore.previewUrl;
            }
        };

        render() {
            const store = dockerSimulatorPreviewStore;

            return (
                <div className="EezStudio_DockerSimulatorPreviewPanel">
                    {store.state === "running" && (
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
                    <div className="EezStudio_DockerSimulatorPreviewPanel_Content">
                        {store.state === "idle" && (
                            <div className="EezStudio_DockerSimulatorPreviewPanel_Placeholder">
                                <Icon
                                    icon="material:play_circle_outline"
                                    size={64}
                                />
                                <p>Click "Run in Full Simulator" to start</p>
                            </div>
                        )}

                        {store.state === "building" && (
                            <div className="EezStudio_DockerSimulatorPreviewPanel_Building">
                                <Loader />
                                <p>Building...</p>
                                <p className="phase">{store.buildPhase}</p>
                            </div>
                        )}

                        {store.state === "error" && (
                            <div className="EezStudio_DockerSimulatorPreviewPanel_Error">
                                <Icon icon="material:error_outline" size={64} />
                                <p>Build Failed</p>
                                <p className="error-message">
                                    {store.errorMessage}
                                </p>
                            </div>
                        )}

                        {store.state === "running" && store.previewUrl && (
                            <iframe
                                ref={this.iframeRef}
                                src={store.previewUrl}
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

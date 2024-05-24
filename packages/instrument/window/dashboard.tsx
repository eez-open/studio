import React from "react";
import { observable, runInAction, makeObservable } from "mobx";
import { observer } from "mobx-react";
import { InstrumentObject } from "instrument/instrument-object";
import { getExtensionFolderPath } from "eez-studio-shared/extensions/extension-folder";
import { ProjectStore } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import { ProjectEditorView } from "project-editor/project/ui/ProjectEditor";
import { initProjectEditor } from "project-editor/project-editor-bootstrap";
import { ProjectEditorTab, tabs } from "home/tabs-store";
import { Loader } from "eez-studio-ui/loader";
import type { RuntimeBase } from "project-editor/flow/runtime/runtime";

////////////////////////////////////////////////////////////////////////////////

interface DashboardProps {
    instrument: InstrumentObject;
    dashboardIndex: number;
}

export const Dashboard = observer(
    class Dashboard extends React.Component<DashboardProps> {
        constructor(props: DashboardProps) {
            super(props);

            makeObservable(this, {});

            this.dashboardProject = new DashboardProject(
                getExtensionFolderPath(props.instrument.instrumentExtensionId) +
                    "/d" +
                    props.dashboardIndex +
                    ".eez-project",
                this.props.instrument
            );
        }

        dashboardProject: DashboardProject;

        componentWillUnmount() {
            this.dashboardProject.close();
        }

        render() {
            return this.dashboardProject.render();
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export class DashboardProject {
    constructor(
        public _filePath: string,
        private instrument: InstrumentObject
    ) {
        makeObservable(this, {
            projectStore: observable,
            runtime: observable,
            error: observable
        });
    }

    projectStore: ProjectStore | undefined;
    runtime: RuntimeBase | undefined;

    error: string | undefined;

    ProjectContext: React.Context<ProjectStore>;
    ProjectEditor: typeof ProjectEditorView;

    loadProject = async () => {
        if (!this.instrument.isConnected) {
            return;
        }

        try {
            this.ProjectContext = ProjectContext;

            this.ProjectEditor = ProjectEditorView;

            await initProjectEditor(tabs, ProjectEditorTab);
            const projectStore = ProjectStore.create({
                type: "instrument-dashboard",
                instrument: this.instrument
            });

            projectStore.mount();

            if (this._filePath) {
                await projectStore.openFile(this._filePath);
            } else {
                await projectStore.newProject();
            }

            runInAction(() => {
                projectStore.project._fullyLoaded = true;
            });

            runInAction(() => {
                this.projectStore = projectStore;
                this.projectStore.setRuntimeMode(false);
                this.runtime = this.projectStore.runtime;
            });
        } catch (err) {
            console.log(err);
            runInAction(() => {
                this.error = "Failed to load file!";
            });
        }
    };

    reload = async () => {
        await this.close();
        await this.loadProject();
    };

    close = async () => {
        if (this.projectStore) {
            if (await this.projectStore.closeWindow()) {
                this.projectStore.unmount();
                runInAction(() => {
                    this.projectStore = undefined;
                    this.runtime = undefined;
                });
            }
        }
    };

    render() {
        let body: React.ReactNode | undefined;

        if (!this.instrument.isConnected) {
            setTimeout(this.close);

            body = (
                <div className="alert alert-primary">
                    Instrument is not connected
                </div>
            );
        } else if (!this.projectStore) {
            setTimeout(this.loadProject);

            body = this.error ? (
                <div className="error">{this.error}</div>
            ) : (
                <Loader size={60} />
            );
        } else if (
            !this.projectStore.runtime ||
            ((this.projectStore.runtime.isStopped ||
                this.projectStore.runtime.isPaused) &&
                !this.projectStore.runtime.error)
        ) {
            body = (
                <div>
                    {this.runtime && this.runtime.error && (
                        <div className="alert alert-danger">
                            Start error: {this.runtime.error}
                        </div>
                    )}
                    <button className="btn btn-primary" onClick={this.reload}>
                        Start
                    </button>
                </div>
            );
        } else if (this.projectStore.runtime.error) {
            body = (
                <div>
                    <div className="alert alert-danger">
                        Execution error: {this.projectStore.runtime.error}
                    </div>
                    <div>
                        <button
                            className="btn btn-primary"
                            onClick={this.reload}
                        >
                            Reload
                        </button>
                    </div>
                </div>
            );
        }

        if (body) {
            return (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "absolute",
                        width: "100%",
                        height: "100%"
                    }}
                >
                    {body}
                </div>
            );
        }

        return (
            <this.ProjectContext.Provider value={this.projectStore!}>
                <this.ProjectEditor showToolbar={false} />
            </this.ProjectContext.Provider>
        );
    }
}

import {
    makeObservable,
    observable,
    IReactionDisposer,
    autorun,
    runInAction,
    computed
} from "mobx";
import type { FSWatcher } from "chokidar";
import fs from "fs";
import path from "path";

import * as notification from "eez-studio-ui/notification";

import type { ProjectStore } from "project-editor/store";
import { ImportDirective, Project } from "project-editor/project/project";
import { loadProject } from "project-editor/store/serialization";

type LoadExternalProjectParams = { filePath: string } & (
    | {
          type: "master";
          project: Project;
      }
    | {
          type: "import-directive";
          importDirective: ImportDirective;
      }
);

export class ExternalProjects {
    externalProjects = new Map<string, Project>();
    mapProjectToPath = new Map<
        Project,
        {
            filePath: string;
            paramsList: LoadExternalProjectParams[];
        }
    >();
    masterProjects = new Map<Project, Project>();
    importDirectiveProjects = new Map<ImportDirective, Project>();

    _externalProjectsLoading = new Map<
        string,
        {
            canceled: boolean;
            paramsList: LoadExternalProjectParams[];
        }
    >();

    dispose: IReactionDisposer;
    watcher: FSWatcher | undefined = undefined;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            externalProjects: observable,
            mapProjectToPath: observable,
            masterProjects: observable,
            importDirectiveProjects: observable,
            allExternalProjects: computed
        });
    }

    getImportDirectiveProject(
        importDirective: ImportDirective
    ): Project | undefined {
        return this.importDirectiveProjects.get(importDirective);
    }

    getExternalProjectFromAbsoluteFilePath(absoluteFilePath: string) {
        return this.externalProjects.get(absoluteFilePath);
    }

    getExternalProjectAbsoluteFilePath(project: Project) {
        return this.mapProjectToPath.get(project)?.filePath;
    }

    getAbsoluteFilePath(filePath: string, relativeFilePath: string) {
        return path
            .resolve(
                path.dirname(filePath),
                relativeFilePath.replace(/(\\|\/)/g, path.sep)
            )
            .replace(/(\\|\/)/g, "/");
    }

    getMasterProject(project: Project): Project | undefined {
        return this.masterProjects.get(project);
    }

    get allExternalProjects() {
        const projects: Project[] = [];

        function enumProjects(project: Project) {
            if (
                project.settings.general.masterProject &&
                project.masterProject
            ) {
                if (projects.indexOf(project.masterProject) == -1) {
                    projects.push(project.masterProject);
                    enumProjects(project.masterProject);
                }
            }
            for (const importDirective of project.settings.general.imports) {
                if (
                    importDirective.projectFilePath &&
                    importDirective.project
                ) {
                    if (projects.indexOf(importDirective.project) == -1) {
                        projects.push(importDirective.project);
                        enumProjects(importDirective.project);
                    }
                }
            }
        }

        if (this.projectStore.project) {
            enumProjects(this.projectStore.project);
        }

        return projects;
    }

    async loadProject(filePath: string) {
        let fileData: Buffer;
        try {
            fileData = await fs.promises.readFile(filePath);
        } catch (err) {
            throw new Error(`File read error: ${err.toString()}`);
        }

        const isDashboardBuild = filePath.endsWith(".eez-dashboard");

        let projectJs;
        if (isDashboardBuild) {
            const decompress = require("decompress");
            const files = await decompress(fileData);
            projectJs = files[0].data.toString("utf8");
        } else {
            projectJs = fileData.toString("utf8");
        }

        const project = loadProject(this.projectStore, projectJs) as Project;

        project._isDashboardBuild = isDashboardBuild;

        this.loadExternalProjects(project, filePath);

        return project;
    }

    async loadExternalProjects(project: Project, filePath: string) {
        // load master project
        if (project.settings.general.masterProject) {
            try {
                await this.loadExternalProject(
                    {
                        filePath: this.getAbsoluteFilePath(
                            filePath,
                            project.settings.general.masterProject
                        ),
                        type: "master",
                        project
                    },
                    false
                );
            } catch (err) {
                notification.error(
                    `Failed to load project ${project.settings.general.masterProject}`
                );
            }
        }

        // load imported projects
        for (const importDirective of project.settings.general.imports) {
            try {
                if (importDirective.projectFilePath) {
                    await this.projectStore.externalProjects.loadExternalProject(
                        {
                            filePath: this.getAbsoluteFilePath(
                                filePath,
                                importDirective.projectFilePath
                            ),
                            type: "import-directive",
                            importDirective
                        },
                        false
                    );
                }
            } catch (err) {
                notification.error(
                    `Failed to load project ${importDirective.projectFilePath}`
                );
            }
        }
    }

    async loadExternalProject(
        params: LoadExternalProjectParams,
        reload: boolean
    ) {
        let loading = this._externalProjectsLoading.get(params.filePath);

        if (reload) {
            if (loading) {
                loading.canceled = true;
            }
        } else {
            const project = this.externalProjects.get(params.filePath);
            if (project) {
                const result = this.mapProjectToPath.get(project);
                result?.paramsList.push(params);

                if (params.type == "master") {
                    this.masterProjects.set(params.project, project);
                } else {
                    runInAction(() => {
                        this.importDirectiveProjects.set(
                            params.importDirective,
                            project
                        );
                    });
                }
                return;
            }

            if (loading) {
                loading.paramsList.push(params);
                return;
            }
        }

        if (!loading) {
            loading = {
                canceled: false,
                paramsList: [params]
            };
        }

        const project = await this.loadProject(params.filePath);

        if (loading.canceled) {
            return;
        }

        project._isReadOnly = true;
        project._store = this.projectStore;

        const paramsList = loading.paramsList;

        runInAction(() => {
            this.externalProjects.set(params.filePath, project);

            this.mapProjectToPath.set(project, {
                filePath: params.filePath,
                paramsList
            });

            for (const params of paramsList) {
                if (params.type == "master") {
                    this.masterProjects.set(params.project, project);
                } else {
                    this.importDirectiveProjects.set(
                        params.importDirective,
                        project
                    );
                }
            }
        });

        this._externalProjectsLoading.delete(params.filePath);

        return project;
    }

    async mount() {
        const { watch } = await import("chokidar");

        this.dispose = autorun(() => {
            if (this.watcher) {
                this.watcher.close();
            }

            if (!this.projectStore.project) {
                return;
            }

            this.loadExternalProjects(
                this.projectStore.project,
                this.projectStore.filePath!
            );

            // removed unused projects
            const projectsAfter = this.allExternalProjects;
            runInAction(() => {
                for (const entry of this.externalProjects) {
                    if (projectsAfter.indexOf(entry[1]) == -1) {
                        this.externalProjects.delete(entry[0]);
                    }
                }

                for (const entry of this.mapProjectToPath) {
                    if (projectsAfter.indexOf(entry[0]) == -1) {
                        this.mapProjectToPath.delete(entry[0]);
                    }
                }

                for (const entry of this.masterProjects) {
                    if (projectsAfter.indexOf(entry[0]) == -1) {
                        this.masterProjects.delete(entry[0]);
                    }
                }

                for (const entry of this.importDirectiveProjects) {
                    if (projectsAfter.indexOf(entry[1]) == -1) {
                        this.importDirectiveProjects.delete(entry[0]);
                    }
                }
            });

            const watchFilePaths = [...this.externalProjects.keys()];
            this.watcher = watch(watchFilePaths) as FSWatcher;
            this.watcher.on("change", path => {
                path = path.replace(/(\\|\/)/g, "/");
                for (const entry of this.mapProjectToPath) {
                    if (path == entry[1].filePath) {
                        runInAction(() => {
                            for (const params of entry[1].paramsList) {
                                this.loadExternalProject(params, true);
                            }
                        });
                    }
                }
            });
        });
    }

    unmount() {
        if (this.watcher) {
            this.watcher.close();
        }

        if (this.dispose) {
            this.dispose();
        }
    }
}

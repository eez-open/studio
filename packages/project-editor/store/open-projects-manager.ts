import {
    makeObservable,
    observable,
    IReactionDisposer,
    reaction,
    runInAction,
    computed
} from "mobx";
import { FSWatcher, watch } from "chokidar";
import fs from "fs";
import path from "path";

import * as notification from "eez-studio-ui/notification";

import type { ProjectStore } from "project-editor/store";
import { ImportDirective, Project } from "project-editor/project/project";
import { loadProject } from "project-editor/store/serialization";
import { ProjectEditor } from "project-editor/project-editor-interface";

type ProjectReference =
    | {
          type: "main";
      }
    | {
          type: "master";
          project: Project;
      }
    | {
          type: "import-directive";
          importDirective: ImportDirective;
      };

interface OpenProject {
    filePath: string;
    project: Project;
    dirty: boolean;
    watcher: FSWatcher | undefined;
    references: ProjectReference[];
}

export class OpenProjectsManager {
    openProjects: OpenProject[] = [];
    dispose: IReactionDisposer;

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            openProjects: observable.shallow,
            projects: computed,
            mapPathToOpenProject: computed,
            mapProjectToOpenProject: computed,
            masterProjects: computed,
            importDirectiveProjects: computed
        });
    }

    get projects() {
        const projects: Project[] = [];

        function enumProjects(project: Project) {
            if (projects.indexOf(project) != -1) {
                return;
            }

            projects.push(project);

            for (const importDirective of project.settings.general.imports) {
                if (
                    importDirective.projectFilePath &&
                    importDirective.project
                ) {
                    if (projects.indexOf(importDirective.project) == -1) {
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

    get mapPathToOpenProject(): Map<string, OpenProject> {
        const map = new Map<string, OpenProject>();
        for (const openProject of this.openProjects) {
            map.set(openProject.filePath, openProject);
        }
        return map;
    }

    get mapProjectToOpenProject(): Map<Project, OpenProject> {
        const map = new Map<Project, OpenProject>();
        for (const openProject of this.openProjects) {
            map.set(openProject.project, openProject);
        }
        return map;
    }

    get masterProjects(): Map<Project, Project> {
        const map = new Map<Project, Project>();
        for (const openProject of this.openProjects) {
            for (const ref of openProject.references) {
                if (ref.type == "master") {
                    map.set(ref.project, openProject.project);
                }
            }
        }
        return map;
    }

    get importDirectiveProjects(): Map<ImportDirective, Project> {
        const map = new Map<ImportDirective, Project>();
        for (const openProject of this.openProjects) {
            for (const ref of openProject.references) {
                if (ref.type == "import-directive") {
                    map.set(ref.importDirective, openProject.project);
                }
            }
        }
        return map;
    }

    getImportDirectiveProject(
        importDirective: ImportDirective
    ): Project | undefined {
        return this.importDirectiveProjects.get(importDirective);
    }

    getProjectFromAbsoluteFilePath(absoluteFilePath: string) {
        return this.mapPathToOpenProject.get(
            absoluteFilePath.replace(/(\\|\/)/g, "/")
        )?.project;
    }

    getProjectAbsoluteFilePath(project: Project) {
        return this.mapProjectToOpenProject.get(project)?.filePath;
    }

    getAbsoluteFilePath(filePath: string, relativeFilePath: string) {
        return path.resolve(path.dirname(filePath), relativeFilePath);
    }

    getMasterProject(project: Project): Project | undefined {
        return this.masterProjects.get(project);
    }

    async openMainProject(absoluteFilePath: string) {
        const map = new Map<string, OpenProject>();

        const project = await this._openProject(
            absoluteFilePath,
            {
                type: "main"
            },
            map
        );

        this._unwatchOpenProjects();

        runInAction(() => {
            this.openProjects = [...map.values()];
        });

        //this._dumpOpenProjects();

        return project;
    }

    async mount() {
        this.dispose = reaction(
            () => {
                const project = this.projectStore.project;
                if (!project) {
                    return undefined;
                }
                return {
                    masterProjectPath: project.settings.general.masterProject,
                    importDirectivePath: project.settings.general.imports.map(
                        importDirective => importDirective.projectFilePath
                    )
                };
            },
            async arg => {
                this._refresh();
            }
        );
    }

    unmount() {
        if (this.dispose) {
            this.dispose();
        }

        this._unwatchOpenProjects();
    }

    async _openProject(
        absoluteFilePath: string,
        params: ProjectReference,
        map: Map<string, OpenProject>
    ) {
        absoluteFilePath = absoluteFilePath.replace(/(\\|\/)/g, "/");

        let openProject = map.get(absoluteFilePath);

        if (openProject) {
            runInAction(() => {
                openProject!.references.push(params);
            });

            return openProject.project;
        }

        let project;
        let watcher: FSWatcher | undefined;

        openProject = this.mapPathToOpenProject.get(absoluteFilePath);
        if (openProject && !openProject.dirty) {
            project = openProject.project;
            watcher = openProject.watcher;
            openProject.watcher = undefined;
        } else {
            project = await this._loadProject(absoluteFilePath);
            project._isReadOnly = params.type != "main";
            project._store = this.projectStore;
        }

        const newOpenProject = {
            filePath: absoluteFilePath.replace(/(\\|\/)/g, "/"),
            project,
            dirty: false,
            watcher,
            references: [params]
        };

        if (!watcher && params.type != "main") {
            this._watch(newOpenProject);
        }

        map.set(absoluteFilePath, newOpenProject);

        await this._openExternalProjects(project, absoluteFilePath, map);

        return project;
    }

    async _loadProject(filePath: string) {
        console.log("loadProject", filePath);

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

        return project;
    }

    async _openExternalProjects(
        project: Project,
        baseFilePath: string,
        map: Map<string, OpenProject>
    ) {
        // load master project
        if (project.settings.general.masterProject) {
            const absoluteFilePath = this.getAbsoluteFilePath(
                baseFilePath,
                project.settings.general.masterProject
            );

            try {
                await this._openProject(
                    absoluteFilePath,
                    {
                        type: "master",
                        project
                    },
                    map
                );
            } catch (err) {
                notification.error(
                    `Failed to load project ${absoluteFilePath}`
                );
            }
        }

        // load imported projects
        for (const importDirective of project.settings.general.imports) {
            const absoluteFilePath = this.getAbsoluteFilePath(
                baseFilePath,
                importDirective.projectFilePath
            );

            try {
                if (importDirective.projectFilePath) {
                    await this._openProject(
                        absoluteFilePath,
                        {
                            type: "import-directive",
                            importDirective
                        },
                        map
                    );
                }
            } catch (err) {
                notification.error(
                    `Failed to load project ${absoluteFilePath}`
                );
            }
        }
    }

    _watch(openProject: OpenProject) {
        openProject.watcher = watch(openProject.filePath);

        openProject.watcher.on("change", () => {
            console.log("project file changed", openProject.filePath);
            openProject.dirty = true;
            this._refresh();
        });
    }

    _unwatchOpenProjects() {
        for (const openProject of this.openProjects) {
            if (openProject.watcher) {
                openProject.watcher.close();
            }
        }
    }

    async _refresh() {
        setTimeout(() => {
            this.openMainProject(this.projectStore.filePath!);
        });
    }

    _dumpOpenProjects() {
        for (const openProject of this.openProjects) {
            console.log(openProject.filePath);

            for (const ref of openProject.references) {
                if (ref.type == "main") {
                    console.log("\t" + ref.type);
                } else if (ref.type == "master") {
                    console.log(
                        "\t" +
                            ref.type +
                            ": " +
                            this.getProjectAbsoluteFilePath(ref.project)
                    );
                } else {
                    console.log(
                        "\t" +
                            ref.type +
                            ": " +
                            this.getProjectAbsoluteFilePath(
                                ProjectEditor.getProject(ref.importDirective)
                            )
                    );
                }
            }
        }
    }
}

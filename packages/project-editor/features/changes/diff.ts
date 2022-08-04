import { readTextFile } from "eez-studio-shared/util-electron";
import { runInAction } from "mobx";
import path from "path";
import type { Project } from "project-editor/project/project";
import { loadProject, ProjectEditorStore } from "project-editor/store";

import {
    Revision,
    MEMORY_HASH,
    UNSTAGED_HASH,
    STAGED_HASH
} from "project-editor/store/ui-state";

async function getProjectTopLevelDirPath(
    projectFilePath: string
): Promise<string> {
    const { simpleGit } = await import("simple-git");

    const projectDirPath = path.dirname(projectFilePath);

    let git = simpleGit(projectDirPath);

    let projectTopLevelDirPath = await git.raw("rev-parse", "--show-toplevel");
    if (projectTopLevelDirPath.endsWith("\n")) {
        projectTopLevelDirPath = projectTopLevelDirPath.slice(0, -1);
    }

    return projectTopLevelDirPath;
}

export async function getRevisions(
    projectEditorStore: ProjectEditorStore,
    forceGitRefresh: boolean
): Promise<Revision[]> {
    if (
        !forceGitRefresh &&
        projectEditorStore.uiStateStore.revisionsGitRefreshed
    ) {
        const revisions = projectEditorStore.uiStateStore.revisions.slice();

        if (projectEditorStore.modified) {
            if (revisions.length == 0 || revisions[0].hash != MEMORY_HASH) {
                revisions.splice(0, 0, {
                    hash: MEMORY_HASH,
                    message: "[ Current changes ]"
                });
            }
        } else {
            if (revisions.length > 0 && revisions[0].hash == MEMORY_HASH) {
                revisions.splice(0, 1);
            }
        }

        return revisions;
    }

    let revisions: Revision[] = [];

    try {
        const projectFilePath = projectEditorStore.filePath!;
        const projectTopLevelDirPath = await getProjectTopLevelDirPath(
            projectFilePath
        );

        const { simpleGit } = await import("simple-git");
        const git = simpleGit(projectTopLevelDirPath);

        const projectGitRelativeFilePath = path
            .relative(projectTopLevelDirPath, projectFilePath)
            .split(path.sep)
            .join(path.posix.sep);

        const log = await git.log({
            file: projectGitRelativeFilePath
        });

        const status = await git.status();

        if (status.modified.indexOf(projectGitRelativeFilePath) != -1) {
            revisions.push({
                hash: UNSTAGED_HASH,
                message: "[ Unstaged ]"
            });
        }

        if (status.staged.indexOf(projectGitRelativeFilePath) != -1) {
            revisions.push({
                hash: STAGED_HASH,
                message: "[ Staged ]"
            });
        }

        revisions.push(...log.all);

        projectEditorStore.uiStateStore.revisionsGitRefreshed = true;
    } catch (err) {
        console.error(err);
        revisions = [];
    }

    if (projectEditorStore.modified) {
        revisions.splice(0, 0, {
            hash: MEMORY_HASH,
            message: "[ Current changes ]"
        });
    }

    return revisions;
}

async function getRevisionProject(
    projectEditorStore: ProjectEditorStore,
    revision: Revision,
    progressCallback: (percent: number) => void
): Promise<Project> {
    if (revision.hash == MEMORY_HASH) {
        progressCallback(100);
        return projectEditorStore.project;
    }

    const projectFilePath = projectEditorStore.filePath!;

    let content: string;

    if (revision.hash == UNSTAGED_HASH) {
        content = await readTextFile(projectFilePath);
    } else {
        const projectTopLevelDirPath = await getProjectTopLevelDirPath(
            projectFilePath
        );

        const { simpleGit } = await import("simple-git");
        const git = simpleGit(projectTopLevelDirPath);

        const projectGitRelativeFilePath = path
            .relative(projectTopLevelDirPath, projectFilePath)
            .split(path.sep)
            .join(path.posix.sep);

        content = await git.show(
            `${
                revision.hash == STAGED_HASH ? "" : revision.hash
            }:${projectGitRelativeFilePath}`
        );
    }

    progressCallback(50);

    const revisionProjectEditorStore = new ProjectEditorStore();

    runInAction(() => {
        revisionProjectEditorStore.project = loadProject(
            projectEditorStore,
            content
        ) as Project;
    });

    progressCallback(100);

    return revisionProjectEditorStore.project;
}

export interface BeforeAfterProject {
    projectBefore: Project;
    projectAfter: Project;
}

export async function getBeforeAfterProject(
    projectEditorStore: ProjectEditorStore,
    revisionBefore: Revision | undefined,
    revisionAfter: Revision,
    progressCallback: (percent: number) => void
): Promise<BeforeAfterProject | undefined> {
    const SUBTASK_PERCENT = 45;

    const projectBefore: Project = revisionBefore
        ? await getRevisionProject(
              projectEditorStore,
              revisionBefore,
              percent => progressCallback(SUBTASK_PERCENT * (1 + percent / 100))
          )
        : ({} as any);

    const projectAfter = await getRevisionProject(
        projectEditorStore,
        revisionAfter,
        percent => progressCallback(SUBTASK_PERCENT * (percent / 100))
    );

    progressCallback(100);

    return {
        projectBefore: projectBefore,
        projectAfter: projectAfter
    };
}

import { readTextFile } from "eez-studio-shared/util-electron";
import { runInAction } from "mobx";
import path from "path";
import type { Project } from "project-editor/project/project";
import { getJSON, loadProject, ProjectEditorStore } from "project-editor/store";

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
    projectEditorStore: ProjectEditorStore
): Promise<Revision[]> {
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

    const revisions: Revision[] = [];

    if (projectEditorStore.modified) {
        revisions.push({
            hash: MEMORY_HASH,
            message: "[ Current changes ]"
        });
    }

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

    return revisions;
}

export async function getRevisionContent(
    projectEditorStore: ProjectEditorStore,
    revision: Revision,
    progressCallback: (percent: number) => void
): Promise<string> {
    if (revision.hash == MEMORY_HASH) {
        const json = getJSON(projectEditorStore);
        progressCallback(50);
        const result = JSON.parse(json);
        progressCallback(100);
        return result;
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

    progressCallback(25);

    const revisionProjectEditorStore = new ProjectEditorStore();

    runInAction(() => {
        revisionProjectEditorStore.project = loadProject(
            projectEditorStore,
            content
        ) as Project;
    });

    progressCallback(50);

    const json = getJSON(revisionProjectEditorStore);

    progressCallback(75);

    const result = JSON.parse(json);

    revisionProjectEditorStore.unmount();

    progressCallback(100);

    return result;
}

export async function diff(
    projectEditorStore: ProjectEditorStore,
    revisionBefore: Revision | undefined,
    revisionAfter: Revision,
    progressCallback: (percent: number) => void
): Promise<string | undefined> {
    const jsondiffpatch = await import("jsondiffpatch");

    const SUBTASK_PERCENT = 45;

    const afterContent = await getRevisionContent(
        projectEditorStore,
        revisionAfter,
        percent => progressCallback(SUBTASK_PERCENT * (percent / 100))
    );

    const beforeContent = revisionBefore
        ? await getRevisionContent(
              projectEditorStore,
              revisionBefore,
              percent => progressCallback(SUBTASK_PERCENT * (1 + percent / 100))
          )
        : {};

    const delta = jsondiffpatch
        .create({
            objectHash: function (obj: any, index: number) {
                return obj.objid || index;
            }
        })
        .diff(beforeContent, afterContent);
    if (!delta) {
        return undefined;
    }

    jsondiffpatch.formatters.html.hideUnchanged();
    const result = jsondiffpatch.formatters.html.format(delta, beforeContent);

    progressCallback(100);

    return result;
}

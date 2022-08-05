import { readTextFile } from "eez-studio-shared/util-electron";
import { runInAction } from "mobx";
import path from "path";
import {
    EezObject,
    PropertyInfo,
    PropertyType
} from "project-editor/core/object";
import type { Project } from "project-editor/project/project";
import {
    getClassInfo,
    loadProject,
    ProjectEditorStore
} from "project-editor/store";

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
            revisionProjectEditorStore,
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

export async function getBeforeAndAfterProject(
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

export interface ObjectChanges {
    objectBefore: EezObject;
    objectAfter: EezObject;
    changes: PropertyChange[];
}

type PropertyChange = {
    propertyInfo: PropertyInfo;
} & (
    | {
          type: "SAME";
      }
    | {
          type: "VALUE_CHANGED";
          valueBefore: any;
          valueAfter: any;
      }
    | {
          type: "VALUE_ADDED";
          value: any;
      }
    | {
          type: "VALUE_REMOVED";
          value: any;
      }
    | {
          type: "OBJECT_CHANGED";
          objectChanges: ObjectChanges;
      }
    | {
          type: "ARRAY_CHANGED";
          arrayChanges: ArrayChanges;
      }
);

export interface ArrayChanges {
    arrayBefore: EezObject[];
    arrayAfter: EezObject[];

    added: EezObject[];
    removed: EezObject[];
    changed: ObjectChanges[];
    moved: boolean;
}

export function diffObject(
    objectBefore: EezObject,
    objectAfter: EezObject
): ObjectChanges {
    const classInfo = getClassInfo(objectAfter);

    const changes: PropertyChange[] = classInfo.properties
        .filter(propertyInfo => !propertyInfo.computed)
        .map(propertyInfo => {
            const valueBefore = (objectBefore as any)[propertyInfo.name];
            const valueAfter = (objectAfter as any)[propertyInfo.name];

            if (!valueBefore && !valueAfter) {
                return {
                    propertyInfo,
                    type: "SAME"
                } as PropertyChange;
            }

            if (!valueBefore && valueAfter) {
                return {
                    propertyInfo,
                    type: "VALUE_ADDED",
                    value: valueAfter
                } as PropertyChange;
            }

            if (valueBefore && !valueAfter) {
                return {
                    propertyInfo,
                    type: "VALUE_REMOVED",
                    value: valueBefore
                } as PropertyChange;
            }

            if (propertyInfo.type == PropertyType.Array) {
                const arrayChanges = diffArray(
                    (objectBefore as any)[propertyInfo.name],
                    (objectAfter as any)[propertyInfo.name]
                );

                if (
                    arrayChanges.added.length == 0 &&
                    arrayChanges.removed.length == 0 &&
                    arrayChanges.changed.length == 0 &&
                    !arrayChanges.moved
                ) {
                    return {
                        propertyInfo,
                        type: "SAME"
                    } as PropertyChange;
                }

                return {
                    propertyInfo,
                    type: "ARRAY_CHANGED",
                    arrayChanges
                } as PropertyChange;
            } else if (propertyInfo.type == PropertyType.Object) {
                const objectChanges = diffObject(
                    (objectBefore as any)[propertyInfo.name],
                    (objectAfter as any)[propertyInfo.name]
                );

                if (objectChanges.changes.length == 0) {
                    return {
                        propertyInfo,
                        type: "SAME"
                    } as PropertyChange;
                }

                return {
                    propertyInfo,
                    type: "OBJECT_CHANGED",
                    objectChanges
                } as PropertyChange;
            } else {
                if (JSON.stringify(valueBefore) == JSON.stringify(valueAfter)) {
                    return {
                        propertyInfo,
                        type: "SAME"
                    } as PropertyChange;
                }

                return {
                    propertyInfo,
                    type: "VALUE_CHANGED",
                    valueBefore,
                    valueAfter
                } as PropertyChange;
            }
        })
        .filter(propertyChange => propertyChange.type != "SAME");

    return {
        objectBefore,
        objectAfter,
        changes
    };
}

function diffArray(
    arrayBefore: EezObject[],
    arrayAfter: EezObject[]
): ArrayChanges {
    const added: EezObject[] = [];
    const removed: EezObject[] = [];
    const changed: ObjectChanges[] = [];
    let moved = false;

    for (let indexAfter = 0; indexAfter < arrayAfter.length; indexAfter++) {
        const elementAfter = arrayAfter[indexAfter];

        const indexBefore = arrayBefore.findIndex(
            elementBefore => elementBefore.objID == elementAfter.objID
        );

        if (indexBefore == -1) {
            added.push(elementAfter);
        } else {
            const elementBefore = arrayBefore[indexBefore];

            const objectChanges = diffObject(elementBefore, elementAfter);
            if (objectChanges.changes.length > 0) {
                changed.push(objectChanges);
            }

            if (indexBefore != indexAfter) {
                moved = true;
            }
        }
    }

    for (let indexBefore = 0; indexBefore < arrayBefore.length; indexBefore++) {
        const elementBefore = arrayBefore[indexBefore];
        const indexAfter = arrayAfter.findIndex(
            elementAfter => elementAfter.objID == elementBefore.objID
        );
        if (indexAfter == -1) {
            removed.push(elementBefore);
        }
    }

    return {
        arrayBefore,
        arrayAfter,
        added,
        removed,
        changed,
        moved: moved && added.length == 0 && removed.length == 0
    };
}

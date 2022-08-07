import { readTextFile } from "eez-studio-shared/util-electron";
import { runInAction, toJS } from "mobx";
import path from "path";
import {
    EezObject,
    PropertyInfo,
    PropertyType
} from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Project } from "project-editor/project/project";
import {
    addObject,
    createObject,
    deleteObject,
    getClassInfo,
    getObjectFromStringPath,
    getObjectPathAsString,
    loadProject,
    ProjectEditorStore,
    replaceObject,
    updateObject
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
        console.warn(err);

        revisions = [
            {
                hash: UNSTAGED_HASH,
                message: "[ Unstaged ]"
            }
        ];
    }

    if (projectEditorStore.modified) {
        revisions.splice(0, 0, {
            hash: MEMORY_HASH,
            message: "[ Current changes ]"
        });
    }

    return revisions;
}

export async function refreshRevisions(
    projectEditorStore: ProjectEditorStore,
    forceGitRefresh: boolean = true
) {
    runInAction(() => {
        projectEditorStore.uiStateStore.revisionsRefreshing = true;
    });

    let revisions: Revision[] = await getRevisions(
        projectEditorStore,
        forceGitRefresh
    );

    runInAction(() => {
        projectEditorStore.uiStateStore.revisions = revisions;
        projectEditorStore.uiStateStore.revisionsRefreshing = false;
    });
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
        revisionProjectEditorStore.setProject(
            loadProject(revisionProjectEditorStore, content) as Project,
            undefined
        );
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

export type RevertChange = ((project: Project) => void) | undefined;

export type PropertyChange = {
    propertyInfo: PropertyInfo;
    revert: RevertChange;
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

    added: { object: EezObject; revert: RevertChange }[];
    removed: { object: EezObject; revert: RevertChange }[];
    changed: {
        objectChanges: ObjectChanges;
        revert: RevertChange;
    }[];
    moved: RevertChange;
}

export function diffObject(
    objectBefore: EezObject,
    objectAfter: EezObject
): ObjectChanges {
    const classInfo = getClassInfo(objectAfter);

    const changes: PropertyChange[] = classInfo.properties
        .filter(propertyInfo => !propertyInfo.computed)
        .map(propertyInfo => {
            let propertyChange: PropertyChange;

            const valueBefore = (objectBefore as any)[propertyInfo.name];
            const valueAfter = (objectAfter as any)[propertyInfo.name];

            if (!valueBefore && !valueAfter) {
                propertyChange = {
                    propertyInfo,
                    type: "SAME",
                    revert: undefined
                };
            } else if (!valueBefore && valueAfter) {
                let mandatoryFeature = false;
                if (objectAfter instanceof ProjectEditor.ProjectClass) {
                    mandatoryFeature = true;
                }

                propertyChange = {
                    propertyInfo,
                    type: "VALUE_ADDED",
                    value: valueAfter,
                    revert: mandatoryFeature
                        ? undefined
                        : (project: Project) => {
                              const object = getObjectFromStringPath(
                                  project,
                                  getObjectPathAsString(objectAfter)
                              );
                              updateObject(object, {
                                  [propertyInfo.name]: undefined
                              });
                          }
                };
            } else if (valueBefore && !valueAfter) {
                propertyChange = {
                    propertyInfo,
                    type: "VALUE_REMOVED",
                    value: valueBefore,
                    revert: (project: Project) => {
                        const object = getObjectFromStringPath(
                            project,
                            getObjectPathAsString(objectAfter)
                        );

                        let value;
                        if (
                            propertyInfo.type == PropertyType.Object ||
                            propertyInfo.type == PropertyType.Array
                        ) {
                            value = createObject(
                                project._DocumentStore,
                                toJS(valueBefore),
                                propertyInfo.typeClass!,
                                undefined,
                                false
                            );
                        } else {
                            value = valueBefore;
                        }

                        updateObject(object, {
                            [propertyInfo.name]: value
                        });
                    }
                };
            } else if (propertyInfo.type == PropertyType.Array) {
                const arrayChanges = diffArray(
                    propertyInfo,
                    (objectBefore as any)[propertyInfo.name],
                    (objectAfter as any)[propertyInfo.name]
                );

                if (
                    arrayChanges.added.length == 0 &&
                    arrayChanges.removed.length == 0 &&
                    arrayChanges.changed.length == 0 &&
                    !arrayChanges.moved
                ) {
                    propertyChange = {
                        propertyInfo,
                        type: "SAME",
                        revert: undefined
                    };
                } else {
                    propertyChange = {
                        propertyInfo,
                        type: "ARRAY_CHANGED",
                        arrayChanges,
                        revert: (project: Project) => {
                            const object = getObjectFromStringPath(
                                project,
                                getObjectPathAsString(objectAfter)
                            );

                            let value = createObject(
                                project._DocumentStore,
                                toJS(valueBefore),
                                propertyInfo.typeClass!,
                                undefined,
                                false
                            );

                            updateObject(object, {
                                [propertyInfo.name]: value
                            });
                        }
                    };
                }
            } else if (propertyInfo.type == PropertyType.Object) {
                const objectChanges = diffObject(
                    (objectBefore as any)[propertyInfo.name],
                    (objectAfter as any)[propertyInfo.name]
                );

                if (objectChanges.changes.length == 0) {
                    propertyChange = {
                        propertyInfo,
                        type: "SAME",
                        revert: undefined
                    };
                } else {
                    propertyChange = {
                        propertyInfo,
                        type: "OBJECT_CHANGED",
                        objectChanges,
                        revert: (project: Project) => {
                            const object = getObjectFromStringPath(
                                project,
                                getObjectPathAsString(objectAfter)
                            );

                            let value = createObject(
                                project._DocumentStore,
                                toJS(valueBefore),
                                propertyInfo.typeClass!,
                                undefined,
                                false
                            );

                            updateObject(object, {
                                [propertyInfo.name]: value
                            });
                        }
                    };
                }
            } else {
                if (JSON.stringify(valueBefore) == JSON.stringify(valueAfter)) {
                    propertyChange = {
                        propertyInfo,
                        type: "SAME",
                        revert: undefined
                    };
                } else {
                    propertyChange = {
                        propertyInfo,
                        type: "VALUE_CHANGED",
                        valueBefore,
                        valueAfter,
                        revert: (project: Project) => {
                            const object = getObjectFromStringPath(
                                project,
                                getObjectPathAsString(objectAfter)
                            );

                            let value;
                            if (
                                propertyInfo.type == PropertyType.Object ||
                                propertyInfo.type == PropertyType.Array
                            ) {
                                value = createObject(
                                    project._DocumentStore,
                                    toJS(valueBefore),
                                    propertyInfo.typeClass!,
                                    undefined,
                                    false
                                );
                            } else {
                                value = valueBefore;
                            }

                            updateObject(object, {
                                [propertyInfo.name]: value
                            });
                        }
                    };
                }
            }

            return propertyChange;
        })
        .filter(propertyChange => propertyChange.type != "SAME");

    return {
        objectBefore,
        objectAfter,
        changes
    };
}

function diffArray(
    propertyInfo: PropertyInfo,
    arrayBefore: EezObject[],
    arrayAfter: EezObject[]
): ArrayChanges {
    const added: { object: EezObject; revert: RevertChange }[] = [];
    const removed: { object: EezObject; revert: RevertChange }[] = [];
    const changed: {
        objectChanges: ObjectChanges;
        revert: RevertChange;
    }[] = [];
    let moved: RevertChange = undefined;

    for (let indexAfter = 0; indexAfter < arrayAfter.length; indexAfter++) {
        const elementAfter = arrayAfter[indexAfter];

        const indexBefore = arrayBefore.findIndex(
            elementBefore => elementBefore.objID == elementAfter.objID
        );

        if (indexBefore == -1) {
            added.push({
                object: elementAfter,
                revert: (project: Project) => {
                    const object = getObjectFromStringPath(
                        project,
                        getObjectPathAsString(elementAfter)
                    );

                    deleteObject(object);
                }
            });
        } else {
            const elementBefore = arrayBefore[indexBefore];

            const objectChanges = diffObject(elementBefore, elementAfter);
            if (objectChanges.changes.length > 0) {
                changed.push({
                    objectChanges,
                    revert: (project: Project) => {
                        const object = getObjectFromStringPath(
                            project,
                            getObjectPathAsString(elementAfter)
                        );

                        const value = createObject(
                            project._DocumentStore,
                            toJS(elementBefore),
                            propertyInfo.typeClass!,
                            undefined,
                            false
                        );

                        replaceObject(object, value);
                    }
                });
            }

            if (indexBefore != indexAfter) {
                moved = (project: Project) => {
                    console.warn("NOT IMPLEMENTED");
                };
            }
        }
    }

    for (let indexBefore = 0; indexBefore < arrayBefore.length; indexBefore++) {
        const elementBefore = arrayBefore[indexBefore];
        const indexAfter = arrayAfter.findIndex(
            elementAfter => elementAfter.objID == elementBefore.objID
        );
        if (indexAfter == -1) {
            removed.push({
                object: elementBefore,
                revert: (project: Project) => {
                    const object = getObjectFromStringPath(
                        project,
                        getObjectPathAsString(arrayAfter)
                    );

                    const value = createObject(
                        project._DocumentStore,
                        toJS(elementBefore),
                        propertyInfo.typeClass!,
                        undefined,
                        false
                    );

                    addObject(object, value);
                }
            });
        }
    }

    return {
        arrayBefore,
        arrayAfter,
        added,
        removed,
        changed,
        moved:
            moved && added.length == 0 && removed.length == 0
                ? moved
                : undefined
    };
}

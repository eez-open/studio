import { readTextFile } from "eez-studio-shared/util-electron";
import { computed, makeObservable, observable, runInAction, toJS } from "mobx";
import path from "path";
import {
    EezObject,
    PropertyInfo,
    PropertyType
} from "project-editor/core/object";
import { Component } from "project-editor/flow/component";
import { ConnectionLine } from "project-editor/flow/connection-line";
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
    ProjectStore,
    replaceObject,
    updateObject
} from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export const MEMORY_HASH = "memory";
export const UNSTAGED_HASH = "unstaged";
export const STAGED_HASH = "staged";
export const FILE_PATH_HASH_PREFIX = "file_path:";

export interface Revision {
    hash: string;
    message: string;
    date?: string;
    author_name?: string;
    author_email?: string;
}

interface CompareRevisionsPair {
    revisionAfter: Revision | undefined;
    revisionBefore: Revision | undefined;
}

export function getHashFromFilePath(filePath: string) {
    return FILE_PATH_HASH_PREFIX + filePath;
}

export function getFilePathFromHash(hash: string) {
    return hash.startsWith(FILE_PATH_HASH_PREFIX)
        ? hash.substring(FILE_PATH_HASH_PREFIX.length)
        : undefined;
}

export function getHashLabel(hash: string | undefined) {
    if (!hash) {
        return "[None]";
    }

    if (hash == MEMORY_HASH) {
        return "[Memory content]";
    }

    if (hash == UNSTAGED_HASH) {
        return "[File content]";
    }

    if (hash == STAGED_HASH) {
        return "[Staged]";
    }

    const filePath = getFilePathFromHash(hash);
    if (filePath) {
        return filePath;
    }

    return hash.slice(0, 8);
}

const MEMORY_REVISION = {
    hash: MEMORY_HASH,
    message: getHashLabel(MEMORY_HASH)
};

const UNSTAGED_REVISION = {
    hash: UNSTAGED_HASH,
    message: getHashLabel(UNSTAGED_HASH)
};

const STAGED_REVISION = {
    hash: STAGED_HASH,
    message: getHashLabel(STAGED_HASH)
};

export class ChangesState {
    constructor() {
        makeObservable(this, {
            revisionsRefreshing: observable,
            revisions: observable,
            selectedRevisionHash: observable,
            revisionForCompareHash: observable,
            comparePair: computed
        });
    }

    revisionsGitRefreshed: boolean = false;
    revisionsRefreshing: boolean = false;
    revisions: Revision[] = [];
    selectedRevisionHash: string | undefined;
    revisionForCompareHash: string | undefined;

    getRevisionFromHash(hash: string): Revision | undefined {
        if (getFilePathFromHash(hash)) {
            return {
                hash,
                message: hash
            };
        }

        if (hash == MEMORY_HASH) {
            return MEMORY_REVISION;
        }

        if (hash == UNSTAGED_HASH) {
            return UNSTAGED_REVISION;
        }

        if (hash == STAGED_HASH) {
            return STAGED_REVISION;
        }

        return this.revisions.find(revision => revision.hash == hash);
    }

    async _getRevisions(
        projectStore: ProjectStore,
        forceGitRefresh: boolean
    ): Promise<Revision[]> {
        if (!forceGitRefresh && this.revisionsGitRefreshed) {
            return this.revisions.slice();
        }

        let revisions: Revision[] = [];

        try {
            const projectFilePath = projectStore.filePath!;
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
                revisions.push(UNSTAGED_REVISION);
            }

            if (status.staged.indexOf(projectGitRelativeFilePath) != -1) {
                revisions.push(STAGED_REVISION);
            }

            revisions.push(...log.all);

            this.revisionsGitRefreshed = true;
        } catch (err) {
            console.warn(err);

            revisions = [UNSTAGED_REVISION];
        }

        revisions.splice(0, 0, MEMORY_REVISION);

        return revisions;
    }

    async refreshRevisions(
        projectStore: ProjectStore,
        forceGitRefresh: boolean = true
    ) {
        runInAction(() => {
            this.revisionsRefreshing = true;
        });

        let revisions: Revision[] = await this._getRevisions(
            projectStore,
            forceGitRefresh
        );

        runInAction(() => {
            this.revisions = revisions;
            this.revisionsRefreshing = false;
        });
    }

    get comparePair(): CompareRevisionsPair {
        let revisionAfter = undefined;
        let revisionBefore = undefined;

        if (this.selectedRevisionHash) {
            if (this.revisionForCompareHash) {
                revisionAfter = this.getRevisionFromHash(
                    this.selectedRevisionHash
                );
                revisionBefore = this.getRevisionFromHash(
                    this.revisionForCompareHash
                );
            } else {
                const index = this.revisions.findIndex(
                    revision => revision.hash == this.selectedRevisionHash
                );

                if (index != -1) {
                    revisionAfter = this.revisions[index];

                    if (index != -1 && index + 1 < this.revisions.length) {
                        revisionBefore = this.revisions[index + 1];
                    }
                }
            }
        }

        return {
            revisionAfter,
            revisionBefore
        };
    }
}

////////////////////////////////////////////////////////////////////////////////

export abstract class ProjectChange {
    constructor(public revertable: boolean) {}

    abstract revert(project: Project): void;
}

export abstract class ObjectPropertyChange extends ProjectChange {
    constructor(
        public objectBefore: EezObject,
        public objectAfter: EezObject,
        public propertyInfo: PropertyInfo,
        revertable: boolean
    ) {
        super(revertable);
    }

    abstract revert(project: Project): void;
}

export class PropertyValueAdded extends ObjectPropertyChange {
    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.objectAfter)
        );
        updateObject(object, {
            [this.propertyInfo.name]: undefined
        });
    }
}

export class PropertyValueRemoved extends ObjectPropertyChange {
    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.objectAfter)
        );

        let valueBefore = (this.objectBefore as any)[this.propertyInfo.name];
        let value;
        if (
            this.propertyInfo.type == PropertyType.Object ||
            this.propertyInfo.type == PropertyType.Array
        ) {
            value = createObject(
                project._store,
                toJS(valueBefore),
                this.propertyInfo.typeClass!,
                undefined,
                false
            );
        } else {
            value = valueBefore;
        }

        updateObject(object, {
            [this.propertyInfo.name]: value
        });
    }
}

export class PropertyValueUpdated extends ObjectPropertyChange {
    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.objectAfter)
        );

        let valueBefore = (this.objectBefore as any)[this.propertyInfo.name];
        let value;
        if (
            this.propertyInfo.type == PropertyType.Object ||
            this.propertyInfo.type == PropertyType.Array
        ) {
            value = createObject(
                project._store,
                toJS(valueBefore),
                this.propertyInfo.typeClass!,
                undefined,
                false
            );
        } else {
            value = valueBefore;
        }

        updateObject(object, {
            [this.propertyInfo.name]: value
        });
    }
}

export class ObjectPropertyValueUpdated extends ObjectPropertyChange {
    constructor(
        objectBefore: EezObject,
        objectAfter: EezObject,
        propertyInfo: PropertyInfo,
        revertable: boolean,
        public objectChanges: ObjectChanges
    ) {
        super(objectBefore, objectAfter, propertyInfo, revertable);
    }

    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.objectAfter)
        );

        let valueBefore = (this.objectBefore as any)[this.propertyInfo.name];
        let value = createObject(
            project._store,
            toJS(valueBefore),
            this.propertyInfo.typeClass!,
            undefined,
            false
        );

        updateObject(object, {
            [this.propertyInfo.name]: value
        });
    }
}

export class ArrayPropertyValueUpdated extends ObjectPropertyChange {
    constructor(
        objectBefore: EezObject,
        objectAfter: EezObject,
        propertyInfo: PropertyInfo,
        revertable: boolean,
        public arrayChanges: ArrayChanges
    ) {
        super(objectBefore, objectAfter, propertyInfo, revertable);
    }

    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.objectAfter)
        );

        let valueBefore = (this.objectBefore as any)[this.propertyInfo.name];
        let value = createObject(
            project._store,
            toJS(valueBefore),
            this.propertyInfo.typeClass!,
            undefined,
            false
        );

        updateObject(object, {
            [this.propertyInfo.name]: value
        });
    }
}

export abstract class ArrayPropertyChange extends ProjectChange {
    constructor(
        public arrayBefore: EezObject[],
        public arrayAfter: EezObject[],
        public propertyInfo: PropertyInfo,
        public elementIndexBefore: number,
        public elementIndexAfter: number
    ) {
        super(true);
    }
}

export class ArrayElementAdded extends ArrayPropertyChange {
    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.arrayAfter[this.elementIndexAfter])
        );

        deleteObject(object);
    }
}

export class ArrayElementRemoved extends ArrayPropertyChange {
    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.arrayAfter)
        );

        const value = createObject(
            project._store,
            toJS(this.arrayBefore[this.elementIndexBefore]),
            this.propertyInfo.typeClass!,
            undefined,
            false
        );

        addObject(object, value);
    }
}

export class ArrayElementUpdated extends ArrayPropertyChange {
    constructor(
        arrayBefore: EezObject[],
        arrayAfter: EezObject[],
        propertyInfo: PropertyInfo,
        elementIndexBefore: number,
        elementIndexAfter: number,
        public objectChanges: ObjectChanges
    ) {
        super(
            arrayBefore,
            arrayAfter,
            propertyInfo,
            elementIndexBefore,
            elementIndexAfter
        );
    }

    revert(project: Project) {
        const object = getObjectFromStringPath(
            project,
            getObjectPathAsString(this.arrayAfter[this.elementIndexAfter])
        );

        const value = createObject(
            project._store,
            toJS(this.arrayBefore[this.elementIndexBefore]),
            this.propertyInfo.typeClass!,
            undefined,
            false
        );

        replaceObject(object, value);
    }
}

class ArrayShuffled extends ProjectChange {
    constructor(
        public arrayBefore: EezObject[],
        public arrayAfter: EezObject[]
    ) {
        super(true);
    }

    revert(project: Project) {
        console.warn("NOT IMPLEMENTED");
    }
}

////////////////////////////////////////////////////////////////////////////////

export class ObjectChanges {
    constructor(
        public objectBefore: EezObject,
        public objectAfter: EezObject,
        public changes: ObjectPropertyChange[]
    ) {}
}

export class ArrayChanges {
    constructor(
        public arrayBefore: EezObject[],
        public arrayAfter: EezObject[],
        public changes: ArrayPropertyChange[],
        public shuffled: ArrayShuffled | undefined
    ) {}
}

////////////////////////////////////////////////////////////////////////////////

export function diffObject(
    objectBefore: EezObject,
    objectAfter: EezObject
): ObjectChanges {
    const classInfo = getClassInfo(objectAfter);

    const changes: ObjectPropertyChange[] = classInfo.properties
        .filter(propertyInfo => {
            if (propertyInfo.computed) {
                return false;
            }

            if (
                propertyInfo.name === "changes" &&
                objectAfter instanceof ProjectEditor.ProjectClass
            ) {
                return false;
            }

            return true;
        })
        .map(propertyInfo => {
            let propertyChange: ObjectPropertyChange | undefined;

            const valueBefore = (objectBefore as any)[propertyInfo.name];
            const valueAfter = (objectAfter as any)[propertyInfo.name];

            if (valueBefore === undefined && valueAfter === undefined) {
                propertyChange = undefined;
            } else if (valueBefore === undefined && valueAfter !== undefined) {
                let mandatoryFeature = false;
                if (objectAfter instanceof ProjectEditor.ProjectClass) {
                    mandatoryFeature = true;
                }

                propertyChange = new PropertyValueAdded(
                    objectBefore,
                    objectAfter,
                    propertyInfo,
                    !mandatoryFeature
                );
            } else if (valueBefore !== undefined && valueAfter === undefined) {
                propertyChange = new PropertyValueRemoved(
                    objectBefore,
                    objectAfter,
                    propertyInfo,
                    true
                );
            } else if (propertyInfo.type == PropertyType.Array) {
                const arrayChanges = diffArray(
                    propertyInfo,
                    (objectBefore as any)[propertyInfo.name],
                    (objectAfter as any)[propertyInfo.name]
                );

                if (
                    arrayChanges.changes.length == 0 &&
                    !arrayChanges.shuffled
                ) {
                    propertyChange = undefined;
                } else {
                    propertyChange = new ArrayPropertyValueUpdated(
                        objectBefore,
                        objectAfter,
                        propertyInfo,
                        true,
                        arrayChanges
                    );
                }
            } else if (propertyInfo.type == PropertyType.Object) {
                const objectChanges = diffObject(
                    (objectBefore as any)[propertyInfo.name],
                    (objectAfter as any)[propertyInfo.name]
                );

                if (objectChanges.changes.length == 0) {
                    propertyChange = undefined;
                } else {
                    propertyChange = new ObjectPropertyValueUpdated(
                        objectBefore,
                        objectAfter,
                        propertyInfo,
                        true,
                        objectChanges
                    );
                }
            } else {
                if (JSON.stringify(valueBefore) == JSON.stringify(valueAfter)) {
                    propertyChange = undefined;
                } else {
                    propertyChange = new PropertyValueUpdated(
                        objectBefore,
                        objectAfter,
                        propertyInfo,
                        true
                    );
                }
            }

            return propertyChange;
        })
        .filter(
            propertyChange => propertyChange != undefined
        ) as ObjectPropertyChange[];

    return new ObjectChanges(objectBefore, objectAfter, changes);
}

function diffArray(
    propertyInfo: PropertyInfo,
    arrayBefore: EezObject[],
    arrayAfter: EezObject[]
): ArrayChanges {
    const changes: ArrayPropertyChange[] = [];
    let shuffled: ArrayShuffled | undefined;

    for (let indexAfter = 0; indexAfter < arrayAfter.length; indexAfter++) {
        const elementAfter = arrayAfter[indexAfter];

        const indexBefore = arrayBefore.findIndex(
            elementBefore => elementBefore.objID == elementAfter.objID
        );

        if (indexBefore == -1) {
            changes.push(
                new ArrayElementAdded(
                    arrayBefore,
                    arrayAfter,
                    propertyInfo,
                    indexBefore,
                    indexAfter
                )
            );
        } else {
            const elementBefore = arrayBefore[indexBefore];

            const objectChanges = diffObject(elementBefore, elementAfter);
            if (objectChanges.changes.length > 0) {
                changes.push(
                    new ArrayElementUpdated(
                        arrayBefore,
                        arrayAfter,
                        propertyInfo,
                        indexBefore,
                        indexAfter,
                        objectChanges
                    )
                );
            }

            if (indexBefore != indexAfter) {
                shuffled = new ArrayShuffled(arrayBefore, arrayAfter);
            }
        }
    }

    for (let indexBefore = 0; indexBefore < arrayBefore.length; indexBefore++) {
        const elementBefore = arrayBefore[indexBefore];
        const indexAfter = arrayAfter.findIndex(
            elementAfter => elementAfter.objID == elementBefore.objID
        );
        if (indexAfter == -1) {
            changes.push(
                new ArrayElementRemoved(
                    arrayBefore,
                    arrayAfter,
                    propertyInfo,
                    indexBefore,
                    indexAfter
                )
            );
        }
    }

    return new ArrayChanges(
        arrayBefore,
        arrayAfter,
        changes,
        shuffled &&
        !changes.find(
            change =>
                change instanceof ArrayElementAdded ||
                change instanceof ArrayElementRemoved
        )
            ? shuffled
            : undefined
    );
}

////////////////////////////////////////////////////////////////////////////////

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

async function getRevisionProject(
    projectStore: ProjectStore,
    revision: Revision,
    progressCallback: (percent: number) => void
): Promise<Project> {
    if (revision.hash == MEMORY_HASH) {
        progressCallback(100);
        return projectStore.project;
    }

    let content: string;

    const filePath = getFilePathFromHash(revision.hash);
    if (filePath) {
        content = await readTextFile(filePath);
    } else {
        const projectFilePath = projectStore.filePath!;

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
    }

    progressCallback(50);

    const revisionProjectStore = new ProjectStore({ type: "project-editor" });

    runInAction(() => {
        revisionProjectStore.setProject(
            loadProject(revisionProjectStore, content, false) as Project,
            undefined
        );
    });

    progressCallback(100);

    return revisionProjectStore.project;
}

export interface BeforeAfterProject {
    projectBefore: Project;
    projectAfter: Project;
}

export async function getBeforeAndAfterProject(
    projectStore: ProjectStore,
    revisionBefore: Revision | undefined,
    revisionAfter: Revision,
    progressCallback: (percent: number) => void
): Promise<BeforeAfterProject | undefined> {
    try {
        const SUBTASK_PERCENT = 45;

        const projectBefore: Project = revisionBefore
            ? await getRevisionProject(projectStore, revisionBefore, percent =>
                  progressCallback(SUBTASK_PERCENT * (1 + percent / 100))
              )
            : ({} as any);

        const projectAfter = await getRevisionProject(
            projectStore,
            revisionAfter,
            percent => progressCallback(SUBTASK_PERCENT * (percent / 100))
        );

        progressCallback(100);

        return {
            projectBefore: projectBefore,
            projectAfter: projectAfter
        };
    } catch (err) {
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

export type ChangeOperations = "added" | "removed" | "updated";

export type ChangedFlowObjects = {
    object: Component | ConnectionLine;
    operation: ChangeOperations;
}[];

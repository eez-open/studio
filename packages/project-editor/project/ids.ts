import path from "path";

import {
    MessageType,
    type IEezObject,
    type IMessage
} from "project-editor/core/object";
import { Message, type ProjectStore } from "project-editor/store";
import { getProject, type Project } from "project-editor/project/project";
import { getProjectWithThemes } from "project-editor/features/style/theme";
import { isBB3ModuleField } from "project-editor/features/variable/bb3-module-field-unit";

// An object with an ID is built at the index of its ID (see Assets): the ID is
// what the module projects and the generated C++ code use. The IDs of a kind
// must have no gaps (from 1, the colors from 0), otherwise the project can't be
// built. A project that doesn't export (a project with a master project, or
// "Export objects with an ID" off, see Project.exportsObjects) has no objects
// with an ID.

type IdKind =
    | "page"
    | "global variable"
    | "action"
    | "style"
    | "font"
    | "bitmap"
    | "color";

const ID_KINDS: IdKind[] = [
    "page",
    "global variable",
    "action",
    "style",
    "font",
    "bitmap",
    "color"
];

// the ID property is hidden in a project that doesn't export (see
// Project.exportsObjects), unless the object has one (a paste drops it, see
// dropIdsInProjectThatDoesntExport, but a file can have one): then it can be
// removed
export function isIdHidden(object: IEezObject) {
    const project = getProject(object);
    return (
        !!project &&
        !project.exportsObjects &&
        (object as { id?: number }).id == undefined
    );
}

// the objects the build places by their ID, as Assets collects them
function getObjects(
    projectStore: ProjectStore,
    project: Project,
    kind: IdKind
): { id?: number; name: string }[] {
    const hasFlowSupport = projectStore.projectTypeTraits.hasFlowSupport;
    switch (kind) {
        case "page":
            return project.pages;
        case "global variable":
            return (project.variables?.globalVariables ?? []).filter(
                variable =>
                    (!hasFlowSupport || variable.native) &&
                    !(
                        projectStore.project.bb3ModuleMetadata &&
                        isBB3ModuleField(variable)
                    )
            );
        case "action":
            return project.actions.filter(
                action =>
                    !hasFlowSupport || action.implementationType == "native"
            );
        case "style":
            return project.allStyles;
        case "font":
            return project.fonts ?? [];
        case "bitmap":
            return project.bitmaps ?? [];
        case "color":
            return project.colors ?? [];
    }
}

function formatIds(ids: number[]) {
    const parts: string[] = [];
    for (let i = 0; i < ids.length; ) {
        let j = i;
        while (j + 1 < ids.length && ids[j + 1] == ids[j] + 1) {
            j++;
        }
        parts.push(j > i ? `${ids[i]}-${ids[j]}` : `${ids[i]}`);
        i = j + 1;
    }
    return parts.join(", ");
}

function getIdError(projectStore: ProjectStore, kind: IdKind) {
    const project = projectStore.project;
    const masterProject = project.settings.general.masterProject;

    // the colors of a module project are found by name (see module colors)
    if (masterProject && kind == "color") {
        return undefined;
    }

    // a project that doesn't export has no objects with an ID
    if (!project.exportsObjects) {
        const names = getObjects(projectStore, project, kind)
            .filter(object => object.id != undefined)
            .map(object => object.name);
        if (names.length > 0) {
            return `${
                masterProject
                    ? "A project with a master project doesn't export"
                    : `"Export objects with an ID" is off in the project settings`
            }, remove the ID of: ${names.join(", ")}`;
        }
    }

    // the project and its imports are built together, the colors come from
    // the project with the themes
    const projects =
        kind == "color"
            ? [getProjectWithThemes(projectStore)]
            : projectStore.openProjectsManager?.projects ?? [
                  projectStore.project
              ];

    const ids = new Set<number>();
    const sourceProjects = new Set<Project>();
    for (const project of projects) {
        for (const object of getObjects(projectStore, project, kind)) {
            if (object.id != undefined) {
                ids.add(object.id);
                sourceProjects.add(project);
            }
        }
    }

    const missingIds: number[] = [];
    const maxId = Math.max(-1, ...ids);
    for (let id = kind == "color" ? 0 : 1; id < maxId; id++) {
        if (!ids.has(id)) {
            missingIds.push(id);
        }
    }
    if (missingIds.length == 0) {
        return undefined;
    }

    const source = [...sourceProjects]
        .filter(project => project != projectStore.project)
        .map(project =>
            path.basename(
                projectStore.openProjectsManager?.getProjectFilePath(project) ??
                    project.projectName
            )
        )
        .join(", ");

    return `Gap in the ${kind} IDs${
        source ? ` in ${source}` : ""
    }: ${formatIds(
        missingIds
    )} not used (an object with an ID is built at the index of its ID)`;
}

export function checkIds(
    projectStore: ProjectStore,
    kind: IdKind,
    object: IEezObject,
    messages: IMessage[]
) {
    const error = getIdError(projectStore, kind);
    if (error) {
        messages.push(new Message(MessageType.ERROR, error, object));
    }
}

// the errors that stop the build
export function getIdErrors(projectStore: ProjectStore) {
    return ID_KINDS.map(kind => getIdError(projectStore, kind)).filter(
        (error): error is string => error != undefined
    );
}

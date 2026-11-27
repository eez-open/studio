import {
    EezObject,
    IEezObject,
    IMessage,
    MessageType,
    getParent,
    getProperty,
    getRootObject
} from "project-editor/core/object";
import type { Project } from "./project";
import {
    Message,
    ProjectStore,
    findPropertyByNameInObject,
    getAncestorOfType,
    getChildOfObject,
    propertyNotFoundMessage,
    propertyNotSetMessage,
    propertyNotUniqueMessage
} from "project-editor/store";
import type { AssetType } from "project-editor/project/assets";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { Flow } from "project-editor/flow/flow";
import type { Page } from "project-editor/features/page/page";

export function findAllReferencedObjects(
    project: Project,
    referencedObjectCollectionPath: string,
    referencedObjectName: string
) {
    return project._assets.maps["name"].allAssets.get(
        referencedObjectCollectionPath + "/" + referencedObjectName
    );
}

export function checkObjectReference(
    object: IEezObject,
    propertyName: string,
    messages: IMessage[],
    mandatory?: boolean
) {
    const value = getProperty(object, propertyName);
    if (value) {
        const propertyInfo = findPropertyByNameInObject(object, propertyName);
        if (!propertyInfo) {
            throw `unknow object property: ${propertyName}`;
        }
        if (!propertyInfo.referencedObjectCollectionPath) {
            throw `no referencedObjectCollectionPath for property: ${propertyName}`;
        }

        const objects = findAllReferencedObjects(
            getProject(object),
            propertyInfo.referencedObjectCollectionPath,
            value
        );

        if (!objects || objects.length == 0) {
            messages.push(propertyNotFoundMessage(object, propertyName));
        } else if (objects.length > 1) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `Ambiguous, found in multiple projects: ${objects
                        .map(object => getProject(object).projectName)
                        .join(", ")}`,
                    getChildOfObject(object, propertyName)
                )
            );
        }
    } else {
        if (mandatory) {
            messages.push(propertyNotSetMessage(object, propertyName));
        }
    }
}

export function getProject(object: IEezObject) {
    return getRootObject(object) as Project;
}

export function getFlow(object: IEezObject) {
    return getAncestorOfType(object, ProjectEditor.FlowClass.classInfo) as Flow;
}

export function getPage(object: IEezObject) {
    return getAncestorOfType(object, ProjectEditor.PageClass.classInfo) as Page;
}

export function isObjectReadOnly(object: IEezObject) {
    return getProject(object)._isReadOnly;
}

export function isAnyObjectReadOnly(objects: IEezObject[]) {
    return !!objects.find(isObjectReadOnly);
}

// A module project can use these items of its master project when they have
// an "id": global variables, actions, pages, user widgets, styles, fonts,
// bitmaps and colors.
function isExportableAsset(object: IEezObject) {
    if (object instanceof ProjectEditor.VariableClass) {
        const variables = getProject(object)?.variables;
        return !!variables && getParent(object) === variables.globalVariables;
    }
    return (
        object instanceof ProjectEditor.ActionClass ||
        object instanceof ProjectEditor.PageClass ||
        object instanceof ProjectEditor.StyleClass ||
        object instanceof ProjectEditor.FontClass ||
        object instanceof ProjectEditor.BitmapClass ||
        object instanceof ProjectEditor.ColorClass
    );
}

// The id of an item exported to the module projects, undefined if the item is
// not exported. Only a firmware project that exports (Project.exportsObjects:
// no master project, "Export objects with an ID" on) exports.
export function getExportedId(object: IEezObject): number | undefined {
    const id = (object as any).id;
    if (typeof id != "number" || !isExportableAsset(object)) {
        return undefined;
    }
    const project = getProject(object);
    if (
        !(project instanceof ProjectEditor.ProjectClass) ||
        !project.projectTypeTraits.isFirmware ||
        !project.exportsObjects
    ) {
        return undefined;
    }
    return id;
}

// "master" for an object of the master project of the opened project,
// "imported" for an object of a project the opened project imports,
// undefined otherwise.
export function getExternalProjectKind(
    object: IEezObject
): "master" | "imported" | undefined {
    const project = getProject(object);
    if (!(project instanceof ProjectEditor.ProjectClass)) {
        return undefined;
    }
    const openedProject = project._store?.project;
    if (!openedProject || project === openedProject) {
        return undefined;
    }
    if (project === openedProject.masterProject) {
        return "master";
    }
    if (
        openedProject.settings.general.imports.some(
            importDirective => importDirective.project === project
        )
    ) {
        return "imported";
    }
    return undefined;
}

// The items of other projects listed (read-only) after the items of a
// collection of the opened project: getCollection gives the same collection
// in another project, of which the exported items of the master project and
// all the items of the imported projects are listed. The child styles of a
// style are listed after it.
export function getExternalItems(
    openedProject: Project,
    getCollection: ((project: Project) => IEezObject[] | undefined) | undefined
) {
    const items: IEezObject[] = [];
    if (!getCollection) {
        return items;
    }

    function add(object: IEezObject, onlyExported: boolean) {
        if (!onlyExported || getExportedId(object) != undefined) {
            items.push(object);
        }
        if (object instanceof ProjectEditor.StyleClass) {
            object.childStyles.forEach(child => add(child, onlyExported));
        }
    }

    const masterProject = openedProject.masterProject;
    if (masterProject) {
        getCollection(masterProject)?.forEach(object => add(object, true));
    }

    // a project imported more than once, the master project or the opened
    // project itself (imported back by a project it imports) is listed once
    const listed = new Set<Project>([openedProject]);
    if (masterProject) {
        listed.add(masterProject);
    }
    for (const importDirective of openedProject.settings.general.imports) {
        const importedProject = importDirective.project;
        if (importedProject && !listed.has(importedProject)) {
            listed.add(importedProject);
            getCollection(importedProject)?.forEach(object =>
                add(object, false)
            );
        }
    }

    return items;
}

export function checkAssetId(
    projectStore: ProjectStore,
    assetType: AssetType,
    asset: EezObject & {
        id: number | undefined;
    },
    messages: IMessage[],
    min: number = 1,
    max: number = 1000
) {
    if (asset.id != undefined) {
        if (!(asset.id >= min && asset.id <= max)) {
            messages.push(
                new Message(
                    MessageType.ERROR,
                    `"Id": invalid value, should be between ${min} and ${max}.`,
                    getChildOfObject(asset, "id")
                )
            );
        } else {
            if (
                projectStore.project._assets.maps["id"].allAssets.get(
                    `${assetType}/${asset.id}`
                )!.length > 1
            ) {
                messages.push(propertyNotUniqueMessage(asset, "id"));
            }
        }
    }
}

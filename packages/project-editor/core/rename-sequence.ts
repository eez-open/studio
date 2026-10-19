import { guid } from "eez-studio-shared/guid";

import { IEezObject, getParent } from "project-editor/core/object";
import { replaceObjectReference } from "project-editor/core/search";
import { getProjectStore, isArrayElement } from "project-editor/store";

////////////////////////////////////////////////////////////////////////////////

export function getSequentialName(baseName: string, index: number) {
    return `${baseName}_${index + 1}`;
}

// Renames the given objects (elements of the same array) to baseName_1,
// baseName_2, ... in the order they have in the array. References to the
// renamed objects (for example images used by widgets) are updated too and the
// whole change is a single undo step.
//
// Returns an error message if objects can't be renamed, otherwise undefined.
export function renameObjectsInSequence(
    objects: IEezObject[],
    propertyName: string,
    baseName: string
): string | undefined {
    baseName = baseName.trim();
    if (!baseName) {
        return "Name is required";
    }

    if (objects.length == 0) {
        return undefined;
    }

    if (!objects.every(object => isArrayElement(object))) {
        return "Selected items must be elements of a list";
    }

    const parent = getParent(objects[0]) as IEezObject[];
    if (objects.some(object => getParent(object) !== parent)) {
        return "Selected items must be in the same list";
    }

    const ordered = objects
        .slice()
        .sort((a, b) => parent.indexOf(a) - parent.indexOf(b));

    const getName = (object: IEezObject): string | undefined =>
        (object as any)[propertyName];

    const newNames = ordered.map((_, i) => getSequentialName(baseName, i));

    // names can't clash with the objects that are not renamed
    const otherNames = new Set(
        parent
            .filter(object => !ordered.includes(object))
            .map(object => getName(object))
    );
    const clash = newNames.find(name => otherNames.has(name));
    if (clash) {
        return `"${clash}" already exists`;
    }

    const projectStore = getProjectStore(objects[0]);

    const rename = (object: IEezObject, name: string) => {
        if (getName(object) === name) {
            return;
        }
        replaceObjectReference(object, name);
        projectStore.updateObject(object, { [propertyName]: name });
    };

    const wasCombineCommands = projectStore.undoManager.combineCommands;
    if (!wasCombineCommands) {
        projectStore.undoManager.setCombineCommands(true);
    }
    try {
        // A new name can be equal to the current name of another renamed
        // object (for example when renaming test_2 and test_1 to test): go
        // through temporary names so references never get mixed up.
        const currentNames = new Set(ordered.map(object => getName(object)));
        const needsTemporaryNames = newNames.some(
            (name, i) => currentNames.has(name) && getName(ordered[i]) !== name
        );

        if (needsTemporaryNames) {
            const temporaryPrefix = `__rename_${guid()}_`;
            ordered.forEach((object, i) =>
                rename(object, temporaryPrefix + i)
            );
        }

        ordered.forEach((object, i) => rename(object, newNames[i]));
    } finally {
        if (!wasCombineCommands) {
            projectStore.undoManager.setCombineCommands(false);
        }
    }

    return undefined;
}

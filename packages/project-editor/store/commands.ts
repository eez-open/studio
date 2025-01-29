import { makeObservable, computed, action } from "mobx";
import { map } from "lodash";

import { humanize } from "eez-studio-shared/string";
import { guid } from "eez-studio-shared/guid";

import {
    IEezObject,
    getProperty,
    getParent,
    getKey,
    PropertyType,
    EezObject,
    setParent
} from "project-editor/core/object";

import {
    findPropertyByNameInObject,
    getClassInfo,
    getProjectStore,
    getHumanReadableObjectPath,
    isArrayElement,
    getAncestorOfType
} from "project-editor/store/helper";

import { ICommand } from "project-editor/store/undo-manager";
import { visitObjects } from "project-editor/core/search";
import { ProjectEditor } from "project-editor/project-editor-interface";
import type { LVGLWidget } from "project-editor/lvgl/widgets";
import type { Style } from "project-editor/features/style/style";
import type { Page } from "project-editor/features/page/page";

////////////////////////////////////////////////////////////////////////////////

// make sure LVGL widget ends up inside LVGLScreenWidget
function fixParentObject(parentObject: IEezObject, object: EezObject) {
    if (object instanceof ProjectEditor.LVGLWidgetClass) {
        const page = getAncestorOfType<Page>(
            parentObject,
            ProjectEditor.PageClass.classInfo
        );
        if (page && page.lvglScreenWidget && parentObject == page.components) {
            return page.lvglScreenWidget.children;
        }
    }
    return parentObject;
}

////////////////////////////////////////////////////////////////////////////////

export let addObject = action((parentObject: IEezObject, object: EezObject) => {
    parentObject = fixParentObject(parentObject, object);

    setParent(object, parentObject);

    const classInfo = getClassInfo(object);
    if (classInfo.addObjectHook) {
        classInfo.addObjectHook(object, parentObject);
    }

    ensureUniqueProperties(parentObject, [object]);

    getProjectStore(parentObject).undoManager.executeCommand({
        execute: action(() => {
            (parentObject as IEezObject[]).push(object);
        }),

        undo: action(() => {
            (parentObject as IEezObject[]).pop();
        }),

        get description() {
            return "Added: " + getHumanReadableObjectPath(object);
        }
    });

    return object;
});

export let addObjects = action(
    (parentObject: IEezObject, objects: EezObject[]) => {
        objects.forEach(object => {
            setParent(object, parentObject);

            const classInfo = getClassInfo(object);
            if (classInfo.addObjectHook) {
                classInfo.addObjectHook(object, parentObject);
            }
        });

        ensureUniqueProperties(parentObject, objects);

        getProjectStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).push(...objects);
            }),

            undo: action(() => {
                for (let i = 0; i < objects.length; i++) {
                    (parentObject as IEezObject[]).pop();
                }
            }),

            get description() {
                return (
                    "Added: " +
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return objects;
    }
);

export let insertObject = action(
    (parentObject: IEezObject, index: number, object: any) => {
        parentObject = fixParentObject(parentObject, object);

        setParent(object, parentObject);

        ensureUniqueProperties(parentObject, [object]);

        getProjectStore(parentObject).undoManager.executeCommand({
            execute: action(() => {
                (parentObject as IEezObject[]).splice(index, 0, object);
            }),

            undo: action(() => {
                (parentObject as IEezObject[]).splice(index, 1);
            }),

            get description() {
                return "Inserted: " + getHumanReadableObjectPath(object);
            }
        });

        return object;
    }
);

class UpdateCommand implements ICommand {
    private oldValues: any = {};
    private newValues: any = {};

    constructor(
        public object: IEezObject,
        private values: any,
        lastCommand?: UpdateCommand
    ) {
        makeObservable(this, {
            execute: action,
            undo: action,
            description: computed
        });

        if (lastCommand) {
            values = Object.assign(lastCommand.newValues, values);
            this.oldValues = lastCommand.oldValues;
        }

        for (let propertyName in values) {
            let propertyInfo = findPropertyByNameInObject(object, propertyName);

            if (propertyInfo) {
                if (!(propertyName in this.oldValues)) {
                    this.oldValues[propertyName] = getProperty(
                        object,
                        propertyName
                    );
                }
                this.newValues[propertyName] = values[propertyName];
            }
        }
    }

    execute() {
        Object.assign(this.object, this.newValues);
    }

    undo() {
        Object.assign(this.object, this.oldValues);
    }

    get description() {
        return (
            `Changed (${map(this.values, (value, name) => humanize(name)).join(
                ", "
            )}): ` + getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((object: IEezObject, values: any) => {
    const undoManager = getProjectStore(object).undoManager;

    let closeCombineCommands = false;

    const updateObjectValueHook = getClassInfo(object).updateObjectValueHook;
    if (updateObjectValueHook) {
        if (!undoManager.combineCommands) {
            undoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        updateObjectValueHook(object, values);
    }

    let previousCommand;

    // TODO this should be moved to undoManager implementation
    // merge with previous command
    if (undoManager.combineCommands && undoManager.commands.length > 0) {
        let command = undoManager.commands[undoManager.commands.length - 1];
        if (command instanceof UpdateCommand && command.object == object) {
            undoManager.commands.pop();
            previousCommand = command;
        }
    }

    undoManager.executeCommand(
        new UpdateCommand(object, values, previousCommand)
    );

    if (closeCombineCommands) {
        undoManager.setCombineCommands(false);
    }
});

export let deleteObject = action((object: any) => {
    const parent = getParent(object);

    if (isArrayElement(object)) {
        const array = parent as IEezObject[];
        const index = array.indexOf(object);

        getProjectStore(object).undoManager.executeCommand({
            execute: action(() => {
                array.splice(index, 1);
            }),

            undo: action(() => {
                array.splice(index, 0, object);
                setParent(object, parent);
            }),

            get description() {
                return "Deleted: " + getHumanReadableObjectPath(object);
            }
        });
    } else {
        updateObject(parent, {
            [getKey(object)]: undefined
        });
    }
});

export let deleteObjects = action((objects: IEezObject[]) => {
    if (objects.length == 0) {
        return;
    }

    let undoIndexes: number[];

    getProjectStore(objects[0]).undoManager.executeCommand({
        execute: action(() => {
            undoIndexes = [];
            for (let i = 0; i < objects.length; i++) {
                let object = objects[i];
                let parent = getParent(object);

                if (isArrayElement(object)) {
                    const array = parent as IEezObject[];
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                } else {
                    undoIndexes.push(-1);
                    (parent as any)[getKey(object)] = undefined;
                }
            }
        }),

        undo: action(() => {
            for (let i = objects.length - 1; i >= 0; i--) {
                let object = objects[i];
                let parent = getParent(object);
                if (isArrayElement(object)) {
                    const array = parent as IEezObject[];
                    let index = undoIndexes[i];
                    array.splice(index, 0, object);
                } else {
                    (parent as any)[getKey(object)] = object;
                }
            }
        }),

        get description() {
            return (
                "Deleted: " +
                objects
                    .map(object => getHumanReadableObjectPath(object))
                    .join(", ")
            );
        }
    });
});

export let replaceObject = action(
    (
        object: IEezObject,
        replaceWithObject: EezObject,
        newParent?: IEezObject
    ) => {
        const parent = getParent(object);
        setParent(replaceWithObject, parent);

        const undoManager = getProjectStore(parent).undoManager;
        if (isArrayElement(object)) {
            const array = parent as IEezObject[];

            let index = array.indexOf(object);

            undoManager.executeCommand({
                execute: action(() => {
                    if (newParent) {
                        setParent(object, newParent);
                    }
                    array[index] = replaceWithObject;
                }),

                undo: action(() => {
                    if (newParent) {
                        setParent(object, parent);
                    }
                    array[index] = object;
                }),

                get description() {
                    return "Replaced: " + getHumanReadableObjectPath(object);
                }
            });
        } else {
            updateObject(parent as any, {
                [getKey(object)]: replaceWithObject
            });
        }

        return replaceWithObject;
    }
);

export let replaceObjects = action(
    (
        objects: IEezObject[],
        replaceWithObject: EezObject,
        newParent: IEezObject | undefined
    ) => {
        if (objects.length === 1) {
            return replaceObject(objects[0], replaceWithObject, newParent);
        }

        const parent = getParent(objects[0]);

        setParent(replaceWithObject, parent);

        const array = parent as IEezObject[];
        const index = array.indexOf(objects[0]);

        let undoIndexes: number[];

        getProjectStore(parent).undoManager.executeCommand({
            execute: action(() => {
                if (newParent) {
                    setParent(objects[0], newParent);
                }

                array[index] = replaceWithObject;

                undoIndexes = [];
                for (let i = 1; i < objects.length; i++) {
                    let object = objects[i];
                    if (newParent) {
                        setParent(object, newParent);
                    }
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                }
            }),

            undo: action(() => {
                for (let i = objects.length - 1; i >= 1; i--) {
                    let object = objects[i];
                    if (newParent) {
                        setParent(object, parent);
                    }
                    let index = undoIndexes[i - 1];
                    array.splice(index, 0, object);
                }

                if (newParent) {
                    setParent(objects[0], parent);
                }
                array[index] = objects[0];
            }),

            get description() {
                return (
                    "Replaced: " +
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return replaceWithObject;
    }
);

export function insertObjectBefore(object: IEezObject, objectToInsert: any) {
    const parent = getParent(object);
    const array = parent as IEezObject[];
    const index = array.indexOf(object);
    return insertObject(parent, index, objectToInsert);
}

export function insertObjectAfter(object: IEezObject, objectToInsert: any) {
    const parent = getParent(object);
    const array = parent as IEezObject[];
    const index = array.indexOf(object);
    return insertObject(parent, index + 1, objectToInsert);
}

// ensure that unique properties are unique inside parent
function ensureUniqueProperties(
    parentObject: IEezObject,
    objects: IEezObject[]
) {
    let existingObjects = (parentObject as IEezObject[]).map(
        (object: IEezObject) => object
    );
    objects.forEach(object => {
        for (const propertyInfo of getClassInfo(object).properties) {
            if (propertyInfo.unique || propertyInfo.uniqueIdentifier) {
                if (propertyInfo.type == PropertyType.GUID) {
                    (object as any)[propertyInfo.name] = guid();
                } else {
                    (object as any)[propertyInfo.name] = getUniquePropertyValue(
                        existingObjects,
                        propertyInfo.name,
                        getProperty(object, propertyInfo.name)
                    );
                }
            }
        }
        existingObjects.push(object);
    });

    const project = ProjectEditor.getProject(parentObject);
    if (project.projectTypeTraits.isLVGL) {
        // make sure LVGL widget identifiers are unique
        const newLvglWidgets: LVGLWidget[] = [];

        objects.forEach(object => {
            for (const widget of visitObjects(object)) {
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    newLvglWidgets.push(widget);
                }
            }
        });
        if (newLvglWidgets.length > 0) {
            const existingLvglWidgets: LVGLWidget[] = [];

            for (const widget of visitObjects(project)) {
                if (widget instanceof ProjectEditor.LVGLWidgetClass) {
                    existingLvglWidgets.push(widget);
                }
            }

            newLvglWidgets.forEach(newLvglWidget => {
                if (newLvglWidget.identifier) {
                    newLvglWidget.identifier = getUniquePropertyValue(
                        existingLvglWidgets,
                        "identifier",
                        newLvglWidget.identifier
                    ) as string;
                }
                existingLvglWidgets.push(newLvglWidget);
            });
        }
    } else {
        // make sure style names are unique
        const newStyles: Style[] = [];

        objects.forEach(object => {
            if (object instanceof ProjectEditor.StyleClass) {
                newStyles.push(object);
            }
        });

        if (newStyles.length > 0) {
            const existingStyles: Style[] = [];

            for (const style of visitObjects(project)) {
                if (style instanceof ProjectEditor.StyleClass) {
                    existingStyles.push(style);
                }
            }

            newStyles.forEach(newStyle => {
                newStyle.name = getUniquePropertyValue(
                    existingStyles,
                    "name",
                    newStyle.name
                ) as string;
                existingStyles.push(newStyle);
            });
        }
    }
}

export function getUniquePropertyValue(
    existingObjects: IEezObject[],
    key: string,
    value: string | number
) {
    if (value === undefined) {
        return value;
    }
    while (true) {
        if (
            !existingObjects.find(object => getProperty(object, key) == value)
        ) {
            return value;
        }

        if (typeof value == "number") {
            value++;
        } else {
            var groups = value.match(/(.+)_(\d+)/);
            if (groups) {
                value = groups[1] + "_" + (parseInt(groups[2]) + 1);
            } else {
                value += "_1";
            }
        }
    }
}

import { action, computed } from "mobx";

import { _map } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    EezObject,
    loadObject,
    asArray,
    getProperty,
    getHumanReadableObjectPath,
    isArrayElement,
    findPropertyByName,
    PropertyType
} from "eez-studio-shared/model/object";

////////////////////////////////////////////////////////////////////////////////

export interface ICommand {
    execute(): void;
    undo(): void;
    description: string;
}

export interface IUndoManager {
    executeCommand(command: ICommand): void;
    combineCommands: boolean;
    commands: ICommand[];
}

export interface ISelectionManager {
    setSelection(selection: EezObject[] | undefined): void;
}

export interface ICommandContext {
    undoManager: IUndoManager;
    selectionManager: ISelectionManager;
}

////////////////////////////////////////////////////////////////////////////////

function onObjectModified(object: EezObject) {
    object._modificationTime = new Date().getTime();
    if (object._parent) {
        onObjectModified(object._parent);
    }
}

function getUniquePropertyValue(existingObjects: EezObject[], key: string, value: string) {
    while (true) {
        if (!existingObjects.find(object => getProperty(object, key) == value)) {
            return value;
        }

        var groups = value.match(/(.+) \((\d+)\)/);
        if (groups) {
            value = groups[1] + " (" + (parseInt(groups[2]) + 1) + ")";
        } else {
            value += " (1)";
        }
    }
}

// ensure that unique properties are unique inside parent
function ensureUniqueProperties(parentObject: EezObject, objects: EezObject[]) {
    let existingObjects = asArray(parentObject).map((object: EezObject) => object);
    objects.forEach(object => {
        for (const propertyInfo of object._classInfo.properties) {
            if (propertyInfo.unique) {
                (object as any)[propertyInfo.name] = getUniquePropertyValue(
                    existingObjects,
                    propertyInfo.name,
                    getProperty(object, propertyInfo.name)
                );
            }
        }
        existingObjects.push(object);
    });
}

////////////////////////////////////////////////////////////////////////////////

export let addObject = action(
    (context: ICommandContext, parentObject: EezObject, object: EezObject) => {
        object = loadObject(parentObject, object, parentObject._class);
        ensureUniqueProperties(parentObject, [object]);

        context.undoManager.executeCommand({
            execute: action(() => {
                asArray(parentObject).push(object);
                onObjectModified(parentObject);
            }),

            undo: action(() => {
                asArray(parentObject).pop();
            }),

            get description() {
                return "Added: " + getHumanReadableObjectPath(object);
            }
        });

        context.selectionManager.setSelection([object]);

        return object;
    }
);

export let addObjects = action(
    (context: ICommandContext, parentObject: EezObject, objects: EezObject[]) => {
        objects = objects.map(object => loadObject(parentObject, object, parentObject._class));
        ensureUniqueProperties(parentObject, objects);

        context.undoManager.executeCommand({
            execute: action(() => {
                asArray(parentObject).push.apply(parentObject, objects);
                onObjectModified(parentObject);
            }),

            undo: action(() => {
                for (let i = 0; i < objects.length; i++) {
                    asArray(parentObject).pop();
                }
                onObjectModified(parentObject);
            }),

            get description() {
                return (
                    "Added: " + objects.map(object => getHumanReadableObjectPath(object)).join(", ")
                );
            }
        });

        context.selectionManager.setSelection(objects);
    }
);

export let insertObject = action(
    (context: ICommandContext, parentObject: EezObject, index: number, object: EezObject) => {
        object = loadObject(parentObject, object, parentObject._class);
        ensureUniqueProperties(parentObject, [object]);

        context.undoManager.executeCommand({
            execute: action(() => {
                asArray(parentObject).splice(index, 0, object);
                onObjectModified(parentObject);
            }),

            undo: action(() => {
                asArray(parentObject).splice(index, 1);
                onObjectModified(parentObject);
            }),

            get description() {
                return "Inserted: " + getHumanReadableObjectPath(object);
            }
        });

        context.selectionManager.setSelection([object]);
    }
);

class UpdateCommand implements ICommand {
    private oldValues: any = {};
    private newValues: any = {};

    constructor(public object: EezObject, private values: any, lastCommand?: UpdateCommand) {
        if (lastCommand) {
            this.oldValues = lastCommand.oldValues;
        }

        for (let propertyName in values) {
            let propertyInfo = findPropertyByName(object, propertyName);
            if (propertyInfo) {
                if (!lastCommand) {
                    this.oldValues[propertyName] = getProperty(object, propertyName);
                }

                let value = values[propertyName];

                if (propertyInfo.type == PropertyType.Number) {
                    if (value !== undefined) {
                        this.newValues[propertyName] = +value;
                    } else {
                        this.newValues[propertyName] = undefined;
                    }
                } else {
                    this.newValues[propertyName] = values[propertyName];
                }
            }
        }
    }

    static assignValues(dest: any, src: any) {
        for (let propertyName in src) {
            dest[propertyName] = src[propertyName];
        }
    }

    @action
    execute() {
        UpdateCommand.assignValues(this.object, this.newValues);
        onObjectModified(this.object);
    }

    @action
    undo() {
        UpdateCommand.assignValues(this.object, this.oldValues);
        onObjectModified(this.object);
    }

    @computed
    get description() {
        return (
            `Changed (${_map(this.values, (value, name) => humanize(name)).join(", ")}): ` +
            getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((context: ICommandContext, object: EezObject, values: any) => {
    let previousCommand;

    // TODO this should be moved to undoManager implementation
    // merge with previous command
    if (context.undoManager.combineCommands && context.undoManager.commands.length > 0) {
        let command = context.undoManager.commands[context.undoManager.commands.length - 1];
        if (command instanceof UpdateCommand && command.object == object) {
            context.undoManager.commands.pop();
            previousCommand = command;
        }
    }

    context.undoManager.executeCommand(new UpdateCommand(object, values, previousCommand));
});

export let deleteObject = action((context: ICommandContext, object: any) => {
    if (isArrayElement(object)) {
        const parent = object._parent!;
        const array = asArray(parent);
        const index = array.indexOf(object);

        context.undoManager.executeCommand({
            execute: action(() => {
                array.splice(index, 1);
                onObjectModified(parent);
            }),

            undo: action(() => {
                array.splice(index, 0, object);
                onObjectModified(parent);
            }),

            get description() {
                return "Deleted: " + getHumanReadableObjectPath(object);
            }
        });

        if (array.length > 0) {
            if (index == array.length) {
                context.selectionManager.setSelection([array[index - 1]]);
            } else {
                context.selectionManager.setSelection([array[index]]);
            }
        } else {
            context.selectionManager.setSelection([parent]);
        }
    } else {
        updateObject(context, object, {
            [object._key as string]: undefined
        });
    }
});

export let deleteObjects = action((context: ICommandContext, objects: EezObject[]) => {
    let undoIndexes: number[];

    context.undoManager.executeCommand({
        execute: action(() => {
            undoIndexes = [];
            for (let i = 0; i < objects.length; i++) {
                let object = objects[i];
                let parent = object._parent!;

                if (isArrayElement(object)) {
                    const array = asArray(parent!);
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                } else {
                    undoIndexes.push(-1);
                    (parent as any)[object._key as string] = undefined;
                }

                onObjectModified(parent);
            }
        }),

        undo: action(() => {
            for (let i = objects.length - 1; i >= 0; i--) {
                let object = objects[i];
                let parent = object._parent!;
                if (isArrayElement(object)) {
                    const array = asArray(parent);
                    let index = undoIndexes[i];
                    array.splice(index, 0, object);
                } else {
                    (parent as any)[object._key as string] = object;
                }
                onObjectModified(parent);
            }
        }),

        get description() {
            return (
                "Deleted: " + objects.map(object => getHumanReadableObjectPath(object)).join(", ")
            );
        }
    });
});

export let replaceObject = action(
    (context: ICommandContext, object: EezObject, replaceWithObject: EezObject) => {
        replaceWithObject._id = object._id;
        replaceWithObject._key = object._key;
        replaceWithObject._parent = object._parent;

        let parent = object._parent!;
        if (isArrayElement(object)) {
            const array = asArray(parent);

            let index = array.indexOf(object);

            context.undoManager.executeCommand({
                execute: action(() => {
                    array[index] = replaceWithObject;
                }),

                undo: action(() => {
                    array[index] = object;
                }),

                get description() {
                    return "Replaced: " + getHumanReadableObjectPath(object);
                }
            });

            context.selectionManager.setSelection([replaceWithObject]);
        } else {
            updateObject(context, parent as any, {
                [object._key!]: replaceWithObject
            });
        }
    }
);

export let replaceObjects = action(
    (context: ICommandContext, objects: EezObject[], replaceWithObject: EezObject) => {
        const parent = objects[0]._parent;
        const array = asArray(parent!);
        const index = array.indexOf(objects[0]);

        replaceWithObject._id = objects[0]._id;
        replaceWithObject._key = objects[0]._key;
        replaceWithObject._parent = parent;

        let undoIndexes: number[];

        context.undoManager.executeCommand({
            execute: action(() => {
                array[index] = replaceWithObject;

                undoIndexes = [];
                for (let i = 1; i < objects.length; i++) {
                    let object = objects[i];
                    let index = array.indexOf(object);
                    undoIndexes.push(index);
                    array.splice(index, 1);
                }
            }),

            undo: action(() => {
                for (let i = objects.length - 1; i >= 1; i--) {
                    let object = objects[i];
                    let index = undoIndexes[i - 1];
                    array.splice(index, 0, object);
                }

                array[index] = objects[0];
            }),

            get description() {
                return (
                    "Replaced: " +
                    objects.map(object => getHumanReadableObjectPath(object)).join(", ")
                );
            }
        });

        context.selectionManager.setSelection([replaceWithObject]);
    }
);

////////////////////////////////////////////////////////////////////////////////

export function insertObjectBefore(
    context: ICommandContext,
    object: EezObject,
    objectToInsert: EezObject
) {
    const parent = object._parent!;
    const array = asArray(parent);
    const index = array.indexOf(object);
    insertObject(context, parent, index, objectToInsert);
}

export function insertObjectAfter(
    context: ICommandContext,
    object: EezObject,
    objectToInsert: EezObject
) {
    const parent = object._parent!;
    const array = asArray(parent);
    const index = array.indexOf(object);
    insertObject(context, parent, index + 1, objectToInsert);
}

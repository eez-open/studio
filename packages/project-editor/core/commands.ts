import { action, computed } from "mobx";

import { _map } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    IEezObject,
    getProperty,
    getHumanReadableObjectPath,
    isArrayElement,
    findPropertyByNameInObject,
    getParent,
    getKey,
    getClass,
    getClassInfo
} from "project-editor/core/object";
import { loadObject } from "project-editor/core/serialization";
import { getDocumentStore } from "project-editor/core/store";

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

////////////////////////////////////////////////////////////////////////////////

function getUniquePropertyValue(
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
            var groups = value.match(/(.+) \((\d+)\)/);
            if (groups) {
                value = groups[1] + " (" + (parseInt(groups[2]) + 1) + ")";
            } else {
                value += " (1)";
            }
        }
    }
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
    (parentObject: IEezObject, object: IEezObject) => {
        object = loadObject(
            getDocumentStore(parentObject),
            parentObject,
            object,
            getClass(parentObject)
        );
        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).UndoManager.executeCommand({
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
    }
);

export let addObjects = action(
    (parentObject: IEezObject, objects: IEezObject[]) => {
        objects = objects.map(object =>
            loadObject(
                getDocumentStore(parentObject),
                parentObject,
                object,
                getClass(parentObject)
            )
        );
        ensureUniqueProperties(parentObject, objects);

        getDocumentStore(parentObject).UndoManager.executeCommand({
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
        object = loadObject(
            getDocumentStore(parentObject),
            parentObject,
            object,
            getClass(parentObject)
        );
        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).UndoManager.executeCommand({
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
        if (lastCommand) {
            this.oldValues = lastCommand.oldValues;
        }

        for (let propertyName in values) {
            let propertyInfo = findPropertyByNameInObject(object, propertyName);

            if (propertyInfo) {
                if (!lastCommand) {
                    this.oldValues[propertyName] = getProperty(
                        object,
                        propertyName
                    );
                }
                this.newValues[propertyName] = values[propertyName];
            }
        }
    }

    @action
    execute() {
        Object.assign(this.object, this.newValues);
    }

    @action
    undo() {
        Object.assign(this.object, this.oldValues);
    }

    @computed
    get description() {
        return (
            `Changed (${_map(this.values, (value, name) => humanize(name)).join(
                ", "
            )}): ` + getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((object: IEezObject, values: any) => {
    const UndoManager = getDocumentStore(object).UndoManager;

    let closeCombineCommands = false;

    const updateObjectValueHook = getClassInfo(object).updateObjectValueHook;
    if (updateObjectValueHook) {
        if (!UndoManager.combineCommands) {
            UndoManager.setCombineCommands(true);
            closeCombineCommands = true;
        }

        updateObjectValueHook(object, values);
    }

    let previousCommand;

    // TODO this should be moved to undoManager implementation
    // merge with previous command
    if (UndoManager.combineCommands && UndoManager.commands.length > 0) {
        let command = UndoManager.commands[UndoManager.commands.length - 1];
        if (command instanceof UpdateCommand && command.object == object) {
            UndoManager.commands.pop();
            previousCommand = command;
        }
    }

    UndoManager.executeCommand(
        new UpdateCommand(object, values, previousCommand)
    );

    if (closeCombineCommands) {
        UndoManager.setCombineCommands(false);
    }
});

export let deleteObject = action((object: any) => {
    const parent = getParent(object);

    if (isArrayElement(object)) {
        const array = parent as IEezObject[];
        const index = array.indexOf(object);

        getDocumentStore(object).UndoManager.executeCommand({
            execute: action(() => {
                array.splice(index, 1);
            }),

            undo: action(() => {
                array.splice(index, 0, object);
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
    let undoIndexes: number[];

    getDocumentStore(objects[0]).UndoManager.executeCommand({
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
    (object: IEezObject, replaceWithObject: IEezObject) => {
        let parent = getParent(object);
        const UndoManager = getDocumentStore(parent).UndoManager;
        if (isArrayElement(object)) {
            const array = parent as IEezObject[];

            let index = array.indexOf(object);

            UndoManager.executeCommand({
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
        } else {
            updateObject(parent as any, {
                [getKey(object)]: replaceWithObject
            });
        }

        return replaceWithObject;
    }
);

export let replaceObjects = action(
    (objects: IEezObject[], replaceWithObject: IEezObject) => {
        if (objects.length === 1) {
            return replaceObject(objects[0], replaceWithObject);
        }

        const parent = getParent(objects[0]);
        const array = parent as IEezObject[];
        const index = array.indexOf(objects[0]);

        let undoIndexes: number[];

        getDocumentStore(parent).UndoManager.executeCommand({
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
                    objects
                        .map(object => getHumanReadableObjectPath(object))
                        .join(", ")
                );
            }
        });

        return replaceWithObject;
    }
);

////////////////////////////////////////////////////////////////////////////////

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

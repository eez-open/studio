import { makeObservable, computed, action } from "mobx";

import { humanize } from "eez-studio-shared/string";

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
    getClass,
    getClassInfo,
    getDocumentStore,
    getHumanReadableObjectPath,
    isArrayElement
} from "project-editor/store/helper";

import { ICommand } from "project-editor/store/undo-manager";
import { loadObject } from "project-editor/store/serialization";
import { _map } from "eez-studio-shared/algorithm";
import { guid } from "eez-studio-shared/guid";

////////////////////////////////////////////////////////////////////////////////

export let addObject = action(
    (parentObject: IEezObject, object: IEezObject) => {
        setParent(object, parentObject);

        ensureUniqueProperties(parentObject, [object]);

        getDocumentStore(parentObject).undoManager.executeCommand({
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
    (parentObject: IEezObject, objects: EezObject[]) => {
        objects.forEach(object => setParent(object, parentObject));

        ensureUniqueProperties(parentObject, objects);

        getDocumentStore(parentObject).undoManager.executeCommand({
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

        getDocumentStore(parentObject).undoManager.executeCommand({
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
            `Changed (${_map(this.values, (value, name) => humanize(name)).join(
                ", "
            )}): ` + getHumanReadableObjectPath(this.object)
        );
    }
}

export let updateObject = action((object: IEezObject, values: any) => {
    const undoManager = getDocumentStore(object).undoManager;

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

        getDocumentStore(object).undoManager.executeCommand({
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

    getDocumentStore(objects[0]).undoManager.executeCommand({
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
        const undoManager = getDocumentStore(parent).undoManager;
        if (isArrayElement(object)) {
            const array = parent as IEezObject[];

            let index = array.indexOf(object);

            undoManager.executeCommand({
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

        getDocumentStore(parent).undoManager.executeCommand({
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
            if (propertyInfo.unique) {
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
}

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

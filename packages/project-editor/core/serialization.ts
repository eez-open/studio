import { toJS } from "mobx";

import {
    EezClass,
    EezObject,
    EezArrayObject,
    PropertyType,
    PropertyInfo,
    getId,
    setId,
    setParent,
    setKey,
    getNextChildId,
    setPropertyInfo,
    getClassInfo
} from "project-editor/core/object";

export function getChildId(parent: EezObject | undefined) {
    let id;
    if (parent) {
        id = getId(parent) + "." + getNextChildId(parent);
    } else {
        id = "1";
    }

    return id;
}

function loadArrayObject(arrayObject: any, parent: any, propertyInfo: PropertyInfo) {
    const eezArray = new EezArrayObject<any>();

    setId(eezArray, getChildId(parent));
    setParent(eezArray, parent);
    setKey(eezArray, propertyInfo.name);
    setPropertyInfo(eezArray, propertyInfo);

    eezArray._array = (arrayObject._array || arrayObject).map((object: any) =>
        loadObject(eezArray, object, propertyInfo.typeClass!)
    );

    return eezArray;
}

export function loadObject(
    parent: EezObject | EezObject[] | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): EezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string" ? JSON.parse(jsObjectOrString) : jsObjectOrString;

    if (Array.isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClass: aClass
        });
    }

    let object: EezObject;

    try {
        object = aClass.classInfo.getClass
            ? new (aClass.classInfo.getClass(jsObject, aClass))()
            : new aClass();
    } catch (err) {
        // TODO we need much better error recovery here
        console.error(err);
        return new EezObject();
    }

    const classInfo = getClassInfo(object);

    setId(object, getChildId(parent as EezObject));
    setParent(object, parent as EezObject);

    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(object, jsObject);
    }

    for (const propertyInfo of classInfo.properties) {
        if (propertyInfo.computed === true) {
            continue;
        }

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: EezObject | undefined;

            if (value) {
                childObject = loadObject(object, value, propertyInfo.typeClass!);
            } else if (!propertyInfo.isOptional) {
                let typeClass = propertyInfo.typeClass!;
                childObject = loadObject(object, typeClass.classInfo.defaultValue, typeClass);
            }

            if (childObject) {
                setKey(childObject, propertyInfo.name);
                (object as any)[propertyInfo.name] = childObject;
            }
        } else if (propertyInfo.type === PropertyType.Array) {
            if (!value && !propertyInfo.isOptional) {
                value = [];
            }

            if (value) {
                (object as any)[propertyInfo.name] = loadArrayObject(value, object, propertyInfo);
            }
        } else {
            if (value !== undefined) {
                (object as any)[propertyInfo.name] = value;
            }
        }
    }

    return object;
}

export function objectToJson(
    object: EezObject | EezObject[],
    space?: number,
    toJsHook?: (jsObject: any) => void
) {
    let jsObject;
    if (!Array.isArray(object) && object._parent) {
        // do not serialize _parent
        jsObject = toJS(Object.assign({}, object, { _parent: undefined }));
    } else {
        jsObject = toJS(object);
    }

    if (toJsHook) {
        toJsHook(jsObject);
    }

    return JSON.stringify(
        jsObject,
        (key: string | number, value: any) => {
            if (typeof key === "string" && key[0] === "_") {
                return undefined;
            }
            if (value && typeof value === "object" && "_array" in value) {
                return value._array;
            }
            return value;
        },
        space
    );
}

export function objectToJS(object: EezObject | EezObject[]): any {
    return JSON.parse(objectToJson(object));
}

import { toJS, observable } from "mobx";

import {
    EezClass,
    IEezObject,
    EezObject,
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

export function getChildId(parent: IEezObject | undefined) {
    let id;
    if (parent) {
        id = getId(parent) + "." + getNextChildId(parent);
    } else {
        id = "1";
    }

    return id;
}

function loadArrayObject(arrayObject: any, parent: any, propertyInfo: PropertyInfo) {
    const eezArray: EezObject[] = observable([]);

    setId(eezArray, getChildId(parent));
    setParent(eezArray, parent);
    setKey(eezArray, propertyInfo.name);
    setPropertyInfo(eezArray, propertyInfo);

    arrayObject.forEach((object: any) =>
        eezArray.push(loadObject(eezArray, object, propertyInfo.typeClass!))
    );

    return eezArray;
}

export function loadObject(
    parent: IEezObject | IEezObject[] | undefined,
    jsObjectOrString: any | string,
    aClass: EezClass,
    key?: string
): IEezObject {
    let jsObject: any =
        typeof jsObjectOrString == "string" ? JSON.parse(jsObjectOrString) : jsObjectOrString;

    if (Array.isArray(jsObject)) {
        return loadArrayObject(jsObject, parent, {
            type: PropertyType.Array,
            name: key!,
            typeClass: aClass
        });
    }

    let object: IEezObject;

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

    setId(object, getChildId(parent as IEezObject));
    setParent(object, parent as IEezObject);

    if (classInfo.beforeLoadHook) {
        classInfo.beforeLoadHook(object, jsObject);
    }

    for (const propertyInfo of classInfo.properties) {
        if (propertyInfo.computed === true) {
            continue;
        }

        let value = jsObject[propertyInfo.name];

        if (propertyInfo.type === PropertyType.Object) {
            let childObject: IEezObject | undefined;

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
    object: IEezObject | IEezObject[],
    space?: number,
    toJsHook?: (jsObject: any, object: IEezObject) => void
) {
    let jsObject = toJS(object);

    if (toJsHook) {
        toJsHook(jsObject, object);
    }

    return JSON.stringify(
        jsObject,
        (key: string | number, value: any) => {
            if (typeof key === "string" && key[0] === "_") {
                return undefined;
            }
            return value;
        },
        space
    );
}

export function objectToJS(object: IEezObject | IEezObject[]): any {
    return JSON.parse(objectToJson(object));
}

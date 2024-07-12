import { EezObject, getParent } from "project-editor/core/object";
import {
    isPropertySearchable,
    visitWithPause
} from "project-editor/core/search";

////////////////////////////////////////////////////////////////////////////////

interface ObjectDependency {
    reference: {
        object: EezObject;
        propertyName: string;
        startIndex: number;
        endIndex: number;
    };
    referencedObject: EezObject;
}

export function* getObjectDependencies(
    object: EezObject
): IterableIterator<ObjectDependency> {
    const result: ObjectDependency[] = [];

    const v = visitWithPause(object);

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        let valueObject = visitResult.value;
        if (valueObject) {
            if (
                !isPropertySearchable(
                    getParent(valueObject),
                    valueObject.propertyInfo
                ) ||
                !valueObject.value
            ) {
                continue;
            }

            let flowProperty;
            if (valueObject.propertyInfo.flowProperty) {
                if (typeof valueObject.propertyInfo.flowProperty == "string") {
                    flowProperty = valueObject.propertyInfo.flowProperty;
                } else {
                    flowProperty =
                        valueObject.propertyInfo.flowProperty(object);
                }
            }

            console.log(flowProperty);
        }
    }

    return result;
}

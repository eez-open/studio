import { _isEqual } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    IEezObject,
    EezValueObject,
    PropertyType,
    getProperty,
    isArray,
    asArray,
    getObjectPath,
    objectToString,
    getObjectPropertyAsObject,
    getParent,
    getKey,
    getClassInfo
} from "project-editor/core/object";
import { DocumentStore, OutputSectionsStore } from "project-editor/core/store";

import { Section, Type } from "project-editor/core/output";

////////////////////////////////////////////////////////////////////////////////

type VisitResult = EezValueObject | null;

function* visitWithPause(parentObject: IEezObject): IterableIterator<VisitResult> {
    if (isArray(parentObject)) {
        let arrayOfObjects = asArray(parentObject);
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitWithPause(arrayOfObjects[i]);
        }
    } else {
        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (!propertyInfo.skipSearch) {
                let value = getProperty(parentObject, propertyInfo.name);
                if (value) {
                    if (
                        propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array
                    ) {
                        yield* visitWithPause(value);
                    } else {
                        yield getObjectPropertyAsObject(parentObject, propertyInfo);
                    }
                }
            }
        }
    }

    // pause
    yield null;
}

function* visitWithoutPause(parentObject: IEezObject): IterableIterator<VisitResult> {
    if (isArray(parentObject)) {
        let arrayOfObjects = asArray(parentObject);
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitWithoutPause(arrayOfObjects[i]);
        }
    } else {
        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (!propertyInfo.skipSearch) {
                let value = getProperty(parentObject, propertyInfo.name);
                if (value) {
                    if (
                        propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array
                    ) {
                        yield* visitWithoutPause(value);
                    } else {
                        yield getObjectPropertyAsObject(parentObject, propertyInfo);
                    }
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

type SearchResult = EezValueObject | null;

function* searchForPattern(
    root: IEezObject,
    pattern: string,
    matchCase: boolean,
    matchWholeWord: boolean,
    withPause: boolean
): IterableIterator<SearchResult> {
    let v = withPause ? visitWithPause(root) : visitWithoutPause(root);

    if (!matchCase) {
        pattern = pattern.toLowerCase();
    }

    const [namePattern, valuePattern] = pattern.split("=").map(pattern => {
        pattern = pattern.trim();
        if (!matchCase) {
            pattern = pattern.toLowerCase();
        }
        return pattern;
    });

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        if (visitResult.value) {
            let valueObject = visitResult.value;
            if (valueObject.value) {
                let name = humanize(valueObject.propertyInfo.name);
                let value = valueObject.value.toString();

                if (!matchCase) {
                    name = name.toLowerCase();
                    value = value.toLowerCase();
                }

                if (matchWholeWord) {
                    if (
                        value == pattern ||
                        (namePattern &&
                            valuePattern &&
                            name === namePattern &&
                            value === valuePattern)
                    ) {
                        yield valueObject;
                    }
                } else {
                    if (
                        value.indexOf(pattern) != -1 ||
                        (namePattern &&
                            valuePattern &&
                            name.indexOf(namePattern) != -1 &&
                            value.indexOf(valuePattern) != -1)
                    ) {
                        yield valueObject;
                    }
                }
            }
        } else if (withPause) {
            // pause
            yield null;
        }
    }
}

function* searchForReference(
    root: IEezObject,
    object: IEezObject,
    withPause: boolean
): IterableIterator<SearchResult> {
    let v = withPause ? visitWithPause(root) : visitWithoutPause(root);

    let objectParent = getParent(object);
    if (!objectParent) {
        return;
    }

    let objectName = getProperty(object, "name");
    if (!objectName || objectName.length == 0) {
        return;
    }

    let objectParentPath = getObjectPath(objectParent);

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        let valueObject = visitResult.value;
        if (valueObject) {
            if (!valueObject.propertyInfo.skipSearch) {
                if (valueObject.value) {
                    let match = false;

                    if (valueObject.propertyInfo.matchObjectReference) {
                        match = valueObject.propertyInfo.matchObjectReference(
                            valueObject.value,
                            objectParentPath,
                            objectName
                        );
                    } else if (
                        valueObject.propertyInfo.type === PropertyType.ObjectReference ||
                        valueObject.propertyInfo.type === PropertyType.ThemedColor
                    ) {
                        if (
                            _isEqual(
                                valueObject.propertyInfo.referencedObjectCollectionPath,
                                objectParentPath
                            )
                        ) {
                            if (valueObject.value === objectName) {
                                match = true;
                            }
                        }
                    } else if (
                        valueObject.propertyInfo.type === PropertyType.ConfigurationReference
                    ) {
                        if (_isEqual(["settings", "build", "configurations"], objectParentPath)) {
                            if (valueObject.value) {
                                for (let i = 0; i < valueObject.value.length; i++) {
                                    if (valueObject.value[i] === objectName) {
                                        match = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (match) {
                        yield valueObject;
                    }
                }
            }
        } else if (withPause) {
            // pause
            yield null;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

class CurrentSearch {
    interval: any;

    startNewSearch(
        root: IEezObject,
        patternOrObject: string | IEezObject,
        matchCase: boolean,
        matchWholeWord: boolean
    ) {
        OutputSectionsStore.clear(Section.SEARCH);

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }

        if (
            root &&
            patternOrObject &&
            (typeof patternOrObject != "string" || patternOrObject.length > 0)
        ) {
            let searchResultsGenerator =
                typeof patternOrObject == "string"
                    ? searchForPattern(root, patternOrObject, matchCase, matchWholeWord, true)
                    : searchForReference(root, patternOrObject, true);

            this.interval = setInterval(() => {
                let startTime = new Date().getTime();

                while (true) {
                    let searchResult = searchResultsGenerator.next();
                    if (searchResult.done) {
                        clearInterval(this.interval);
                        this.interval = undefined;
                        return;
                    }

                    let valueObject = searchResult.value;
                    if (valueObject) {
                        OutputSectionsStore.write(
                            Section.SEARCH,
                            Type.INFO,
                            objectToString(valueObject),
                            valueObject
                        );
                    }

                    if (new Date().getTime() - startTime > 10) {
                        return;
                    }
                }
            }, 20);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

let theCurrentSearch = new CurrentSearch();

function startNewSearch(
    root: IEezObject,
    patternOrObject: string | IEezObject,
    matchCase: boolean,
    matchWholeWord: boolean
) {
    theCurrentSearch.startNewSearch(root, patternOrObject, matchCase, matchWholeWord);
}

export function startSearch(pattern: string, matchCase: boolean, matchWholeWord: boolean) {
    OutputSectionsStore.setActiveSection(Section.SEARCH);
    startNewSearch(DocumentStore.document, pattern, matchCase, matchWholeWord);
}

export function findAllReferences(object: IEezObject) {
    OutputSectionsStore.setActiveSection(Section.SEARCH);
    startNewSearch(DocumentStore.document, object, true, true);
}

////////////////////////////////////////////////////////////////////////////////

export function isReferenced(object: IEezObject) {
    let resultsGenerator = searchForReference(DocumentStore.document, object, false);

    while (true) {
        let searchResult = resultsGenerator.next();
        if (searchResult.done) {
            return false;
        }

        if (searchResult.value) {
            return true;
        }
    }
}

export function replaceObjectReference(object: IEezObject, newValue: string) {
    let resultsGenerator = searchForReference(DocumentStore.document, object, false);

    while (true) {
        let searchResult = resultsGenerator.next();
        if (searchResult.done) {
            break;
        }

        let searchValue = searchResult.value;
        if (searchValue) {
            let value: string | string[] = newValue;

            if (searchValue.propertyInfo.replaceObjectReference) {
                value = searchValue.propertyInfo.replaceObjectReference(value);
            } else if (searchValue.propertyInfo.type === PropertyType.ConfigurationReference) {
                value = [];
                for (let i = 0; i < searchValue.value.length; i++) {
                    if (searchValue.value[i] !== getProperty(object, "name")) {
                        value.push(searchValue.value[i]);
                    } else {
                        value.push(newValue);
                    }
                }
            }

            let parent = getParent(searchValue);
            if (parent) {
                let key = getKey(searchValue);
                if (parent && key && typeof key == "string") {
                    DocumentStore.updateObject(parent, {
                        [key]: value
                    });
                }
            }
        }
    }
}

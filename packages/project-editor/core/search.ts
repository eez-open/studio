import { _isEqual } from "eez-studio-shared/algorithm";
import { humanize } from "eez-studio-shared/string";

import {
    IEezObject,
    PropertyType,
    getProperty,
    getParent,
    getKey,
    getRootObject,
    MessageType
} from "project-editor/core/object";
import {
    getObjectPropertyAsObject,
    isArray,
    getObjectPath,
    getClassInfo,
    EezValueObject,
    Section,
    DocumentStoreClass,
    getDocumentStore,
    objectToString
} from "project-editor/core/store";

import type {
    checkObjectReference,
    findReferencedObject
} from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

type VisitResult = EezValueObject | null;

function* visitWithPause(
    parentObject: IEezObject
): IterableIterator<VisitResult> {
    if (isArray(parentObject)) {
        let arrayOfObjects = parentObject as IEezObject[];
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitWithPause(arrayOfObjects[i]);
        }
    } else {
        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (!propertyInfo.skipSearch) {
                let value = getProperty(parentObject, propertyInfo.name);
                if (value != undefined) {
                    if (
                        propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array
                    ) {
                        yield* visitWithPause(value);
                    } else {
                        yield getObjectPropertyAsObject(
                            parentObject,
                            propertyInfo
                        );
                    }
                }
            }
        }
    }

    // pause
    yield null;
}

function* visitWithoutPause(
    parentObject: IEezObject
): IterableIterator<VisitResult> {
    if (isArray(parentObject)) {
        let arrayOfObjects = parentObject as IEezObject[];
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitWithoutPause(arrayOfObjects[i]);
        }
    } else {
        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (!propertyInfo.skipSearch) {
                let value = getProperty(parentObject, propertyInfo.name);
                if (value != undefined) {
                    if (
                        propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array
                    ) {
                        yield* visitWithoutPause(value);
                    } else {
                        yield getObjectPropertyAsObject(
                            parentObject,
                            propertyInfo
                        );
                    }
                }
            }
        }
    }
}

export function* visitObjects(
    parentObject: IEezObject
): IterableIterator<IEezObject> {
    if (isArray(parentObject)) {
        let arrayOfObjects = parentObject as IEezObject[];
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitObjects(arrayOfObjects[i]);
        }
    } else {
        yield parentObject;

        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (!propertyInfo.skipSearch) {
                if (
                    propertyInfo.type === PropertyType.Object ||
                    propertyInfo.type === PropertyType.Array
                ) {
                    let value = getProperty(parentObject, propertyInfo.name);
                    if (value) {
                        yield* visitObjects(value);
                    }
                }
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

function testMatchWholeWord(value: string, pattern: string) {
    return new RegExp("\\b" + pattern + "\\b").test(value);
}

////////////////////////////////////////////////////////////////////////////////

type SearchResult = EezValueObject | null;

export function* searchForPattern(
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
            if (valueObject.value != undefined) {
                let name = humanize(valueObject.propertyInfo.name);
                let value = valueObject.value.toString();

                if (!matchCase) {
                    name = name.toLowerCase();
                    value = value.toLowerCase();
                }

                if (matchWholeWord) {
                    if (
                        testMatchWholeWord(value, pattern) ||
                        (namePattern &&
                            valuePattern &&
                            name === namePattern &&
                            testMatchWholeWord(value, valuePattern))
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

export function* searchForReference(
    root: IEezObject,
    object: IEezObject,
    withPause: boolean
): IterableIterator<SearchResult> {
    let v = withPause ? visitWithPause(root) : visitWithoutPause(root);

    let objectName;
    let objectParentPath;

    const classInfo = getClassInfo(object);

    let importedProject = classInfo.getImportedProject
        ? classInfo.getImportedProject(object)
        : undefined;

    if (classInfo.getImportedProject) {
        importedProject = classInfo.getImportedProject(object);
        if (!importedProject) {
            return;
        }
    } else {
        let objectParent = getParent(object);
        if (!objectParent) {
            return;
        }

        objectName = getProperty(object, "name");
        if (!objectName || objectName.length == 0) {
            return;
        }

        objectParentPath = getObjectPath(objectParent).join("/");
    }

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

                    if (
                        valueObject.propertyInfo.type ===
                            PropertyType.ObjectReference ||
                        valueObject.propertyInfo.type ===
                            PropertyType.ThemedColor
                    ) {
                        if (importedProject) {
                            if (
                                valueObject.propertyInfo
                                    .referencedObjectCollectionPath
                            ) {
                                if (
                                    importedProject.findReferencedObject(
                                        root,
                                        valueObject.propertyInfo
                                            .referencedObjectCollectionPath,
                                        valueObject.value
                                    )
                                ) {
                                    match = true;
                                }
                            }
                        } else {
                            if (
                                valueObject.propertyInfo
                                    .referencedObjectCollectionPath ==
                                    objectParentPath &&
                                valueObject.value === objectName
                            ) {
                                match = true;
                            }
                        }
                    } else if (
                        valueObject.propertyInfo.type ===
                        PropertyType.ConfigurationReference
                    ) {
                        if (
                            valueObject.propertyInfo
                                .referencedObjectCollectionPath ==
                                objectParentPath &&
                            valueObject.value
                        ) {
                            for (let i = 0; i < valueObject.value.length; i++) {
                                if (valueObject.value[i] === objectName) {
                                    match = true;
                                    break;
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

export function* searchForAllReferences(
    root: IEezObject,
    withPause: boolean
): IterableIterator<SearchResult> {
    let v = withPause ? visitWithPause(root) : visitWithoutPause(root);

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        let valueObject = visitResult.value;
        if (valueObject) {
            if (!valueObject.propertyInfo.skipSearch) {
                if (valueObject.value) {
                    if (
                        valueObject.propertyInfo.type ===
                            PropertyType.ObjectReference ||
                        valueObject.propertyInfo.type ===
                            PropertyType.ThemedColor ||
                        valueObject.propertyInfo.type ===
                            PropertyType.ConfigurationReference
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

////////////////////////////////////////////////////////////////////////////////

interface SearchCallbackMessageValue {
    type: "value";
    valueObject: EezValueObject;
}

interface SearchCallbackMessageFinish {
    type: "finish";
}

export type SearchCallbackMessage =
    | SearchCallbackMessageValue
    | SearchCallbackMessageFinish;

export type SearchCallback = (message: SearchCallbackMessage) => boolean;

export class CurrentSearch {
    interval: any;

    searchCallback?: SearchCallback;

    constructor(public DocumentStore: DocumentStoreClass) {}

    finishSearch() {
        if (this.searchCallback) {
            this.searchCallback({ type: "finish" });
            this.searchCallback = undefined;
        }

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }

        this.DocumentStore.outputSectionsStore.setLoading(
            Section.SEARCH,
            false
        );
    }

    startNewSearch(
        patternOrObject: string | IEezObject | undefined,
        matchCase: boolean,
        matchWholeWord: boolean,
        searchCallback?: SearchCallback
    ) {
        this.DocumentStore.outputSectionsStore.clear(Section.SEARCH);

        this.finishSearch();

        this.searchCallback = searchCallback;

        const root = this.DocumentStore.project;

        if (
            root &&
            (patternOrObject == undefined ||
                typeof patternOrObject != "string" ||
                patternOrObject.length > 0)
        ) {
            let searchResultsGenerator =
                typeof patternOrObject == "string"
                    ? searchForPattern(
                          root,
                          patternOrObject,
                          matchCase,
                          matchWholeWord,
                          true
                      )
                    : patternOrObject
                    ? searchForReference(root, patternOrObject, true)
                    : searchForAllReferences(root, true);

            this.DocumentStore.outputSectionsStore.setLoading(
                Section.SEARCH,
                true
            );

            this.interval = setInterval(() => {
                let startTime = new Date().getTime();

                while (true) {
                    let searchResult = searchResultsGenerator.next();
                    if (searchResult.done) {
                        this.finishSearch();
                        return;
                    }

                    let valueObject = searchResult.value;
                    if (valueObject) {
                        if (searchCallback) {
                            if (
                                !searchCallback({ type: "value", valueObject })
                            ) {
                                this.finishSearch();
                                return;
                            }
                        } else {
                            this.DocumentStore.outputSectionsStore.write(
                                Section.SEARCH,
                                MessageType.INFO,
                                objectToString(valueObject),
                                valueObject
                            );
                        }
                    }

                    if (new Date().getTime() - startTime > 10) {
                        return;
                    }
                }
            }, 0);
        }
    }
}

export interface IDocumentSearch {
    CurrentSearch: typeof CurrentSearch;
    findAllReferences: typeof findAllReferences;
    isReferenced: typeof isReferenced;
    findReferencedObject: typeof findReferencedObject;
    checkObjectReference: typeof checkObjectReference;
}

////////////////////////////////////////////////////////////////////////////////

function startNewSearch(
    DocumentStore: DocumentStoreClass,
    patternOrObject: string | IEezObject | undefined,
    matchCase: boolean,
    matchWholeWord: boolean,
    searchCallback?: SearchCallback
) {
    DocumentStore.currentSearch.startNewSearch(
        patternOrObject || "",
        matchCase,
        matchWholeWord,
        searchCallback
    );
}

export function startSearch(
    DocumentStore: DocumentStoreClass,
    pattern: string,
    matchCase: boolean,
    matchWholeWord: boolean
) {
    startNewSearch(DocumentStore, pattern, matchCase, matchWholeWord);
}

export function findAllReferences(object: IEezObject) {
    const DocumentStore = getDocumentStore(object);
    startNewSearch(DocumentStore, object, true, true);
}

export function usage(
    DocumentStore: DocumentStoreClass,
    searchCallback: SearchCallback
) {
    startNewSearch(DocumentStore, undefined, true, true, searchCallback);
}

////////////////////////////////////////////////////////////////////////////////

export function isReferenced(object: IEezObject) {
    let resultsGenerator = searchForReference(
        getRootObject(object),
        object,
        false
    );

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
    const rootObject = getRootObject(object);
    let resultsGenerator = searchForReference(rootObject, object, false);

    while (true) {
        let searchResult = resultsGenerator.next();
        if (searchResult.done) {
            break;
        }

        let searchValue = searchResult.value;
        if (searchValue) {
            let value: string | string[] = newValue;

            if (
                searchValue.propertyInfo.type ===
                PropertyType.ConfigurationReference
            ) {
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
                    getDocumentStore(rootObject).updateObject(parent, {
                        [key]: value
                    });
                }
            }
        }
    }
}

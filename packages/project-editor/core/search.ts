import {
    IEezObject,
    PropertyType,
    getProperty,
    getParent,
    getKey,
    getRootObject,
    isPropertyHidden,
    PropertyInfo
} from "project-editor/core/object";
import {
    getObjectPropertyAsObject,
    isEezObjectArray,
    getObjectPath,
    getClassInfo,
    EezValueObject,
    ProjectStore,
    getProjectStore,
    getAncestorOfType
} from "project-editor/store";

import type {
    checkObjectReference,
    ImportDirective
} from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { expressionParser } from "project-editor/flow/expression/parser";
import { findValueTypeInExpressionNode } from "project-editor/flow/expression/type";
import {
    templateLiteralToExpressions,
    visitExpressionNodes
} from "project-editor/flow/expression/helper";
import type {
    IdentifierExpressionNode,
    IdentifierType
} from "project-editor/flow/expression/node";

import {
    parseScpi,
    SCPI_PART_EXPR,
    SCPI_PART_QUERY_WITH_ASSIGNMENT
} from "eez-studio-shared/scpi-parser";

import type { Component } from "project-editor/flow/component";

import {
    ValueType,
    variableTypeProperty
} from "project-editor/features/variable/value-type";
import type {
    Enum,
    Structure
} from "project-editor/features/variable/variable";

////////////////////////////////////////////////////////////////////////////////

export function isPropertySearchable(
    object: IEezObject,
    propertyInfo: PropertyInfo
) {
    if (propertyInfo.skipSearch) {
        return false;
    }

    if (propertyInfo.disabled) {
        return !propertyInfo.disabled(object, propertyInfo);
    }

    return true;
}

////////////////////////////////////////////////////////////////////////////////

type VisitResult = EezValueObject | null;

export function* visitWithPause(
    parentObject: IEezObject
): IterableIterator<VisitResult> {
    if (isEezObjectArray(parentObject)) {
        let arrayOfObjects = parentObject as IEezObject[];
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitWithPause(arrayOfObjects[i]);
        }
    } else {
        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (isPropertySearchable(parentObject, propertyInfo)) {
                let value = getProperty(parentObject, propertyInfo.name);
                if (value != undefined) {
                    if (
                        propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array
                    ) {
                        yield* visitWithPause(value);
                    } else if (
                        propertyInfo.type === PropertyType.Any &&
                        propertyInfo.visitProperty
                    ) {
                        const result = propertyInfo.visitProperty(parentObject);
                        for (const valueObject of result) {
                            yield valueObject;
                        }
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
    if (isEezObjectArray(parentObject)) {
        let arrayOfObjects = parentObject as IEezObject[];
        for (let i = 0; i < arrayOfObjects.length; i++) {
            yield* visitWithoutPause(arrayOfObjects[i]);
        }
    } else {
        for (const propertyInfo of getClassInfo(parentObject).properties) {
            if (isPropertySearchable(parentObject, propertyInfo)) {
                let value = getProperty(parentObject, propertyInfo.name);
                if (value != undefined) {
                    if (
                        propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array
                    ) {
                        yield* visitWithoutPause(value);
                    } else if (
                        propertyInfo.type === PropertyType.Any &&
                        propertyInfo.visitProperty
                    ) {
                        const result = propertyInfo.visitProperty(parentObject);
                        for (const valueObject of result) {
                            yield valueObject;
                        }
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
    if (isEezObjectArray(parentObject)) {
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

type SearchResult = EezValueObject | null;

export function* searchForPattern(
    root: IEezObject,
    searchParams: SearchParamsPattern,
    withPause: boolean
): IterableIterator<SearchResult> {
    function testMatchWholeWord(value: string, pattern: string) {
        return new RegExp("\\b" + pattern + "\\b").test(value);
    }

    let v = withPause ? visitWithPause(root) : visitWithoutPause(root);

    let pattern = searchParams.pattern;
    if (!searchParams.matchCase) {
        pattern = pattern.toLowerCase();
    }

    const canReplaceNumber =
        searchParams.replace == undefined ||
        !isNaN(Number.parseFloat(searchParams.replace));

    function canReplace(valueObject: EezValueObject) {
        if (
            valueObject.propertyInfo.readOnlyInPropertyGrid ||
            isPropertyHidden(getParent(valueObject), valueObject.propertyInfo)
        ) {
            return searchParams.replace == undefined;
        }

        let value = valueObject.value;

        if (typeof value == "string") {
            return true;
        }

        if (typeof value == "number") {
            return canReplaceNumber;
        }

        return false;
    }

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        if (visitResult.value) {
            let valueObject = visitResult.value;
            if (valueObject.value != undefined) {
                let value = valueObject.value.toString();

                if (!searchParams.matchCase) {
                    value = value.toLowerCase();
                }

                if (searchParams.matchWholeWord) {
                    if (testMatchWholeWord(value, pattern)) {
                        if (canReplace(valueObject)) {
                            yield valueObject;
                        }
                    }
                } else {
                    if (value.indexOf(pattern) != -1) {
                        if (canReplace(valueObject)) {
                            yield valueObject;
                        }
                    }
                }
            }
        } else if (withPause) {
            // pause
            yield null;
        }
    }
}

export function* searchForAllReferences2(
    projectStore: ProjectStore,
    root: IEezObject,
    withPause: boolean
) {
    let v = (withPause ? visitWithPause : visitWithoutPause)(root);

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
                    flowProperty = valueObject.propertyInfo.flowProperty(
                        getParent(valueObject)
                    );
                }
            }

            if (
                (valueObject.propertyInfo.type ===
                    PropertyType.ObjectReference &&
                    (!projectStore.project.projectTypeTraits.hasFlowSupport ||
                        valueObject.propertyInfo
                            .referencedObjectCollectionPath !=
                            "variables/globalVariables")) ||
                valueObject.propertyInfo.type === PropertyType.ThemedColor
            ) {
                yield {
                    kinde: "object-reference",
                    valueObject
                };
            } else if (
                valueObject.propertyInfo.type ===
                PropertyType.ConfigurationReference
            ) {
                yield {
                    kinde: "configuration-reference",
                    valueObject
                };
            } else if (
                valueObject.propertyInfo.expressionType != undefined ||
                flowProperty == "scpi-template-literal"
            ) {
                const component = getAncestorOfType<Component>(
                    valueObject,
                    ProjectEditor.ComponentClass.classInfo
                );
                let expressions;

                if (flowProperty && flowProperty == "template-literal") {
                    expressions = templateLiteralToExpressions(
                        valueObject.value
                    ).map(expression => ({
                        start: expression.start + 1,
                        end: expression.end - 1
                    }));
                } else if (
                    flowProperty &&
                    flowProperty == "scpi-template-literal"
                ) {
                    expressions = [];

                    try {
                        const parts = parseScpi(valueObject.value);
                        for (const part of parts) {
                            const tag = part.tag;
                            const str = part.value!;

                            if (tag == SCPI_PART_EXPR) {
                                expressions.push({
                                    start: part.token.offset + 1,
                                    end: part.token.offset + str.length - 1
                                });
                            } else if (tag == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
                                if (str[0] == "{") {
                                    expressions.push({
                                        start: part.token.offset + 1,
                                        end: part.token.offset + str.length - 1
                                    });
                                } else {
                                    expressions.push({
                                        start: part.token.offset,
                                        end: part.token.offset + str.length
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        expressions = [];
                    }
                } else {
                    expressions = [{ start: 0, end: valueObject.value.length }];
                }

                for (const expression of expressions) {
                    try {
                        const rootNode = expressionParser.parse(
                            valueObject.value.substring(
                                expression.start,
                                expression.end
                            )
                        );

                        findValueTypeInExpressionNode(
                            projectStore.project,
                            component,
                            rootNode,
                            flowProperty == "assignable"
                        );

                        for (const node of visitExpressionNodes(rootNode)) {
                            yield {
                                kind: "expression-node",
                                valueObject,
                                node
                            };
                        }
                    } catch (err) {}
                }
            } else if (valueObject.propertyInfo == variableTypeProperty) {
                yield {
                    kind: "variable-type",
                    valueObject
                };
            }
        } else if (withPause) {
            // pause
            yield null;
        }
    }
}

export function* searchForReference(
    root: IEezObject,
    searchParams: SearchParamsObject,
    withPause: boolean
): IterableIterator<SearchResult> {
    const object = searchParams.object;
    const objectParent = getParent(object);

    const project = ProjectEditor.getProject(object);

    let identifierType: IdentifierType | undefined;
    let structType: ValueType | undefined;
    let enumType: ValueType | undefined;

    if (object instanceof ProjectEditor.VariableClass) {
        let flow = getAncestorOfType(object, ProjectEditor.FlowClass.classInfo);
        if (flow) {
            identifierType = "local-variable";
            root = flow;
        } else {
            identifierType = "global-variable";
        }
    } else if (object instanceof ProjectEditor.StructureFieldClass) {
        const struct = getAncestorOfType<Structure>(
            object,
            ProjectEditor.StructureClass.classInfo
        );
        structType = `struct:${struct!.name}`;
    } else if (object instanceof ProjectEditor.EnumClass) {
        identifierType = "enum";
    } else if (object instanceof ProjectEditor.EnumMemberClass) {
        identifierType = "enum-member";
        const parentEnum = getAncestorOfType<Enum>(
            object,
            ProjectEditor.EnumClass.classInfo
        );
        enumType = `enum:${parentEnum!.name}`;
    } else if (object instanceof ProjectEditor.CustomInputClass) {
        identifierType = "input";
        root = getAncestorOfType(
            object,
            ProjectEditor.ComponentClass.classInfo
        )!;
    } else if (object instanceof ProjectEditor.CustomOutputClass) {
        identifierType = "output";
        root = getAncestorOfType(
            object,
            ProjectEditor.ComponentClass.classInfo
        )!;
    } else if (object instanceof ProjectEditor.ImportDirectiveClass) {
        identifierType = "imported-project";
    }

    let v = (withPause ? visitWithPause : visitWithoutPause)(root);

    let objectName;
    let objectParentPath;

    const classInfo = getClassInfo(object);

    let importedProject;

    if (classInfo.getImportedProject) {
        importedProject = classInfo.getImportedProject(object);
        if (!importedProject) {
            return;
        }
    } else {
        if (!objectParent) {
            return;
        }

        objectName = getProperty(
            object,
            identifierType == "imported-project" ? "importAs" : "name"
        );
        if (!objectName || objectName.length == 0) {
            return;
        }

        if (object instanceof ProjectEditor.StyleClass) {
            objectParentPath = "allStyles";
        } else if (object instanceof ProjectEditor.LVGLStyleClass) {
            objectParentPath = "allLvglStyles";
        } else {
            objectParentPath = getObjectPath(objectParent).join("/");
        }
    }

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

            let match = false;

            let flowProperty;
            if (valueObject.propertyInfo.flowProperty) {
                if (typeof valueObject.propertyInfo.flowProperty == "string") {
                    flowProperty = valueObject.propertyInfo.flowProperty;
                } else {
                    flowProperty = valueObject.propertyInfo.flowProperty(
                        getParent(valueObject)
                    );
                }
            }

            if (
                (valueObject.propertyInfo.type ===
                    PropertyType.ObjectReference &&
                    (!project.projectTypeTraits.hasFlowSupport ||
                        valueObject.propertyInfo
                            .referencedObjectCollectionPath !=
                            "variables/globalVariables")) ||
                valueObject.propertyInfo.type === PropertyType.ThemedColor
            ) {
                if (importedProject) {
                    if (
                        valueObject.propertyInfo.referencedObjectCollectionPath
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
                    if (identifierType == "imported-project") {
                        if (valueObject.value.startsWith(objectName + ".")) {
                            valueObject.foundPositions = [
                                {
                                    start: 0,
                                    end: objectName.length
                                }
                            ];
                            match = true;
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
                }
            } else if (
                valueObject.propertyInfo.type ===
                PropertyType.ConfigurationReference
            ) {
                if (
                    valueObject.propertyInfo.referencedObjectCollectionPath ==
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
            } else if (
                valueObject.propertyInfo.expressionType != undefined ||
                flowProperty == "scpi-template-literal"
            ) {
                if (identifierType || structType) {
                    const component = getAncestorOfType<Component>(
                        valueObject,
                        ProjectEditor.ComponentClass.classInfo
                    );
                    let expressions;

                    if (flowProperty && flowProperty == "template-literal") {
                        expressions = templateLiteralToExpressions(
                            valueObject.value
                        ).map(expression => ({
                            start: expression.start + 1,
                            end: expression.end - 1
                        }));
                    } else if (
                        flowProperty &&
                        flowProperty == "scpi-template-literal"
                    ) {
                        expressions = [];

                        try {
                            const parts = parseScpi(valueObject.value);
                            for (const part of parts) {
                                const tag = part.tag;
                                const str = part.value!;

                                if (tag == SCPI_PART_EXPR) {
                                    expressions.push({
                                        start: part.token.offset + 1,
                                        end: part.token.offset + str.length - 1
                                    });
                                } else if (
                                    tag == SCPI_PART_QUERY_WITH_ASSIGNMENT
                                ) {
                                    if (str[0] == "{") {
                                        expressions.push({
                                            start: part.token.offset + 1,
                                            end:
                                                part.token.offset +
                                                str.length -
                                                1
                                        });
                                    } else {
                                        expressions.push({
                                            start: part.token.offset,
                                            end: part.token.offset + str.length
                                        });
                                    }
                                }
                            }
                        } catch (err) {
                            expressions = [];
                        }
                    } else {
                        expressions = [
                            { start: 0, end: valueObject.value.length }
                        ];
                    }

                    for (const expression of expressions) {
                        try {
                            const rootNode = expressionParser.parse(
                                valueObject.value.substring(
                                    expression.start,
                                    expression.end
                                )
                            );

                            findValueTypeInExpressionNode(
                                project,
                                component,
                                rootNode,
                                flowProperty == "assignable"
                            );

                            const foundExpressionNodes: IdentifierExpressionNode[] =
                                [];

                            for (const node of visitExpressionNodes(rootNode)) {
                                if (node.type == "Identifier") {
                                    if (
                                        node.identifierType ===
                                            identifierType &&
                                        (identifierType != "enum-member" ||
                                            node.valueType == enumType) &&
                                        node.name == objectName
                                    ) {
                                        node.location.start.offset +=
                                            expression.start;

                                        node.location.end.offset +=
                                            expression.start;

                                        foundExpressionNodes.push(node);
                                    }
                                } else if (node.type == "MemberExpression") {
                                    if (
                                        node.object.type == "Identifier" &&
                                        node.object.valueType == structType &&
                                        node.property.type == "Identifier" &&
                                        node.property.name == objectName
                                    ) {
                                        node.property.location.start.offset +=
                                            expression.start;

                                        node.property.location.end.offset +=
                                            expression.start;

                                        foundExpressionNodes.push(
                                            node.property
                                        );
                                    }
                                }
                            }

                            if (foundExpressionNodes.length > 0) {
                                match = true;

                                const foundPositions = foundExpressionNodes.map(
                                    node => ({
                                        start: node.location.start.offset,
                                        end: node.location.end.offset
                                    })
                                );

                                if (!valueObject.foundPositions) {
                                    valueObject.foundPositions = foundPositions;
                                } else {
                                    valueObject.foundPositions = [
                                        ...valueObject.foundPositions,
                                        ...foundPositions
                                    ];
                                }
                            }
                        } catch (err) {}
                    }
                }
            } else if (valueObject.propertyInfo == variableTypeProperty) {
                if (object instanceof ProjectEditor.StructureClass) {
                    if (valueObject.value == `struct:${objectName}`) {
                        valueObject.foundPositions = [
                            {
                                start: "struct:".length,
                                end: valueObject.value.length
                            }
                        ];
                        match = true;
                    } else if (
                        valueObject.value == `array:struct:${objectName}`
                    ) {
                        valueObject.foundPositions = [
                            {
                                start: "array:struct:".length,
                                end: valueObject.value.length
                            }
                        ];
                        match = true;
                    }
                } else if (object instanceof ProjectEditor.EnumClass) {
                    if (valueObject.value == `enum:${objectName}`) {
                        valueObject.foundPositions = [
                            {
                                start: "enum:".length,
                                end: valueObject.value.length
                            }
                        ];
                        match = true;
                    } else if (
                        valueObject.value == `array:enum:${objectName}`
                    ) {
                        valueObject.foundPositions = [
                            {
                                start: "array:enum:".length,
                                end: valueObject.value.length
                            }
                        ];
                        match = true;
                    }
                }
            }

            if (match) {
                yield valueObject;
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
            if (
                isPropertySearchable(
                    getParent(valueObject),
                    valueObject.propertyInfo
                )
            ) {
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

interface SearchCallbackMessageClear {
    type: "clear";
}

interface SearchCallbackMessageStart {
    type: "start";
}

interface SearchCallbackMessageValue {
    type: "value";
    valueObject: EezValueObject;
}

interface SearchCallbackMessageFinish {
    type: "finish";
}

export type SearchCallbackMessage =
    | SearchCallbackMessageClear
    | SearchCallbackMessageStart
    | SearchCallbackMessageValue
    | SearchCallbackMessageFinish;

export type SearchCallback = (message: SearchCallbackMessage) => boolean;

export interface SearchParamsPattern {
    type: "pattern";
    pattern: string;
    matchCase: boolean;
    matchWholeWord: boolean;
    replace: string | undefined;
}

export interface SearchParamsObject {
    type: "object";
    object: IEezObject;
}

export interface SearchParamsReferences {
    type: "references";
}

export type SearchParams = (
    | SearchParamsPattern
    | SearchParamsObject
    | SearchParamsReferences
) & {
    searchCallback: SearchCallback;
};

export class CurrentSearch {
    interval: any;

    searchCallback: SearchCallback | undefined;

    constructor(public projectStore: ProjectStore) {}

    finishSearch() {
        if (this.searchCallback) {
            this.searchCallback({ type: "finish" });
            this.searchCallback = undefined;
        }

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }

    startNewSearch(searchParams: SearchParams) {
        searchParams.searchCallback({ type: "clear" });

        this.finishSearch();

        this.searchCallback = searchParams.searchCallback;

        const root = this.projectStore.project;

        if (
            root &&
            (searchParams.type != "pattern" || searchParams.pattern != "")
        ) {
            searchParams.searchCallback({ type: "start" });

            let searchResultsGenerator =
                searchParams.type == "pattern"
                    ? searchForPattern(root, searchParams, true)
                    : searchParams.type == "object"
                    ? searchForReference(root, searchParams, true)
                    : searchForAllReferences(root, true);

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
                        if (
                            !searchParams.searchCallback({
                                type: "value",
                                valueObject
                            })
                        ) {
                            this.finishSearch();
                            return;
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
    isReferenced: typeof isReferenced;
    checkObjectReference: typeof checkObjectReference;
}

////////////////////////////////////////////////////////////////////////////////

export function startNewSearch(
    projectStore: ProjectStore,
    searchParams: SearchParams
) {
    projectStore.currentSearch.startNewSearch(searchParams);
}

export function importDirectiveUsage(
    projectStore: ProjectStore,
    searchCallback: SearchCallback
) {
    startNewSearch(projectStore, {
        type: "references",
        searchCallback
    });
}

export function importDirectiveUsageWithImportAs(
    projectStore: ProjectStore,
    importDirective: ImportDirective,
    searchCallback: SearchCallback
) {
    startNewSearch(projectStore, {
        type: "object",
        object: importDirective,
        searchCallback
    });
}

////////////////////////////////////////////////////////////////////////////////

export function isReferenced(object: IEezObject) {
    let resultsGenerator = searchForReference(
        getRootObject(object),
        { type: "object", object },
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
    let resultsGenerator = searchForReference(
        rootObject,
        { type: "object", object },
        false
    );

    while (true) {
        let searchResult = resultsGenerator.next();
        if (searchResult.done) {
            break;
        }

        let searchValue = searchResult.value;
        if (searchValue) {
            let parent = getParent(searchValue);
            if (!parent) {
                continue;
            }

            let key = getKey(searchValue);
            if (!key || !(typeof key == "string")) {
                continue;
            }

            let value: string | string[] = newValue;

            if (searchValue.foundPositions) {
                const oldValue = getProperty(parent, key);

                value = "";

                let prevEnd = 0;

                for (const position of searchValue.foundPositions) {
                    let start = position.start;
                    let end = position.end;

                    if (prevEnd < start) {
                        value += oldValue.substring(prevEnd, start);
                    }

                    value += newValue;

                    prevEnd = end;
                }

                if (prevEnd < oldValue.length) {
                    value += oldValue.substring(prevEnd);
                }
            } else if (
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

            getProjectStore(rootObject).updateObject(parent, {
                [key]: value
            });
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

export function findAllOccurrences(
    str: string,
    pattern: string,
    matchCase: boolean,
    matchWholeWord: boolean
) {
    const occurrences: { start: number; end: number }[] = [];

    if (!matchCase) {
        str = str.toLowerCase();
    }

    if (matchWholeWord) {
        const re = new RegExp("\\b" + pattern + "\\b", "g");

        for (let i = 0; i < 1000; i++) {
            const result = re.exec(str);

            if (!result) {
                break;
            }

            occurrences.push({
                start: result.index,
                end: result.index + pattern.length
            });
        }
    } else {
        let end = 0;

        for (let i = 0; i < 1000; i++) {
            let start = str.indexOf(pattern, end);

            if (start == -1) {
                break;
            }

            end = start + pattern.length;

            occurrences.push({ start, end });
        }
    }

    return occurrences;
}

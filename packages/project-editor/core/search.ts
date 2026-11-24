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
    getHumanReadableObjectPath,
    getClassInfo,
    EezValueObject,
    ProjectStore,
    getProjectStore,
    getAncestorOfType
} from "project-editor/store";

import type {
    checkObjectReference,
    ImportDirective,
    Project
} from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

import { expressionParser } from "project-editor/flow/expression/parser";
import { findValueTypeInExpressionNode } from "project-editor/flow/expression/type";
import {
    templateLiteralToExpressions,
    visitExpressionNodes
} from "project-editor/flow/expression/helper";
import type {
    ExpressionNode,
    IdentifierExpressionNode,
    IdentifierType
} from "project-editor/flow/expression/node";
import type { Component } from "project-editor/flow/component";
import { expandNamedExpressions } from "project-editor/flow/expression/named-expression";

import {
    parseScpi,
    SCPI_PART_EXPR,
    SCPI_PART_QUERY_WITH_ASSIGNMENT
} from "eez-studio-shared/scpi-parser";

import {
    ValueType,
    variableTypeProperty
} from "project-editor/features/variable/value-type";
import type {
    Enum,
    Structure,
    Variable
} from "project-editor/features/variable/variable";
import type { Style } from "project-editor/features/style/style";
import type { LVGLStyle } from "project-editor/lvgl/style";

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
    parentObject: IEezObject,
    includeAdditionObjects?: IEezObject[]
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

    if (includeAdditionObjects) {
        for (let i = 0; i < includeAdditionObjects.length; i++) {
            yield* visitWithPause(includeAdditionObjects[i]);
        }
    }

    // pause
    yield null;
}

function* visitWithoutPause(
    parentObject: IEezObject,
    includeAdditionObjects?: IEezObject[]
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

    if (includeAdditionObjects) {
        for (let i = 0; i < includeAdditionObjects.length; i++) {
            yield* visitWithoutPause(includeAdditionObjects[i]);
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

type NamedDestinationVisitor = (
    component: Component | undefined,
    name: string,
    reference: EezValueObject
) => void;

export function* searchForObjectDependencies(
    projectStore: ProjectStore,
    root: IEezObject,
    withPause: boolean,
    lookInsideExpressions: boolean,
    includeAdditionObjects?: IEezObject[],
    visitNamedDestination?: NamedDestinationVisitor
): IterableIterator<
    | { kind: "object-reference"; valueObject: EezValueObject }
    | { kind: "configuration-reference"; valueObject: EezValueObject }
    | { kind: "expression-start"; valueObject: EezValueObject }
    | {
          kind: "expression-node";
          valueObject: EezValueObject;
          node: ExpressionNode;
          ambiguous?: boolean;
          expressionStartIndex: number;
      }
    | { kind: "expression-end"; valueObject: EezValueObject }
    | { kind: "variable-type"; valueObject: EezValueObject }
    | null
> {
    let v = (withPause ? visitWithPause : visitWithoutPause)(
        root,
        includeAdditionObjects
    );

    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        let valueObject = visitResult.value;
        if (valueObject) {
            if (!valueObject.value) {
                continue;
            }

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
                ((valueObject.propertyInfo.type ===
                    PropertyType.ObjectReference ||
                    (valueObject.propertyInfo.type === PropertyType.Enum &&
                        valueObject.propertyInfo
                            .referencedObjectCollectionPath)) &&
                    (!projectStore.project.projectTypeTraits.hasFlowSupport ||
                        flowProperty == undefined)) ||
                valueObject.propertyInfo.type === PropertyType.ThemedColor
            ) {
                yield {
                    kind: "object-reference",
                    valueObject
                };
            } else if (
                valueObject.propertyInfo.type ===
                PropertyType.ConfigurationReference
            ) {
                yield {
                    kind: "configuration-reference",
                    valueObject
                };
            } else if (
                (flowProperty &&
                    valueObject.propertyInfo.expressionType != undefined) ||
                flowProperty == "scpi-template-literal"
            ) {
                if (lookInsideExpressions) {
                    let value = valueObject.value;
                    if (typeof value != "string") {
                        value = valueObject.value.toString();
                    }

                    yield {
                        kind: "expression-start",
                        valueObject
                    };

                    const component = ProjectEditor.getComponent(valueObject);
                    let expressions;

                    if (flowProperty && flowProperty == "template-literal") {
                        expressions = templateLiteralToExpressions(value).map(
                            expression => ({
                                start: expression.start + 1,
                                end: expression.end - 1
                            })
                        );
                    } else if (
                        flowProperty &&
                        flowProperty == "scpi-template-literal"
                    ) {
                        expressions = [];

                        try {
                            const parts = parseScpi(value);
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
                        expressions = [{ start: 0, end: value.length }];
                    }

                    for (const expression of expressions) {
                        try {
                            const source = value.substring(
                                expression.start,
                                expression.end
                            );
                            const rootNode: ExpressionNode =
                                expressionParser.parse(source);
                            const nodes = expressionNodesForSearch(
                                projectStore.project,
                                component,
                                rootNode,
                                source,
                                flowProperty === "assignable" ||
                                    (valueObject.propertyInfo.assignableList ===
                                        true &&
                                        rootNode.type === "ArrayExpression"),
                                visitNamedDestination
                                    ? name =>
                                          visitNamedDestination(
                                              component,
                                              name,
                                              valueObject
                                          )
                                    : undefined
                            );

                            for (const reference of nodes) {
                                yield {
                                    kind: "expression-node",
                                    valueObject,
                                    ...reference,
                                    expressionStartIndex: expression.start
                                };
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    yield {
                        kind: "expression-end",
                        valueObject
                    };
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

function* expressionNodesForSearch(
    project: Project,
    component: Component | undefined,
    root: ExpressionNode,
    source: string,
    assignable: boolean,
    visitNamedDestination?: (name: string) => void
): IterableIterator<{ node: ExpressionNode; ambiguous?: boolean }> {
    if (assignable && project.variables?.namedExpressionsMap.size) {
        const identifiers = new Map<number, IdentifierExpressionNode[]>();
        const record = (node: IdentifierExpressionNode) => {
            if (
                node.location.source !== source ||
                !node.identifierType ||
                node.identifierType === "unknown"
            ) {
                return;
            }
            const offset = node.location.start.offset;
            const bindings = identifiers.get(offset);
            if (!bindings) {
                identifiers.set(offset, [node]);
            } else if (
                !bindings.some(
                    binding =>
                        binding.identifierType === node.identifierType &&
                        binding.importedVariable === node.importedVariable &&
                        (node.identifierType !== "enum-member" ||
                            binding.valueType === node.valueType)
                )
            ) {
                bindings.push(node);
            }
        };
        try {
            const namedDestinations = visitNamedDestination
                ? new Set<string>()
                : undefined;
            const expanded = expandNamedExpressions(
                project,
                component,
                root,
                source,
                assignable,
                (node, writable) => {
                    record({ ...node, identifierType: "named-expression" });
                    if (writable) {
                        namedDestinations?.add(node.name);
                    }
                }
            );
            findValueTypeInExpressionNode(
                project,
                component,
                expanded,
                assignable
            );
            namedDestinations?.forEach(visitNamedDestination!);
            if (identifiers.size > 0) {
                const members = new Map<number, ExpressionNode[]>();
                for (const node of visitExpressionNodes(expanded)) {
                    if (node.type === "Identifier") {
                        record(node);
                    } else if (
                        node.type === "MemberExpression" &&
                        node.property.type === "Identifier" &&
                        node.property.location.source === source
                    ) {
                        members.set(node.property.location.start.offset, [node]);
                    }
                }
                // Expansion can duplicate or reorder parameters. Visit each
                // distinct binding once, at its original source position.
                const bindings = [...identifiers, ...members]
                    .sort(([a], [b]) => a - b);
                for (const [, nodes] of bindings) {
                    for (const node of nodes) {
                        yield { node, ambiguous: nodes.length > 1 };
                    }
                }
                return;
            }
            for (const node of visitExpressionNodes(expanded)) {
                yield { node };
            }
            return;
        } catch {
            // Keep finding explicit references in an unfinished expression.
            root = expressionParser.parse(source);
        }
    }
    findValueTypeInExpressionNode(project, component, root, assignable);
    for (const node of visitExpressionNodes(root)) {
        yield { node };
    }
}

export function* searchForReference(
    root: IEezObject,
    searchParams: SearchParamsObject,
    withPause: boolean,
    visitNamedDestination?: NamedDestinationVisitor
): IterableIterator<SearchResult> {
    const object = searchParams.object;
    const objectParent = getParent(object);

    const project = ProjectEditor.getProject(object);

    let identifierType: IdentifierType | undefined;
    let structType: ValueType | undefined;
    let enumType: ValueType | undefined;
    if (
        object instanceof ProjectEditor.VariableClass ||
        object instanceof ProjectEditor.UserPropertyClass
    ) {
        let flow = ProjectEditor.getFlow(object);
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
    } else if (object instanceof ProjectEditor.NamedExpressionClass) {
        identifierType = "named-expression";
    } else if (object instanceof ProjectEditor.EnumMemberClass) {
        identifierType = "enum-member";
        const parentEnum = getAncestorOfType<Enum>(
            object,
            ProjectEditor.EnumClass.classInfo
        );
        enumType = `enum:${parentEnum!.name}`;
    } else if (object instanceof ProjectEditor.CustomInputClass) {
        identifierType = "input";
        root = ProjectEditor.getComponent(object);
    } else if (object instanceof ProjectEditor.CustomOutputClass) {
        identifierType = "output";
        root = ProjectEditor.getComponent(object);
    } else if (object instanceof ProjectEditor.ImportDirectiveClass) {
        identifierType = "imported-project";
    }

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

        if (
            object instanceof ProjectEditor.StyleClass ||
            object instanceof ProjectEditor.LiteStyleClass
        ) {
            objectParentPath = "allStyles";
        } else if (object instanceof ProjectEditor.LVGLStyleClass) {
            objectParentPath = "allLvglStyles";
        } else {
            objectParentPath = getObjectPath(objectParent).join("/");
        }
    }

    let v = searchForObjectDependencies(
        project._store,
        root,
        withPause,
        identifierType != undefined || structType != undefined,
        searchParams.includeAdditionObjects,
        visitNamedDestination
    );
    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            return;
        }

        let dependency = visitResult.value;
        if (dependency) {
            let match = false;

            const valueObject = dependency.valueObject;

            if (dependency.kind == "object-reference") {
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
            } else if (dependency.kind == "configuration-reference") {
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
            } else if (dependency.kind == "expression-start") {
                valueObject.foundPositions = [];
            } else if (dependency.kind == "expression-node") {
                const node = dependency.node;

                if (node.type == "Identifier") {
                    if (
                        node.identifierType === identifierType &&
                        (identifierType != "enum-member" ||
                            node.valueType == enumType) &&
                        (node.importedVariable
                            ? node.importedVariable === object
                            : node.name === objectName)
                    ) {
                        valueObject.foundPositions!.push({
                            start:
                                node.location.start.offset +
                                dependency.expressionStartIndex,
                            end:
                                node.location.end.offset +
                                dependency.expressionStartIndex,
                            ambiguous: dependency.ambiguous
                        });
                    }
                } else if (node.type == "MemberExpression") {
                    if (
                        node.object.type == "Identifier" &&
                        node.object.valueType == structType &&
                        node.property.type == "Identifier" &&
                        node.property.name == objectName
                    ) {
                        valueObject.foundPositions!.push({
                            start:
                                node.property.location.start.offset +
                                dependency.expressionStartIndex,
                            end:
                                node.property.location.end.offset +
                                dependency.expressionStartIndex
                        });
                    }
                }
            } else if (dependency.kind == "expression-end") {
                if (valueObject.foundPositions!.length > 0) {
                    match = true;
                }
            } else if (dependency.kind == "variable-type") {
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

export interface UnusedObject {
    object: IEezObject;
    group: string;
    text: string;
}

function* isReferencedWithPause(
    object: IEezObject
): Generator<null, boolean, undefined> {
    // styles, fonts and bitmaps marked with "Always build" are used
    if (getProperty(object, "alwaysBuild")) {
        return true;
    }

    const resultsGenerator = searchForReference(
        getRootObject(object),
        { type: "object", object },
        true
    );

    while (true) {
        const searchResult = resultsGenerator.next();
        if (searchResult.done) {
            return false;
        }

        if (searchResult.value) {
            return true;
        }

        // pause
        yield null;
    }
}

export function* searchForUnusedObjects(
    root: IEezObject
): Generator<UnusedObject | null, void, undefined> {
    const project = ProjectEditor.getProject(root);

    function* checkObjects(
        group: string,
        objects: IEezObject[] | undefined,
        getText: (object: IEezObject) => string = object =>
            getProperty(object, "name")
    ): Generator<UnusedObject | null, void, undefined> {
        if (!objects) {
            return;
        }
        for (const object of objects) {
            if (!(yield* isReferencedWithPause(object))) {
                yield { object, group, text: getText(object) };
            }
        }
    }

    // style is used if it or any of its child styles is used,
    // because child styles inherit from their parent style
    function* checkStyles(
        group: string,
        styles: (Style | LVGLStyle)[] | undefined
    ): Generator<UnusedObject | null, boolean, undefined> {
        let anyUsed = false;
        if (styles) {
            for (const style of styles) {
                // a state style and a variant style are used with their base
                // style
                if ((style as Style).state || (style as Style).variant) {
                    continue;
                }

                const childStylesUsed: boolean = yield* checkStyles(
                    group,
                    style.childStyles
                );

                if (
                    childStylesUsed ||
                    (yield* isReferencedWithPause(style))
                ) {
                    anyUsed = true;
                } else {
                    yield { object: style, group, text: style.name };
                }
            }
        }
        return anyUsed;
    }

    yield* checkObjects(
        "Global Variables",
        project.variables?.globalVariables
    );

    const flows = [
        ...(project.userPages ?? []),
        ...(project.userWidgets ?? []),
        ...(project.actions ?? [])
    ];
    for (const flow of flows) {
        yield* checkObjects(
            "Local Variables",
            flow.localVariables,
            (localVariable: Variable) => `${flow.name}: ${localVariable.name}`
        );
    }

    yield* checkObjects("Structures", project.variables?.structures);
    yield* checkObjects("Enumerations", project.variables?.enums);
    yield* checkObjects(
        "Named Expressions",
        project.variables?.namedExpressions
    );

    if (project.projectTypeTraits.isLVGL) {
        yield* checkStyles("Styles", project.lvglStyles?.styles);
    } else {
        yield* checkStyles("Styles", project.styles);
    }

    yield* checkObjects("Fonts", project.fonts);
    yield* checkObjects("Bitmaps", project.bitmaps);
    yield* checkObjects("Theme Colors", project.colors);
    yield* checkObjects("User Widgets", project.userWidgets);
    yield* checkObjects("User Actions", project.actions);
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

interface SearchCallbackMessageUnused {
    type: "unused";
    unusedObject: UnusedObject;
}

interface SearchCallbackMessageFinish {
    type: "finish";
}

export type SearchCallbackMessage =
    | SearchCallbackMessageClear
    | SearchCallbackMessageStart
    | SearchCallbackMessageValue
    | SearchCallbackMessageUnused
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
    includeAdditionObjects?: IEezObject[];
}

export interface SearchParamsReferences {
    type: "references";
}

export interface SearchParamsUnused {
    type: "unused";
}

export type SearchParams = (
    | SearchParamsPattern
    | SearchParamsObject
    | SearchParamsReferences
    | SearchParamsUnused
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

            let searchResultsGenerator: Iterator<
                SearchResult | UnusedObject | null
            > =
                searchParams.type == "pattern"
                    ? searchForPattern(root, searchParams, true)
                    : searchParams.type == "object"
                    ? searchForReference(root, searchParams, true)
                    : searchParams.type == "unused"
                    ? searchForUnusedObjects(root)
                    : searchForAllReferences(root, true);

            this.interval = setInterval(() => {
                let startTime = new Date().getTime();

                while (true) {
                    let searchResult = searchResultsGenerator.next();
                    if (searchResult.done) {
                        this.finishSearch();
                        return;
                    }

                    let result = searchResult.value;
                    if (result) {
                        if (
                            !searchParams.searchCallback(
                                result instanceof EezValueObject
                                    ? {
                                          type: "value",
                                          valueObject: result
                                      }
                                    : {
                                          type: "unused",
                                          unusedObject: result
                                      }
                            )
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

export class AmbiguousObjectReferenceError extends Error {}

export function prepareObjectReferenceReplacement(
    object: IEezObject,
    newValue: string,
    includeAdditionObjects?: IEezObject[]
): () => void {
    const rootObject = getRootObject(object);
    const project = ProjectEditor.getProject(object);
    const oldName: string = getProperty(object, "name");
    const outputComponent =
        object instanceof ProjectEditor.CustomOutputClass &&
        project.variables?.namedExpressionsMap.has(newValue)
            ? ProjectEditor.getComponent(object)
            : undefined;
    const renameNamedExpression =
        object instanceof ProjectEditor.NamedExpressionClass;
    let captured: EezValueObject | undefined;
    const visitNamedDestination: NamedDestinationVisitor | undefined =
        outputComponent || renameNamedExpression
            ? (component, name, reference) => {
                  if (
                      (outputComponent &&
                          component === outputComponent &&
                          name === newValue) ||
                      (renameNamedExpression &&
                          name === oldName &&
                          component?.outputs?.some(
                              output => output.name === newValue
                          ))
                  ) {
                      captured ??= reference;
                  }
              }
            : undefined;

    const changes: {
        parent: IEezObject;
        key: string;
        value: string | string[];
    }[] = [];
    const references = searchForReference(
        rootObject,
        { type: "object", object, includeAdditionObjects },
        false,
        visitNamedDestination
    );

    for (const reference of references) {
        if (!reference) {
            continue;
        }

        const parent = getParent(reference);
        const key = getKey(reference);
        if (!parent || !key || typeof key !== "string") {
            continue;
        }

        let value: string | string[] = newValue;
        if (reference.foundPositions) {
            const oldValue = getProperty(parent, key);
            const ambiguous = reference.foundPositions.find(
                position => position.ambiguous
            );
            if (ambiguous) {
                const name = oldValue.slice(ambiguous.start, ambiguous.end);
                throw new AmbiguousObjectReferenceError(
                    `Cannot rename "${name}" in ${getHumanReadableObjectPath(reference)}. It refers to different declarations when read and written. Use separate arguments for reading and writing, then rename again.`
                );
            }

            value = "";
            let prevEnd = 0;
            for (const { start, end } of reference.foundPositions) {
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
            reference.propertyInfo.type === PropertyType.ConfigurationReference
        ) {
            value = reference.value.map((item: string) =>
                item === oldName ? newValue : item
            );
        }
        changes.push({ parent, key, value });
    }

    if (captured) {
        throw new AmbiguousObjectReferenceError(
            `Cannot rename "${oldName}" to "${newValue}". The new name would change the destination in ${getHumanReadableObjectPath(captured)}. Choose a different name or update that expression first.`
        );
    }

    return () => {
        const store = getProjectStore(rootObject);
        for (const { parent, key, value } of changes) {
            store.updateObject(parent, { [key]: value });
        }
    };
}

export function replaceObjectReference(
    object: IEezObject,
    newValue: string,
    includeAdditionObjects?: IEezObject[]
) {
    prepareObjectReferenceReplacement(object, newValue, includeAdditionObjects)();
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

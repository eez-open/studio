import type { Project } from "project-editor/project/project";
import type { Component } from "project-editor/flow/component";
import type { ExpressionNode } from "project-editor/flow/expression/node";
import {
    ValueType,
    getStructureFromType
} from "project-editor/features/variable/value-type";

import {
    getArrayElementTypeFromType,
    getEnumTypeNameFromType,
    isEnumType
} from "project-editor/features/variable/value-type";

import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    logicalOperators,
    unaryOperators
} from "./operations";

import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";

import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export function findValueTypeInExpressionNode(
    project: Project,
    component: Component | undefined,
    node: ExpressionNode,
    assignable: boolean
) {
    if (node.type == "Literal") {
        if (typeof node.value === "boolean") {
            node.valueType = "boolean";
        } else if (typeof node.value === "number") {
            if (
                Number.isInteger(node.value) &&
                (!node.location ||
                    (node.location.source as string)
                        .substring(
                            node.location.start.offset,
                            node.location.end.offset
                        )
                        .indexOf(".") == -1)
            ) {
                node.valueType = "integer";
            } else {
                node.valueType = "double";
            }
        } else if (typeof node.value === "string") {
            node.valueType = "string";
        } else if (node.value === "null") {
            node.valueType = "null";
        } else {
            node.valueType = "undefined";
        }
    } else if (node.type == "TextResource") {
        node.valueType = "string";
    } else if (node.type == "JSONLiteral") {
        node.valueType = "json";
    } else if (node.type == "Identifier") {
        if (assignable) {
            const output = component?.outputs.find(
                output => output.name === node.name
            );
            if (output) {
                node.valueType = getType(project, output.type);
                node.identifierType = "output";
                return;
            }
        }

        const input = component?.inputs.find(input => input.name == node.name);
        if (input) {
            node.valueType = getType(project, input.type);
            node.identifierType = "input";
            return;
        }

        if (component) {
            const flow = ProjectEditor.getFlow(component);
            if (flow) {
                let localVariable = flow.userPropertiesAndLocalVariables.find(
                    localVariable => localVariable.name == node.name
                );
                if (localVariable) {
                    node.valueType = getType(project, localVariable.type);
                    node.identifierType = "local-variable";
                    return;
                }
            }
        }

        let globalVariable = project.allGlobalVariables.find(
            globalVariable => globalVariable.fullName == node.name
        );
        if (globalVariable) {
            node.valueType = getType(project, globalVariable.type);
            node.identifierType = "global-variable";
            return;
        }

        let enumDef = project.variables.enumsMap.get(node.name);
        if (enumDef) {
            node.valueType = `enum:${node.name}` as ValueType;
            node.identifierType = "enum";
            return;
        }

        let importIndex = project.importAsList.findIndex(
            importPrefix => importPrefix == node.name
        );
        if (importIndex != -1) {
            node.valueType = `importedProject`;
            node.identifierType = "imported-project";
            return;
        }

        if (node.name == FLOW_ITERATOR_INDEX_VARIABLE) {
            node.valueType = `integer`;
            node.identifierType = "system-variable";
            return;
        }

        if (node.name == FLOW_ITERATOR_INDEXES_VARIABLE) {
            node.valueType = `array:integer`;
            node.identifierType = "system-variable";
            return;
        }

        // TODO test inputs and outputs (assignable expression)
        // throw `identifier '${node.name}' is neither input or local or global variable or enum`;

        node.valueType = "any";
        node.identifierType = "unknown";
        return;
    } else if (node.type == "BinaryExpression") {
        let operator = binaryOperators[node.operator];
        if (!operator) {
            operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }
        }
        findValueTypeInExpressionNode(
            project,
            component,
            node.left,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.right,
            assignable
        );
        node.valueType = operator.getValueType(
            node.left.valueType,
            node.right.valueType
        );
    } else if (node.type == "LogicalExpression") {
        const operator = logicalOperators[node.operator];
        if (!operator) {
            throw `Unknown logical operator '${node.operator}'`;
        }
        findValueTypeInExpressionNode(
            project,
            component,
            node.left,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.right,
            assignable
        );
        node.valueType = operator.getValueType(
            node.left.valueType,
            node.right.valueType
        );
    } else if (node.type == "UnaryExpression") {
        const operator = unaryOperators[node.operator];
        if (!operator) {
            throw `Unknown unary operator '${node.operator}'`;
        }
        findValueTypeInExpressionNode(
            project,
            component,
            node.argument,
            assignable
        );
        node.valueType = operator.getValueType(node.argument.valueType);
    } else if (node.type == "ConditionalExpression") {
        findValueTypeInExpressionNode(
            project,
            component,
            node.test,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.consequent,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.alternate,
            assignable
        );
        // if (node.consequent.valueType != node.alternate.valueType) {
        //     throw "different types in conditional";
        // }
        node.valueType = node.consequent.valueType;
    } else if (node.type == "CallExpression") {
        if (
            node.callee.type != "MemberExpression" ||
            node.callee.object.type != "Identifier" ||
            node.callee.property.type != "Identifier"
        ) {
            throw "Invalid call expression";
        }

        let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

        const builtInFunction = builtInFunctions[functionName];
        if (builtInFunction == undefined) {
            throw `Unknown function '${functionName}'`;
        }

        if (
            builtInFunction.enabled &&
            !builtInFunction.enabled(project._store)
        ) {
            throw `Function '${functionName}' not supported`;
        }

        checkArity(functionName, node);

        node.arguments.forEach(argument =>
            findValueTypeInExpressionNode(
                project,
                component,
                argument,
                assignable
            )
        );

        node.valueType = builtInFunction.getValueType(
            ...node.arguments.map(node => node.valueType)
        );

        if (functionName == "Flow.makeValue") {
            if (node.arguments[0].type == "Literal") {
                node.valueType = node.arguments[0].value;
            }

            const type = project._store.typesStore.getType(node.valueType);
            if (type?.kind == "object") {
                const valueArgument = node.arguments[1];

                if (valueArgument && valueArgument.type == "ObjectExpression") {
                    const structure = getStructureFromType(
                        project,
                        node.valueType
                    )!;

                    if (structure) {
                        for (const property of valueArgument.properties) {
                            if (property.key.type != "Identifier") {
                                continue;
                            }

                            const field = structure.fieldsMap.get(
                                property.key.name
                            );

                            if (field) {
                                if (
                                    field.type == "double" &&
                                    (property.value.valueType == "integer" ||
                                        property.value.valueType == "float")
                                ) {
                                    property.value.valueType = "double";
                                } else if (
                                    field.type == "float" &&
                                    property.value.valueType == "integer"
                                ) {
                                    property.value.valueType = "float";
                                } else if (field.type == "array:double") {
                                    if (
                                        property.value.valueType ==
                                            "array:integer" ||
                                        property.value.valueType ==
                                            "array:float"
                                    ) {
                                        property.value.valueType =
                                            "array:double";
                                    }

                                    if (
                                        property.value.type == "ArrayExpression"
                                    ) {
                                        for (const element of property.value
                                            .elements) {
                                            element.valueType = "double";
                                        }
                                    }
                                } else if (field.type == "array:float") {
                                    if (
                                        property.value.valueType ==
                                        "array:integer"
                                    ) {
                                        property.value.valueType =
                                            "array:float";
                                    }

                                    if (
                                        property.value.type == "ArrayExpression"
                                    ) {
                                        for (const element of property.value
                                            .elements) {
                                            element.valueType = "float";
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else if (functionName == "Flow.makeArrayValue") {
            if (node.arguments[0].type == "Literal") {
                node.valueType = node.arguments[0].value;
            }
        }
    } else if (node.type == "MemberExpression") {
        findValueTypeInExpressionNode(
            project,
            component,
            node.object,
            assignable
        );
        findValueTypeInExpressionNode(
            project,
            component,
            node.property,
            assignable
        );

        if (node.object.valueType == "importedProject") {
            node.valueType = "any";
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const importAs = node.object.name;
                const variableName = node.property.name;

                const importDirective = project.settings.general.imports.find(
                    importDirective => importDirective.importAs == importAs
                );
                if (importDirective && importDirective.project) {
                    const globalVariable =
                        importDirective.project.variables.globalVariables.find(
                            globalVariable =>
                                globalVariable.name == variableName
                        );
                    if (globalVariable) {
                        node.valueType = globalVariable.type;
                        node.property.identifierType = "global-variable";
                    }
                }
            }
        } else if (isEnumType(node.object.valueType)) {
            const enumName = getEnumTypeNameFromType(node.object.valueType)!;
            const enumDef = project.variables.enumsMap.get(enumName)!;
            if (node.property.type != "Identifier") {
                throw `Invalid enum field type: '${node.property.type}'`;
            }
            const enumMember = enumDef.membersMap.get(node.property.name);
            if (!enumMember) {
                throw `Enum member '${node.property.name}' not found in enum '${enumName}'`;
            }
            node.valueType = node.object.valueType;
            node.property.valueType = node.object.valueType;
            node.property.identifierType = "enum-member";
        } else {
            if (node.computed) {
                if (node.object.valueType == "any") {
                    node.valueType = "any";
                } else if (node.object.valueType == "blob") {
                    node.valueType = "integer";
                } else if (node.object.valueType == "json") {
                    node.valueType = "json";
                } else {
                    const valueType = getArrayElementTypeFromType(
                        node.object.valueType
                    );
                    if (!valueType) {
                        throw `Array type expected but found '${node.object.valueType}'`;
                    }
                    node.valueType = valueType;
                }
            } else {
                if (node.property.type != "Identifier") {
                    throw `Invalid field type: '${node.property.type}'`;
                }

                if (node.object.type == "Identifier") {
                    if (node.object.valueType === "any") {
                        node.valueType = "any";
                        return;
                    }

                    const enumDef = project.variables.enumsMap.get(
                        node.object.name
                    );
                    if (enumDef) {
                        const enumMember = enumDef.membersMap.get(
                            node.property.name
                        );
                        if (enumMember) {
                            node.valueType = "integer";
                            node.property.identifierType = "enum-member";
                            return;
                        }
                    } else {
                        const builtInConstantName = `${node.object.name}.${node.property.name}`;
                        const buildInConstantValue = builtInConstants(
                            project._store
                        )[builtInConstantName];
                        if (buildInConstantValue != undefined) {
                            node.valueType = buildInConstantValue.valueType;
                            node.object.identifierType =
                                "builtin-constant-namespace";
                            node.property.identifierType =
                                "builtin-constant-member";
                            return;
                        }
                    }
                }

                if (node.object.valueType == "json") {
                    node.valueType = "json";
                    node.property.identifierType = "member";
                } else {
                    const type = project._store.typesStore.getFieldType(
                        node.object.valueType,
                        node.property.name
                    );
                    if (!type) {
                        throw `Member access ".${node.property.name}" is not allowed`;
                    }

                    node.valueType = type;
                    node.property.identifierType = "member";
                }
            }
        }
    } else if (node.type == "ArrayExpression") {
        node.elements.forEach(element =>
            findValueTypeInExpressionNode(
                project,
                component,
                element,
                assignable
            )
        );
        node.valueType = `array:${
            node.elements.length > 0 ? node.elements[0].valueType : "any"
        }` as ValueType;
    } else if (node.type == "ObjectExpression") {
        node.properties.forEach(property =>
            findValueTypeInExpressionNode(
                project,
                component,
                property.value,
                assignable
            )
        );
        node.valueType = project.projectTypeTraits.isDashboard
            ? "json"
            : "struct:any";
    } else {
        throw `Unknown expression node "${node.type}"`;
    }
}

export function checkArity(functionName: string, node: ExpressionNode) {
    if (node.type != "CallExpression") {
        throw "not an CallExpression node";
    }

    const arity = builtInFunctions[functionName].arity;

    if (typeof arity == "object") {
        if (arity.max != undefined) {
            if (
                node.arguments.length < arity.min ||
                node.arguments.length > arity.max
            ) {
                throw `In function '${functionName}' call expected ${arity.min} to ${arity.max} arguments, but got ${node.arguments.length}`;
            }
        } else {
            if (node.arguments.length < arity.min) {
                throw `In function '${functionName}' call expected at least ${arity.min} arguments, but got ${node.arguments.length}`;
            }
        }
    } else {
        if (node.arguments.length != arity) {
            throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
        }
    }
}

export function isImplicitConversionPossible(
    fromType: ValueType,
    toType: ValueType
) {
    if (toType == "null") {
        return true;
    }

    if (toType == "any" || fromType == "any") {
        return true;
    }

    return fromType == toType;
}

function getType(project: Project, valueType: ValueType): ValueType {
    if (valueType == "any") {
        return project._store.typesStore.createOpenType();
    }

    if (valueType == "array:any") {
        return `array:${project._store.typesStore.createOpenType()}`;
    }

    return valueType;
}

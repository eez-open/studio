import type { Project } from "project-editor/project/project";
import type { Component } from "project-editor/flow/component";
import type { ExpressionNode } from "project-editor/flow/expression/node";
import type { ValueType } from "project-editor/features/variable/value-type";

import {
    getArrayElementTypeFromType,
    getEnumTypeNameFromType,
    getStructTypeNameFromType,
    isObjectType,
    isEnumType,
    isStructType
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
            node.valueType = "double";
        } else if (typeof node.value === "string") {
            node.valueType = "string";
        } else if (node.value === "null") {
            node.valueType = "null";
        } else {
            node.valueType = "undefined";
        }
    } else if (node.type == "Identifier") {
        if (assignable) {
            const output = component?.outputs.find(
                output => output.name === node.name
            );
            if (output) {
                node.valueType = output.type;
                return;
            }
        }

        const input = component?.inputs.find(input => input.name == node.name);
        if (input) {
            node.valueType = input.type;
            return;
        }

        if (component) {
            const flow = ProjectEditor.getFlow(component);
            let localVariable = flow.localVariables.find(
                localVariable => localVariable.name == node.name
            );
            if (localVariable) {
                node.valueType = localVariable.type as ValueType;
                return;
            }
        }

        let globalVariable = project.allGlobalVariables.find(
            globalVariable => globalVariable.name == node.name
        );
        if (globalVariable) {
            node.valueType = globalVariable.type as ValueType;
            return;
        }

        let enumDef = project.variables.enumsMap.get(node.name);
        if (enumDef) {
            node.valueType = `enum:${node.name}` as ValueType;
            return;
        }

        if (node.name == FLOW_ITERATOR_INDEX_VARIABLE) {
            node.valueType = `integer`;
            return;
        }

        if (node.name == FLOW_ITERATOR_INDEXES_VARIABLE) {
            node.valueType = `array:integer`;
            return;
        }

        // TODO test inputs and outputs (assignable expression)
        // throw `identifier '${node.name}' is neither input or local or global variable or enum`;

        node.valueType = "any";
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
        if (isEnumType(node.object.valueType)) {
            const enumName = getEnumTypeNameFromType(node.object.valueType)!;
            const enumDef = project.variables.enumsMap.get(enumName)!;
            if (node.property.type != "Identifier") {
                throw `Invalid enum field type: '${node.property.type}'`;
            }
            const enumMember = enumDef.membersMap.get(node.property.name);
            if (!enumMember) {
                throw `Enum member '${node.property.name}' not found in enum '${enumName}'`;
            }
            node.valueType = "integer";
        } else {
            if (node.computed) {
                if (node.object.valueType == "any") {
                    node.valueType = "any";
                } else {
                    const valueType = getArrayElementTypeFromType(
                        node.object.valueType
                    );
                    if (!valueType) {
                        throw `Array type expected but found '${node.object.valueType}'`;
                    }
                    node.valueType = valueType as ValueType;
                }
            } else {
                if (
                    node.object.type == "Identifier" &&
                    node.property.type == "Identifier"
                ) {
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
                            // TODO
                            node.valueType = "any";
                            return;
                        }
                    } else {
                        const builtInConstantName = `${node.object.name}.${node.property.name}`;
                        const buildInConstantValue =
                            builtInConstants[builtInConstantName];
                        if (buildInConstantValue != undefined) {
                            // TODO
                            node.valueType = "any";
                            return;
                        }
                    }

                    if (
                        !isStructType(node.object.valueType) &&
                        !isObjectType(node.object.valueType)
                    ) {
                        throw `Unknown "${node.object.name}.${node.property.name}"`;
                    }
                }

                let structTypeName = getStructTypeNameFromType(
                    node.object.valueType
                );
                if (!structTypeName) {
                    structTypeName = node.object.valueType;
                }

                const structure =
                    project.variables.structsMap.get(structTypeName);
                if (structure) {
                    if (node.property.type != "Identifier") {
                        throw `Invalid struct field type: '${node.property.type}'`;
                    }

                    const fieldName = node.property.name;

                    const field = structure.fieldsMap.get(fieldName);

                    if (!field) {
                        throw `Struct field not found: '${fieldName}'`;
                    }

                    node.valueType = field.type as ValueType;
                } else if (isObjectType(node.object.valueType)) {
                    node.valueType = "any";
                } else if (node.object.valueType == "any") {
                    node.valueType = "any";
                } else {
                    throw `Struct or object type expected but found '${node.object.valueType}'`;
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
        node.valueType = `struct:any`;
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
        if (
            node.arguments.length < arity.min ||
            node.arguments.length > arity.max
        ) {
            throw `In function '${functionName}' call expected ${arity.min} to ${arity.max} arguments, but got ${node.arguments.length}`;
        }
    } else {
        if (node.arguments.length != arity) {
            throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
        }
    }
}

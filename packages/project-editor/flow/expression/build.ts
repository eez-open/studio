import type { Component } from "project-editor/flow/component";
import type { Assets, DataBuffer } from "project-editor/build/assets";
import type {
    ExpressionNode,
    IdentifierExpressionNode
} from "project-editor/flow/expression/node";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    CONDITIONAL_OPERATOR,
    logicalOperators,
    operationIndexes,
    unaryOperators
} from "./operations";
import { expressionParser } from "./grammar";
import {
    makePushConstantInstruction,
    makePushInputInstruction,
    makePushLocalVariableInstruction,
    makePushGlobalVariableInstruction,
    makePushOutputInstruction,
    makeArrayElementInstruction,
    makeOperationInstruction,
    makeEndInstruction
} from "./instructions";
import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import {
    findValueTypeInExpressionNode,
    checkArity
} from "project-editor/flow/expression/type";
import { ProjectEditor } from "project-editor/project-editor-interface";

export function buildExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    let instructions;
    if (
        expression == undefined ||
        (typeof expression == "string" && expression.length == 0)
    ) {
        instructions = [
            makePushConstantInstruction(assets, undefined, "undefined")
        ];
    } else if (typeof expression == "number") {
        instructions = [
            makePushConstantInstruction(
                assets,
                expression,
                Number.isInteger(expression) &&
                    expression > -2147483648 &&
                    expression < 2147483647
                    ? "integer"
                    : "double"
            )
        ];
    } else {
        let rootNode;
        try {
            rootNode = expressionParser.parse(expression);
        } catch (err) {
            throw `Expression error: ${err}`;
        }
        findValueTypeInExpressionNode(
            ProjectEditor.getProject(component),
            component,
            rootNode,
            false
        );
        instructions = buildExpressionNode(assets, component, rootNode, false);
    }

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

export function buildAssignableExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    function isAssignableExpression(node: ExpressionNode): boolean {
        if (node.type === "Identifier") {
            return true;
        }
        if (node.type === "ConditionalExpression") {
            return (
                isAssignableExpression(node.consequent) &&
                isAssignableExpression(node.alternate)
            );
        }
        if (node.type === "MemberExpression") {
            return true;
        }
        return false;
    }

    let rootNode;
    try {
        rootNode = expressionParser.parse(expression);
    } catch (err) {
        throw `Expression error: ${err}`;
    }

    findValueTypeInExpressionNode(
        ProjectEditor.getProject(component),
        component,
        rootNode,
        true
    );

    if (!isAssignableExpression(rootNode)) {
        console.log("Expression is not assignable", rootNode);
        throw `Expression is not assignable`;
    }

    const instructions = buildExpressionNode(assets, component, rootNode, true);

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

function buildExpressionNode(
    assets: Assets,
    component: Component,
    node: ExpressionNode,
    assignable: boolean
): number[] {
    if (node.type == "Literal") {
        return [
            makePushConstantInstruction(assets, node.value, node.valueType)
        ];
    }

    if (node.type == "TextResource") {
        if (assets.DocumentStore.project.texts) {
            return [
                makePushConstantInstruction(
                    assets,
                    assets.DocumentStore.project.texts.resources.findIndex(
                        textResource => textResource.resourceID == node.value
                    ),
                    "integer"
                ),
                makeOperationInstruction(operationIndexes["Flow.translate"])
            ];
        }
        return [
            makePushConstantInstruction(assets, node.value, node.valueType)
        ];
    }

    if (node.type == "Identifier") {
        if (assignable) {
            const outputIndex = component.buildOutputs.findIndex(
                output => output.name === node.name
            );
            if (outputIndex != -1) {
                return [makePushOutputInstruction(outputIndex)];
            }
        }

        const componentInputIndex = component.buildInputs.findIndex(
            input => input.name == node.name
        );
        if (componentInputIndex != -1) {
            const inputIndex = assets.getComponentInputIndex(
                component,
                node.name
            );
            return [makePushInputInstruction(inputIndex)];
        }

        const flow = ProjectEditor.getFlow(component);
        let localVariableIndex = flow.localVariables.findIndex(
            localVariable => localVariable.name == node.name
        );
        if (localVariableIndex != -1) {
            return [makePushLocalVariableInstruction(localVariableIndex)];
        }

        let globalVariableIndex = assets.globalVariables.findIndex(
            globalVariable => globalVariable.name == node.name
        );
        if (globalVariableIndex != -1) {
            return [makePushGlobalVariableInstruction(globalVariableIndex)];
        }

        if (node.name == FLOW_ITERATOR_INDEX_VARIABLE) {
            return [
                makePushConstantInstruction(assets, 0, "integer"),
                makeOperationInstruction(operationIndexes["Flow.index"])
            ];
        }

        throw `identifier '${node.name}' is neither input or local or global variable`;
    }

    if (node.type == "BinaryExpression") {
        let operator = binaryOperators[node.operator];
        if (!operator) {
            operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }
        }

        return [
            ...buildExpressionNode(assets, component, node.left, assignable),
            ...buildExpressionNode(assets, component, node.right, assignable),
            makeOperationInstruction(operationIndexes[operator.name])
        ];
    }

    if (node.type == "LogicalExpression") {
        const operator = logicalOperators[node.operator];
        if (!operator) {
            throw `Unknown logical operator '${node.operator}'`;
        }

        return [
            ...buildExpressionNode(assets, component, node.left, assignable),
            ...buildExpressionNode(assets, component, node.right, assignable),
            makeOperationInstruction(operationIndexes[operator.name])
        ];
    }

    if (node.type == "UnaryExpression") {
        const operator = unaryOperators[node.operator];
        if (!operator) {
            throw `Unknown unary operator '${node.operator}'`;
        }

        return [
            ...buildExpressionNode(
                assets,
                component,
                node.argument,
                assignable
            ),
            makeOperationInstruction(operationIndexes[operator.name])
        ];
    }

    if (node.type == "ConditionalExpression") {
        return [
            ...buildExpressionNode(assets, component, node.test, assignable),
            ...buildExpressionNode(
                assets,
                component,
                node.consequent,
                assignable
            ),
            ...buildExpressionNode(
                assets,
                component,
                node.alternate,
                assignable
            ),
            makeOperationInstruction(operationIndexes[CONDITIONAL_OPERATOR])
        ];
    }

    if (node.type == "CallExpression") {
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

        if (functionName == "Flow.makeValue") {
            if (node.arguments[0].type == "Literal") {
                node.valueType = node.arguments[0].value;
            }

            node.arguments[0] = {
                type: "Literal",
                value: assets.getTypeIndex(node.valueType),
                valueType: "integer"
            };

            node.arguments[1].valueType = node.valueType;
        }

        return [
            ...node.arguments.reduce(
                (instructions, node) => [
                    ...buildExpressionNode(assets, component, node, assignable),
                    ...instructions
                ],
                []
            ),
            ...(typeof builtInFunction.arity == "object"
                ? [
                      makePushConstantInstruction(
                          assets,
                          node.arguments.length,
                          "integer"
                      )
                  ]
                : []),
            makeOperationInstruction(operationIndexes[functionName])
        ];
    }

    if (node.type == "MemberExpression") {
        if (
            node.object.type == "Identifier" &&
            node.property.type == "Identifier"
        ) {
            const enumDef = assets.rootProject.variables.enumsMap.get(
                node.object.name
            );
            if (enumDef) {
                const enumMember = enumDef.membersMap.get(node.property.name);
                if (!enumMember) {
                    throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                }
                return [
                    makePushConstantInstruction(
                        assets,
                        enumMember.value,
                        "integer"
                    )
                ];
            }

            const builtInConstantName = `${node.object.name}.${node.property.name}`;
            const buildInConstantValue = builtInConstants[builtInConstantName];
            if (buildInConstantValue != undefined) {
                return [
                    makePushConstantInstruction(
                        assets,
                        buildInConstantValue.value(assets.DocumentStore),
                        buildInConstantValue.valueType
                    )
                ];
            }
        }

        if (node.computed) {
            return [
                ...buildExpressionNode(
                    assets,
                    component,
                    node.object,
                    assignable
                ),
                ...buildExpressionNode(
                    assets,
                    component,
                    node.property,
                    assignable
                ),
                makeArrayElementInstruction()
            ];
        } else {
            const fieldName = (node.property as IdentifierExpressionNode).name;
            const fieldIndex = assets.DocumentStore.typesStore.getFieldIndex(
                node.object.valueType,
                fieldName
            );

            if (fieldIndex == undefined) {
                throw `field not found: "${node.object.valueType}"."${fieldName}"`;
            }

            return [
                ...buildExpressionNode(
                    assets,
                    component,
                    node.object,
                    assignable
                ),
                makePushConstantInstruction(assets, fieldIndex, "integer"),
                makeArrayElementInstruction()
            ];
        }
    }

    if (node.type == "ArrayExpression") {
        return [
            // elements
            ...node.elements.reduce(
                (instructions, node) => [
                    ...buildExpressionNode(assets, component, node, assignable),
                    ...instructions
                ],
                []
            ),
            // no. of elements
            makePushConstantInstruction(
                assets,
                node.elements.length,
                "integer"
            ),
            // array type
            makePushConstantInstruction(
                assets,
                assets.getTypeIndex(node.valueType),
                "integer"
            ),
            makeOperationInstruction(operationIndexes["Flow.makeArrayValue"])
        ];
    }

    if (node.type == "ObjectExpression") {
        const type = assets.DocumentStore.typesStore.getType(node.valueType);
        if (!type || type.kind != "object") {
            throw `Can't build ObjectExpression for type: ${node.valueType}`;
        }

        const fieldValues: ExpressionNode[] = [];

        node.properties.forEach(property => {
            console.log(property.key);
            const fieldIndex = type.fieldIndexes[property.key.value];
            if (fieldIndex == undefined) {
                throw `Field ${property.key.value} not in ${node.valueType}`;
            }
            fieldValues[fieldIndex] = property.value;
        });

        for (let i = 0; i < type.fields.length; i++) {
            if (fieldValues[i] == undefined) {
                fieldValues[i] = {
                    type: "Literal",
                    value: undefined,
                    valueType: "undefined"
                };
            }
        }

        return [
            // fields
            ...fieldValues.reduce(
                (instructions, node) => [
                    ...buildExpressionNode(assets, component, node, assignable),
                    ...instructions
                ],
                []
            ),
            // no. of fields
            makePushConstantInstruction(assets, type.fields.length, "integer")
        ];
    }

    throw `Unknown expression node "${node.type}"`;
}

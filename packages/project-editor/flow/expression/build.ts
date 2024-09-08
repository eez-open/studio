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
import { expressionParser } from "project-editor/flow/expression/parser";
import {
    makePushConstantInstruction,
    makePushInputInstruction,
    makePushLocalVariableInstruction,
    makePushGlobalVariableInstruction,
    makePushOutputInstruction,
    makeArrayElementInstruction,
    makeOperationInstruction,
    makeEndInstruction,
    makeEndInstructionWithType
} from "./instructions";
import { FLOW_ITERATOR_INDEX_VARIABLE } from "project-editor/features/variable/defs";
import {
    findValueTypeInExpressionNode,
    checkArity
} from "project-editor/flow/expression/type";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { IMPORT_AS_PREFIX, findVariable } from "project-editor/project/assets";

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

    instructions.push(
        ...makeEndInstructionWithType(assets, rootNode.valueType)
    );

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
        if (assets.projectStore.project.texts) {
            return [
                makePushConstantInstruction(
                    assets,
                    assets.projectStore.project.texts.resources.findIndex(
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

    if (node.type == "JSONLiteral") {
        return [
            makePushConstantInstruction(
                assets,
                assets.registerJSONValue(JSON.parse(node.value)),
                node.valueType
            ),
            makeOperationInstruction(operationIndexes["JSON.clone"])
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
        let localVariableIndex = flow.userPropertiesAndLocalVariables.findIndex(
            localVariable => localVariable.name == node.name
        );
        if (localVariableIndex != -1) {
            return [makePushLocalVariableInstruction(localVariableIndex)];
        }

        let globalVariableIndex = assets.getAssetIndexByAssetName(
            component,
            node.name,
            findVariable,
            assets.globalVariables
        );

        if (globalVariableIndex != undefined) {
            if (globalVariableIndex < 0) {
                globalVariableIndex = -globalVariableIndex;
            }

            return [makePushGlobalVariableInstruction(globalVariableIndex - 1)];
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

        if (
            builtInFunction.enabled &&
            !builtInFunction.enabled(assets.projectStore)
        ) {
            throw `Function '${functionName}' not supported`;
        }

        checkArity(functionName, node);

        if (functionName == "Flow.makeValue") {
            node.arguments[0] = {
                type: "Literal",
                value: assets.getTypeIndex(node.valueType),
                valueType: "integer"
            };

            node.arguments[1].valueType = node.valueType;
        } else if (functionName == "Flow.makeArrayValue") {
            if (node.arguments[0].type == "Literal") {
                node.valueType = node.arguments[0].value;
            }

            node.arguments[0] = {
                type: "Literal",
                value: assets.getTypeIndex(node.valueType),
                valueType: "integer"
            };

            // number of init elements is 0
            node.arguments.push({
                type: "Literal",
                value: 0,
                valueType: "integer"
            });
        } else if (functionName == "Flow.translate") {
            const nodeArgument = node.arguments[0];
            if (
                nodeArgument.type != "Literal" ||
                nodeArgument.valueType != "string"
            ) {
                makePushConstantInstruction(assets, "", "string");
            } else {
                if (assets.projectStore.project.texts) {
                    return [
                        makePushConstantInstruction(
                            assets,
                            assets.projectStore.project.texts.resources.findIndex(
                                textResource =>
                                    textResource.resourceID ==
                                    nodeArgument.value
                            ),
                            "integer"
                        ),
                        makeOperationInstruction(
                            operationIndexes["Flow.translate"]
                        )
                    ];
                }
                return [
                    makePushConstantInstruction(
                        assets,
                        nodeArgument.value,
                        "string"
                    )
                ];
            }
        }

        if (functionName == "Crypto.sha256") {
            assets.isUsingCrypyoSha256 = true;
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
            const buildInConstantValue = builtInConstants(assets.projectStore)[
                builtInConstantName
            ];
            if (buildInConstantValue != undefined) {
                return [
                    makePushConstantInstruction(
                        assets,
                        buildInConstantValue.value(assets.projectStore),
                        buildInConstantValue.valueType
                    )
                ];
            }

            if (node.object.valueType == "importedProject") {
                const importAs = node.object.name;
                const variableName = node.property.name;

                let globalVariableIndex = assets.getAssetIndexByAssetName(
                    component,
                    `${importAs}${IMPORT_AS_PREFIX}${variableName}`,
                    findVariable,
                    assets.globalVariables
                );

                if (globalVariableIndex != undefined) {
                    if (globalVariableIndex < 0) {
                        globalVariableIndex = -globalVariableIndex;
                    }
                    return [
                        makePushGlobalVariableInstruction(
                            globalVariableIndex - 1
                        )
                    ];
                }

                throw `Unknown variable '${variableName}' in import '${importAs}'`;
            }
        }

        if (node.computed) {
            if (node.object.valueType == "json") {
                return [
                    ...buildExpressionNode(
                        assets,
                        component,
                        node.property,
                        assignable
                    ),
                    ...buildExpressionNode(
                        assets,
                        component,
                        node.object,
                        assignable
                    ),
                    makeOperationInstruction(operationIndexes["JSON.get"])
                ];
            }

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

            if (node.object.valueType == "json") {
                return [
                    makePushConstantInstruction(assets, fieldName, "string"),
                    ...buildExpressionNode(
                        assets,
                        component,
                        node.object,
                        assignable
                    ),
                    makeOperationInstruction(operationIndexes["JSON.get"])
                ];
            }

            const fieldIndex = assets.projectStore.typesStore.getFieldIndex(
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
            // no. of init elements
            makePushConstantInstruction(
                assets,
                node.elements.length,
                "integer"
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
        const type = assets.projectStore.typesStore.getType(node.valueType);
        if (!type || type.kind != "object") {
            if (
                assets.projectStore.projectTypeTraits.isDashboard &&
                type?.valueType == "json"
            ) {
                return [
                    // elements
                    ...node.properties.reduce((instructions, property) => {
                        let propertyName;
                        if (property.key.type == "Identifier") {
                            propertyName = property.key.name;
                        } else if (property.key.type == "Literal") {
                            propertyName = property.key.value;
                        } else {
                            console.log(property);
                            throw `invalid field node "${property.key.type}"`;
                        }

                        return [
                            ...buildExpressionNode(
                                assets,
                                component,
                                property.value,
                                assignable
                            ),
                            makePushConstantInstruction(
                                assets,
                                propertyName,
                                "string"
                            ),
                            ...instructions
                        ];
                    }, []),
                    // no. of init elements
                    makePushConstantInstruction(
                        assets,
                        node.properties.length * 2,
                        "integer"
                    ),
                    // no. of elements
                    makePushConstantInstruction(
                        assets,
                        node.properties.length * 2,
                        "integer"
                    ),
                    // array type
                    makePushConstantInstruction(
                        assets,
                        assets.getTypeIndex(node.valueType),
                        "integer"
                    ),
                    makeOperationInstruction(
                        operationIndexes["Flow.makeArrayValue"]
                    )
                ];
            }

            throw `Can't build ObjectExpression for type: ${node.valueType}`;
        }

        const fieldValues: ExpressionNode[] = [];

        node.properties.forEach(property => {
            let propertyName;
            if (property.key.type == "Identifier") {
                propertyName = property.key.name;
            } else if (property.key.type == "Literal") {
                propertyName = property.key.value;
            } else {
                throw `invalid field node "${property.key.type}"`;
            }

            const fieldIndex = type.fieldIndexes[propertyName];
            if (fieldIndex == undefined) {
                throw `Field ${propertyName} not in ${node.valueType}`;
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
            // no. of init elements is same as no. of fields
            makePushConstantInstruction(assets, type.fields.length, "integer"),
            // no. of elements is same as no. of fields
            makePushConstantInstruction(assets, type.fields.length, "integer")
        ];
    }

    throw `Unknown expression node "${node.type}"`;
}

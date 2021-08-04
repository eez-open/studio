import { Component } from "project-editor/flow/component";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { getFlow, getProject, Project } from "project-editor/project/project";
import { IFlowContext } from "project-editor/flow/flow-interfaces";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    CONDITIONAL_OPERATOR,
    logicalOperators,
    operationIndexes,
    unaryOperators
} from "./operations";
import { expressionParser, identifierParser } from "./grammar";
import {
    makeEndInstruction,
    makeOperationInstruction,
    makePushConstantInstruction,
    makePushGlobalVariableInstruction,
    makePushInputInstruction,
    makePushLocalVariableInstruction,
    makePushOutputInstruction
} from "./instructions";

////////////////////////////////////////////////////////////////////////////////

export { operationIndexes } from "./operations";

////////////////////////////////////////////////////////////////////////////////

export function parseIdentifier(identifier: string) {
    try {
        const rootNode: ExpressionNode = identifierParser.parse(identifier);
        return rootNode && rootNode.type === "Identifier";
    } catch (err) {
        return false;
    }
}

export function checkExpression(component: Component, expression: string) {
    if (expression == undefined) {
    } else if (typeof expression == "number") {
    } else {
        checkExpressionNode(component, expressionParser.parse(expression));
    }
}

export function buildExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    let instructions;
    if (expression == undefined) {
        instructions = [makePushConstantInstruction(assets, undefined)];
    } else if (typeof expression == "number") {
        instructions = [makePushConstantInstruction(assets, expression)];
    } else {
        instructions = buildExpressionNode(
            assets,
            component,
            expressionParser.parse(expression),
            false
        );
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
        return false;
    }

    const rootNode: ExpressionNode = expressionParser.parse(expression);

    if (!isAssignableExpression(rootNode)) {
        throw `Expression is not assignable`;
    }

    const instructions = buildExpressionNode(assets, component, rootNode, true);

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

export function evalConstantExpression(project: Project, expression: string) {
    let value;
    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        try {
            value = evalConstantExpressionNode(
                project,
                expressionParser.parse(expression)
            );
        } catch (err) {
            console.error(err);
            value = null;
        }
    }

    return value;
}

export function evalExpression(flowContext: IFlowContext, expression: string) {
    let value;

    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        try {
            value = evalExpressionInFlowContext(
                flowContext,
                expressionParser.parse(expression)
            );
        } catch (err) {
            console.error(err);
            value = null;
        }
    }

    return value;
}

////////////////////////////////////////////////////////////////////////////////

type ExpressionNode =
    | {
          type: "Literal";
          value: any;
      }
    | {
          type: "Identifier";
          name: string;
      }
    | {
          type: "BinaryExpression";
          operator: string;
          left: ExpressionNode;
          right: ExpressionNode;
      }
    | {
          type: "LogicalExpression";
          operator: string;
          left: ExpressionNode;
          right: ExpressionNode;
      }
    | {
          type: "ArrayExpression";
          elements: ExpressionNode[];
      }
    | {
          type: "ObjectExpression";
          properties: {
              key: {
                  type: "Identifier";
                  name: string;
              };
              value: ExpressionNode;
              kind: "init";
          }[];
      }
    | {
          type: "MemberExpression";
          object: ExpressionNode;
          property: ExpressionNode;
          computed: boolean;
      }
    | {
          type: "CallExpression";
          callee: ExpressionNode;
          arguments: ExpressionNode[];
      }
    | {
          type: "ConditionalExpression";
          test: ExpressionNode;
          consequent: ExpressionNode;
          alternate: ExpressionNode;
      }
    | {
          type: "UnaryExpression";
          operator: string;
          argument: ExpressionNode;
      }
    | {
          type: "__Unknown";
      };

function checkExpressionNode(component: Component, rootNode: ExpressionNode) {
    function checkNode(node: ExpressionNode) {
        if (node.type == "Literal") {
            return;
        }

        if (node.type == "Identifier") {
            const input = component.inputs.find(
                input => input.name == node.name
            );
            if (input != undefined) {
                return;
            }

            const flow = getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return;
            }

            let globalVariableIndex =
                project.variables.globalVariables.findIndex(
                    globalVariable => globalVariable.name == node.name
                );
            if (globalVariableIndex != -1) {
                return;
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

            checkNode(node.left);
            checkNode(node.right);
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator '${node.operator}'`;
            }

            checkNode(node.left);
            checkNode(node.right);
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator '${node.operator}'`;
            }

            checkNode(node.argument);
        }

        if (node.type == "ConditionalExpression") {
            checkNode(node.test);
            checkNode(node.consequent);
            checkNode(node.alternate);
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

            const arity = builtInFunctions[functionName].arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            node.arguments.forEach(checkNode);
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = project.variables.enumMap.get(node.object.name);
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return;
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            console.log("TODO check MemberExpression", node);
            return;
        }

        if (node.type == "ArrayExpression") {
            console.log("TODO check ArrayExpression", node);
            return;
        }

        if (node.type == "ObjectExpression") {
            console.log("TODO check ObjectExpression", node);
            return;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    const project = getProject(component);

    checkNode(rootNode);
}

function buildExpressionNode(
    assets: Assets,
    component: Component,
    node: ExpressionNode,
    assignable: boolean
): number[] {
    if (node.type == "Literal") {
        return [makePushConstantInstruction(assets, node.value)];
    }

    if (node.type == "Identifier") {
        if (assignable) {
            const outputIndex = component.buildOutputs.findIndex(
                output => output.name === node.name
            );
            if (outputIndex != -1) {
                return [makePushOutputInstruction(outputIndex)];
            }
        } else {
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
        }

        const flow = getFlow(component);
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

        const arity = builtInFunctions[functionName].arity;

        if (node.arguments.length != arity) {
            throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
        }

        return [
            ...node.arguments.reduce(
                (instructions, node) => [
                    ...instructions,
                    ...buildExpressionNode(assets, component, node, assignable)
                ],
                []
            ),
            makeOperationInstruction(operationIndexes[functionName])
        ];
    }

    if (node.type == "MemberExpression") {
        if (
            node.object.type == "Identifier" &&
            node.property.type == "Identifier"
        ) {
            const enumDef = assets.rootProject.variables.enumMap.get(
                node.object.name
            );
            if (enumDef) {
                const enumMember = enumDef.membersMap.get(node.property.name);
                if (!enumMember) {
                    throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                }
                return [makePushConstantInstruction(assets, enumMember.value)];
            }

            const builtInConstantName = `${node.object.name}.${node.property.name}`;
            const buildInConstantValue = builtInConstants[builtInConstantName];
            if (buildInConstantValue != undefined) {
                return [
                    makePushConstantInstruction(assets, buildInConstantValue)
                ];
            }

            throw `Unknown constant '${builtInConstantName}'`;
        }

        console.log("TODO build MemberExpression", node);
        return [];
    }

    if (node.type == "ArrayExpression") {
        console.log("TODO build ArrayExpression", node);
        return [];
    }

    if (node.type == "ObjectExpression") {
        console.log("TODO build ObjectExpression", node);
        return [];
    }

    throw `Unknown expression node "${node.type}"`;
}

function evalConstantExpressionNode(
    project: Project,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            throw `Can not evaulate during build`;
        }

        if (node.type == "BinaryExpression") {
            const operator = binaryOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.left), evalNode(node.right));
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.left), evalNode(node.right));
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
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

            const arity = builtInFunction.arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return builtInFunction.eval(...node.arguments.map(evalNode));
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = project.variables.enumMap.get(node.object.name);
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue;
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            console.log("TODO eval_constant MemberExpression", node);
            return [];
        }

        if (node.type == "ArrayExpression") {
            return node.elements.map(element => evalNode(element));
        }

        if (node.type == "ObjectExpression") {
            const object: any = {};

            for (const property of node.properties) {
                object[property.key.name] = evalNode(property.value);
            }

            return object;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

function evalExpressionInFlowContext(
    flowContext: IFlowContext,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            return flowContext.dataContext.get(node.name);
        }

        if (node.type == "BinaryExpression") {
            const operator = binaryOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.left), evalNode(node.right));
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.left), evalNode(node.right));
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
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

            const arity = builtInFunction.arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return builtInFunction.eval(...node.arguments.map(evalNode));
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef =
                    flowContext.document.DocumentStore.project.variables.enumMap.get(
                        node.object.name
                    );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue;
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            console.log("TODO eval_in_flow MemberExpression", node);
            return undefined;
        }

        if (node.type == "ArrayExpression") {
            console.log("TODO eval_in_flow ArrayExpression", node);
            return undefined;
        }

        if (node.type == "ObjectExpression") {
            console.log("TODO eval_in_flow ObjectExpression", node);
            return undefined;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

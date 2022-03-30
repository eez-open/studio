import type { Component } from "project-editor/flow/component";
import type { ExpressionNode } from "project-editor/flow/expression/node";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    logicalOperators,
    unaryOperators
} from "./operations";
import { expressionParser } from "./grammar";
import {
    FLOW_ITERATOR_INDEXES_VARIABLE,
    FLOW_ITERATOR_INDEX_VARIABLE
} from "project-editor/features/variable/defs";
import { isEnumType } from "project-editor/features/variable/value-type";
import {
    findValueTypeInExpressionNode,
    checkArity
} from "project-editor/flow/expression/type";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { templateLiteralToExpression } from "project-editor/flow/expression/helper";

export function checkExpression(component: Component, expression: string) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    if (expression == undefined) {
    } else if (typeof expression == "number") {
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
        checkExpressionNode(component, rootNode);
    }
}

export function checkTemplateLiteralExpression(
    component: Component,
    templateLiteral: string
) {
    if (templateLiteral != undefined) {
        const expression = templateLiteralToExpression(templateLiteral.trim());

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
        checkExpressionNode(component, rootNode);
    }
}

export function checkAssignableExpression(
    component: Component,
    expression: string
) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    if (expression == undefined) {
    } else if (typeof expression == "number") {
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
            true
        );
        checkAssignableExpressionNode(component, rootNode);
    }
}

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

            const flow = ProjectEditor.getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return;
            }

            let globalVariableIndex = project.allGlobalVariables.findIndex(
                globalVariable => globalVariable.name == node.name
            );
            if (globalVariableIndex != -1) {
                return;
            }

            if (
                node.name == FLOW_ITERATOR_INDEX_VARIABLE ||
                node.name == FLOW_ITERATOR_INDEXES_VARIABLE
            ) {
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
            return;
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator '${node.operator}'`;
            }

            checkNode(node.left);
            checkNode(node.right);
            return;
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator '${node.operator}'`;
            }

            checkNode(node.argument);
            return;
        }

        if (node.type == "ConditionalExpression") {
            checkNode(node.test);
            checkNode(node.consequent);
            checkNode(node.alternate);
            return;
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

            node.arguments.forEach(checkNode);
            return;
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                if (isEnumType(node.object.valueType)) {
                    const enumDef = project.variables.enumsMap.get(
                        node.object.name
                    );
                    if (enumDef) {
                        const enumMember = enumDef.membersMap.get(
                            node.property.name
                        );
                        if (!enumMember) {
                            throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                        }
                        return;
                    } else {
                        throw `Unknown enumeration type ${node.object.valueType}`;
                    }
                } else {
                    const builtInConstantName = `${node.object.name}.${node.property.name}`;
                    const buildInConstantValue =
                        builtInConstants[builtInConstantName];
                    if (buildInConstantValue != undefined) {
                        return;
                    }
                }
            }

            checkNode(node.object);
            if (node.computed) {
                checkNode(node.property);
            }
            return;
        }

        if (node.type == "ArrayExpression") {
            node.elements.forEach(element => checkNode(element));
            return;
        }

        if (node.type == "ObjectExpression") {
            node.properties.forEach(property => checkNode(property.value));
            return;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    const project = ProjectEditor.getProject(component);

    checkNode(rootNode);
}

function checkAssignableExpressionNode(
    component: Component,
    rootNode: ExpressionNode
) {
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

            const output = component.outputs.find(
                output => output.name == node.name
            );
            if (output != undefined) {
                return;
            }

            const flow = ProjectEditor.getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return;
            }

            let globalVariableIndex = project.allGlobalVariables.findIndex(
                globalVariable => globalVariable.name == node.name
            );
            if (globalVariableIndex != -1) {
                return;
            }

            throw `identifier '${node.name}' is neither output or local or global variable`;
        }

        if (node.type == "ConditionalExpression") {
            checkExpressionNode(component, node.test);
            checkNode(node.consequent);
            checkNode(node.alternate);
            return;
        }

        if (node.type == "MemberExpression") {
            checkNode(node.object);

            if (node.computed) {
                checkExpressionNode(component, node.property);
            }

            return;
        }

        if (node.type == "ArrayExpression") {
            console.log("TODO check ArrayExpression", node);
        }

        if (node.type == "ObjectExpression") {
            console.log("TODO check ObjectExpression", node);
        }

        throw `Unknown expression node "${node.type}"`;
    }

    const project = ProjectEditor.getProject(component);

    checkNode(rootNode);
}

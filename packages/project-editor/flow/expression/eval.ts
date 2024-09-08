import type { Component } from "project-editor/flow/component";
import type { Project } from "project-editor/project/project";
import type {
    ExpressionNode,
    NonComputedPropertyExpressionNode
} from "project-editor/flow/expression/node";
import {
    binaryOperators,
    builtInConstants,
    builtInFunctions,
    logicalOperators,
    unaryOperators
} from "./operations";
import { expressionParser } from "project-editor/flow/expression/parser";
import { ValueType } from "project-editor/features/variable/value-type";
import type { IDataContext, IFlowState } from "../flow-interfaces";
import type { ProjectStore } from "project-editor/store";
import {
    findValueTypeInExpressionNode,
    checkArity
} from "project-editor/flow/expression/type";
import { ProjectEditor } from "project-editor/project-editor-interface";

export function evalConstantExpression(project: Project, expression: string) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    let value;
    let valueType: ValueType;
    if (expression == undefined) {
        value = undefined;
        valueType = "undefined";
    } else if (typeof expression == "number") {
        value = expression;
        valueType = "double";
    } else {
        let rootNode = expressionParser.parse(expression);
        findValueTypeInExpressionNode(project, undefined, rootNode, false);
        value = evalConstantExpressionNode(project, rootNode);
        valueType = rootNode.valueType;
    }

    return { value, valueType };
}

export interface IExpressionContext {
    dataContext: IDataContext;
    flowState?: IFlowState;
    projectStore: ProjectStore;
}

export function evalExpression(
    expressionContext: IExpressionContext,
    component: Component,
    expression: string
) {
    if (typeof expression == "string") {
        expression = expression.trim();
    }

    let value;

    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
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

        value = evalExpressionWithContext(
            expressionContext,
            component,
            rootNode
        );
    }

    return value;
}

export function evalExpressionGetValueType(
    expressionContext: IExpressionContext,
    component: Component,
    expression: string
) {
    let value;
    let valueType;

    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        expression = expression.trim();

        let rootNode: ExpressionNode;
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

        value = evalExpressionWithContext(
            expressionContext,
            component,
            rootNode
        );
        valueType = rootNode.valueType;
    }

    return { value, valueType };
}

export function evalAssignableExpression(
    expressionContext: IExpressionContext,
    component: Component,
    expression: string
): AssignableValue {
    let assignableValue: AssignableValue | undefined;

    if (typeof expression == "string") {
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

        assignableValue = evalAssignableExpressionWithContext(
            expressionContext,
            component,
            rootNode
        );
    }

    if (!assignableValue) {
        return new AssignableValue("null", "null");
    }

    return assignableValue;
}

////////////////////////////////////////////////////////////////////////////////

function evalConstantExpressionNode(
    project: Project,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            throw `Not a constant`;
        }

        if (node.type == "TextResource") {
            const textResource = project.texts.resources.find(
                textResource => textResource.resourceID == node.value
            );
            if (!textResource) {
                throw `Text resource "${node.value}" not found`;
            }

            const languageID =
                project._store.uiStateStore.selectedLanguage.languageID;

            const translation = textResource.translations.find(
                translation => translation.languageID == languageID
            );
            if (!translation) {
                throw `Translation for text resource "${node.value}" and language "${languageID}" not found`;
            }

            if (!translation.text || translation.text.trim().length == 0) {
                throw `Translation for text resource "${node.value}" and language "${languageID}" not defined`;
            }

            return translation.text;
        }

        if (node.type == "JSONLiteral") {
            return JSON.parse(node.value);
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            return operator.eval(
                undefined,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(
                undefined,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(undefined, evalNode(node.argument));
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

            if (
                builtInFunction.enabled &&
                !builtInFunction.enabled(project._store)
            ) {
                throw `Function '${functionName}' not supported`;
            }

            checkArity(functionName, node);

            return builtInFunction.eval(
                undefined,
                ...node.arguments.map(evalNode)
            );
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
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
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue = builtInConstants(project._store)[
                    builtInConstantName
                ];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue.value(project._store);
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            throw "constant MemberExpression currently not supported";
        }

        if (node.type == "ArrayExpression") {
            return node.elements.map(element => evalNode(element));
        }

        if (node.type == "ObjectExpression") {
            const object: any = {};

            for (const property of node.properties) {
                if (property.key.type == "Identifier") {
                    object[property.key.name] = evalNode(property.value);
                } else {
                    throw `invalid field node "${property.key.type}"`;
                }
            }

            return object;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

////////////////////////////////////////////////////////////////////////////////

function getNodeDescription(node: ExpressionNode) {
    if (node.type == "Identifier") {
        return node.name;
    }
    return node.type;
}

function evalExpressionWithContext(
    expressionContext: IExpressionContext,
    component: Component,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            const input = component.inputs.find(
                input => input.name == node.name
            );
            if (input != undefined) {
                const flowState = expressionContext.flowState;
                if (!flowState) {
                    throw `cannot get input "${input.name}" value without flow state`;
                }

                return flowState.getInputValue(component, input.name);
            }

            if (expressionContext.dataContext.has(node.name)) {
                return expressionContext.dataContext.get(node.name);
            }

            throw `Unknown identifier "${node.name}"`;
        }

        if (node.type == "BinaryExpression") {
            let operator = binaryOperators[node.operator];
            if (!operator) {
                operator = logicalOperators[node.operator];
                if (!operator) {
                    throw `Unknown binary operator '${node.operator}'`;
                }
            }

            return operator.eval(
                expressionContext,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(
                expressionContext,
                evalNode(node.left),
                evalNode(node.right)
            );
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(expressionContext, evalNode(node.argument));
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

            if (
                builtInFunction.enabled &&
                !builtInFunction.enabled(expressionContext.projectStore)
            ) {
                throw `Function '${functionName}' not supported`;
            }

            checkArity(functionName, node);

            return builtInFunction.eval(
                expressionContext,
                ...node.arguments.map(evalNode)
            );
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef =
                    expressionContext.projectStore.project.variables.enumsMap.get(
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
                const buildInConstantValue = builtInConstants(
                    expressionContext.projectStore
                )[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue.value(
                        expressionContext.projectStore
                    );
                }
            }

            const object = evalNode(node.object);

            if (object == undefined) {
                return undefined;
            }

            const property = node.computed
                ? evalNode(node.property)
                : (node.property as NonComputedPropertyExpressionNode).name;

            if (property == undefined) {
                throw new ExpressionEvalError(
                    `${getNodeDescription(node.property)} is undefined`
                );
            }

            return object[property];
        }

        if (node.type == "ArrayExpression") {
            return node.elements.map(element => evalNode(element));
        }

        if (node.type == "ObjectExpression") {
            const object: any = {};

            for (const property of node.properties) {
                if (property.key.type == "Identifier") {
                    object[property.key.name] = evalNode(property.value);
                } else {
                    throw `invalid field node "${property.key.type}"`;
                }
            }

            return object;
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

////////////////////////////////////////////////////////////////////////////////

type AssignableValueType =
    | "null"
    | "input"
    | "output"
    | "local-variable"
    | "global-variable"
    | "flow-value";

class AssignableValue {
    constructor(
        private type: AssignableValueType,
        public valueType: ValueType,
        public name?: any,
        public object?: any
    ) {}

    isInput() {
        return this.type == "input";
    }

    isOutput() {
        return this.type == "output";
    }

    isLocalVariable() {
        return this.type == "local-variable";
    }

    isGlobalVariable() {
        return this.type == "global-variable";
    }

    isFlowValue() {
        return this.type == "flow-value";
    }

    getValue(expressionContext: IExpressionContext) {
        if (this.isLocalVariable() || this.isGlobalVariable()) {
            return expressionContext.dataContext.get(this.name);
        } else if (this.isInput()) {
            return this.object;
        } else if (this.isFlowValue()) {
            return this.object[this.name];
        } else {
            return null;
        }
    }
}

function evalAssignableExpressionWithContext(
    expressionContext: IExpressionContext,
    component: Component,
    rootNode: ExpressionNode
) {
    function evalNode(node: ExpressionNode): AssignableValue {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            const input = component.inputs.find(
                input => input.name == node.name
            );
            if (input != undefined) {
                return new AssignableValue(
                    "input",
                    input.type,
                    undefined,
                    expressionContext.flowState?.getInputValue(
                        component,
                        input.name
                    )
                );
            }

            const output = component.outputs.find(
                output => output.name == node.name
            );
            if (output != undefined) {
                return new AssignableValue("output", output.type, output.name);
            }

            const flow = ProjectEditor.getFlow(component);
            let localVariable = flow.userPropertiesAndLocalVariables.find(
                localVariable => localVariable.name == node.name
            );
            if (localVariable) {
                return new AssignableValue(
                    "local-variable",
                    localVariable.type,
                    localVariable.name
                );
            }

            let globalVariable =
                expressionContext.projectStore.project.allGlobalVariables.find(
                    globalVariable => globalVariable.fullName == node.name
                );
            if (globalVariable) {
                node.valueType = globalVariable.type as ValueType;
                return new AssignableValue(
                    "global-variable",
                    globalVariable.type,
                    globalVariable.fullName
                );
            }

            return new AssignableValue("null", "null");
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "MemberExpression") {
            const object = evalNode(node.object);
            if (object != undefined) {
                let property;

                if (node.computed) {
                    property = evalExpressionWithContext(
                        expressionContext,
                        component,
                        node.property
                    );
                } else {
                    property = (
                        node.property as NonComputedPropertyExpressionNode
                    ).name;
                }
                if (property != undefined) {
                    return new AssignableValue(
                        "flow-value",
                        node.valueType,
                        property,
                        object.getValue(expressionContext)
                    );
                }
            }

            return new AssignableValue("null", "null");
        }

        if (node.type == "ArrayExpression") {
            console.log("TODO eval_in_flow ArrayExpression", node);
            return new AssignableValue("null", "null");
        }

        if (node.type == "ObjectExpression") {
            console.log("TODO eval_in_flow ObjectExpression", node);
            return new AssignableValue("null", "null");
        }

        throw `Unknown expression node "${node.type}"`;
    }

    return evalNode(rootNode);
}

////////////////////////////////////////////////////////////////////////////////

export class ExpressionEvalError extends Error {
    constructor(message: string) {
        super(message);
    }
}

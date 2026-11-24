// Named expressions (Variables / Named Expressions in the project) are
// expanded in the expression AST, before the type inference, during the check,
// build and evaluation in the editor. The runtime doesn't know about them.
//
//   IMPORTANT_NUMBER: 42
//   half(a): a / 2
//   add(a, b): a + b
//
// The AST nodes are substituted, not the text, so half(x + 1) is (x + 1) / 2.
// The identifiers in the definition, except the parameters, are resolved in
// the context of the expression which uses the named expression, and an input,
// an output (assignable expression), a local variable or a user property with
// the same name shadows the named expression.

import type { Project } from "project-editor/project/project";
import type { Component } from "project-editor/flow/component";
import type { ExpressionNode } from "project-editor/flow/expression/node";
import { expressionParser } from "project-editor/flow/expression/parser";
import { ProjectEditor } from "project-editor/project-editor-interface";

export interface INamedExpression {
    name: string;
    parameterNames: string[];
    expression: string;
}

// thrown when the error happens inside the expanded subtree, the message
// already tells where the node came from
export class NamedExpressionError extends Error {
    constructor(message: string) {
        super(message);
    }

    override toString() {
        return this.message;
    }
}

export function namedExpressionSignature(namedExpression: INamedExpression) {
    return namedExpression.parameterNames.length > 0
        ? `${namedExpression.name}(${namedExpression.parameterNames.join(
              ", "
          )})`
        : namedExpression.name;
}

export function parseNamedExpressionParameters(parameters: string | undefined) {
    if (!parameters) {
        return [];
    }
    return parameters
        .split(",")
        .map(parameter => parameter.trim())
        .filter(parameter => parameter.length > 0);
}

////////////////////////////////////////////////////////////////////////////////

interface ExpandContext {
    namedExpressions: Map<string, INamedExpression>;
    component: Component | undefined;
    assignable: boolean;
    // the expression which is checked, for the error messages
    expression: string;
    // the named expressions being expanded, outermost first
    stack: string[];
}

interface Argument {
    node: ExpressionNode;
    // the expansion path where the argument comes from
    path: string[];
}

function getNamedExpressions(project: Project | undefined) {
    return project?.variables?.namedExpressionsMap;
}

function isShadowed(context: ExpandContext, name: string) {
    const component = context.component;
    if (!component) {
        return false;
    }

    if (
        context.assignable &&
        component.outputs?.find(output => output.name == name)
    ) {
        return true;
    }

    if (component.inputs?.find(input => input.name == name)) {
        return true;
    }

    const flow = ProjectEditor.getFlow(component);
    if (
        flow &&
        flow.userPropertiesAndLocalVariables.find(
            localVariable => localVariable.name == name
        )
    ) {
        return true;
    }

    return false;
}

function cloneNode(node: ExpressionNode): ExpressionNode {
    return JSON.parse(JSON.stringify(node));
}

function tag(node: ExpressionNode, context: ExpandContext, path: string[]) {
    // the innermost expansion wins
    if (!node.namedExpression) {
        node.namedExpression = { path, expression: context.expression };
    }
    return node;
}

function expandDefinition(
    context: ExpandContext,
    namedExpression: INamedExpression,
    args: Argument[]
): ExpressionNode {
    const cycleStart = context.stack.indexOf(namedExpression.name);
    if (cycleStart != -1) {
        throw `circular definition: ${[
            ...context.stack.slice(cycleStart),
            namedExpression.name
        ].join(" → ")}`;
    }

    if (!namedExpression.expression?.trim()) {
        throw `named expression '${namedExpression.name}' is empty`;
    }

    let body: ExpressionNode;
    try {
        // expression parser caches parse result and returns a fresh copy
        body = expressionParser.parse(namedExpression.expression.trim());
    } catch (err) {
        throw `syntax error in named expression '${namedExpression.name}': ${err}`;
    }

    const parameters = new Map<string, Argument>();
    namedExpression.parameterNames.forEach((parameterName, i) =>
        parameters.set(parameterName, args[i])
    );

    context.stack.push(namedExpression.name);
    const path = [...context.stack];
    try {
        body = expandNode(context, body, parameters);
    } finally {
        context.stack.pop();
    }

    return tag(body, context, path);
}

function checkNamedExpressionArity(
    namedExpression: INamedExpression,
    numArgs: number | undefined
) {
    const numParameters = namedExpression.parameterNames.length;

    if (numArgs == undefined) {
        // used as identifier
        if (numParameters > 0) {
            throw `named expression '${
                namedExpression.name
            }' expects ${numParameters} argument${
                numParameters > 1 ? "s" : ""
            }, use it as ${namedExpressionSignature(namedExpression)}`;
        }
    } else {
        // used as function call
        if (numParameters == 0) {
            throw `named expression '${namedExpression.name}' has no parameters, use it without parentheses`;
        }

        if (numArgs != numParameters) {
            throw `named expression '${namedExpressionSignature(
                namedExpression
            )}' expects ${numParameters} argument${
                numParameters > 1 ? "s" : ""
            }, but got ${numArgs}`;
        }
    }
}

function expandNode(
    context: ExpandContext,
    node: ExpressionNode,
    parameters: Map<string, Argument> | undefined
): ExpressionNode {
    const expand = (node: ExpressionNode) =>
        expandNode(context, node, parameters);

    if (node.type == "Identifier") {
        const argument = parameters?.get(node.name);
        if (argument) {
            return tag(cloneNode(argument.node), context, argument.path);
        }

        const namedExpression = context.namedExpressions.get(node.name);
        if (!namedExpression || isShadowed(context, node.name)) {
            return node;
        }

        checkNamedExpressionArity(namedExpression, undefined);

        return expandDefinition(context, namedExpression, []);
    }

    if (node.type == "CallExpression") {
        if (node.callee.type == "Identifier") {
            const name = node.callee.name;

            const namedExpression = context.namedExpressions.get(name);
            if (
                namedExpression &&
                !parameters?.has(name) &&
                !isShadowed(context, name)
            ) {
                checkNamedExpressionArity(
                    namedExpression,
                    node.arguments.length
                );

                // arguments are expanded in the context of the caller
                const path = [...context.stack];
                const args = node.arguments.map(argument => ({
                    node: expand(argument),
                    path
                }));

                return expandDefinition(context, namedExpression, args);
            }
        }

        // the callee is the name of the built-in function (e.g. Math.sin),
        // it is not expanded
        node.arguments = node.arguments.map(expand);
        return node;
    }

    if (node.type == "MemberExpression") {
        node.object = expand(node.object);
        if (node.computed) {
            node.property = expand(node.property);
        }
        return node;
    }

    if (
        node.type == "BinaryExpression" ||
        node.type == "LogicalExpression"
    ) {
        node.left = expand(node.left);
        node.right = expand(node.right);
        return node;
    }

    if (node.type == "UnaryExpression") {
        node.argument = expand(node.argument);
        return node;
    }

    if (node.type == "ConditionalExpression") {
        node.test = expand(node.test);
        node.consequent = expand(node.consequent);
        node.alternate = expand(node.alternate);
        return node;
    }

    if (node.type == "ArrayExpression") {
        node.elements = node.elements.map(expand);
        return node;
    }

    if (node.type == "ObjectExpression") {
        for (const property of node.properties) {
            property.value = expand(property.value);
        }
        return node;
    }

    return node;
}

////////////////////////////////////////////////////////////////////////////////

// Returns the root node of the expression with all the named expressions
// expanded. The nodes are modified in place, but the returned root node can be
// a different node.
export function expandNamedExpressions(
    project: Project | undefined,
    component: Component | undefined,
    rootNode: ExpressionNode,
    expression: string,
    assignable: boolean = false
): ExpressionNode {
    const namedExpressions = getNamedExpressions(project);
    if (!namedExpressions || namedExpressions.size == 0) {
        return rootNode;
    }

    return expandNode(
        {
            namedExpressions,
            component,
            assignable,
            expression,
            stack: []
        },
        rootNode,
        undefined
    );
}

// Checks the definition of the named expression: syntax, cycles and the
// arity of the named expressions used inside. Everything else depends on the
// context where the named expression is used, so it can't be checked here.
export function checkNamedExpressionDefinition(
    project: Project,
    namedExpression: INamedExpression
) {
    const namedExpressions = getNamedExpressions(project);
    if (!namedExpressions) {
        return;
    }

    const context: ExpandContext = {
        namedExpressions,
        component: undefined,
        assignable: false,
        expression: namedExpressionSignature(namedExpression),
        stack: []
    };

    expandDefinition(
        context,
        namedExpression,
        namedExpression.parameterNames.map(parameterName => ({
            node: {
                type: "Identifier",
                name: parameterName,
                valueType: "any",
                identifierType: "unknown",
                location: undefined as any
            },
            path: []
        }))
    );
}

// Call it from the recursive functions which go through the expanded tree
// (type inference, check, build), so the error message tells where the node
// came from, e.g.:
//    ... in half (expanded from half(my_var) + IMPORTANT_NUMBER)
export function withNamedExpressionContext<T>(
    node: ExpressionNode,
    fn: () => T
): T {
    const info = node.namedExpression;
    if (!info) {
        return fn();
    }

    try {
        return fn();
    } catch (err) {
        if (err instanceof NamedExpressionError) {
            // already decorated in the inner expansion
            throw err;
        }

        if (info.path.length == 0) {
            // argument subtree, comes from the expression which is checked
            throw new NamedExpressionError(`${err}`);
        }

        throw new NamedExpressionError(
            `${err}, in ${info.path.join(" → ")} (expanded from ${
                info.expression
            })`
        );
    }
}

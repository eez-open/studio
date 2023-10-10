import { ExpressionNode } from "project-editor/flow/expression/node";
import { identifierParser } from "project-editor/flow/expression/parser";

export function parseIdentifier(identifier: string) {
    try {
        const rootNode: ExpressionNode = identifierParser.parse(identifier);
        return rootNode && rootNode.type === "Identifier";
    } catch (err) {
        return false;
    }
}

export function toStringLiteral(str: string) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
        if (str[i] == '"') {
            result += '\\"';
        } else if (str[i] == "\\") {
            result += "\\\\";
        } else if (str[i] == "\n") {
            result += "\\n";
        } else {
            result += str[i];
        }
    }
    return `"${result}"`;
}

export function templateLiteralToExpressions(templateLiteral: string) {
    const expressions: { start: number; end: number }[] = [];

    const re = /\{([^\s][^\}]+)\}/gm;
    while (true) {
        let result = re.exec(templateLiteral);
        if (!result) {
            break;
        }

        expressions.push({
            start: result.index,
            end: result.index + result[0].length
        });
    }

    return expressions;
}

export function templateLiteralToExpression(templateLiteral: string) {
    let result = "";

    function appendToResult(str: string) {
        if (result) {
            result += ` + ${str}`;
        } else {
            result = str;
        }
    }

    const expressions = templateLiteralToExpressions(templateLiteral);

    let prevEnd = 0;
    for (const expression of expressions) {
        if (prevEnd < expression.start) {
            appendToResult(
                toStringLiteral(
                    templateLiteral.substring(prevEnd, expression.start)
                )
            );
        }

        appendToResult(
            `(${templateLiteral.substring(
                expression.start + 1,
                expression.end - 1
            )})`
        );

        prevEnd = expression.end;
    }

    if (prevEnd < templateLiteral.length) {
        appendToResult(toStringLiteral(templateLiteral.substring(prevEnd)));
    }

    return result;
}

export function* visitExpressionNodes(
    node: ExpressionNode
): IterableIterator<ExpressionNode> {
    yield node;

    if (node.type == "BinaryExpression" || node.type == "LogicalExpression") {
        yield* visitExpressionNodes(node.left);
        yield* visitExpressionNodes(node.right);
    } else if (node.type == "UnaryExpression") {
        yield* visitExpressionNodes(node.argument);
    } else if (node.type == "ConditionalExpression") {
        yield* visitExpressionNodes(node.test);
        yield* visitExpressionNodes(node.consequent);
        yield* visitExpressionNodes(node.alternate);
    } else if (node.type == "ArrayExpression") {
        for (const element of node.elements) {
            yield* visitExpressionNodes(element);
        }
    } else if (node.type == "ObjectExpression") {
        for (const property of node.properties) {
            yield* visitExpressionNodes(property.key);
            yield* visitExpressionNodes(property.value);
        }
    } else if (node.type == "MemberExpression") {
        yield* visitExpressionNodes(node.object);
        yield* visitExpressionNodes(node.property);
    } else if (node.type == "CallExpression") {
        yield* visitExpressionNodes(node.callee);
        for (const argument of node.arguments) {
            yield* visitExpressionNodes(argument);
        }
    }
}

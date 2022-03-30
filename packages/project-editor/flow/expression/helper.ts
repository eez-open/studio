import { ExpressionNode } from "project-editor/flow/expression/node";
import { identifierParser } from "project-editor/flow/expression/grammar";

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

export function templateLiteralToExpression(templateLiteral: string) {
    let result = "";

    function appendToResult(str: string) {
        if (result) {
            result += ` + ${str}`;
        } else {
            result = str;
        }
    }

    let str = templateLiteral;
    while (true) {
        let matches = str.match(/\{[^\}]+\}/);
        if (!matches) {
            if (str) {
                appendToResult(toStringLiteral(str));
            }
            break;
        }

        const idx = matches.index!;
        const len = matches[0].length;

        if (idx > 0) {
            appendToResult(toStringLiteral(str.substring(0, idx)));
        }
        appendToResult(`(${str.substring(idx + 1, idx + len - 1)})`);

        str = str.substring(idx + len);
    }

    return result;
}

import type { ExpressionNode } from "project-editor/flow/expression/node";
import { identifierParser } from "./grammar";

////////////////////////////////////////////////////////////////////////////////

export { operationIndexes } from "project-editor/flow/expression/operations";

export {
    checkExpression,
    checkAssignableExpression
} from "project-editor/flow/expression/check";

export {
    buildExpression,
    buildAssignableExpression
} from "project-editor/flow/expression/build";

export {
    IExpressionContext,
    evalConstantExpression,
    evalExpression,
    evalExpressionGetValueType,
    evalAssignableExpression,
    ExpressionEvalError
} from "project-editor/flow/expression/eval";

////////////////////////////////////////////////////////////////////////////////

export function parseIdentifier(identifier: string) {
    try {
        const rootNode: ExpressionNode = identifierParser.parse(identifier);
        return rootNode && rootNode.type === "Identifier";
    } catch (err) {
        return false;
    }
}

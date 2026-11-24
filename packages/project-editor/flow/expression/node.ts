import type { ValueType } from "project-editor/features/variable/value-type";
import type { Variable } from "project-editor/features/variable/variable";

import type { LocationRange } from "peggy";

export type IdentifierType =
    | "input"
    | "output"
    | "local-variable"
    | "global-variable"
    | "system-variable"
    | "enum"
    | "enum-member"
    | "builtin-constant-namespace"
    | "builtin-constant-member"
    | "imported-project"
    | "member"
    | "named-expression"
    | "unknown";

// Set on the root of a subtree that was spliced in by the named expression
// expansion (see named-expression.ts), used to tell in the error message
// where the node came from.
export interface NamedExpressionExpansionInfo {
    // the named expressions being expanded, outermost first, empty for the
    // argument subtrees which come from the expression that is checked
    path: string[];
    // the expression that is checked (before the expansion)
    expression: string;
}

export type IdentifierExpressionNode = {
    type: "Identifier";
    name: string;
    valueType: ValueType;
    identifierType: IdentifierType;
    importedVariable?: Variable;
    location: LocationRange;
};

export type ExpressionNode = (
    | {
          type: "Literal";
          value: any;
          valueType: ValueType;
          location?: LocationRange;
      }
    | {
          type: "TextResource";
          value: string;
          valueType: ValueType;
      }
    | {
          type: "JSONLiteral";
          value: string;
          valueType: ValueType;
      }
    | IdentifierExpressionNode
    | {
          type: "BinaryExpression";
          operator: string;
          left: ExpressionNode;
          right: ExpressionNode;
          valueType: ValueType;
      }
    | {
          type: "LogicalExpression";
          operator: string;
          left: ExpressionNode;
          right: ExpressionNode;
          valueType: ValueType;
      }
    | {
          type: "ArrayExpression";
          elements: ExpressionNode[];
          valueType: ValueType;
      }
    | {
          type: "ObjectExpression";
          properties: {
              key: ExpressionNode;
              value: ExpressionNode;
              kind: "init";
          }[];
          valueType: ValueType;
      }
    | {
          type: "MemberExpression";
          object: ExpressionNode;
          property: ExpressionNode;
          computed: boolean;
          valueType: ValueType;
      }
    | {
          type: "CallExpression";
          callee: ExpressionNode;
          arguments: ExpressionNode[];
          valueType: ValueType;
      }
    | {
          type: "ConditionalExpression";
          test: ExpressionNode;
          consequent: ExpressionNode;
          alternate: ExpressionNode;
          valueType: ValueType;
      }
    | {
          type: "UnaryExpression";
          operator: string;
          argument: ExpressionNode;
          valueType: ValueType;
      }
    | {
          type: "__Unknown";
          valueType: ValueType;
      }
) & {
    namedExpression?: NamedExpressionExpansionInfo;
};

export type NonComputedPropertyExpressionNode = ExpressionNode & {
    name: string;
};

import type { ValueType } from "project-editor/features/variable/value-type";

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
    | "unknown";

export type IdentifierExpressionNode = {
    type: "Identifier";
    name: string;
    valueType: ValueType;
    identifierType: IdentifierType;
    location: LocationRange;
};

export type ExpressionNode =
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
      };

export type NonComputedPropertyExpressionNode = ExpressionNode & {
    name: string;
};

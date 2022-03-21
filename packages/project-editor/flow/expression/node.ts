import type { ValueType } from "project-editor/features/variable/value-type";

export type IdentifierExpressionNode = {
    type: "Identifier";
    name: string;
    valueType: ValueType;
};

export type ExpressionNode =
    | {
          type: "Literal";
          value: any;
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
              key: {
                  type: "Identifier";
                  name: string;
              };
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

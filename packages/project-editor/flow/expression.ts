import jsep from "jsep";
import { Component } from "./component";

jsep.addIdentifierChar("{");
jsep.addIdentifierChar("}");

function isArrayExpression(
    expr: jsep.Expression
): expr is jsep.ArrayExpression {
    return expr.type == "ArrayExpression";
}

function isBinaryExpression(
    expr: jsep.Expression
): expr is jsep.BinaryExpression {
    return expr.type == "BinaryExpression";
}

function isCallExpression(expr: jsep.Expression): expr is jsep.CallExpression {
    return expr.type == "CallExpression";
}

function isCompound(expr: jsep.Expression): expr is jsep.Compound {
    return expr.type == "Compound";
}

function isConditionalExpression(
    expr: jsep.Expression
): expr is jsep.ConditionalExpression {
    return expr.type == "ConditionalExpression";
}

function isIdentifier(expr: jsep.Expression): expr is jsep.Identifier {
    return expr.type == "Identifier";
}

function isLiteral(expr: jsep.Expression): expr is jsep.Literal {
    return expr.type == "Literal";
}

function isLogicalExpression(
    expr: jsep.Expression
): expr is jsep.LogicalExpression {
    return expr.type == "LogicalExpression";
}

function isMemberExpression(
    expr: jsep.Expression
): expr is jsep.MemberExpression {
    return expr.type == "MemberExpression";
}

function isThisExpression(expr: jsep.Expression): expr is jsep.ThisExpression {
    return expr.type == "ThisExpression";
}

function isUnaryExpression(
    expr: jsep.Expression
): expr is jsep.UnaryExpression {
    return expr.type == "UnaryExpression";
}

export function compileExpression(component: Component, expression: string) {
    console.log("COMPILE EXPRESSION", component, expression);

    function compileExpression(expr: jsep.Expression) {
        if (isArrayExpression(expr)) {
        } else if (isBinaryExpression(expr)) {
            compileExpression(expr.left);
            compileExpression(expr.right);
            console.log("binop", expr.operator);
        } else if (isCallExpression(expr)) {
        } else if (isCompound(expr)) {
        } else if (isConditionalExpression(expr)) {
        } else if (isIdentifier(expr)) {
        } else if (isLiteral(expr)) {
            console.log(expr.raw);
        } else if (isLogicalExpression(expr)) {
        } else if (isMemberExpression(expr)) {
        } else if (isThisExpression(expr)) {
        } else if (isUnaryExpression(expr)) {
        }
    }

    const parsedExpr = jsep(expression);
    compileExpression(parsedExpr);
}

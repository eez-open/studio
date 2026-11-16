import type { Component } from "project-editor/flow/component";
import type { ExpressionNode } from "./node";
import { expressionParser } from "./parser";
import { checkAssignableExpressionNode } from "./check";
import { findValueTypeInExpressionNode } from "./type";
import { ProjectEditor } from "project-editor/project-editor-interface";
import {
    ASSIGNABLE_LIST_RUNTIME_ERROR,
    supportsAssignableLists
} from "project-editor/flow/assignable-list-support";

// A container of independent assignable expressions, not an ordinary array
// expression. Keep in sync with eez/core/assets.h in eez-framework.
export const ASSIGNABLE_LIST_MARKER = 0xe400;

function checkConditionalTargets(node: ExpressionNode): void {
    if (node.type === "ConditionalExpression") {
        if (node.consequent.valueType !== node.alternate.valueType) {
            throw "Both destinations of a conditional target must have the same type";
        }
        checkConditionalTargets(node.consequent);
        checkConditionalTargets(node.alternate);
    } else if (node.type === "MemberExpression") {
        // Also cover a conditional array/structure used as the destination's
        // owner, without restricting ordinary expressions used for an index.
        checkConditionalTargets(node.object);
    }
}

export function parseAssignableListExpression(
    component: Component,
    expression: string
): ExpressionNode[] {
    if (
        !supportsAssignableLists(
            ProjectEditor.getProjectStore(component).projectTypeTraits
        )
    ) {
        throw ASSIGNABLE_LIST_RUNTIME_ERROR;
    }
    const root = expressionParser.parse(expression);
    if (root.type !== "ArrayExpression") {
        throw "An assignable list must be an array literal";
    }
    if (root.elements.length > 0xffff) {
        throw "Too many targets in an assignable list";
    }
    for (const node of root.elements) {
        function isTarget(node: ExpressionNode): boolean {
            return (
                node.type === "Identifier" ||
                node.type === "MemberExpression" ||
                (node.type === "ConditionalExpression" &&
                    isTarget(node.consequent) && isTarget(node.alternate))
            );
        }
        if (!isTarget(node)) {
            throw "Every item in an assignable list must be assignable";
        }
        // Validate each item independently: targets may have different types.
        findValueTypeInExpressionNode(
            ProjectEditor.getProject(component), component, node, true
        );
        checkConditionalTargets(node);
        checkAssignableExpressionNode(component, node);
    }
    return root.elements;
}

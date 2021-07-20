import { readFileSync } from "fs";
import { resolve } from "path";
import peggy from "peggy";

import { isDev } from "eez-studio-shared/util-electron";

import { Component } from "./component";
import { Assets } from "project-editor/features/page/build/assets";

const expressionParserGrammar = readFileSync(
    isDev
        ? resolve(`${__dirname}/../../../resources/expression-grammar.pegjs`)
        : process.resourcesPath! + "/expression-grammar.pegjs",
    "utf8"
);

var expressionParser = peggy.generate(expressionParserGrammar);

const operations = [
    ["+", 2],
    ["-", 2],
    ["*", 2],
    ["/", 2],
    ["%", 2],

    ["<<", 2],
    [">>", 2],
    ["&", 2],
    ["|", 2],
    ["^", 2],

    ["==", 2],
    ["!=", 2],
    ["<", 2],
    [">", 2],
    ["<=", 2],
    [">=", 2],
    ["&&", 2],
    ["||", 2],

    ["unary_minus", 1],
    ["~", 1],
    ["!", 1],

    ["?:", 3],

    ["sin", 1],
    ["cos", 1],
    ["log", 1]
    // ...
];

console.log(operations);

export const EXPR_EVAL_INSTRUCTION_TYPE_MASK = 7 << 13;
export const EXPR_EVAL_INSTRUCTION_PARAM_MASK =
    ~EXPR_EVAL_INSTRUCTION_TYPE_MASK;

export const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_CONSTANT = 0 << 13;
export const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_GLOBAL_VAR = 1 << 13;
export const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_LOCAL_VAR = 2 << 13;
export const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_INPUT = 3 << 13;
export const EXPR_EVAL_INSTRUCTION_TYPE_DO_OPERATION = 4 << 13;
export const EXPR_EVAL_INSTRUCTION_TYPE_END = 4 << 13;

export function makePushInputInstruction(inputIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_INPUT | inputIndex;
}

export function makeEndInstruction() {
    return EXPR_EVAL_INSTRUCTION_TYPE_END;
}

export function compileExpression(component: Component, expression: string) {
    console.log("COMPILE EXPRESSION", component, expression);

    const tree = expressionParser.parse(expression);
    console.log(tree);
}

export function buildExpression(
    assets: Assets,
    component: Component,
    expression: string
) {
    console.log("COMPILE EXPRESSION", component, expression);

    const tree = expressionParser.parse(expression);
    console.log(tree);
}

import { readFileSync } from "fs";
import { resolve } from "path";
import peggy from "peggy";

import { isDev } from "eez-studio-shared/util-electron";

import { Component } from "./component";

const expressionParserGrammar = readFileSync(
    isDev
        ? resolve(`${__dirname}/../../../resources/expression-grammar.pegjs`)
        : process.resourcesPath! + "/expression-grammar.pegjs",
    "utf8"
);

var expressionParser = peggy.generate(expressionParserGrammar);

export function compileExpression(component: Component, expression: string) {
    console.log("COMPILE EXPRESSION", component, expression);

    const tree = expressionParser.parse(expression);
    console.log(tree);
}

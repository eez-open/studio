import { readFileSync } from "fs";
import { resolve } from "path";
import peggy from "peggy";

import { isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";

const expressionParserGrammar = readFileSync(
    isDev
        ? resolve(`${sourceRootDir()}/../resources/expression-grammar.pegjs`)
        : process.resourcesPath! + "/expression-grammar.pegjs",
    "utf8"
);

export const expressionParser = peggy.generate(expressionParserGrammar);

export const identifierParser = peggy.generate(expressionParserGrammar, {
    allowedStartRules: ["Identifier"]
});

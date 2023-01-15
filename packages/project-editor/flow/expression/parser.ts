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

const peggyParser = peggy.generate(expressionParserGrammar);

const cache = new Map<string, any>();

export const expressionParser = {
    parse(expr: string) {
        let result: any;

        let resultJSONStr = cache.get(expr);
        if (resultJSONStr != undefined) {
            result = JSON.parse(resultJSONStr);
        } else {
            result = peggyParser.parse(expr);
            resultJSONStr = JSON.stringify(result);
            cache.set(expr, resultJSONStr);
        }

        return result;
    }
};

export const identifierParser = peggy.generate(expressionParserGrammar, {
    allowedStartRules: ["Identifier"],
    cache: true
});

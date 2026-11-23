// expression-parser.js is generated from resources/expression-grammar.pegjs
// at build time (gulp task "expression-parser")
import { parse } from "./expression-parser";

const cache = new Map<string, any>();

export const expressionParser = {
    parse(expr: string) {
        let result: any;

        let resultJSONStr = cache.get(expr);
        if (resultJSONStr != undefined) {
            result = JSON.parse(resultJSONStr);
        } else {
            result = parse(expr, {
                startRule: "Start",
                grammarSource: expr
            });
            resultJSONStr = JSON.stringify(result);
            cache.set(expr, resultJSONStr);
        }

        return result;
    }
};

export const identifierParser = {
    parse(identifier: string) {
        return parse(identifier, { startRule: "Identifier" });
    }
};

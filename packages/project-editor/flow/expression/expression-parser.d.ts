// Types of expression-parser.js, which is generated from
// resources/expression-grammar.pegjs by the "expression-parser" gulp task.

export interface ParseOptions {
    startRule?: "Start" | "Identifier";
    grammarSource?: any;
}

export function parse(input: string, options?: ParseOptions): any;

export class SyntaxError extends Error {
    expected: any;
    found: any;
    location: any;
}

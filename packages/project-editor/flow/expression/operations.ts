import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import type { ValueType } from "project-editor/features/variable/value-type";
import type { IExpressionContext } from "project-editor/flow/expression";
import type { DocumentStoreClass } from "project-editor/store";

function roundN(value: number, decimals: number) {
    return Number(Math.round(Number(value + "e" + decimals)) + "e-" + decimals);
}

export const binaryOperators: {
    [operator: string]: {
        name: string;
        eval: (
            expressionContext: IExpressionContext | undefined,
            a: any,
            b: any
        ) => any;
        getValueType: (a: ValueType, b: ValueType) => ValueType;
    };
} = {
    "+": {
        name: "add",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a + b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (
                a != "integer" &&
                a != "float" &&
                a != "double" &&
                a != "string"
            ) {
                return "undefined";
            }
            if (
                b != "integer" &&
                b != "float" &&
                b != "double" &&
                b != "string"
            ) {
                return "undefined";
            }
            if (a == "string" || b == "string") {
                return "string";
            }
            if (a == "double" || b == "double") {
                return "double";
            }
            if (a == "float" || b == "float") {
                return "float";
            }
            return "integer";
        }
    },
    "-": {
        name: "sub",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a - b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            if (b != "integer" && b != "float" && b != "double") {
                return "undefined";
            }
            if (a == "double" || b == "double") {
                return "double";
            }
            if (a == "float" || b == "float") {
                return "float";
            }
            return "integer";
        }
    },
    "*": {
        name: "mul",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a * b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            if (b != "integer" && b != "float" && b != "double") {
                return "undefined";
            }
            if (a == "double" || b == "double") {
                return "double";
            }
            if (a == "float" || b == "float") {
                return "float";
            }
            return "integer";
        }
    },
    "/": {
        name: "div",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a / b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            if (b != "integer" && b != "float" && b != "double") {
                return "undefined";
            }
            if (a == "double" || b == "double") {
                return "double";
            }
            if (a == "float" || b == "float") {
                return "float";
            }
            return "integer";
        }
    },
    "%": {
        name: "mod",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a % b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            if (b != "integer") {
                return "undefined";
            }
            return "integer";
        }
    },
    "<<": {
        name: "left_shift",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a << b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            if (b != "integer") {
                return "undefined";
            }
            return "integer";
        }
    },
    ">>": {
        name: "right_shift",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a >> b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            if (b != "integer") {
                return "undefined";
            }
            return "integer";
        }
    },
    "&": {
        name: "binary_and",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a & b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            if (b != "integer") {
                return "undefined";
            }
            return "integer";
        }
    },
    "|": {
        name: "binary_or",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a | b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            if (b != "integer") {
                return "undefined";
            }
            return "integer";
        }
    },
    "^": {
        name: "binary_xor",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a ^ b,
        getValueType: (a: ValueType, b: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            if (b != "integer") {
                return "undefined";
            }
            return "integer";
        }
    }
};

export const logicalOperators: {
    [operator: string]: {
        name: string;
        eval: (
            expressionContext: IExpressionContext | undefined,
            a: any,
            b: any
        ) => any;
        getValueType: (a: ValueType, b: ValueType) => ValueType;
    };
} = {
    "==": {
        name: "equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a == b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "!=": {
        name: "not_equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a != b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "<": {
        name: "less",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a < b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    ">": {
        name: "greater",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a > b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "<=": {
        name: "less_or_equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a <= b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    ">=": {
        name: "greater_or_equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a >= b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "&&": {
        name: "logical_and",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a && b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "||": {
        name: "logical_or",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a || b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    }
};

export const unaryOperators: {
    [operator: string]: {
        name: string;
        eval: (
            expressionContext: IExpressionContext | undefined,
            a: any
        ) => any;
        getValueType: (a: ValueType) => ValueType;
    };
} = {
    "+": {
        name: "unary_plus",
        eval: (expressionContext: IExpressionContext | undefined, a) => +a,
        getValueType: (a: ValueType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            return a;
        }
    },
    "-": {
        name: "unary_minus",
        eval: (expressionContext: IExpressionContext | undefined, a) => -a,
        getValueType: (a: ValueType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            return a;
        }
    },
    "~": {
        name: "binary_one_complement",
        eval: (expressionContext: IExpressionContext | undefined, a) => ~a,
        getValueType: (a: ValueType) => {
            if (a != "integer") {
                return "undefined";
            }
            return a;
        }
    },
    "!": {
        name: "not",
        eval: (expressionContext: IExpressionContext | undefined, a) => !a,
        getValueType: (a: ValueType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            return "boolean";
        }
    }
};

export const CONDITIONAL_OPERATOR = "conditional"; // {test} ? {consequent} : {alternate}

export const builtInFunctions: {
    [name: string]: {
        arity: number | { min: number; max?: number };
        args: string[];
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => any;
        getValueType: (...args: ValueType[]) => ValueType;
    };
} = {
    "System.getTick": {
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return Date.now();
        },
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },

    "Flow.index": {
        arity: 1,
        args: ["index"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            if (!expressionContext) {
                return 0;
            }
            const iterators = expressionContext.dataContext.get(
                FLOW_ITERATOR_INDEXES_VARIABLE
            );
            if (!iterators) {
                throw "no iterators";
            }
            const i = args[0];
            if (typeof i != "number") {
                return `iterator index '${i}' is not an number`;
            } else if (i < 0 && i >= iterators.length) {
                return `iterator index ${i} is not in the range [0...${iterators.length}]`;
            } else {
                return iterators[i];
            }
        },
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Flow.isPageActive": {
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            if (!expressionContext) {
                return false;
            }
            return (
                expressionContext.flowState &&
                expressionContext.flowState.flow ==
                    expressionContext.flowState.runtime.selectedPage
            );
        },
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Flow.pageTimelinePosition": {
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return expressionContext && expressionContext.flowState
                ? expressionContext.flowState.timelinePosition
                : 0;
        },
        getValueType: (...args: ValueType[]) => {
            return "float";
        }
    },
    "Flow.makeValue": {
        arity: 2,
        args: ["struct", "value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return args[1];
        },
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },
    "Flow.makeArrayValue": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return args[0];
        },
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },
    "Flow.languages": {
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            const texts = expressionContext?.DocumentStore.project.texts;
            if (texts) {
                return texts.languages.map(language => language.languageID);
            }
            return [];
        },
        getValueType: (...args: ValueType[]) => {
            return "array:string";
        }
    },
    "Flow.translate": {
        arity: 1,
        args: ["textResourceID"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            const texts = expressionContext?.DocumentStore.project.texts;
            if (texts) {
                const textResource = texts.resources[args[0]];
                if (textResource) {
                    const translation = textResource.translations.find(
                        translation =>
                            translation.languageID ==
                            texts.languages[0].languageID
                    );
                    if (translation) {
                        return translation.text;
                    }
                }
            }
            return "";
        },
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },
    "Flow.parseInteger": {
        arity: 1,
        args: ["str"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return parseInt(args[0]);
        },
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Flow.parseFloat": {
        arity: 1,
        args: ["str"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return parseFloat(args[0]);
        },
        getValueType: (...args: ValueType[]) => {
            return "float";
        }
    },
    "Flow.parseDouble": {
        arity: 1,
        args: ["str"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return parseFloat(args[0]);
        },
        getValueType: (...args: ValueType[]) => {
            return "double";
        }
    },

    "Date.now": {
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(),
        getValueType: (...args: ValueType[]) => {
            return "date";
        }
    },
    "Date.toString": {
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).toISOString(),
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },
    "Date.fromString": {
        arity: 1,
        args: ["dateStr"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getTime(),
        getValueType: (...args: ValueType[]) => {
            return "date";
        }
    },

    "Math.sin": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.sin(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.cos": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.cos(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.log": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.log(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.log10": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.log10(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.abs": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.abs(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "integer") {
                return "integer";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.floor": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.floor(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.ceil": {
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.ceil(args[0]),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.round": {
        arity: { min: 1, max: 2 },
        args: ["value", "numOfDigits"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => (args.length == 1 ? roundN(args[0], 0) : roundN(args[0], args[1])),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.min": {
        arity: { min: 2 },
        args: ["value", "..."],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.min(...args),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.max": {
        arity: { min: 2 },
        args: ["value", "..."],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.max(...args),
        getValueType: (...args: ValueType[]) => {
            if (
                args[0] != "integer" &&
                args[0] != "float" &&
                args[0] != "double"
            ) {
                return "undefined";
            }
            if (args[0] == "float") {
                return "float";
            }
            return "double";
        }
    },

    "String.find": {
        arity: 2,
        args: ["string", "substring"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].indexOf(args[1]),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },

    "String.padStart": {
        arity: 3,
        args: ["string", "targetLength", "padString"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].toString().padStart(args[1], args[2]),
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },

    "String.split": {
        arity: 2,
        args: ["string", "separator"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].split(args[1]),
        getValueType: (...args: ValueType[]) => {
            return "array:string";
        }
    },

    "Array.length": {
        arity: 1,
        args: ["array"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].length,
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },

    "Array.slice": {
        arity: { min: 2, max: 3 },
        args: ["array", "from", "[to]"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].slice(args[1], args[2]),
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    }
};

export const builtInConstants: {
    [name: string]: {
        value: (DocumentStore: DocumentStoreClass) => any;
        valueType: ValueType;
    };
} = {
    "System.ProjectFolder": {
        value: (DocumentStore: DocumentStoreClass) =>
            DocumentStore.getAbsoluteProjectFolderPath(),
        valueType: "string"
    },
    "System.ProjectFile": {
        value: (DocumentStore: DocumentStoreClass) => DocumentStore.filePath,
        valueType: "string"
    },

    "Math.PI": {
        value: () => Math.PI,
        valueType: "double"
    },
    "Math.Infinity": {
        value: () => Infinity,
        valueType: "double"
    }
};

export const operationIndexes: { [key: string]: number } = {};

function buildOperationIndexes() {
    let nextOperationIndex = 0;

    for (const name in binaryOperators) {
        if (binaryOperators.hasOwnProperty(name)) {
            operationIndexes[binaryOperators[name].name] = nextOperationIndex++;
        }
    }

    for (const name in logicalOperators) {
        if (logicalOperators.hasOwnProperty(name)) {
            operationIndexes[logicalOperators[name].name] =
                nextOperationIndex++;
        }
    }

    for (const name in unaryOperators) {
        if (unaryOperators.hasOwnProperty(name)) {
            operationIndexes[unaryOperators[name].name] = nextOperationIndex++;
        }
    }

    operationIndexes[CONDITIONAL_OPERATOR] = nextOperationIndex++;

    for (const name in builtInFunctions) {
        if (builtInFunctions.hasOwnProperty(name)) {
            operationIndexes[name] = nextOperationIndex++;
        }
    }
}

buildOperationIndexes();

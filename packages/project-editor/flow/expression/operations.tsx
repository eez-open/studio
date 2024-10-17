import React from "react";

import { objectClone } from "eez-studio-shared/util";
import * as os from "os";
import { FLOW_ITERATOR_INDEXES_VARIABLE } from "project-editor/features/variable/defs";
import type { ValueType } from "project-editor/features/variable/value-type";
import type { IExpressionContext } from "project-editor/flow/expression";
import type { ProjectStore } from "project-editor/store";
import { findBitmap } from "project-editor/project/assets";
import sha256 from "sha256";

function roundN(value: number, decimals: number) {
    return Number(Math.round(Number(value + "e" + decimals)) + "e-" + decimals);
}

export const binaryOperators: {
    [operator: string]: {
        operationIndex: number;
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
        operationIndex: 0,
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
        operationIndex: 1,
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
        operationIndex: 2,
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
        operationIndex: 3,
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
        operationIndex: 4,
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
        operationIndex: 5,
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
        operationIndex: 6,
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
        operationIndex: 7,
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
        operationIndex: 8,
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
        operationIndex: 9,
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
        operationIndex: number;
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
        operationIndex: 10,
        name: "equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a == b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "!=": {
        operationIndex: 11,
        name: "not_equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a != b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "<": {
        operationIndex: 12,
        name: "less",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a < b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    ">": {
        operationIndex: 13,
        name: "greater",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a > b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "<=": {
        operationIndex: 14,
        name: "less_or_equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a <= b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    ">=": {
        operationIndex: 15,
        name: "greater_or_equal",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a >= b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "&&": {
        operationIndex: 16,
        name: "logical_and",
        eval: (expressionContext: IExpressionContext | undefined, a, b) =>
            a && b,
        getValueType: (a: ValueType, b: ValueType) => {
            return "boolean";
        }
    },
    "||": {
        operationIndex: 17,
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
        operationIndex: number;
        name: string;
        eval: (
            expressionContext: IExpressionContext | undefined,
            a: any
        ) => any;
        getValueType: (a: ValueType) => ValueType;
    };
} = {
    "+": {
        operationIndex: 18,
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
        operationIndex: 19,
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
        operationIndex: 20,
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
        operationIndex: 21,
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
        operationIndex: number;
        arity: number | { min: number; max?: number };
        args: string[];
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => any;
        getValueType: (...args: ValueType[]) => ValueType;
        enabled?: (projectStore: ProjectStore) => boolean;
    };
} = {
    "System.getTick": {
        operationIndex: 23,
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
        operationIndex: 24,
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
        operationIndex: 25,
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
        operationIndex: 26,
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
        operationIndex: 27,
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
        operationIndex: 28,
        arity: 2,
        args: ["type", "size"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return new Array(args[1]);
        },
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },
    "Flow.languages": {
        operationIndex: 29,
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            const texts = expressionContext?.projectStore.project.texts;
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
        operationIndex: 30,
        arity: 1,
        args: ["textResourceID"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            const texts = expressionContext?.projectStore.project.texts;
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
    "Flow.themes": {
        operationIndex: 89,
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            const themes = expressionContext?.projectStore.project.themes;
            if (themes) {
                return themes.map(theme => theme.name);
            }
            return [];
        },
        getValueType: (...args: ValueType[]) => {
            return "array:string";
        }
    },
    "Flow.parseInteger": {
        operationIndex: 31,
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
        operationIndex: 32,
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
        operationIndex: 33,
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

    "Flow.toInteger": {
        operationIndex: 71,
        arity: 1,
        args: ["value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            return args[0];
        },
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },

    "Flow.getBitmapIndex": {
        operationIndex: 70,
        arity: 1,
        args: ["bitmapName"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) =>
            expressionContext
                ? findBitmap(expressionContext?.projectStore.project, args[0])
                : undefined,
        getValueType: (...args: ValueType[]) => {
            return "blob";
        },
        enabled: projectStore => !projectStore.projectTypeTraits.isLVGL
    },

    "Flow.getBitmapAsDataURL": {
        operationIndex: 78,
        arity: 1,
        args: ["bitmapName"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) =>
            expressionContext
                ? findBitmap(expressionContext?.projectStore.project, args[0])
                : undefined,
        getValueType: (...args: ValueType[]) => {
            return "string";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isDashboard
    },

    "Crypto.sha256": {
        operationIndex: 74,
        arity: 1,
        args: ["string_or_blob"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => sha256(args[0]),
        getValueType: (...args: ValueType[]) => {
            return "blob";
        }
    },

    "Date.now": {
        operationIndex: 34,
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
        operationIndex: 35,
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
    "Date.toLocaleString": {
        operationIndex: 59,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).toLocaleString(),
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },
    "Date.fromString": {
        operationIndex: 36,
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
    "Date.getYear": {
        operationIndex: 60,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getFullYear(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.getMonth": {
        operationIndex: 61,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getMonth(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.getDay": {
        operationIndex: 62,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getDay(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.getHours": {
        operationIndex: 63,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getHours(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.getMinutes": {
        operationIndex: 64,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getMinutes(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.getSeconds": {
        operationIndex: 65,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getSeconds(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.getMilliseconds": {
        operationIndex: 66,
        arity: 1,
        args: ["date"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Date(args[0]).getMilliseconds(),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },
    "Date.make": {
        operationIndex: 67,
        arity: 7,
        args: [
            "year",
            "month",
            "day",
            "hours",
            "minutes",
            "seconds",
            "milliseconds"
        ],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) =>
            new Date(
                args[0],
                args[1] - 1,
                args[2],
                args[3],
                args[4],
                args[5],
                args[6]
            ),
        getValueType: (...args: ValueType[]) => {
            return "date";
        }
    },

    "Math.sin": {
        operationIndex: 37,
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
        operationIndex: 38,
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
    "Math.pow": {
        operationIndex: 68,
        arity: 2,
        args: ["base", "exponent"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Math.pow(args[0], args[1]),
        getValueType: (...args: ValueType[]) => {
            if (
                (args[0] != "integer" &&
                    args[0] != "float" &&
                    args[0] != "double") ||
                (args[1] != "integer" &&
                    args[1] != "float" &&
                    args[1] != "double")
            ) {
                return "undefined";
            }
            if (args[0] == "float" && args[1] == "float") {
                return "float";
            }
            return "double";
        }
    },
    "Math.log": {
        operationIndex: 39,
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
        operationIndex: 40,
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
        operationIndex: 41,
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
        operationIndex: 42,
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
        operationIndex: 43,
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
        operationIndex: 44,
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
        operationIndex: 45,
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
        operationIndex: 46,
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

    "String.length": {
        operationIndex: 47,
        arity: 1,
        args: ["string"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].length,
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },

    "String.substring": {
        operationIndex: 48,
        arity: { min: 2 },
        args: ["string", "start", "end"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].substring(args[1], args[2]),
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },

    "String.find": {
        operationIndex: 49,
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

    "String.format": {
        operationIndex: 79,
        arity: 2,
        args: ["specifier", "number"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => {
            if (
                !expressionContext?.projectStore.projectTypeTraits.isDashboard
            ) {
                if (args[0].startsWith("%")) {
                    return (window as any).d3.format(args[0].slice(1))(args[1]);
                } else {
                    return (window as any).d3.format(args[0])(args[1]);
                }
            } else {
                (window as any).d3.format(args[0])(args[1]);
            }
        },
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },

    "String.formatPrefix": {
        operationIndex: 80,
        arity: 3,
        args: ["specifier", "value", "number"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => (window as any).d3.formatPrefix(args[0], args[1])(args[2]),
        getValueType: (...args: ValueType[]) => {
            return "string";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isDashboard
    },

    "String.padStart": {
        operationIndex: 50,
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
        operationIndex: 51,
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

    "String.fromCodePoint": {
        operationIndex: 72,
        arity: 1,
        args: ["charCode"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => String.fromCodePoint(args[0]),
        getValueType: (...args: ValueType[]) => {
            return "string";
        }
    },

    "String.codePointAt": {
        operationIndex: 73,
        arity: 2,
        args: ["string", "index"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].codePointAt(args[1]),
        getValueType: (...args: ValueType[]) => {
            return "integer";
        }
    },

    "Array.length": {
        operationIndex: 52,
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
        operationIndex: 53,
        arity: { min: 1, max: 3 },
        args: ["array", "start", "[end]"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0].slice(args[1], args[2]),
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },

    "Array.allocate": {
        operationIndex: 54,
        arity: 1,
        args: ["size"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => new Array(args[0]),
        getValueType: (...args: ValueType[]) => {
            return "array:any";
        }
    },

    "Array.append": {
        operationIndex: 55,
        arity: 2,
        args: ["array", "value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => [...args[0], args[1]],
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },

    "Array.insert": {
        operationIndex: 56,
        arity: 3,
        args: ["array", "position", "value"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => [...args[0].slice(0, args[2]), args[2], ...args[0].slice(args[2])],
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },

    "Array.remove": {
        operationIndex: 57,
        arity: 2,
        args: ["array", "position"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => [...args[0].slice(0, args[2]), ...args[0].slice(args[2] + 1)],
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },

    "Array.clone": {
        operationIndex: 58,
        arity: 1,
        args: ["array"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => objectClone(args[0]),
        getValueType: (...args: ValueType[]) => {
            return args[0];
        }
    },

    "Blob.allocate": {
        operationIndex: 75,
        arity: 1,
        args: ["size"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => Buffer.alloc(args[0]),
        getValueType: (...args: ValueType[]) => {
            return "blob";
        }
    },

    "Blob.toString": {
        operationIndex: 88,
        arity: 1,
        args: ["blob"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[1].toString("utf8"),
        getValueType: (...args: ValueType[]) => {
            return "string";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isDashboard
    },

    "JSON.get": {
        operationIndex: 76,
        arity: 2,
        args: ["json", "property"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => args[0][args[1]],
        getValueType: (...args: ValueType[]) => {
            return "json";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isDashboard
    },

    "JSON.clone": {
        operationIndex: 77,
        arity: 1,
        args: ["json"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => JSON.parse(JSON.stringify(args[0])),
        getValueType: (...args: ValueType[]) => {
            return "json";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isDashboard
    },

    "Event.getCode": {
        operationIndex: 81,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "integer";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "Event.getCurrentTarget": {
        operationIndex: 82,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "widget";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "Event.getTarget": {
        operationIndex: 83,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "widget";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "Event.getUserData": {
        operationIndex: 84,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "any";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "Event.getKey": {
        operationIndex: 85,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "integer";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "Event.getGestureDir": {
        operationIndex: 86,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "integer";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "Event.getRotaryDiff": {
        operationIndex: 87,
        arity: 1,
        args: ["event"],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => undefined,
        getValueType: (...args: ValueType[]) => {
            return "integer";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    },

    "LVGL.MeterTickIndex": {
        operationIndex: 69,
        arity: 0,
        args: [],
        eval: (
            expressionContext: IExpressionContext | undefined,
            ...args: any[]
        ) => 0,
        getValueType: (...args: ValueType[]) => {
            return "integer";
        },
        enabled: projectStore => projectStore.projectTypeTraits.isLVGL
    }
};

type BuiltInConstantsType = {
    [name: string]: {
        value: (projectStore: ProjectStore) => any;
        valueType: ValueType;
        label?: (name: string) => React.ReactNode;
    };
};

const commonConstants: BuiltInConstantsType = {
    "System.Platform": {
        value: (projectStore: ProjectStore) => {
            const platform = os.platform();
            if (platform == "darwin") return "macos";
            return platform;
        },
        valueType: "string"
    },

    "System.Architecture": {
        value: (projectStore: ProjectStore) => os.arch(),
        valueType: "string"
    },

    "System.ProjectFolder": {
        value: (projectStore: ProjectStore) =>
            projectStore.getAbsoluteProjectFolderPath(),
        valueType: "string"
    },
    "System.ProjectFile": {
        value: (projectStore: ProjectStore) => projectStore.filePath,
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

function LVGL_SYMBOL(value: string): {
    value: (projectStore: ProjectStore) => string;
    valueType: ValueType;
    label: (name: string) => React.ReactNode;
} {
    return {
        value: (projectStore: ProjectStore) => value,
        valueType: "string",
        label: name => (
            <>
                <span className="EezStudio_LVGLSymbolIcon font-awesome-icons">
                    {value}
                </span>
                <span>{name}</span>
            </>
        )
    };
}

const lvglConstants: BuiltInConstantsType = {
    ...commonConstants,
    "LVGL.LV_SYMBOL_AUDIO": LVGL_SYMBOL("\uF001"),
    "LVGL.LV_SYMBOL_VIDEO": LVGL_SYMBOL("\uF008"),
    "LVGL.LV_SYMBOL_LIST": LVGL_SYMBOL("\uF00B"),
    "LVGL.LV_SYMBOL_OK": LVGL_SYMBOL("\uF00C"),
    "LVGL.LV_SYMBOL_CLOSE": LVGL_SYMBOL("\uF00D"),
    "LVGL.LV_SYMBOL_POWER": LVGL_SYMBOL("\uF011"),
    "LVGL.LV_SYMBOL_SETTINGS": LVGL_SYMBOL("\uF013"),
    "LVGL.LV_SYMBOL_HOME": LVGL_SYMBOL("\uF015"),
    "LVGL.LV_SYMBOL_DOWNLOAD": LVGL_SYMBOL("\uF019"),
    "LVGL.LV_SYMBOL_DRIVE": LVGL_SYMBOL("\uF01C"),
    "LVGL.LV_SYMBOL_REFRESH": LVGL_SYMBOL("\uF021"),
    "LVGL.LV_SYMBOL_MUTE": LVGL_SYMBOL("\uF026"),
    "LVGL.LV_SYMBOL_VOLUME_MID": LVGL_SYMBOL("\uF027"),
    "LVGL.LV_SYMBOL_VOLUME_MAX": LVGL_SYMBOL("\uF028"),
    "LVGL.LV_SYMBOL_IMAGE": LVGL_SYMBOL("\uF03E"),
    "LVGL.LV_SYMBOL_TINT": LVGL_SYMBOL("\uF043"),
    "LVGL.LV_SYMBOL_PREV": LVGL_SYMBOL("\uF048"),
    "LVGL.LV_SYMBOL_PLAY": LVGL_SYMBOL("\uF04B"),
    "LVGL.LV_SYMBOL_PAUSE": LVGL_SYMBOL("\uF04C"),
    "LVGL.LV_SYMBOL_STOP": LVGL_SYMBOL("\uF04D"),
    "LVGL.LV_SYMBOL_NEXT": LVGL_SYMBOL("\uF051"),
    "LVGL.LV_SYMBOL_EJECT": LVGL_SYMBOL("\uF052"),
    "LVGL.LV_SYMBOL_LEFT": LVGL_SYMBOL("\uF053"),
    "LVGL.LV_SYMBOL_RIGHT": LVGL_SYMBOL("\uF054"),
    "LVGL.LV_SYMBOL_PLUS": LVGL_SYMBOL("\uF067"),
    "LVGL.LV_SYMBOL_MINUS": LVGL_SYMBOL("\uF068"),
    "LVGL.LV_SYMBOL_EYE_OPEN": LVGL_SYMBOL("\uF06E"),
    "LVGL.LV_SYMBOL_EYE_CLOSE": LVGL_SYMBOL("\uF070"),
    "LVGL.LV_SYMBOL_WARNING": LVGL_SYMBOL("\uF071"),
    "LVGL.LV_SYMBOL_SHUFFLE": LVGL_SYMBOL("\uF074"),
    "LVGL.LV_SYMBOL_UP": LVGL_SYMBOL("\uF077"),
    "LVGL.LV_SYMBOL_DOWN": LVGL_SYMBOL("\uF078"),
    "LVGL.LV_SYMBOL_LOOP": LVGL_SYMBOL("\uF079"),
    "LVGL.LV_SYMBOL_DIRECTORY": LVGL_SYMBOL("\uF07B"),
    "LVGL.LV_SYMBOL_UPLOAD": LVGL_SYMBOL("\uF093"),
    "LVGL.LV_SYMBOL_CALL": LVGL_SYMBOL("\uF095"),
    "LVGL.LV_SYMBOL_CUT": LVGL_SYMBOL("\uF0C4"),
    "LVGL.LV_SYMBOL_COPY": LVGL_SYMBOL("\uF0C5"),
    "LVGL.LV_SYMBOL_SAVE": LVGL_SYMBOL("\uF0C7"),
    "LVGL.LV_SYMBOL_BARS": LVGL_SYMBOL("\uF0C9"),
    "LVGL.LV_SYMBOL_ENVELOPE": LVGL_SYMBOL("\uF0E0"),
    "LVGL.LV_SYMBOL_CHARGE": LVGL_SYMBOL("\uF0E7"),
    "LVGL.LV_SYMBOL_PASTE": LVGL_SYMBOL("\uF0EA"),
    "LVGL.LV_SYMBOL_BELL": LVGL_SYMBOL("\uF0F3"),
    "LVGL.LV_SYMBOL_KEYBOARD": LVGL_SYMBOL("\uF11C"),
    "LVGL.LV_SYMBOL_GPS": LVGL_SYMBOL("\uF124"),
    "LVGL.LV_SYMBOL_FILE": LVGL_SYMBOL("\uF15B"),
    "LVGL.LV_SYMBOL_WIFI": LVGL_SYMBOL("\uF1EB"),
    "LVGL.LV_SYMBOL_BATTERY_FULL": LVGL_SYMBOL("\uF240"),
    "LVGL.LV_SYMBOL_BATTERY_3": LVGL_SYMBOL("\uF241"),
    "LVGL.LV_SYMBOL_BATTERY_2": LVGL_SYMBOL("\uF242"),
    "LVGL.LV_SYMBOL_BATTERY_1": LVGL_SYMBOL("\uF243"),
    "LVGL.LV_SYMBOL_BATTERY_EMPTY": LVGL_SYMBOL("\uF244"),
    "LVGL.LV_SYMBOL_USB": LVGL_SYMBOL("\uF287"),
    "LVGL.LV_SYMBOL_BLUETOOTH": LVGL_SYMBOL("\uF293"),
    "LVGL.LV_SYMBOL_TRASH": LVGL_SYMBOL("\uF2ED"),
    "LVGL.LV_SYMBOL_EDIT": LVGL_SYMBOL("\uF304"),
    "LVGL.LV_SYMBOL_BACKSPACE": LVGL_SYMBOL("\uF55A"),
    "LVGL.LV_SYMBOL_SD_CARD": LVGL_SYMBOL("\uF7C2"),
    "LVGL.LV_SYMBOL_NEW_LINE": LVGL_SYMBOL("\uF8A2")
};

export const builtInConstants: (
    projectStore: ProjectStore
) => BuiltInConstantsType = (projectStore: ProjectStore) =>
    projectStore.projectTypeTraits.isLVGL ? lvglConstants : commonConstants;

export const operationIndexes: { [key: string]: number } = {};

function buildOperationIndexes() {
    for (const name in binaryOperators) {
        if (binaryOperators.hasOwnProperty(name)) {
            operationIndexes[binaryOperators[name].name] =
                binaryOperators[name].operationIndex;
        }
    }

    for (const name in logicalOperators) {
        if (logicalOperators.hasOwnProperty(name)) {
            operationIndexes[logicalOperators[name].name] =
                logicalOperators[name].operationIndex;
        }
    }

    for (const name in unaryOperators) {
        if (unaryOperators.hasOwnProperty(name)) {
            operationIndexes[unaryOperators[name].name] =
                unaryOperators[name].operationIndex;
        }
    }

    operationIndexes[CONDITIONAL_OPERATOR] = 22;

    for (const name in builtInFunctions) {
        if (builtInFunctions.hasOwnProperty(name)) {
            operationIndexes[name] = builtInFunctions[name].operationIndex;
        }
    }
}

buildOperationIndexes();

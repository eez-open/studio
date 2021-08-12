import { VariableType } from "project-editor/features/variable/variable";
import { IFlowContext } from "../flow-interfaces";

export const binaryOperators: {
    [operator: string]: {
        name: string;
        eval: (flowContext: IFlowContext | undefined, a: any, b: any) => any;
        getValueType: (a: VariableType, b: VariableType) => VariableType;
    };
} = {
    "+": {
        name: "add",
        eval: (flowContext: IFlowContext | undefined, a, b) => a + b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a - b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a * b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a / b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a % b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a << b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a >> b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a & b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a | b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a, b) => a ^ b,
        getValueType: (a: VariableType, b: VariableType) => {
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
        eval: (flowContext: IFlowContext | undefined, a: any, b: any) => any;
        getValueType: (a: VariableType, b: VariableType) => VariableType;
    };
} = {
    "==": {
        name: "equal",
        eval: (flowContext: IFlowContext | undefined, a, b) => a == b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    "!=": {
        name: "not_equal",
        eval: (flowContext: IFlowContext | undefined, a, b) => a != b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    "<": {
        name: "less",
        eval: (flowContext: IFlowContext | undefined, a, b) => a < b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    ">": {
        name: "greater",
        eval: (flowContext: IFlowContext | undefined, a, b) => a > b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    "<=": {
        name: "less_or_equal",
        eval: (flowContext: IFlowContext | undefined, a, b) => a <= b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    ">=": {
        name: "greater_or_equal",
        eval: (flowContext: IFlowContext | undefined, a, b) => a >= b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    "&&": {
        name: "logical_and",
        eval: (flowContext: IFlowContext | undefined, a, b) => a && b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    },
    "||": {
        name: "logical_or",
        eval: (flowContext: IFlowContext | undefined, a, b) => a || b,
        getValueType: (a: VariableType, b: VariableType) => {
            return "boolean";
        }
    }
};

export const unaryOperators: {
    [operator: string]: {
        name: string;
        eval: (flowContext: IFlowContext | undefined, a: any) => any;
        getValueType: (a: VariableType) => VariableType;
    };
} = {
    "+": {
        name: "unary_plus",
        eval: (flowContext: IFlowContext | undefined, a) => +a,
        getValueType: (a: VariableType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            return a;
        }
    },
    "-": {
        name: "unary_minus",
        eval: (flowContext: IFlowContext | undefined, a) => -a,
        getValueType: (a: VariableType) => {
            if (a != "integer" && a != "float" && a != "double") {
                return "undefined";
            }
            return a;
        }
    },
    "~": {
        name: "binary_one_complement",
        eval: (flowContext: IFlowContext | undefined, a) => ~a,
        getValueType: (a: VariableType) => {
            if (a != "integer") {
                return "undefined";
            }
            return a;
        }
    },
    "!": {
        name: "not",
        eval: (flowContext: IFlowContext | undefined, a) => !a,
        getValueType: (a: VariableType) => {
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
        arity: number;
        eval: (flowContext: IFlowContext | undefined, ...args: any[]) => any;
        getValueType: (...args: VariableType[]) => VariableType;
    };
} = {
    "Flow.it": {
        arity: 1,
        eval: (flowContext: IFlowContext | undefined, ...args: any[]) => {
            if (flowContext) {
                return flowContext.dataContext.get("$it");
            }
            return 0;
        },
        getValueType: (...args: VariableType[]) => {
            return "integer";
        }
    },
    "Math.sin": {
        arity: 1,
        eval: (flowContext: IFlowContext | undefined, ...args: any[]) =>
            Math.sin(args[0]),
        getValueType: (...args: VariableType[]) => {
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
        eval: (flowContext: IFlowContext | undefined, ...args: any[]) =>
            Math.cos(args[0]),
        getValueType: (...args: VariableType[]) => {
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
        eval: (flowContext: IFlowContext | undefined, ...args: any[]) =>
            Math.log(args[0]),
        getValueType: (...args: VariableType[]) => {
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
        eval: (flowContext: IFlowContext | undefined, ...args: any[]) =>
            Math.log(args[0]),
        getValueType: (...args: VariableType[]) => {
            if (args[0] != "string" && args[1] != "string") {
                return "undefined";
            }
            return "integer";
        }
    }
};

export const builtInConstants: {
    [name: string]: {
        value: any;
        valueType: VariableType;
    };
} = {
    "Math.PI": {
        value: Math.PI,
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

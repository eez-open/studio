export const binaryOperators: {
    [operator: string]: {
        name: string;
        eval: (a: any, b: any) => any;
    };
} = {
    "+": { name: "add", eval: (a, b) => a + b },
    "-": { name: "sub", eval: (a, b) => a - b },
    "*": { name: "mul", eval: (a, b) => a * b },
    "/": { name: "div", eval: (a, b) => a / b },
    "%": { name: "mod", eval: (a, b) => a % b },
    "<<": { name: "left_shift", eval: (a, b) => a << b },
    ">>": { name: "right_shift", eval: (a, b) => a >> b },
    "&": { name: "binary_and", eval: (a, b) => a & b },
    "|": { name: "binary_or", eval: (a, b) => a | b },
    "^": { name: "binary_xor", eval: (a, b) => a ^ b }
};

export const logicalOperators: {
    [operator: string]: {
        name: string;
        eval: (a: any, b: any) => any;
    };
} = {
    "==": { name: "equal", eval: (a, b) => a == b },
    "!=": { name: "not_equal", eval: (a, b) => a != b },
    "<": { name: "less", eval: (a, b) => a < b },
    ">": { name: "greater", eval: (a, b) => a > b },
    "<=": { name: "less_or_equal", eval: (a, b) => a <= b },
    ">=": { name: "greater_or_equal", eval: (a, b) => a >= b },
    "&&": { name: "logical_and", eval: (a, b) => a && b },
    "||": { name: "logical_or", eval: (a, b) => a || b }
};

export const unaryOperators: {
    [operator: string]: {
        name: string;
        eval: (a: any) => any;
    };
} = {
    "+": { name: "unary_plus", eval: a => +a },
    "-": { name: "unary_minus", eval: a => -a },
    "~": { name: "binary_one_complement", eval: a => ~a },
    "!": { name: "not", eval: a => !a }
};

export const CONDITIONAL_OPERATOR = "conditional"; // {test} ? {consequent} : {alternate}

export const builtInFunctions: {
    [name: string]: {
        arity: number;
        eval: (...args: any[]) => any;
    };
} = {
    "Math.sin": {
        arity: 1,
        eval: (...args: any[]) => Math.sin(args[0])
    },
    "Math.cos": {
        arity: 1,
        eval: (...args: any[]) => Math.cos(args[0])
    },
    "Math.log": {
        arity: 1,
        eval: (...args: any[]) => Math.log(args[0])
    },

    "String.find": {
        arity: 2,
        eval: (...args: any[]) => Math.log(args[0])
    }
};

export const builtInConstants: {
    [name: string]: number; // name => arity
} = {
    "Math.PI": Math.PI
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

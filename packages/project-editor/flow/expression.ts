import { readFileSync } from "fs";
import { resolve } from "path";
import peggy from "peggy";

import { isDev } from "eez-studio-shared/util-electron";

import { Component } from "./component";
import { Assets, DataBuffer } from "project-editor/features/page/build/assets";
import { getFlow, getProject } from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

const expressionParserGrammar = readFileSync(
    isDev
        ? resolve(`${__dirname}/../../../resources/expression-grammar.pegjs`)
        : process.resourcesPath! + "/expression-grammar.pegjs",
    "utf8"
);

var expressionParser = peggy.generate(expressionParserGrammar);

////////////////////////////////////////////////////////////////////////////////

type ExpressionTreeNode =
    | {
          type: "Literal";
          value: any;
      }
    | {
          type: "Identifier";
          name: string;
      }
    | {
          type: "BinaryExpression";
          operator: string;
          left: ExpressionTreeNode;
          right: ExpressionTreeNode;
      }
    | {
          type: "LogicalExpression";
          operator: string;
          left: ExpressionTreeNode;
          right: ExpressionTreeNode;
      }
    | {
          type: "ArrayExpression";
          elements: ExpressionTreeNode[];
      }
    | {
          type: "ObjectExpression";
          properties: {
              key: string;
              value: ExpressionTreeNode;
              kind: "init";
          }[];
      }
    | {
          type: "MemberExpression";
          object: ExpressionTreeNode;
          property: ExpressionTreeNode;
          computed: boolean;
      }
    | {
          type: "CallExpression";
          callee: ExpressionTreeNode;
          arguments: ExpressionTreeNode[];
      }
    | {
          type: "ConditionalExpression";
          test: ExpressionTreeNode;
          consequent: ExpressionTreeNode;
          alternate: ExpressionTreeNode;
      }
    | {
          type: "UnaryExpression";
          operator: string;
          argument: ExpressionTreeNode;
      }
    | {
          type: "__Unknown";
      };

////////////////////////////////////////////////////////////////////////////////

const binaryOperators: {
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

const logicalOperators: {
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

const unaryOperators: {
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

const CONDITIONAL_OPERATOR = "conditional"; // {test} ? {consequent} : {alternate}

const builtInFunctions: {
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
    }
};

const builtInConstants: {
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

////////////////////////////////////////////////////////////////////////////////

const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_CONSTANT = 0 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_INPUT = 1 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_LOCAL_VAR = 2 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_GLOBAL_VAR = 3 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_OPERATION = 4 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_END = 5 << 13;

////////////////////////////////////////////////////////////////////////////////

export function checkExpression(component: Component, expression: string) {
    function checkNode(node: ExpressionTreeNode) {
        if (node.type == "Literal") {
            return;
        }

        if (node.type == "Identifier") {
            const input = component.inputs.find(
                input => input.name == node.name
            );
            if (input != undefined) {
                return;
            }

            const flow = getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return;
            }

            let globalVariableIndex =
                project.variables.globalVariables.findIndex(
                    globalVariable => globalVariable.name == node.name
                );
            if (globalVariableIndex != -1) {
                return;
            }

            throw `identifier '${node.name}' is neither input or local or global variable`;
        }

        if (node.type == "BinaryExpression") {
            const operator = binaryOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }

            checkNode(node.left);
            checkNode(node.right);
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator '${node.operator}'`;
            }

            checkNode(node.left);
            checkNode(node.right);
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator '${node.operator}'`;
            }

            checkNode(node.argument);
        }

        if (node.type == "ConditionalExpression") {
            checkNode(node.test);
            checkNode(node.consequent);
            checkNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunctions[functionName].arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            node.arguments.forEach(checkNode);
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = project.variables.enumMap.get(node.object.name);
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return;
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            throw "Unsupported";
        }

        // TODO

        // if (node.type == "ArrayExpression") {
        // }

        // if (node.type == "ObjectExpression") {
        // }

        throw `Unknown expression node "${node.type}"`;
    }

    console.log("CHECK EXPRESSION", component, expression);

    const project = getProject(component);

    if (expression == undefined) {
    } else if (typeof expression == "number") {
    } else {
        const tree: ExpressionTreeNode = expressionParser.parse(expression);
        checkNode(tree);
    }
}

function makePushConstantInstruction(assets: Assets, value: any) {
    return (
        EXPR_EVAL_INSTRUCTION_TYPE_PUSH_CONSTANT |
        assets.getConstantIndex(value)
    );
}

function makePushInputInstruction(inputIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_INPUT | inputIndex;
}

function makePushLocalVariableInstruction(localVariableIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_LOCAL_VAR | localVariableIndex;
}

function makePushGlobalVariableInstruction(globalVariableIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_GLOBAL_VAR | globalVariableIndex;
}

function makeOperationInstruction(operationIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_OPERATION | operationIndex;
}

function makeEndInstruction() {
    return EXPR_EVAL_INSTRUCTION_TYPE_END;
}

export function buildExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    function buildNode(node: ExpressionTreeNode): number[] {
        if (node.type == "Literal") {
            return [makePushConstantInstruction(assets, node.value)];
        }

        if (node.type == "Identifier") {
            const inputIndex = assets.findComponentInputIndex(
                component,
                node.name
            );
            if (inputIndex != -1) {
                return [makePushInputInstruction(inputIndex)];
            }

            const flow = getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return [makePushLocalVariableInstruction(localVariableIndex)];
            }

            let globalVariableIndex = assets.globalVariables.findIndex(
                globalVariable => globalVariable.name == node.name
            );
            if (globalVariableIndex != -1) {
                return [makePushGlobalVariableInstruction(globalVariableIndex)];
            }

            throw `identifier '${node.name}' is neither input or local or global variable`;
        }

        if (node.type == "BinaryExpression") {
            const operator = binaryOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }

            return [
                ...buildNode(node.left),
                ...buildNode(node.right),
                makeOperationInstruction(operationIndexes[operator.name])
            ];
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator '${node.operator}'`;
            }

            return [
                ...buildNode(node.left),
                ...buildNode(node.right),
                makeOperationInstruction(operationIndexes[operator.name])
            ];
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator '${node.operator}'`;
            }

            return [
                ...buildNode(node.argument),
                makeOperationInstruction(operationIndexes[operator.name])
            ];
        }

        if (node.type == "ConditionalExpression") {
            return [
                ...buildNode(node.test),
                ...buildNode(node.consequent),
                ...buildNode(node.alternate),
                makeOperationInstruction(operationIndexes[CONDITIONAL_OPERATOR])
            ];
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunctions[functionName].arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return [
                ...node.arguments.reduce(
                    (instructions, node) => [
                        ...instructions,
                        ...buildNode(node)
                    ],
                    []
                ),
                operationIndexes[functionName]
            ];
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = assets.rootProject.variables.enumMap.get(
                    node.object.name
                );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return [
                        makePushConstantInstruction(assets, enumMember.value)
                    ];
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return [
                        makePushConstantInstruction(
                            assets,
                            buildInConstantValue
                        )
                    ];
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            throw "Unsupported";
        }

        // TODO

        // if (node.type == "ArrayExpression") {
        // }

        // if (node.type == "ObjectExpression") {
        // }

        throw `Unknown expression node "${node.type}"`;
    }

    console.log("BUILD EXPRESSION", assets, component, expression);

    let instructions;
    if (expression == undefined) {
        instructions = [makePushConstantInstruction(assets, undefined)];
    } else if (typeof expression == "number") {
        instructions = [makePushConstantInstruction(assets, expression)];
    } else {
        const tree: ExpressionTreeNode = expressionParser.parse(expression);
        instructions = buildNode(tree);
    }

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

export function buildAssignableExpression(
    assets: Assets,
    dataBuffer: DataBuffer,
    component: Component,
    expression: string
) {
    function buildNode(node: ExpressionTreeNode): number[] {
        if (node.type == "Literal") {
            return [makePushConstantInstruction(assets, node.value)];
        }

        if (node.type == "Identifier") {
            const inputIndex = assets.findComponentInputIndex(
                component,
                node.name
            );
            if (inputIndex != -1) {
                return [makePushInputInstruction(inputIndex)];
            }

            const flow = getFlow(component);
            let localVariableIndex = flow.localVariables.findIndex(
                localVariable => localVariable.name == node.name
            );
            if (localVariableIndex != -1) {
                return [makePushLocalVariableInstruction(localVariableIndex)];
            }

            let globalVariableIndex = assets.globalVariables.findIndex(
                globalVariable => globalVariable.name == node.name
            );
            if (globalVariableIndex != -1) {
                return [makePushGlobalVariableInstruction(globalVariableIndex)];
            }

            throw `identifier '${node.name}' is neither input or local or global variable`;
        }

        if (node.type == "BinaryExpression") {
            const operator = binaryOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator '${node.operator}'`;
            }

            return [
                ...buildNode(node.left),
                ...buildNode(node.right),
                makeOperationInstruction(operationIndexes[operator.name])
            ];
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator '${node.operator}'`;
            }

            return [
                ...buildNode(node.left),
                ...buildNode(node.right),
                makeOperationInstruction(operationIndexes[operator.name])
            ];
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator '${node.operator}'`;
            }

            return [
                ...buildNode(node.argument),
                makeOperationInstruction(operationIndexes[operator.name])
            ];
        }

        if (node.type == "ConditionalExpression") {
            return [
                ...buildNode(node.test),
                ...buildNode(node.consequent),
                ...buildNode(node.alternate),
                makeOperationInstruction(operationIndexes[CONDITIONAL_OPERATOR])
            ];
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunctions[functionName].arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return [
                ...node.arguments.reduce(
                    (instructions, node) => [
                        ...instructions,
                        ...buildNode(node)
                    ],
                    []
                ),
                operationIndexes[functionName]
            ];
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = assets.rootProject.variables.enumMap.get(
                    node.object.name
                );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return [
                        makePushConstantInstruction(assets, enumMember.value)
                    ];
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return [
                        makePushConstantInstruction(
                            assets,
                            buildInConstantValue
                        )
                    ];
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            throw "Unsupported";
        }

        // TODO

        // if (node.type == "ArrayExpression") {
        // }

        // if (node.type == "ObjectExpression") {
        // }

        throw `Unknown expression node "${node.type}"`;
    }

    function isAssignableExpression(node: ExpressionTreeNode): boolean {
        if (node.type === "Identifier") {
            return true;
        }
        if (node.type === "ConditionalExpression") {
            return (
                isAssignableExpression(node.consequent) &&
                isAssignableExpression(node.alternate)
            );
        }
        return false;
    }

    console.log("BUILD ASSIGNABLE EXPRESSION", assets, component, expression);

    const tree: ExpressionTreeNode = expressionParser.parse(expression);
    if (tree.type == "ConditionalExpression") {
    } else if (tree.type == "Identifier") {
    }

    if (!isAssignableExpression(tree)) {
        throw `Expression is not assignable`;
    }

    const instructions = buildNode(tree);

    instructions.push(makeEndInstruction());

    instructions.forEach(instruction =>
        dataBuffer.writeUint16NonAligned(instruction)
    );
}

export function evalExpression(assets: Assets, expression: string) {
    function evalNode(node: ExpressionTreeNode): any {
        if (node.type == "Literal") {
            return node.value;
        }

        if (node.type == "Identifier") {
            throw `Can not evaulate during build`;
        }

        if (node.type == "BinaryExpression") {
            const operator = binaryOperators[node.operator];
            if (!operator) {
                throw `Unknown binary operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.left), evalNode(node.right));
        }

        if (node.type == "LogicalExpression") {
            const operator = logicalOperators[node.operator];
            if (!operator) {
                throw `Unknown logical operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.left), evalNode(node.right));
        }

        if (node.type == "UnaryExpression") {
            const operator = unaryOperators[node.operator];
            if (!operator) {
                throw `Unknown unary operator: ${node.operator}`;
            }

            return operator.eval(evalNode(node.argument));
        }

        if (node.type == "ConditionalExpression") {
            return evalNode(node.test)
                ? evalNode(node.consequent)
                : evalNode(node.alternate);
        }

        if (node.type == "CallExpression") {
            if (
                node.callee.type != "MemberExpression" ||
                node.callee.object.type != "Identifier" ||
                node.callee.property.type != "Identifier"
            ) {
                throw "Invalid call expression";
            }

            let functionName = `${node.callee.object.name}.${node.callee.property.name}`;

            const builtInFunction = builtInFunctions[functionName];
            if (builtInFunction == undefined) {
                throw `Unknown function '${functionName}'`;
            }

            const arity = builtInFunction.arity;

            if (node.arguments.length != arity) {
                throw `In function '${functionName}' call expected ${arity} arguments, but got ${node.arguments.length}`;
            }

            return builtInFunction.eval(...node.arguments.map(evalNode));
        }

        if (node.type == "MemberExpression") {
            if (
                node.object.type == "Identifier" &&
                node.property.type == "Identifier"
            ) {
                const enumDef = assets.rootProject.variables.enumMap.get(
                    node.object.name
                );
                if (enumDef) {
                    const enumMember = enumDef.membersMap.get(
                        node.property.name
                    );
                    if (!enumMember) {
                        throw `Member '${node.property.name}' does not exist in enum '${node.object.name}'`;
                    }
                    return enumMember.value;
                }

                const builtInConstantName = `${node.object.name}.${node.property.name}`;
                const buildInConstantValue =
                    builtInConstants[builtInConstantName];
                if (buildInConstantValue != undefined) {
                    return buildInConstantValue;
                }

                throw `Unknown constant '${builtInConstantName}'`;
            }

            throw "Unsupported";
        }

        // TODO:

        // if (node.type == "ArrayExpression") {
        // }

        // if (node.type == "ObjectExpression") {
        // }

        throw `Unknown expression node "${node.type}"`;
    }

    console.log("EVAL EXPRESSION", assets, expression);

    let value;
    if (expression == undefined) {
        value = undefined;
    } else if (typeof expression == "number") {
        value = expression;
    } else {
        const tree: ExpressionTreeNode = expressionParser.parse(expression);
        try {
            value = evalNode(tree);
        } catch (err) {
            console.error(err);
            value = null;
        }
    }

    return value;
}

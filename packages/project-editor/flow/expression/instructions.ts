import type { Assets } from "project-editor/build/assets";
import { ValueType } from "project-editor/features/variable/value-type";

const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_CONSTANT = 0 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_INPUT = 1 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_LOCAL_VAR = 2 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_GLOBAL_VAR = 3 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_PUSH_OUTPUT = 4 << 13;
const EXPR_EVAL_INSTRUCTION_ARRAY_ELEMENT = 5 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_OPERATION = 6 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_END = 7 << 13;
const EXPR_EVAL_INSTRUCTION_TYPE_END_WITH_DST_VALUE_TYPE =
    (7 << 13) | (1 << 12);

// Jumps for the short-circuit evaluation of ?:, && and ||. Each is followed by
// one word: a forward offset in words, counted from the word after it.
const EXPR_EVAL_INSTRUCTION_TYPE_JUMP = (7 << 13) | (1 << 11);
// always
const EXPR_EVAL_JUMP_KIND_ALWAYS = 0;
// pops the test of ?: and jumps over the consequent if it is false (an error
// jumps to the end, it is the result)
const EXPR_EVAL_JUMP_KIND_IF_FALSE = 1;
// a && b: a false or an error is the result, b is not evaluated
const EXPR_EVAL_JUMP_KIND_AND = 2;
// a || b: a true or an error is the result, b is not evaluated
const EXPR_EVAL_JUMP_KIND_OR = 3;

const MAX_JUMP_OFFSET = 0xffff;

export function makePushConstantInstruction(
    assets: Assets,
    value: any,
    valueType: ValueType
) {
    return (
        EXPR_EVAL_INSTRUCTION_TYPE_PUSH_CONSTANT |
        assets.getConstantIndex(value, valueType)
    );
}

export function makePushInputInstruction(inputIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_INPUT | inputIndex;
}

export function makePushOutputInstruction(outputIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_OUTPUT | outputIndex;
}

export function makePushLocalVariableInstruction(localVariableIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_LOCAL_VAR | localVariableIndex;
}

export function makePushGlobalVariableInstruction(globalVariableIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_PUSH_GLOBAL_VAR | globalVariableIndex;
}

export function makeArrayElementInstruction() {
    return EXPR_EVAL_INSTRUCTION_ARRAY_ELEMENT;
}

export function makeOperationInstruction(operationIndex: number) {
    return EXPR_EVAL_INSTRUCTION_TYPE_OPERATION | operationIndex;
}

function makeJump(kind: number, offset: number) {
    if (offset > MAX_JUMP_OFFSET) {
        throw "Expression is too long";
    }
    return [EXPR_EVAL_INSTRUCTION_TYPE_JUMP | kind, offset];
}

export function makeJumpInstruction(offset: number) {
    return makeJump(EXPR_EVAL_JUMP_KIND_ALWAYS, offset);
}

export function makeJumpIfFalseInstruction(offset: number) {
    return makeJump(EXPR_EVAL_JUMP_KIND_IF_FALSE, offset);
}

export function makeLogicalAndJumpInstruction(offset: number) {
    return makeJump(EXPR_EVAL_JUMP_KIND_AND, offset);
}

export function makeLogicalOrJumpInstruction(offset: number) {
    return makeJump(EXPR_EVAL_JUMP_KIND_OR, offset);
}

export function makeEndInstruction() {
    return EXPR_EVAL_INSTRUCTION_TYPE_END;
}

export function makeEndInstructionWithType(
    assets: Assets,
    valueType: ValueType
) {
    const valueTypeIndex = assets.getTypeIndex(valueType);

    return [
        EXPR_EVAL_INSTRUCTION_TYPE_END_WITH_DST_VALUE_TYPE,
        valueTypeIndex & 0xffff,
        valueTypeIndex >> 16
    ];
}

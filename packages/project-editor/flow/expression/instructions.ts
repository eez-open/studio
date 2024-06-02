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

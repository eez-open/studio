import type { DashboardComponentContext } from "project-editor/flow/runtime/wasm-worker";

////////////////////////////////////////////////////////////////////////////////

function EvalJSExprActionComponent_execute(context: DashboardComponentContext) {
    const expression = context.getStringParam(0);
    const expressionValues = context.getExpressionListParam(4);

    const values: any = {};
    for (let i = 0; i < expressionValues.length; i++) {
        const name = `_val${i}`;
        values[name] = expressionValues[i];
    }

    let result = eval(expression);

    context.propagateValue(1, result);
    context.propagateValueThroughSeqout();
}

////////////////////////////////////////////////////////////////////////////////

export const actionConmponentExecuteFunctions: {
    [name: string]: (context: DashboardComponentContext) => void;
} = {
    EvalJSExprActionComponent: EvalJSExprActionComponent_execute
};

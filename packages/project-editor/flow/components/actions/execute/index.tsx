import type { DashboardComponentContext } from "project-editor/flow/runtime/wasm-worker";
import pg from "pg";

////////////////////////////////////////////////////////////////////////////////

function EvalJSExprActionComponent_execute(context: DashboardComponentContext) {
    const expression = context.getStringParam(0);
    const expressionValues = context.getExpressionListParam(4);

    const values: any = {};
    for (let i = 0; i < expressionValues.length; i++) {
        const name = `_val${i}`;
        values[name] = expressionValues[i];
    }

    try {
        let result = eval(expression);

        context.propagateValue(1, result);
        context.propagateValueThroughSeqout();
    } catch (err) {
        context.throwError(err.toString());
    }
}

////////////////////////////////////////////////////////////////////////////////

function PostgresActionComponent_execute(context: DashboardComponentContext) {
    (async () => {
        const client = new pg.Client({
            host: "envox.hr",
            port: 5432,
            user: "martin",
            password: "klds9823msdf",
            database: "bb3_ate"
        });
        await client.connect();
        const res = await client.query("select * from modules");
        console.log(res);
    })();

    context.propagateValue(1, 42);
    context.propagateValueThroughSeqout();
}

////////////////////////////////////////////////////////////////////////////////

export const actionConmponentExecuteFunctions: {
    [name: string]: (context: DashboardComponentContext) => void;
} = {
    EvalJSExprActionComponent: EvalJSExprActionComponent_execute,
    "eez-flow-ext-postgres/Postgres": PostgresActionComponent_execute
};

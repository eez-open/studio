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

        context.propagateValue("result", result);
        context.propagateValueThroughSeqout();
    } catch (err) {
        console.info(
            "Error in EvalJSExprActionComponent_execute",
            err.toString()
        );
        context.throwError(err.toString());
    }
}

////////////////////////////////////////////////////////////////////////////////

interface PostgreSQLConnectionVariableTypeConstructorParams {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
}

function PostgresActionComponent_execute(context: DashboardComponentContext) {
    const connection =
        context.evalProperty<PostgreSQLConnectionVariableTypeConstructorParams>(
            0,
            ["object:eez-flow-ext-postgres/PostgreSQLConnection"]
        );

    if (!connection) {
        context.throwError(`Invalid PostgreSQL connection`);
        return;
    }

    const sql = context.evalProperty<string>(1, ["string"]);
    if (!sql) {
        context.throwError(`Invalid SQL`);
        return;
    }

    context = context.startAsyncExecution();

    (async () => {
        const config: pg.ClientConfig = {
            host: connection.host,
            port: connection.port,
            user: connection.user,
            password: connection.password,
            database: connection.database
        };

        if (connection.ssl) {
            config.ssl = {
                rejectUnauthorized: false
            };
        }

        try {
            const client = new pg.Client(config);
            await client.connect();
            const res = await client.query(sql);

            context.propagateValue("result", res?.rows ?? []);
            context.propagateValueThroughSeqout();
        } catch (err) {
            console.error(err);
            context.throwError(err.toString());
        }

        context.endAsyncExecution();
    })();
}

////////////////////////////////////////////////////////////////////////////////

export const actionConmponentExecuteFunctions: {
    [name: string]: (context: DashboardComponentContext) => void;
} = {
    EvalJSExprActionComponent: EvalJSExprActionComponent_execute,
    "eez-flow-ext-postgres/Postgres": PostgresActionComponent_execute
};

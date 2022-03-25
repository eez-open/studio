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

    // TODO:
    // startAsyncExecution

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
            const res = await client.query(
                "select * from modules where serial = '000000000000000000000079'"
            );
            console.log(res);

            let rows = res && res.rows;
            if (!rows) {
                rows = [];
            }
            console.log(rows);

            // TODO:
            //context.propagateValue(1, rows);
            //context.propagateValueThroughSeqout();
        } catch (err) {
            context.throwError(err.toString());
        }

        // TODO:
        // endAsyncExecution
    })();

    // TODO remove this
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

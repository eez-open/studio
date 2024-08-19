import { service } from "eez-studio-shared/service";

import { db } from "eez-studio-shared/db";

interface Params {
    query: string;
    args: any[];
}

interface Result {
    err: any;
    rows: any[];
}

export default service<Params, Result>(
    "db-services/query",
    async (inputParams: Params) => {
        try {
            const rows = db.prepare(inputParams.query).all(...inputParams.args);
            return {
                err: null,
                rows
            };
        } catch (err) {
            throw {
                err: err.toString(),
                inputParams
            };
        }
    }
);

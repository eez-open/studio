import dbQueryService from "db-services/query";

const LOG_ENABLED = false;

export function dbQuery(id: string, query: string) {
    return {
        all: async (...args: any[]): Promise<any[]> => {
            if (LOG_ENABLED) {
                console.time(id);
            }

            const { err, rows } = await dbQueryService({
                query,
                args
            });

            if (LOG_ENABLED) {
                console.log("query", id, { query, err, result: rows });
                console.timeEnd(id);
            }

            if (err) {
                throw err;
            } else {
                // for (const row of rows) {
                //     for (const key in row) {
                //         if (row.hasOwnProperty(key)) {
                //             const value = row[key];
                //             if (value && typeof value === "object") {
                //                 const low = row[key].low;
                //                 const high = row[key].high;
                //                 if (low !== undefined && high !== undefined) {
                //                     row[key] = Database.Integer.fromBits(
                //                         low,
                //                         high
                //                     );
                //                 }
                //             }
                //         }
                //     }
                // }

                return rows;
            }
        }
    };
}

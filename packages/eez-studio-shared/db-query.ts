import dbQueryService from "db-services/query";

export function dbQuery(id: string, query: string) {
    return {
        all: async (...args: any[]): Promise<any[]> => {
            //console.time(id);
            const { err, rows } = await dbQueryService({
                query,
                args
            });

            //console.log("query", id, { query, err, result: rows });
            //console.timeEnd(id);

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

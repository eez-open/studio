import Database from "better-sqlite3";

import dbQueryService from "db-services/query";

export function dbQuery(query: string) {
    return {
        all: async (...args: any[]): Promise<any[]> => {
            const { err, rows } = await dbQueryService({
                query,
                args
            });

            if (err) {
                throw err;
            } else {
                for (const row of rows) {
                    for (const key in row) {
                        if (row.hasOwnProperty(key)) {
                            const value = row[key];
                            if (value && typeof value === "object") {
                                const low = row[key].low;
                                const high = row[key].high;
                                if (low !== undefined && high !== undefined) {
                                    row[key] = Database.Integer.fromBits(
                                        low,
                                        high
                                    );
                                }
                            }
                        }
                    }
                }

                return rows;
            }
        }
    };
}

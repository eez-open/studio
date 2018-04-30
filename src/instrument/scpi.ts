import { filterFloat } from "shared/util";

export function parseScpiValue(data: string) {
    data = data.trim();

    let value = filterFloat(data);
    if (!isNaN(value)) {
        return value;
    }

    if (data.startsWith("**ERROR:")) {
        return {
            error: data
        };
    }

    return data;
}

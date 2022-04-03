import type { IDashboardComponentContext } from "eez-studio-types";

export const actionConmponentExecuteFunctions: {
    [name: string]: (context: IDashboardComponentContext) => void;
} = {};

export function registerExecuteFunction(
    name: string,
    func: (context: IDashboardComponentContext) => void
) {
    actionConmponentExecuteFunctions[name] = func;
}

import { DashboardComponentContext } from "./wasm-worker";

export const actionConmponentExecuteFunctions: {
    [name: string]: (context: DashboardComponentContext) => void;
} = {};

export function registerExecuteFunction(
    name: string,
    func: (context: DashboardComponentContext) => void
) {
    actionConmponentExecuteFunctions[name] = func;
}

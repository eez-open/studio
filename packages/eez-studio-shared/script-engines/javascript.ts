export async function run(code: string, globalModules: { [moduleName: string]: any }) {
    const moduleNames = Object.keys(globalModules);
    const args = moduleNames.join(", ");
    const factoryFnCode = `return async (${args}) => {
${code}
}`;
    const factoryFn = new Function(factoryFnCode);
    const fn = factoryFn();
    await fn(...moduleNames.map(moduleName => globalModules[moduleName]));
}

export async function run(code: string, globalModules: { [moduleName: string]: any }) {
    await globalModules.connection.acquire();
    globalModules.connection.command(code);
    globalModules.connection.release();
}

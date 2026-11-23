exports.initializeWasm = async function (createRuntime, name) {
    let timer;
    let runtime;
    try {
        await new Promise((resolve, reject) => {
            timer = setTimeout(
                () => reject(new Error(name + ' initialization timeout')),
                10000
            );
            runtime = createRuntime(message => {
                if (message.init) resolve();
            });
        });
        return runtime;
    } finally {
        clearTimeout(timer);
    }
};

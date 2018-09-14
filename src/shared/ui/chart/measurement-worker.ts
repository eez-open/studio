namespace MeasurementWorker {
    const { initValuesAccesor } = require("./buffer");

    onmessage = function(e: any) {
        if (!e.data) {
            (postMessage as any)(null);
            return;
        }

        if (e.data.inputs) {
            e.data.inputs.forEach((input: any) => {
                initValuesAccesor(input);
                input.getSampleValueAtIndex = input.value;
            });
        } else {
            initValuesAccesor(e.data);
            e.data.getSampleValueAtIndex = e.data.value;
        }

        const measureFunction = (require(e.data.measureFunctionScript) as any).default;
        try {
            measureFunction(e.data);
        } catch (error) {
            e.data.result = error.toString();
        }

        (postMessage as any)(e.data.result);
    };

    (postMessage as any)("ready");
}

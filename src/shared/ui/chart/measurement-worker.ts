namespace MeasurementWorker {
    const { initValuesAccesor } = require("./buffer");

    onmessage = function(e: any) {
        initValuesAccesor(e.data);
        e.data.getSampleValueAtIndex = e.data.value;

        const measureFunction = (require(e.data.measureFunctionScript) as any).default;
        measureFunction(e.data);

        (postMessage as any)(e.data.result);
    };

    (postMessage as any)("ready");
}

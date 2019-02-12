import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    if (task.inputs[0].samplingRate !== task.inputs[1].samplingRate) {
        task.result = "Different sampling rate!";
        return;
    }

    const result = new Array<number>(task.xNumSamples);

    for (let i = 0; i < task.xNumSamples; ++i) {
        result[i] =
            task.inputs[0].getSampleValueAtIndex(task.xStartIndex + i) -
            task.inputs[1].getSampleValueAtIndex(task.xStartIndex + i);
    }

    task.result = {
        data: result,
        samplingRate: task.inputs[0].samplingRate,
        xAxes: {
            unit: "time"
        },
        yAxes: {
            unit:
                task.inputs[0].valueUnit === task.inputs[1].valueUnit
                    ? task.inputs[0].valueUnit
                    : "unknown"
        }
    };
}

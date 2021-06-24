import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function (task: IMeasureTask) {
    if (task.inputs[0].samplingRate !== task.inputs[1].samplingRate) {
        task.result = "Different sampling rate!";
        return;
    }

    let result = 0;

    const xEndIndex = task.xStartIndex + task.xNumSamples;
    for (let i = task.xStartIndex; i < xEndIndex; ++i) {
        const volt = task.inputs[0].getSampleValueAtIndex(i);
        const curr = task.inputs[1].getSampleValueAtIndex(i);
        result += volt * curr;
    }

    task.result = result / task.xNumSamples;
}

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    let sum = 0;

    const xEndIndex = task.xStartIndex + task.xNumSamples;
    for (let i = task.xStartIndex; i < xEndIndex; ++i) {
        const sample = task.getSampleValueAtIndex(i);
        if (!isNaN(sample)) {
            sum += sample;
        }
    }

    task.result = sum / task.xNumSamples;
}

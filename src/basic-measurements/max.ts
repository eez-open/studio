import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    let result = Number.MIN_VALUE;

    const xEndIndex = task.xStartIndex + task.xNumSamples;
    for (let i = task.xStartIndex; i < xEndIndex; ++i) {
        const y = task.getSampleValueAtIndex(i);
        if (y > result) {
            result = y;
        }
    }

    task.result = result;
}

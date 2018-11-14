import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    let min = Number.MAX_VALUE;
    let max = Number.MIN_VALUE;

    const xEndIndex = task.xStartIndex + task.xNumSamples;
    for (let i = task.xStartIndex; i < xEndIndex; ++i) {
        const y = task.getSampleValueAtIndex(i);
        if (y < min) {
            min = y;
        }
        if (y > max) {
            max = y;
        }
    }

    task.result = max - min;
}

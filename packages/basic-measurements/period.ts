import { IMeasureTask } from "eez-studio-shared/extensions/extension";

import getFrequency from "./frequency";

export default function(task: IMeasureTask) {
    getFrequency(task);
    if (typeof task.result === "number") {
        task.result = 1 / task.result;
        task.resultUnit = "time";
    }
}

// SPDX-FileCopyrightText: 2023 EEZ Studio Contributors
//
// SPDX-License-Identifier: GPL-3.0-only

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

import getFrequency from "./frequency";

export default function(task: IMeasureTask) {
    getFrequency(task);
    if (typeof task.result === "number") {
        task.result = 1 / task.result;
        task.resultUnit = "time";
    }
}

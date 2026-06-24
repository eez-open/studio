// SPDX-FileCopyrightText: 2023 EEZ Studio Contributors
//
// SPDX-License-Identifier: GPL-3.0-only

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

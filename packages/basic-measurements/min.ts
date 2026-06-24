// SPDX-FileCopyrightText: 2023 EEZ Studio Contributors
//
// SPDX-License-Identifier: GPL-3.0-only

import { IMeasureTask } from "eez-studio-shared/extensions/extension";

export default function(task: IMeasureTask) {
    let result = Number.MAX_VALUE;

    const xEndIndex = task.xStartIndex + task.xNumSamples;
    for (let i = task.xStartIndex; i < xEndIndex; ++i) {
        const y = task.getSampleValueAtIndex(i);
        if (y < result) {
            result = y;
        }
    }

    task.result = result;
}

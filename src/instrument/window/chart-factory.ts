import { ChartsController, ChartMode } from "shared/ui/chart";

import { ChartsDisplayOption } from "instrument/window/lists/charts-view-options";
import { Waveform } from "instrument/window/waveform/generic";
import { MultiWaveform } from "instrument/window/waveform/multi";
import { DlogWaveform } from "instrument/window/waveform/dlog";
import { TableList } from "instrument/window/lists/table";
import { EnvelopeList } from "instrument/window/lists/envelope";

export type ChartData = EnvelopeList | TableList | Waveform | MultiWaveform | DlogWaveform;

export function createChartsController(
    chartData: ChartData,
    displayOption: ChartsDisplayOption,
    mode: ChartMode
): ChartsController {
    if (
        chartData instanceof Waveform ||
        chartData instanceof MultiWaveform ||
        chartData instanceof DlogWaveform
    ) {
        return chartData.createChartsController(mode);
    }

    return chartData.createChartsController(displayOption, mode);
}

import { RulersModel } from "eez-studio-shared/ui/chart/rulers";
import { MeasurementsModel } from "eez-studio-shared/ui/chart/measurements";
import { WaveformFormat } from "eez-studio-shared/ui/chart/buffer";

export interface WaveformModel {
    format: WaveformFormat;
    values: any;
    offset: number;
    scale: number;

    length: number;
    value: (index: number) => number;
    samplingRate: number;

    rulers: RulersModel;
    measurements: MeasurementsModel;
}

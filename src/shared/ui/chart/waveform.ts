import { RulersModel } from "shared/ui/chart/rulers";
import { MeasurementsModel } from "shared/ui/chart/measurements";
import { WaveformFormat } from "shared/ui/chart/buffer";

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

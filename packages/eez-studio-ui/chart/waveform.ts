import { RulersModel } from "eez-studio-ui/chart/rulers";
import { MeasurementsModel } from "eez-studio-ui/chart/measurements";
import { WaveformFormat } from "eez-studio-ui/chart/buffer";
import { UNITS } from "eez-studio-shared/units";
import type { IWaveformDlogParams } from "eez-studio-ui/chart/render";

export interface WaveformModel {
    format: WaveformFormat;
    values: any;
    offset:number;
    scale: number;

    dlog?: IWaveformDlogParams,

    length: number;
    value: (index: number) => number;

    samplingRate: number;
    valueUnit: keyof typeof UNITS;

    rulers?: RulersModel;
    measurements?: MeasurementsModel;
}

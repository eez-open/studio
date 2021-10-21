import { DataType } from "./DataType";

export interface IWaveformDlogParams {
    dataType: DataType;
    dataOffset: number;
    dataContainsSampleValidityBit: boolean;
    columnDataIndex: number;
    numBytesPerRow: number;
    bitMask: number;
    logOffset?: number;
    transformOffset: number;
    transformScale: number;
}

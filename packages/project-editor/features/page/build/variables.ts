import type {
    Assets,
    DataBuffer
} from "project-editor/features/page/build/assets";

export function buildVariableNames(assets: Assets, dataBuffer: DataBuffer) {
    dataBuffer.writeArray(
        assets.DocumentStore.masterProject ? assets.globalVariables : [],
        variable => {
            dataBuffer.writeString(variable.name);
        }
    );
}

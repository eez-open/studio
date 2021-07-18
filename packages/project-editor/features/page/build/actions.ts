import { Assets, DataBuffer } from "project-editor/features/page/build/assets";

export function buildActionNames(assets: Assets, dataBuffer: DataBuffer) {
    dataBuffer.writeArray(
        assets.DocumentStore.masterProject ? assets.actions : [],
        action => {
            dataBuffer.writeString(action.name);
        }
    );
}

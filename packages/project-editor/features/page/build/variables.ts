import {
    buildListData,
    DataBuffer,
    StringList,
    Struct,
    String
} from "project-editor/features/page/build/pack";
import { Assets } from "project-editor/features/page/build/assets";

export function buildVariableNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let variableNames = new StringList();
        if (assets.DocumentStore.masterProject) {
            for (let i = 0; i < assets.globalVariables.length; i++) {
                variableNames.addItem(
                    new String(assets.globalVariables[i].name)
                );
            }
        }
        document.addField(variableNames);
    }, dataBuffer);
}

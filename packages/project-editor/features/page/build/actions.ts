import {
    buildListData,
    DataBuffer,
    StringList,
    Struct,
    String
} from "project-editor/features/page/build/pack";
import { Assets } from "project-editor/features/page/build/assets";

export function buildActionNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let actionNames = new StringList();
        if (assets.DocumentStore.masterProject) {
            for (let i = 0; i < assets.actions.length; i++) {
                actionNames.addItem(new String(assets.actions[i].name));
            }
        }
        document.addField(actionNames);
    }, dataBuffer);
}

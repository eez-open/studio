import {
    buildListData,
    DataBuffer,
    StringList,
    Struct,
    String
} from "project-editor/features/page/build/pack";
import { Assets } from "project-editor/features/page/build/assets";

export function buildDataItemNames(assets: Assets, dataBuffer: DataBuffer) {
    return buildListData((document: Struct) => {
        let dataItemNames = new StringList();
        if (assets.DocumentStore.masterProject) {
            for (let i = 0; i < assets.dataItems.length; i++) {
                dataItemNames.addItem(new String(assets.dataItems[i].name));
            }
        }
        document.addField(dataItemNames);
    }, dataBuffer);
}

import { IListType, BaseListData } from "instrument/window/lists/store-renderer";

import { AppStore } from "instrument/window/app-store";

import { createEmptyTableListData, TableList, TableListData } from "instrument/window/lists/table";
import { createEmptyEnvelopeListData, EnvelopeList } from "instrument/window/lists/envelope";

////////////////////////////////////////////////////////////////////////////////

export function createEmptyListData(
    type: IListType,
    props: { duration: number; numSamples: number },
    appStore: AppStore
): BaseListData {
    if (type === "table") {
        return createEmptyTableListData();
    } else {
        return createEmptyEnvelopeListData(props, appStore);
    }
}

export function createTableListFromData(data: TableListData, appStore: AppStore) {
    return new TableList(
        {
            id: "",
            name: "",
            description: "",
            type: "table",
            data: data
        },
        appStore
    );
}

export function createListObject(props: any, appStore: AppStore) {
    if (props.type === "table") {
        return new TableList(props, appStore);
    } else {
        return new EnvelopeList(props, appStore);
    }
}

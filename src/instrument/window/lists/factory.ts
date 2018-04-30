import { IListType, BaseListData } from "instrument/window/lists/store-renderer";

import { createEmptyTableListData, TableList, TableListData } from "instrument/window/lists/table";
import { createEmptyEnvelopeListData, EnvelopeList } from "instrument/window/lists/envelope";

////////////////////////////////////////////////////////////////////////////////

export function createEmptyListData(
    type: IListType,
    props: { duration: number; numSamples: number }
): BaseListData {
    if (type === "table") {
        return createEmptyTableListData();
    } else {
        return createEmptyEnvelopeListData(props);
    }
}

export function createTableListFromData(data: TableListData) {
    return new TableList({
        id: "",
        name: "",
        description: "",
        type: "table",
        data: data
    });
}

export function createListObject(props: any) {
    if (props.type === "table") {
        return new TableList(props);
    } else {
        return new EnvelopeList(props);
    }
}

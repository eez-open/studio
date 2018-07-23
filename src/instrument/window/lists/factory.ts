import { IListType, BaseListData } from "instrument/window/lists/store-renderer";

import { InstrumentObject } from "instrument/instrument-object";

import { AppStore } from "instrument/window/app-store";

import { createEmptyTableListData, TableList, TableListData } from "instrument/window/lists/table";
import { createEmptyEnvelopeListData, EnvelopeList } from "instrument/window/lists/envelope";

////////////////////////////////////////////////////////////////////////////////

export function createEmptyListData(
    type: IListType,
    props: { duration: number; numSamples: number },
    instrument: InstrumentObject
): BaseListData {
    if (type === "table") {
        return createEmptyTableListData();
    } else {
        return createEmptyEnvelopeListData(props, instrument);
    }
}

export function createTableListFromData(
    data: TableListData,
    appStore: AppStore,
    instrument: InstrumentObject
) {
    return new TableList(
        {
            id: "",
            name: "",
            description: "",
            type: "table",
            data: data
        },
        appStore,
        instrument
    );
}

export function createListObject(props: any, appStore: AppStore, instrument: InstrumentObject) {
    if (props.type === "table") {
        return new TableList(props, appStore, instrument);
    } else {
        return new EnvelopeList(props, appStore, instrument);
    }
}

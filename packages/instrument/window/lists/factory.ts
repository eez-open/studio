import type {
    IListType,
    BaseListData
} from "instrument/window/lists/store-renderer";

import type { InstrumentObject } from "instrument/instrument-object";

import type { HistoryItem } from "instrument/window/history/item";

import {
    createEmptyTableListData,
    TableList,
    TableListData
} from "instrument/window/lists/table";
import {
    createEmptyEnvelopeListData,
    EnvelopeList
} from "instrument/window/lists/envelope";

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

export function createTableListFromData(data: TableListData) {
    return new TableList({
        id: "",
        name: "",
        description: "",
        type: "table",
        data: data
    });
}

export function createTableListFromHistoryItem(historyItem: HistoryItem) {
    const tableData: {
        dwell: number[];
        voltage: number[];
        current: number[];
    } = {
        dwell: [],
        voltage: [],
        current: []
    };

    const data: string = Buffer.from(historyItem.data).toString();

    for (const line of data.split("\n").map(line => line.trim())) {
        if (!line) {
            continue;
        }

        const values = line.split(",").map(value => value.trim());

        if (values[0] !== "=") {
            tableData.dwell.push(parseFloat(values[0]));
        }

        if (values[1] !== "=") {
            tableData.voltage.push(parseFloat(values[1]));
        }

        if (values[2] !== "=") {
            tableData.current.push(parseFloat(values[2]));
        }
    }

    return createTableListFromData(tableData as any);
}

export function createListObject(props: any) {
    if (props.type === "table") {
        return new TableList(props);
    } else {
        return new EnvelopeList(props);
    }
}

import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Loader } from "eez-studio-ui/loader";

import { List } from "instrument/bb3/objects/List";

export const ListActions = observer(({ list }: { list: List }) => {
    if (!list.bb3Instrument.instrument.isConnected) {
        return null;
    }

    if (list.busy) {
        return <Loader size={25} style={{ margin: "6px 12px" }} />;
    }

    return (
        <div className="text-nowrap">
            {list.canDownload && (
                <button
                    className={classNames("btn btn-sm", {
                        "btn-primary":
                            list.instrumentVersionNewer || !list.studioList,
                        "btn-secondary": !(
                            list.instrumentVersionNewer || !list.studioList
                        )
                    })}
                    onClick={list.download}
                    disabled={list.bb3Instrument.busy}
                    title="Download from Instrument"
                >
                    Dowload
                </button>
            )}
            {list.canUpload && (
                <button
                    className={classNames("btn btn-sm", {
                        "btn-primary":
                            list.studioVersionNewer || !list.listOnInstrument,
                        "btn-secondary": !(
                            list.studioVersionNewer || !list.listOnInstrument
                        )
                    })}
                    onClick={list.upload}
                    disabled={list.bb3Instrument.busy}
                    title="Upload to Instrument"
                >
                    Upload
                </button>
            )}
            {list.canUpload && (
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={list.edit}
                    disabled={false}
                    title="Edit list in Studio"
                >
                    Edit
                </button>
            )}
        </div>
    );
});

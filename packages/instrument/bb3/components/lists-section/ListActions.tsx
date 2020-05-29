import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Loader } from "eez-studio-ui/loader";

import { getConnection } from "instrument/window/connection";

import { List } from "instrument/bb3/objects/List";

export const ListActions = observer(({ list }: { list: List }) => {
    if (!getConnection(list.bb3Instrument.appStore).isConnected) {
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
                        "btn-primary": list.instrumentVersionNewer,
                        "btn-secondary": !list.instrumentVersionNewer
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
                        "btn-primary": list.studioVersionNewer,
                        "btn-secondary": !list.studioVersionNewer
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

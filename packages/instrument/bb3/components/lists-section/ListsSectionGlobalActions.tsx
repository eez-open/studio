import React from "react";
import { observer } from "mobx-react";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

export const ListsSectionGlobalActions = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (!bb3Instrument.instrument.isConnected) {
            return null;
        }

        if (bb3Instrument.busy) {
            return null;
        }

        return (
            <div className="EezStudio_BB3_ListsSectionGlobalActions">
                {bb3Instrument.canDownloadAllLists && (
                    <button
                        className="btn btn-sm btn-primary text-nowrap"
                        onClick={bb3Instrument.downloadAllLists}
                    >
                        Dowload All
                    </button>
                )}

                {bb3Instrument.canUploadAllLists && (
                    <button
                        className="btn btn-sm btn-primary text-nowrap"
                        onClick={bb3Instrument.uploadAllLists}
                    >
                        Upload All
                    </button>
                )}
            </div>
        );
    }
);

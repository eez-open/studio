import React from "react";
import { observer } from "mobx-react";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

export const ScriptsSectionGlobalActions = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (!bb3Instrument.instrument.isConnected) {
            return null;
        }

        if (!bb3Instrument.canInstallAllScripts || bb3Instrument.busy) {
            return null;
        }

        return (
            <button
                className="btn btn-sm btn-primary text-nowrap"
                onClick={bb3Instrument.installAllScripts}
            >
                Install All
            </button>
        );
    }
);

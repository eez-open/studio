import React from "react";
import { observer } from "mobx-react";

import { getConnection } from "instrument/window/connection";

import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

export const ScriptsSectionGlobalActions = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        if (!getConnection(instrumentOverview.appStore).isConnected) {
            return null;
        }

        if (!instrumentOverview.canInstallAllScripts) {
            return null;
        }

        return (
            <button
                className="btn btn-sm btn-primary"
                onClick={instrumentOverview.installAllScripts}
            >
                Install All
            </button>
        );
    }
);

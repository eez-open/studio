import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { Script } from "instrument/bb3/objects/Script";

export const ScriptActions = observer(({ script }: { script: Script }) => {
    if (!script.bb3Instrument.instrument.isConnected) {
        return null;
    }

    if (script.busy) {
        return <Loader size={25} style={{ margin: "6px 12px" }} />;
    }

    return (
        <div className="text-nowrap">
            {script.canInstall && (
                <button
                    className="btn btn-sm btn-primary"
                    onClick={script.install}
                    disabled={script.bb3Instrument.busy}
                >
                    Install
                </button>
            )}
            {script.canUninstall && (
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={script.uninstall}
                    disabled={script.bb3Instrument.busy}
                >
                    Uninstall
                </button>
            )}
            {script.canUpdate && (
                <button
                    className="btn btn-sm btn-primary"
                    onClick={script.update}
                    disabled={script.bb3Instrument.busy}
                >
                    Update
                </button>
            )}
            {script.canReplace && (
                <button
                    className="btn btn-sm btn-primary"
                    onClick={script.replace}
                    disabled={script.bb3Instrument.busy}
                >
                    Replace
                </button>
            )}
        </div>
    );
});

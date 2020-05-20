import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { getConnection } from "instrument/window/connection";

import { Script } from "instrument/bb3/objects/Script";

export const ScriptActions = observer(({ script }: { script: Script }) => {
    if (!getConnection(script.instrumentOverview.appStore).isConnected) {
        return null;
    }

    if (script.busy) {
        return <Loader size={25} style={{ margin: "6px 12px" }} />;
    }

    return (
        <div>
            {script.canInstall && (
                <button
                    className="btn btn-sm btn-success"
                    onClick={script.install}
                    disabled={script.instrumentOverview.installAllScriptsInProgress}
                >
                    Install
                </button>
            )}
            {script.canUninstall && (
                <button
                    className="btn btn-sm btn-danger"
                    onClick={script.uninstall}
                    disabled={script.instrumentOverview.installAllScriptsInProgress}
                >
                    Uninstall
                </button>
            )}
            {script.canUpdate && (
                <button
                    className="btn btn-sm btn-success"
                    onClick={script.update}
                    disabled={script.instrumentOverview.installAllScriptsInProgress}
                >
                    Update
                </button>
            )}
            {script.canReplace && (
                <button
                    className="btn btn-sm btn-success"
                    onClick={script.replace}
                    disabled={script.instrumentOverview.installAllScriptsInProgress}
                >
                    Replace
                </button>
            )}
        </div>
    );
});

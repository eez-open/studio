import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";

import { Script } from "/script";

export const SelectScriptVersion = observer(({ script }: { script: Script }) => {
    if (!script.versions) {
        return null;
    }

    return (
        <div>
            <label>Version:</label>
            <label style={{ paddingLeft: 15 }} className="form-check-label">
                <select
                    className="form-control form-control-sm"
                    value={script.selectedVersion}
                    onChange={action((event: React.ChangeEvent<HTMLSelectElement>) => {
                        script.selectedVersion = event.currentTarget.value as any;
                    })}
                >
                    {script.versions.map(version => (
                        <option key={version.version} value={version.version}>
                            {version.version}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
});

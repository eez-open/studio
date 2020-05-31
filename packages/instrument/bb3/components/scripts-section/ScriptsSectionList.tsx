import React from "react";
import { observer } from "mobx-react";

import { Script } from "instrument/bb3/objects/Script";
import { ScriptsSectionListItem } from "instrument/bb3/components/scripts-section/ScriptsSectionListItem";

export const ScriptsSectionList = observer(({ scripts }: { scripts: Script[] }) => {
    if (scripts.length == 0) {
        return null;
    }

    return (
        <div className="list-group">
            {scripts.map(script => (
                <ScriptsSectionListItem key={script.name} script={script} />
            ))}
        </div>
    );
});

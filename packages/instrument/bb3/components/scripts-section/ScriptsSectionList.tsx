import React from "react";
import { observer } from "mobx-react";

import { stringCompare } from "eez-studio-shared/string";

import { Script } from "instrument/bb3/objects/Script";
import { ScriptsSectionListItem } from "instrument/bb3/components/scripts-section/ScriptsSectionListItem";

export const ScriptsSectionList = observer(({ scripts }: { scripts: Script[] }) => {
    if (scripts.length == 0) {
        return null;
    }

    return (
        <div className="list-group">
            {scripts
                .slice()
                .sort((a, b) => stringCompare(a.name, b.name))
                .map(script => (
                    <ScriptsSectionListItem key={script.name} script={script} />
                ))}
        </div>
    );
});

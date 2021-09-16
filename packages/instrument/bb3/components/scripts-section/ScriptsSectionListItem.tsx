import React from "react";
import { observer } from "mobx-react";

import { Script } from "instrument/bb3/objects/Script";

import { SelectScriptVersion } from "instrument/bb3/components/scripts-section/SelectScriptVersion";
import { ScriptActions } from "instrument/bb3/components/scripts-section/ScriptActions";

export const ScriptsSectionListItem = observer(
    ({ script }: { script: Script }) => {
        return (
            <div className="list-group-item">
                <div className="EezStudio_BB3_TitleContainer">
                    <div className="font-weight-bold">{script.name}</div>
                    <SelectScriptVersion script={script} />
                </div>
                <div className="EezStudio_BB3_ContentContainer">
                    <div>{script.description}</div>
                    <ScriptActions script={script} />
                </div>
            </div>
        );
    }
);

import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";

import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

export const ScriptsSectionSelectView = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        if (instrumentOverview.allScriptsCollection.length == 0) {
            return null;
        }

        return (
            <label className="form-check-label">
                <select
                    className="form-control form-control-sm"
                    value={instrumentOverview.selectedScriptsCollectionType}
                    onChange={action((event: React.ChangeEvent<HTMLSelectElement>) => {
                        instrumentOverview.selectedScriptsCollectionType = event.currentTarget
                            .value as any;
                    })}
                >
                    <option value="allScriptsCollection">
                        All scripts ({instrumentOverview.allScriptsCollection.length})
                    </option>
                    {instrumentOverview.catalogScriptsCollection.length > 0 && (
                        <option value="catalogScriptsCollection">
                            Scripts from catalog (
                            {instrumentOverview.catalogScriptsCollection.length})
                        </option>
                    )}
                    {instrumentOverview.instrumentScriptsCollection.length > 0 && (
                        <option value="instrumentScriptsCollection">
                            Scripts on instrument (
                            {instrumentOverview.instrumentScriptsCollection.length})
                        </option>
                    )}
                    {instrumentOverview.notInstalledCatalogScriptsCollection.length > 0 && (
                        <option value="notInstalledCatalogScriptsCollection">
                            Not installed scripts from catalog (
                            {instrumentOverview.notInstalledCatalogScriptsCollection.length})
                        </option>
                    )}
                    {instrumentOverview.installedCatalogScriptsCollection.length > 0 && (
                        <option value="installedCatalogScriptsCollection">
                            Installed scripts from catalog (
                            {instrumentOverview.installedCatalogScriptsCollection.length})
                        </option>
                    )}
                    {instrumentOverview.instrumentScriptsNotInCatalogCollection.length > 0 && (
                        <option value="instrumentScriptsNotInCatalogCollection">
                            Scripts on instrument but not from catalog (
                            {instrumentOverview.instrumentScriptsNotInCatalogCollection.length})
                        </option>
                    )}
                </select>
            </label>
        );
    }
);

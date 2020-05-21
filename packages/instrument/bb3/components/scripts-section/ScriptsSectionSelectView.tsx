import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

export const ScriptsSectionSelectView = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (bb3Instrument.allScriptsCollection.length == 0) {
            return null;
        }

        return (
            <label className="form-check-label">
                <select
                    className="form-control form-control-sm"
                    value={bb3Instrument.selectedScriptsCollectionType}
                    onChange={action((event: React.ChangeEvent<HTMLSelectElement>) => {
                        bb3Instrument.selectedScriptsCollectionType = event.currentTarget
                            .value as any;
                    })}
                >
                    <option value="allScriptsCollection">
                        All scripts ({bb3Instrument.allScriptsCollection.length})
                    </option>
                    {bb3Instrument.catalogScriptsCollection.length > 0 && (
                        <option value="catalogScriptsCollection">
                            Scripts from catalog ({bb3Instrument.catalogScriptsCollection.length})
                        </option>
                    )}
                    {bb3Instrument.instrumentScriptsCollection.length > 0 && (
                        <option value="instrumentScriptsCollection">
                            Scripts on instrument (
                            {bb3Instrument.instrumentScriptsCollection.length})
                        </option>
                    )}
                    {bb3Instrument.notInstalledCatalogScriptsCollection.length > 0 && (
                        <option value="notInstalledCatalogScriptsCollection">
                            Not installed scripts from catalog (
                            {bb3Instrument.notInstalledCatalogScriptsCollection.length})
                        </option>
                    )}
                    {bb3Instrument.installedCatalogScriptsCollection.length > 0 && (
                        <option value="installedCatalogScriptsCollection">
                            Installed scripts from catalog (
                            {bb3Instrument.installedCatalogScriptsCollection.length})
                        </option>
                    )}
                    {bb3Instrument.instrumentScriptsNotInCatalogCollection.length > 0 && (
                        <option value="instrumentScriptsNotInCatalogCollection">
                            Scripts on instrument but not from catalog (
                            {bb3Instrument.instrumentScriptsNotInCatalogCollection.length})
                        </option>
                    )}
                </select>
            </label>
        );
    }
);

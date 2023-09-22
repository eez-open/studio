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
                    className="form-select form-control-sm"
                    value={bb3Instrument.selectedScriptsCollectionType}
                    onChange={action(
                        (event: React.ChangeEvent<HTMLSelectElement>) => {
                            bb3Instrument.selectedScriptsCollectionType = event
                                .currentTarget.value as any;
                        }
                    )}
                >
                    <option value="allScriptsCollection">
                        All ({bb3Instrument.allScriptsCollection.length})
                    </option>
                    {bb3Instrument.catalogScriptsCollection.length > 0 && (
                        <option value="catalogScriptsCollection">
                            From catalog (
                            {bb3Instrument.catalogScriptsCollection.length})
                        </option>
                    )}
                    {bb3Instrument.instrumentScriptsCollection.length > 0 && (
                        <option value="instrumentScriptsCollection">
                            On instrument (
                            {bb3Instrument.instrumentScriptsCollection.length})
                        </option>
                    )}
                    {bb3Instrument.notInstalledCatalogScriptsCollection.length >
                        0 && (
                        <option value="notInstalledCatalogScriptsCollection">
                            Not installed from catalog (
                            {
                                bb3Instrument
                                    .notInstalledCatalogScriptsCollection.length
                            }
                            )
                        </option>
                    )}
                    {bb3Instrument.installedCatalogScriptsCollection.length >
                        0 && (
                        <option value="installedCatalogScriptsCollection">
                            Installed from catalog (
                            {
                                bb3Instrument.installedCatalogScriptsCollection
                                    .length
                            }
                            )
                        </option>
                    )}
                    {bb3Instrument.instrumentScriptsNotInCatalogCollection
                        .length > 0 && (
                        <option value="instrumentScriptsNotInCatalogCollection">
                            On instrument but not from catalog (
                            {
                                bb3Instrument
                                    .instrumentScriptsNotInCatalogCollection
                                    .length
                            }
                            )
                        </option>
                    )}
                </select>
            </label>
        );
    }
);

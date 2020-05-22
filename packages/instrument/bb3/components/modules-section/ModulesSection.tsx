import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";
import { ModuleItem } from "instrument/bb3/components/modules-section/ModuleItem";

export const ModulesSection = observer(({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
    let body;

    if (bb3Instrument.refreshInProgress) {
        body = <Loader />;
    } else if (bb3Instrument.modules) {
        body = (
            <table className="table">
                <thead>
                    <tr>
                        <th>Slot #</th>
                        <th>Model</th>
                        <th>Revision</th>
                        <th>Firmware</th>
                        <th>All Firmware releases</th>
                    </tr>
                </thead>
                <tbody>
                    {bb3Instrument.modules.map(module => (
                        <ModuleItem key={module.slotIndex} module={module} />
                    ))}
                </tbody>
            </table>
        );
    } else {
        body = (
            <div className="alert alert-danger" role="alert">
                Failed to get modules info from the instrument!
            </div>
        );
    }

    return <Section title="Modules" body={body} />;
});

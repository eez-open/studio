import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";

export const ModulesSection = observer(({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
    return (
        <Section
            title="Modules"
            body={
                bb3Instrument.refreshInProgress ? (
                    <Loader />
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Slot #</th>
                                <th>Model</th>
                                <th>Version</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bb3Instrument.slots.map((slot, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{slot ? slot.model : "None"}</td>
                                    <td>{slot ? slot.version : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
            }
        />
    );
});

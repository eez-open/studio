import React from "react";
import { observer } from "mobx-react";

import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

export const ModulesSection = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        return (
            <section>
                <header>
                    <h5>Modules</h5>
                </header>
                <div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Slot #</th>
                                <th>Model</th>
                                <th>Version</th>
                            </tr>
                        </thead>
                        <tbody>
                            {instrumentOverview.slots.map((slot, i) => (
                                <tr key={i}>
                                    <td>{i + 1}</td>
                                    <td>{slot ? slot.model : "None"}</td>
                                    <td>{slot ? slot.version : "-"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    }
);

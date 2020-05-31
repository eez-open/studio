import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { Section } from "instrument/bb3/components/Section";
//import { ScriptsSectionSelectView } from "instrument/bb3/components/scripts-section/ScriptsSectionSelectView";
import { ScriptsSectionGlobalActions } from "instrument/bb3/components/scripts-section/ScriptsSectionGlobalActions";
import { ScriptsSectionList } from "instrument/bb3/components/scripts-section/ScriptsSectionList";

export const ScriptsSection = observer(({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
    return (
        <Section
            title="MicroPython Scripts"
            titleControls={
                bb3Instrument.refreshInProgress ? null : (
                    <>
                        {/*<ScriptsSectionSelectView bb3Instrument={bb3Instrument} />*/}
                        <ScriptsSectionGlobalActions bb3Instrument={bb3Instrument} />
                    </>
                )
            }
            body={
                bb3Instrument.refreshInProgress ? (
                    <Loader />
                ) : (
                    <>
                        {bb3Instrument.scriptsOnInstrumentFetchError && (
                            <div className="alert alert-danger" role="alert">
                                Failed to get info about scripts on the instruments!
                            </div>
                        )}
                        <ScriptsSectionList scripts={bb3Instrument.allScriptsCollection} />
                    </>
                )
            }
        />
    );
});

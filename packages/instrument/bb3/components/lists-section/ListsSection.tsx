import React from "react";
import { observer } from "mobx-react";

import { Loader } from "eez-studio-ui/loader";

import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { Section } from "instrument/bb3/components/Section";
import { ListsSectionGlobalActions } from "instrument/bb3/components/lists-section/ListsSectionGlobalActions";
import { ListsSectionList } from "instrument/bb3/components/lists-section/ListsSectionList";

export const ListsSection = observer(({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
    return (
        <Section
            title="Lists"
            titleControls={
                bb3Instrument.refreshInProgress ? null : (
                    <ListsSectionGlobalActions bb3Instrument={bb3Instrument} />
                )
            }
            body={
                bb3Instrument.refreshInProgress ? (
                    <Loader />
                ) : (
                    <>
                        {bb3Instrument.listsOnInstrumentFetchError && (
                            <div className="alert alert-danger" role="alert">
                                Failed to get info about lists on the instruments!
                            </div>
                        )}
                        {bb3Instrument.lists && (
                            <ListsSectionList lists={bb3Instrument.sortedLists} />
                        )}
                    </>
                )
            }
        />
    );
});

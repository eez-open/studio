import React from "react";

import { ButtonAction } from "eez-studio-ui/action";

import { InstrumentAppStore } from "instrument/window/app-store";

import {
    scriptsCatalog,
    bb3InstrumentsMap
} from "instrument/bb3/global-objects";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { StartPage } from "instrument/bb3/components/StartPage";

export function getBB3Instrument(
    appStore: InstrumentAppStore,
    create: boolean
) {
    if (!appStore.instrument) {
        return undefined;
    }
    let bb3Instrument = bb3InstrumentsMap.get(appStore.instrument.id);
    if (!bb3Instrument && create) {
        bb3Instrument = new BB3Instrument(
            scriptsCatalog,
            appStore,
            appStore.instrument
        );
        bb3InstrumentsMap.set(appStore.instrument.id, bb3Instrument);
    }
    return bb3Instrument;
}

export function render(appStore: InstrumentAppStore) {
    const bb3Instrument = getBB3Instrument(appStore, true);

    if (!bb3Instrument) {
        return <div />;
    }

    return <StartPage appStore={appStore} bb3Instrument={bb3Instrument} />;
}

export function toolbarButtonsRender(appStore: InstrumentAppStore) {
    if (!appStore.instrument) {
        return <div />;
    }

    return (
        <React.Fragment>
            {appStore.instrument.connection.isConnected && (
                <ButtonAction
                    text="Refresh"
                    icon="material:refresh"
                    className="btn-secondary"
                    title="Refresh"
                    onClick={() => {
                        const bb3Instrument = getBB3Instrument(appStore, true);
                        if (bb3Instrument) {
                            bb3Instrument.refresh(true);
                        }
                    }}
                />
            )}
        </React.Fragment>
    );
}

import React from "react";

import { ButtonAction } from "eez-studio-ui/action";

import { InstrumentAppStore } from "instrument/window/app-store";

import { scriptsCatalog, instrumentOverviewsMap } from "instrument/bb3/global-objects";
import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";
import { Overview } from "instrument/bb3/components/Overview";

function getInstrumentOverview(appStore: InstrumentAppStore) {
    if (!appStore.instrument) {
        return undefined;
    }
    let instrumentOverview = instrumentOverviewsMap.get(appStore.instrument.id);
    if (!instrumentOverview) {
        instrumentOverview = new InstrumentOverview(scriptsCatalog, appStore, appStore.instrument);
        instrumentOverviewsMap.set(appStore.instrument.id, instrumentOverview);
    }
    return instrumentOverview;
}

export function render(appStore: InstrumentAppStore) {
    const instrumentOverview = getInstrumentOverview(appStore);

    if (!instrumentOverview) {
        return <div />;
    }

    return <Overview appStore={appStore} instrumentOverview={instrumentOverview} />;
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
                        const instrumentOverview = getInstrumentOverview(appStore);
                        if (instrumentOverview) {
                            instrumentOverview.refresh();
                        }
                    }}
                />
            )}
        </React.Fragment>
    );
}

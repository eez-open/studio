import React from "react";
import { observer } from "mobx-react";

import { compareVersions } from "eez-studio-shared/util";

import { InstrumentAppStore } from "instrument/window/app-store";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";

import { FirmwareVersionSection } from "instrument/bb3/components/FirmwareVersionSection";
import { ShortcutsSection } from "instrument/bb3/components/ShortcutsSection";
import { ModulesSection } from "instrument/bb3/components/modules-section/ModulesSection";
import { ScriptsSection } from "instrument/bb3/components/scripts-section/ScriptsSection";
import { ListsSection } from "instrument/bb3/components/lists-section/ListsSection";
import { LatestHistoryItemSection } from "instrument/bb3/components/LatestHistoryItemSection";

export const StartPage = observer(
    ({
        appStore,
        bb3Instrument
    }: {
        appStore: InstrumentAppStore;
        bb3Instrument: BB3Instrument;
    }) => {
        const isConnected = bb3Instrument.instrument.isConnected;

        if (!bb3Instrument.timeOfLastRefresh) {
            return null;
        }

        return (
            <div className="EezStudio_BB3_StartPageContainer">
                <div>
                    {isConnected && <ShortcutsSection appStore={appStore} />}
                    <LatestHistoryItemSection bb3Instrument={bb3Instrument} />
                    {bb3Instrument.mcu.firmwareVersion && (
                        <FirmwareVersionSection bb3Instrument={bb3Instrument} />
                    )}
                    {bb3Instrument.mcu.firmwareVersion &&
                        compareVersions(
                            bb3Instrument.mcu.firmwareVersion,
                            "1.0"
                        ) > 0 && (
                            <ModulesSection
                                bb3Instrument={bb3Instrument}
                                appStore={appStore}
                            />
                        )}
                </div>
                <div>
                    {isConnected && (
                        <ScriptsSection bb3Instrument={bb3Instrument} />
                    )}
                    {isConnected && (
                        <ListsSection bb3Instrument={bb3Instrument} />
                    )}
                </div>
            </div>
        );
    }
);

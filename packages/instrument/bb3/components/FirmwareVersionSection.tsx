import React from "react";
import { observer } from "mobx-react";

import { compareVersions } from "eez-studio-shared/util";
import { FIRMWARE_RELEASES_PAGE, FIRMWARE_UPGRADE_PAGE } from "instrument/bb3/conf";
import { openLink } from "instrument/bb3/helpers";
import { InstrumentOverview } from "instrument/bb3/objects/InstrumentOverview";

export const ReleaseInfo = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        if (!instrumentOverview.mcu.firmwareVersion) {
            return null;
        }

        if (!instrumentOverview.latestFirmwareVersion) {
            return (
                <div className="alert alert-danger" role="alert">
                    Could not get info about the latest firmware version!
                </div>
            );
        }

        if (
            compareVersions(
                instrumentOverview.latestFirmwareVersion,
                instrumentOverview.mcu.firmwareVersion
            ) > 1
        ) {
            return (
                <div className="alert alert-primary" role="alert">
                    There is{" "}
                    <a href="#" onClick={() => openLink(FIRMWARE_RELEASES_PAGE)}>
                        a newer firmware version!
                    </a>
                    . Follow{" "}
                    <a href="#" onClick={() => openLink(FIRMWARE_UPGRADE_PAGE)}>
                        this instructions
                    </a>{" "}
                    how to install it.
                </div>
            );
        }

        return (
            <div className="alert alert-secondary" role="alert">
                This is the latest firmware version!
            </div>
        );
    }
);

export const FirmwareVersionSection = observer(
    ({ instrumentOverview }: { instrumentOverview: InstrumentOverview }) => {
        return (
            <section>
                <header>
                    <h5>Firmware version</h5>
                </header>
                <div className="p-4">
                    <h5>{instrumentOverview.mcu.firmwareVersion}</h5>
                    <ReleaseInfo instrumentOverview={instrumentOverview} />
                </div>
            </section>
        );
    }
);

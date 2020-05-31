import React from "react";
import { observer } from "mobx-react";

import { compareVersions } from "eez-studio-shared/util";
import { Loader } from "eez-studio-ui/loader";

import { FIRMWARE_RELEASES_PAGE, FIRMWARE_UPGRADE_PAGE } from "instrument/bb3/conf";
import { openLink } from "instrument/bb3/helpers";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";

export const ReleaseInfo = observer(({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
    if (bb3Instrument.refreshInProgress) {
        return <Loader />;
    }

    if (bb3Instrument.mcu.firmwareVersion == undefined) {
        return (
            <div className="alert alert-danger border border mb-0" role="alert">
                Failed to get info about the latest firmware version!
            </div>
        );
    }

    if (!bb3Instrument.mcu.firmwareVersion) {
        return null;
    }

    if (!bb3Instrument.mcu.latestFirmwareVersion) {
        return (
            <div className="alert alert-danger border mb-0" role="alert">
                Could not get info about the latest firmware version!
            </div>
        );
    }

    if (
        compareVersions(
            bb3Instrument.mcu.latestFirmwareVersion,
            bb3Instrument.mcu.firmwareVersion
        ) > 1
    ) {
        return (
            <div className="alert alert-primary border mb-0" role="alert">
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
        <div className="alert alert-light border border mb-0" role="alert">
            This is the latest firmware version!
        </div>
    );
});

export const FirmwareVersionSection = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        return (
            <Section
                title={`Firmware version ${bb3Instrument.mcu.firmwareVersion || ""}`}
                body={<ReleaseInfo bb3Instrument={bb3Instrument} />}
            />
        );
    }
);

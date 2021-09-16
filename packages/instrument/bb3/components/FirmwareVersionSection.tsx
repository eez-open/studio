import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { compareVersions } from "eez-studio-shared/util";
import { Loader } from "eez-studio-ui/loader";

import {
    FIRMWARE_RELEASES_PAGE,
    FIRMWARE_UPGRADE_PAGE
} from "instrument/bb3/conf";
import { openLink } from "instrument/bb3/helpers";
import { BB3Instrument } from "instrument/bb3/objects/BB3Instrument";
import { Section } from "instrument/bb3/components/Section";
import { DropdownIconAction, DropdownItem } from "eez-studio-ui/action";

const OtherReleases = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (!bb3Instrument.mcu.allReleases) {
            return null;
        }

        if (
            !bb3Instrument.mcu.firmwareVersion ||
            compareVersions(bb3Instrument.mcu.firmwareVersion, "1.7.1") < 0
        ) {
            return null;
        }

        const otherReleases = bb3Instrument.mcu.allReleases
            .sort((a, b) => compareVersions(b.tag_name, a.tag_name))
            .filter(
                release =>
                    compareVersions(release.tag_name, "1.7.1") >= 0 &&
                    release.tag_name !=
                        bb3Instrument.mcu.latestFirmwareVersion &&
                    release.tag_name != bb3Instrument.mcu.firmwareVersion
            );

        if (otherReleases.length == 0) {
            return null;
        }

        return (
            <div className="EezStudio_OtherReleases">
                <p>
                    <a
                        className="btn btn-light"
                        data-bs-toggle="collapse"
                        href="#allMasterReleases"
                        role="button"
                        aria-expanded="false"
                        aria-controls="allMasterReleases"
                    >
                        Other versions{" "}
                        <i className="material-icons chevron-right">
                            chevron_right
                        </i>
                    </a>
                </p>
                <div className="collapse" id="allMasterReleases">
                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th scope="col">Version</th>
                                <th scope="col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {otherReleases.map(release => (
                                <tr>
                                    <td>{release.tag_name}</td>
                                    <td>
                                        <button
                                            className={classNames(
                                                "btn",
                                                compareVersions(
                                                    release.tag_name,
                                                    bb3Instrument.mcu
                                                        .firmwareVersion!
                                                ) > 0
                                                    ? "btn-primary"
                                                    : "btn-danger"
                                            )}
                                            style={{ marginLeft: 20 }}
                                            disabled={bb3Instrument.busy}
                                            onClick={() =>
                                                bb3Instrument.upgradeMasterFirmwareToVersion(
                                                    release.tag_name
                                                )
                                            }
                                        >
                                            {compareVersions(
                                                release.tag_name,
                                                bb3Instrument.mcu
                                                    .firmwareVersion!
                                            ) > 0
                                                ? "Upgrade"
                                                : "Downgrade"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
);

export const ReleaseInfo = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        if (bb3Instrument.refreshInProgress) {
            return <Loader />;
        }

        const firmwareVersion = bb3Instrument.mcu.firmwareVersion;

        if (firmwareVersion == undefined) {
            return (
                <div
                    className="alert alert-danger border border mb-0"
                    role="alert"
                >
                    Failed to get info about the latest firmware version!
                </div>
            );
        }

        if (!firmwareVersion) {
            return null;
        }

        const latestFirmwareVersion = bb3Instrument.mcu.latestFirmwareVersion;

        if (!latestFirmwareVersion) {
            return (
                <div className="alert alert-danger border mb-0" role="alert">
                    Could not get info about the latest firmware version!
                </div>
            );
        }

        if (compareVersions(latestFirmwareVersion, firmwareVersion) > 0) {
            return (
                <>
                    <div className="d-flex align-items-center fs-5">
                        <span className="badge rounded-pill bg-warning text-dark fs-5 me-3">
                            New release!
                        </span>
                        <span>
                            A new firmware version{" "}
                            <b>{latestFirmwareVersion}</b> is available (
                            <a
                                href="#"
                                onClick={() =>
                                    openLink(
                                        FIRMWARE_RELEASES_PAGE +
                                            "/tag/" +
                                            latestFirmwareVersion
                                    )
                                }
                            >
                                release notes
                            </a>
                            ).
                            {compareVersions(firmwareVersion, "1.7.1") < 0 && (
                                <span>
                                    {" "}
                                    Follow{" "}
                                    <a
                                        href="#"
                                        onClick={() =>
                                            openLink(FIRMWARE_UPGRADE_PAGE)
                                        }
                                    >
                                        this instructions
                                    </a>{" "}
                                    how to install it.
                                </span>
                            )}
                        </span>
                        {compareVersions(firmwareVersion, "1.7.1") >= 0 && (
                            <button
                                className="btn btn-primary btn-lg"
                                style={{ marginLeft: 20 }}
                                disabled={bb3Instrument.busy}
                                onClick={() =>
                                    bb3Instrument.upgradeMasterFirmwareToVersion(
                                        latestFirmwareVersion
                                    )
                                }
                            >
                                Upgrade
                            </button>
                        )}
                    </div>
                    <OtherReleases bb3Instrument={bb3Instrument} />
                </>
            );
        }

        return (
            <>
                <div className="text-success fs-5">
                    This is the latest firmware version!
                </div>
                <OtherReleases bb3Instrument={bb3Instrument} />
            </>
        );
    }
);

export const FirmwareVersionSection = observer(
    ({ bb3Instrument }: { bb3Instrument: BB3Instrument }) => {
        const isConnected = bb3Instrument.appStore.instrument?.isConnected;
        return (
            <Section
                title={`Firmware version ${
                    bb3Instrument.mcu.firmwareVersion || ""
                }`}
                body={
                    isConnected &&
                    (bb3Instrument.isUploadingMasterFirmware ? (
                        <Loader />
                    ) : (
                        <ReleaseInfo bb3Instrument={bb3Instrument} />
                    ))
                }
                titleControls={
                    !bb3Instrument.busy &&
                    isConnected && (
                        <DropdownIconAction
                            key="bb3-instrument/upgrade-firmware-with-local-file"
                            icon="material:more_vert"
                            iconSize={16}
                            title="Load firmware from the file on the local disk"
                        >
                            <DropdownItem
                                text="Load firmware ..."
                                onClick={
                                    bb3Instrument.upgradeMasterFirmwareWithLocalFile
                                }
                            />
                        </DropdownIconAction>
                    )
                }
            />
        );
    }
);

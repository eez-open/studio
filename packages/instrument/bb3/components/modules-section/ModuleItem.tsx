import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { compareVersions } from "eez-studio-shared/util";
import { Loader } from "eez-studio-ui/loader";

import { Module } from "instrument/bb3/objects/Module";
import { openLink } from "instrument/bb3/helpers";
import { MODULE_FIRMWARE_RELEASES_PAGE } from "instrument/bb3/conf";

const OtherReleases = observer(
    ({
        module,
        latestFirmwareVersion
    }: {
        module: Module;
        latestFirmwareVersion: string;
    }) => {
        if (!module.allReleases) {
            return null;
        }

        const bb3Instrument = module.bb3Instrument;
        const firmwareVersion = module.firmwareVersion;

        const otherReleases = module.allReleases
            .sort((a, b) => compareVersions(b.version, a.version))
            .filter(
                release =>
                    release.version != latestFirmwareVersion &&
                    release.version != firmwareVersion
            );

        if (otherReleases.length == 0) {
            return null;
        }

        return (
            <div className="EezStudio_BB3_OtherReleases">
                <p>
                    <a
                        className="btn btn-light"
                        data-bs-toggle="collapse"
                        href={`#allModuleReleases${module.slotIndex}`}
                        role="button"
                        aria-expanded="false"
                        aria-controls={`allModuleReleases${module.slotIndex}`}
                    >
                        Other versions{" "}
                        <i className="material-icons chevron-right">
                            chevron_right
                        </i>
                    </a>
                </p>
                <div
                    className="collapse"
                    id={`allModuleReleases${module.slotIndex}`}
                >
                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th scope="col">Version</th>
                                <th scope="col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {otherReleases.map(release => (
                                <tr key={release.version}>
                                    <td>{release.version}</td>
                                    <td>
                                        <button
                                            className={classNames(
                                                "btn",
                                                compareVersions(
                                                    release.version,
                                                    firmwareVersion
                                                ) > 0
                                                    ? "btn-primary"
                                                    : "btn-danger"
                                            )}
                                            style={{ marginLeft: 20 }}
                                            disabled={bb3Instrument.busy}
                                            onClick={() =>
                                                module.updateModuleFirmware(
                                                    release.version
                                                )
                                            }
                                        >
                                            {compareVersions(
                                                release.version,
                                                firmwareVersion
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

const ReleaseInfo = observer(
    ({
        module,
        latestFirmwareVersion
    }: {
        module: Module;
        latestFirmwareVersion: string | undefined;
    }) => {
        const bb3Instrument = module.bb3Instrument;
        const firmwareVersion = module.firmwareVersion;

        if (bb3Instrument.refreshInProgress) {
            return <Loader />;
        }

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
                    <div className="d-flex align-items-center fs-6">
                        <span className="badge rounded-pill bg-warning text-dark fs-6 me-3">
                            New release!
                        </span>
                        <span>
                            A new firmware version{" "}
                            <b>{latestFirmwareVersion}</b> is available (
                            <a
                                href="#"
                                onClick={() =>
                                    openLink(
                                        MODULE_FIRMWARE_RELEASES_PAGE(
                                            module.moduleType
                                        ) +
                                            "/tag/" +
                                            latestFirmwareVersion
                                    )
                                }
                            >
                                release notes
                            </a>
                            ).
                        </span>
                        <button
                            className="btn btn-primary btn-lg"
                            style={{ marginLeft: 20 }}
                            disabled={bb3Instrument.busy}
                            onClick={() =>
                                module.updateModuleFirmware(
                                    latestFirmwareVersion
                                )
                            }
                        >
                            Upgrade
                        </button>
                    </div>
                    <OtherReleases
                        module={module}
                        latestFirmwareVersion={latestFirmwareVersion}
                    />
                </>
            );
        }

        return (
            <>
                <div className="text-success fs-6">
                    This is the latest firmware version!
                </div>
                <OtherReleases
                    module={module}
                    latestFirmwareVersion={latestFirmwareVersion}
                />
            </>
        );
    }
);

export const ModuleItem = observer(({ module }: { module: Module }) => {
    const latestFirmwareVersion = module.allReleases.reduce<string | undefined>(
        (latestFirmwareVersion, release) =>
            !latestFirmwareVersion ||
            compareVersions(release.version, latestFirmwareVersion) > 0
                ? release.version
                : latestFirmwareVersion,
        undefined
    );

    let updateInfo = null;
    if (module.bb3Instrument.appStore.instrument?.isConnected) {
        if (module.busy) {
            updateInfo = <Loader />;
        } else {
            updateInfo =
                module.moduleType.toLowerCase() != "dcp405" ? (
                    <ReleaseInfo
                        module={module}
                        latestFirmwareVersion={latestFirmwareVersion}
                    />
                ) : null;
        }
    }

    return (
        <tr>
            <td>{module.slotIndex}</td>
            <td>{module.moduleType}</td>
            <td>{module.moduleRevision}</td>
            <td>{module.firmwareVersion}</td>
            <td>{updateInfo}</td>
        </tr>
    );
});

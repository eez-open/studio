import React from "react";
import { observer } from "mobx-react";

import { compareVersions } from "eez-studio-shared/util";
import { Loader } from "eez-studio-ui/loader";
import { Module } from "instrument/bb3/objects/Module";

const SelectModuleFirmwareVersion = observer(
    ({
        selectedFirmwareVersion,
        setSelectedFirmwareVersion,
        versions
    }: {
        selectedFirmwareVersion: string;
        setSelectedFirmwareVersion: (value: string) => void;
        versions: string[];
    }) => {
        return (
            <select
                className="form-control form-control-sm"
                value={selectedFirmwareVersion}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                    setSelectedFirmwareVersion(event.currentTarget.value as any)
                }
            >
                {versions.indexOf(selectedFirmwareVersion) == -1 && (
                    <option value={selectedFirmwareVersion}>{selectedFirmwareVersion}</option>
                )}
                {versions.map(version => (
                    <option key={version} value={version}>
                        {version}
                    </option>
                ))}
            </select>
        );
    }
);

export const ModuleItem = observer(({ module }: { module: Module }) => {
    const newestVersion = module.allReleases.reduce<string | undefined>(
        (newestVersion, release) =>
            !newestVersion || compareVersions(release.version, newestVersion) > 0
                ? release.version
                : newestVersion,
        undefined
    );

    const [selectedFirmwareVersion, setSelectedFirmwareVersion] = React.useState<
        string | undefined
    >(newestVersion);

    const versions = module.allReleases.map(release => release.version);

    let updateInfo;
    if (module.updateInProgress) {
        updateInfo = <Loader />;
    } else {
        updateInfo = (
            <div className="d-flex align-items-center flex-nowrap">
                {versions.length > 0 && (
                    <div>
                        <SelectModuleFirmwareVersion
                            selectedFirmwareVersion={selectedFirmwareVersion || ""}
                            setSelectedFirmwareVersion={setSelectedFirmwareVersion}
                            versions={versions}
                        />
                    </div>
                )}
                {selectedFirmwareVersion && selectedFirmwareVersion != module.firmwareVersion && (
                    <div className="ml-2">
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={async () =>
                                module.updateModuleFirmware(selectedFirmwareVersion)
                            }
                        >
                            Update
                        </button>
                    </div>
                )}
            </div>
        );
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

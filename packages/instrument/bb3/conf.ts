export const FIRMWARE_RELEASES_URL =
    "https://api.github.com/repos/eez-open/modular-psu-firmware/releases";

export const FIRMWARE_RELEASES_PAGE = "https://github.com/eez-open/modular-psu-firmware/releases";

export const FIRMWARE_UPGRADE_PAGE =
    "https://www.envox.hr/eez/eez-bench-box-3/bb3-user-manual/13-firmware-upgrade.html";

export const SCRIPTS_CATALOG_URL =
    "https://github.com/eez-open/modular-psu-firmware/raw/master/scripts/scripts-catalog.json";

export const MODULE_FIRMWARE_RELEASES_URL = (moduleType: string) =>
    `https://api.github.com/repos/eez-open/dib-${moduleType.toLowerCase()}-fw/releases`;

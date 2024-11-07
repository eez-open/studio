// export const FIRMWARE_RELEASES_URL =
//     "https://api.github.com/repos/mvladic/test-bb3-firmware-releases/releases";

// export const FIRMWARE_RELEASES_PAGE =
//     "https://github.com/mvladic/test-bb3-firmware-releases/releases";

export const FIRMWARE_RELEASES_URL =
    "https://api.github.com/repos/eez-open/modular-psu-firmware/releases";

export const FIRMWARE_RELEASES_PAGE =
    "https://github.com/eez-open/modular-psu-firmware/releases";

export const FIRMWARE_UPGRADE_PAGE =
    "https://www.envox.eu/eez-bench-box-3/bb3-user-manual/13-firmware-upgrade/";

export const SCRIPTS_CATALOG_URL =
    "https://github.com/eez-open/modular-psu-firmware/raw/master/scripts/scripts-catalog.json";

export const MODULE_FIRMWARE_RELEASES_PAGE = (moduleType: string) =>
    `https://github.com/eez-open/dib-${moduleType.toLowerCase()}-fw/releases`;

export const MODULE_FIRMWARE_RELEASES_URL = (moduleType: string) =>
    `https://api.github.com/repos/eez-open/dib-${moduleType.toLowerCase()}-fw/releases`;

export const PINOUT_PAGES = [
    {
        url: "https://raw.githubusercontent.com/eez-open/modular-psu-firmware/master/docs/dcp405_pinout.png",
        fileName: "dcp405_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com/eez-open/dib-dcm220-fw/master/Docs/pinout.png",
        fileName: "dcm220_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com/eez-open/dib-dcm224-fw/master/Docs/pinout.png",
        fileName: "dcm224_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-mio168-fw/master/Docs/pinout_no_afe.png",
        fileName: "mio168_no_afe_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-mio168-fw/master/Docs/pinout_afe1.png",
        fileName: "mio168_afe1_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-mio168-fw/master/Docs/pinout_afe2.png",
        fileName: "mio168_afe2_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-mio168-fw/master/Docs/pinout_afe3.png",
        fileName: "mio168_afe3_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-smx46-fw/master/Docs/pinout.png",
        fileName: "smx46_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-prel6-fw/master/Docs/pinout.png",
        fileName: "prel6_pinout.jpg"
    },
    {
        url: "https://raw.githubusercontent.com//eez-open/dib-mux14d-fw/master/Docs/pinout.png",
        fileName: "mux14d_pinout.jpg"
    }
];

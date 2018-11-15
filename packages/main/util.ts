import os from "os";

import path from "path";

export function getIcon() {
    if (os.platform() == "win32") {
        return path.resolve(`${__dirname}/../../icon.ico`);
    } else {
        return path.resolve(`${__dirname}/../eez-studio-ui/_images/eez_logo.png`);
    }
}

export const APP_NAME = "EEZ Studio";

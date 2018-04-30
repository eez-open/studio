import { IExtension } from "shared/extensions/extension";

import "shortcuts/shortcuts-store";
import "shortcuts/groups-store";

const shortcutsExtension: IExtension = {
    id: "shortcuts",
    preInstalled: true,
    name: "Shortcuts",
    version: "0.1",
    author: "Envox",
    image: "",
    properties: {}
};

export default shortcutsExtension;

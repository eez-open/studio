import { IExtensionDefinition } from "eez-studio-shared/extensions/extension";

import "shortcuts/shortcuts-store";
import "shortcuts/groups-store";

const shortcutsExtension: IExtensionDefinition = {
    preInstalled: true,
    extensionType: "built-in"
};

export default shortcutsExtension;

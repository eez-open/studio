import { toJS } from "mobx";
import { objectEqual } from "eez-studio-shared/util";
import { IShortcut } from "shortcuts/interfaces";
import { SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX } from "shortcuts/shortcuts-store";

////////////////////////////////////////////////////////////////////////////////

export function isSameShortcutFromDifferentExtension(
    s1: IShortcut,
    s2: IShortcut
) {
    if (
        !s1.groupName ||
        !s1.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)
    ) {
        return false;
    }

    if (
        !s2.groupName ||
        !s2.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)
    ) {
        return false;
    }

    let s1js: any = toJS(s1);
    delete s1js.id;
    delete s1js.originalId;
    delete s1js.groupName;
    delete s1js.selected;

    let s2js: any = toJS(s2);
    delete s2js.id;
    delete s2js.originalId;
    delete s2js.groupName;
    delete s2js.selected;

    return objectEqual(s1js, s2js);
}

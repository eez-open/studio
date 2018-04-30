import * as React from "react";
import { observable, computed, values } from "mobx";

import { beginTransaction, commitTransaction } from "shared/store";

import { IShortcut, IGroup } from "shortcuts/interfaces";
import { Shortcuts, ShortcutsToolbarButtons } from "shortcuts/shortcuts";
import { Groups, GroupsToolbarButtons } from "shortcuts/groups";
import { shortcuts, addShortcut, updateShortcut, deleteShortcut } from "shortcuts/shortcuts-store";
import {
    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX,
    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX
} from "shortcuts/shortcuts";
import { groups, addGroup, updateGroup, deleteGroup } from "shortcuts/groups-store";
import { bindShortcuts } from "shortcuts/mousetrap";

import { appStore } from "instrument/window/app-store";
import {
    changeGroupNameInInstruments,
    deleteGroupInInstruments
} from "instrument/instrument-object";

import * as ScriptModule from "instrument/window/script";

export const shortcutsOrGroups = observable.box<boolean>(true);

export const instrumentShortcuts = computed(() => {
    let shortcutsMap = new Map<string, IShortcut>();

    const instrument = appStore.instrument;
    if (instrument) {
        values(shortcuts)
            .filter(
                shortcut =>
                    shortcut.groupName ===
                        SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX + instrument.id ||
                    (instrument.extension &&
                        shortcut.groupName ===
                            SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX + instrument.extension.id) ||
                    instrument.selectedShortcutGroups.indexOf(shortcut.groupName) !== -1
            )
            .forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));
    }

    return observable.map(shortcutsMap);
});

class ShortcutsStore {
    @computed
    get shortcuts() {
        return instrumentShortcuts.get();
    }

    addShortcut(shortcut: Partial<IShortcut>) {
        beginTransaction("Add shortcut");
        if (shortcut.groupName) {
            if (
                !shortcut.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX) &&
                !shortcut.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX)
            ) {
                appStore.instrument!.addShortcutGroupToInstrument(shortcut.groupName);
            }
        } else {
            shortcut = Object.assign({}, shortcut, {
                groupName: SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX + appStore.instrument!.id
            });
        }
        let id = addShortcut(shortcut);
        commitTransaction();
        return id;
    }

    updateShortcut(shortcut: Partial<IShortcut>) {
        beginTransaction("Edit shortcut");
        if (shortcut.groupName) {
            if (
                !shortcut.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX) &&
                !shortcut.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX)
            ) {
                appStore.instrument!.addShortcutGroupToInstrument(shortcut.groupName);
            }
        } else {
            shortcut = Object.assign({}, shortcut, {
                groupName: SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX + appStore.instrument!.id
            });
        }
        updateShortcut(shortcut);
        commitTransaction();
    }

    deleteShortcut(shortcut: Partial<IShortcut>) {
        beginTransaction("Delete shortcut");
        deleteShortcut(shortcut);
        commitTransaction();
    }
}

export const shortcutsStore = new ShortcutsStore();

const groupsStore = {
    groups,

    addGroup,

    updateGroup(changes: Partial<IGroup>) {
        if (changes.name) {
            let group = groups.get(changes.id!);
            if (group && group.name != changes.name) {
                changeGroupNameInInstruments(group.name, changes.name);
            }
        }

        updateGroup(changes);
    },

    deleteGroup(group: Partial<IGroup>) {
        deleteGroupInInstruments(group.name!);
        deleteGroup(group);
    },

    isGroupEnabled(group: IGroup) {
        return appStore.instrument!.selectedShortcutGroups.indexOf(group.name) !== -1;
    },

    enableGroup(group: IGroup, enable: boolean): void {
        if (enable) {
            beginTransaction("Add shortcut group to instrument");
            appStore.instrument!.addShortcutGroupToInstrument(group.name);
        } else {
            beginTransaction("Remove shortcut group from instrument");
            appStore.instrument!.removeShortcutGroupFromInstrument(group.name);
        }
        commitTransaction();
    }
};

export function render() {
    return shortcutsOrGroups.get() ? (
        <Shortcuts shortcutsStore={shortcutsStore} groupsStore={groupsStore} />
    ) : (
        <Groups shortcutsStore={shortcutsStore} groupsStore={groupsStore} />
    );
}

export function toolbarButtonsRender() {
    return shortcutsOrGroups.get() ? (
        <ShortcutsToolbarButtons
            shortcutsOrGroups={shortcutsOrGroups}
            shortcutsStore={shortcutsStore}
            groupsStore={groupsStore}
        />
    ) : (
        <GroupsToolbarButtons shortcutsOrGroups={shortcutsOrGroups} groupsStore={groupsStore} />
    );
}

bindShortcuts(instrumentShortcuts, (shortcut: IShortcut) => {
    const { executeShortcut } = require("instrument/window/script") as typeof ScriptModule;
    if (appStore.instrument) {
        executeShortcut(appStore.instrument, shortcut);
    }
});

import React from "react";
import { observable, computed, values, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { IShortcut, IGroup } from "shortcuts/interfaces";
import { Shortcuts, ShortcutsToolbarButtons } from "shortcuts/shortcuts";
import { Groups, GroupsToolbarButtons } from "shortcuts/groups";
import {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut
} from "shortcuts/shortcuts-store";

import { isSameShortcutFromDifferentExtension } from "shortcuts/isSameShortcutFromDifferentExtension";
import { SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX } from "shortcuts/shortcuts-store";
import {
    groups,
    addGroup,
    updateGroup,
    deleteGroup
} from "shortcuts/groups-store";

import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import {
    VerticalHeaderWithBody,
    ToolbarHeader,
    Body
} from "eez-studio-ui/header-with-body";

import type * as InstrumentObjectModule from "instrument/instrument-object";

export const shortcutsOrGroups = observable.box<boolean>(true);

export const allShortcuts = computed(() => {
    let shortcutsMap = new Map<string, IShortcut>();

    values(shortcuts)
        .filter(
            shortcut =>
                shortcut.groupName &&
                !shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX
                )
        )
        .forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));

    return observable.map(shortcutsMap);
});

class ShortcutsStore {
    isScpiInstrument = true;

    constructor() {
        makeObservable(this, {
            shortcuts: computed
        });
    }

    get shortcuts() {
        return allShortcuts.get();
    }

    getSameShortcutsFromDifferentExtensions(id: string) {
        const shortcut = this.shortcuts.get(id)!;
        return values(this.shortcuts).filter(
            otherShortcut =>
                otherShortcut.id !== shortcut.id &&
                isSameShortcutFromDifferentExtension(otherShortcut, shortcut)
        );
    }

    addShortcut(shortcutToAdd: Partial<IShortcut>) {
        beginTransaction("Add shortcut");
        let id = addShortcut(shortcutToAdd);
        commitTransaction();
        return id;
    }

    updateShortcut(shortcut: Partial<IShortcut>) {
        const sameShortcuts = this.getSameShortcutsFromDifferentExtensions(
            shortcut.id!
        );

        beginTransaction("Edit shortcut");

        updateShortcut(shortcut);

        sameShortcuts.forEach(sameShortcut =>
            updateShortcut(
                Object.assign({}, shortcut, {
                    id: sameShortcut.id,
                    originalId: sameShortcut.originalId,
                    groupName: sameShortcut.groupName
                })
            )
        );

        commitTransaction();
    }

    deleteShortcut(shortcut: Partial<IShortcut>) {
        const sameShortcuts = this.getSameShortcutsFromDifferentExtensions(
            shortcut.id!
        );
        beginTransaction("Delete shortcut");
        deleteShortcut(shortcut);
        sameShortcuts.forEach(sameShortcut => deleteShortcut(sameShortcut));
        commitTransaction();
    }
}

const shortcutsStore = new ShortcutsStore();

const groupsStore = {
    groups,

    addGroup,

    updateGroup(changes: Partial<IGroup>) {
        if (changes.name) {
            let group = groups.get(changes.id!);
            if (group && group.name != changes.name) {
                const { changeGroupNameInInstruments } =
                    require("instrument/instrument-object") as typeof InstrumentObjectModule;

                changeGroupNameInInstruments(group.name, changes.name);
            }
        }

        updateGroup(changes);
    },

    deleteGroup(group: Partial<IGroup>) {
        const { deleteGroupInInstruments } =
            require("instrument/instrument-object") as typeof InstrumentObjectModule;

        deleteGroupInInstruments(group.name!);
        deleteGroup(group);
    }
};

export const ShortcutsAndGroups = observer(
    class ShortcutsAndGroups extends React.Component<{}, {}> {
        render() {
            return (
                <VerticalHeaderWithBody>
                    <ToolbarHeader>
                        {shortcutsOrGroups.get() ? (
                            <ShortcutsToolbarButtons
                                shortcutsOrGroups={shortcutsOrGroups}
                                shortcutsStore={shortcutsStore}
                                groupsStore={groupsStore}
                            />
                        ) : (
                            <GroupsToolbarButtons
                                shortcutsOrGroups={shortcutsOrGroups}
                                groupsStore={groupsStore}
                            />
                        )}
                    </ToolbarHeader>
                    <Body tabIndex={0}>
                        {shortcutsOrGroups.get() ? (
                            <Shortcuts
                                shortcutsStore={shortcutsStore}
                                groupsStore={groupsStore}
                            />
                        ) : (
                            <Groups
                                shortcutsStore={shortcutsStore}
                                groupsStore={groupsStore}
                            />
                        )}
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

import React from "react";
import {
    observable,
    computed,
    values,
    makeObservable,
    IReactionDisposer,
    autorun,
    runInAction
} from "mobx";

import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import { IShortcut, IGroup } from "shortcuts/interfaces";
import { Shortcuts, ShortcutsToolbarButtons } from "shortcuts/shortcuts";
import { Groups, GroupsToolbarButtons } from "shortcuts/groups";
import {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut
} from "shortcuts/shortcuts-store";
import {
    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX,
    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX
} from "shortcuts/shortcuts-store";
import {
    groups,
    addGroup,
    updateGroup,
    deleteGroup
} from "shortcuts/groups-store";
import { bindShortcuts } from "shortcuts/mousetrap";

import {
    changeGroupNameInInstruments,
    deleteGroupInInstruments
} from "instrument/instrument-object";

import { InstrumentAppStore } from "instrument/window/app-store";
import type * as ScriptModule from "instrument/window/script";
import type { IExtension } from "eez-studio-shared/extensions/extension";
import { closestBySelector } from "eez-studio-shared/dom";

////////////////////////////////////////////////////////////////////////////////

class ShortcutsToolbarRegistry {
    bindShortcutsDispose: (() => void) | undefined;
    shortcutsToolbarMap: Map<HTMLDivElement, ShortcutsStore> = new Map();
    activeShortcutsToolbar: HTMLDivElement | undefined;

    constructor() {
        makeObservable(this, {
            shortcutsToolbarMap: observable,
            activeShortcutsToolbar: observable
        });

        this.findActiveShortcutsToolbar();
    }

    findActiveShortcutsToolbar = () => {
        let activeShortcutsToolbar: HTMLDivElement | undefined;

        this.shortcutsToolbarMap.forEach((store, element) => {
            // if shortcutsToolbar element is not visible then pass
            const rect = element.getBoundingClientRect();
            if (rect.width == 0 || rect.height == 0) {
                return;
            }

            // if shortcutsToolbar element is inside flexlayout-react tab
            const tabElement: HTMLElement = closestBySelector(
                element,
                ".flexlayout__tab"
            );
            if (tabElement) {
                // if flexlayout tab is selected
                const layoutPath = tabElement.getAttribute("data-layout-path");
                if (layoutPath) {
                    let i = layoutPath.lastIndexOf("/");
                    if (i != -1) {
                        let id = layoutPath.substring(0, i);
                        let tabstripElement: HTMLElement | null =
                            document.querySelector(
                                `[data-layout-path="${id}/tabstrip"]`
                            );
                        if (
                            tabstripElement &&
                            tabstripElement.classList.contains(
                                "flexlayout__tabset-selected"
                            )
                        ) {
                            activeShortcutsToolbar = element;
                        }
                    }
                }

                // if flexlayout tab is not selected but tab contains activeElement
                if (
                    activeShortcutsToolbar != element &&
                    document.activeElement &&
                    tabElement.contains(document.activeElement)
                ) {
                    activeShortcutsToolbar = element;
                }
            } else {
                activeShortcutsToolbar = element;
            }
        });

        if (activeShortcutsToolbar != this.activeShortcutsToolbar) {
            runInAction(() => {
                this.activeShortcutsToolbar = activeShortcutsToolbar;
            });

            if (activeShortcutsToolbar) {
                this.bindShortcutsToKeyboard(
                    this.shortcutsToolbarMap.get(activeShortcutsToolbar)!
                );
            }
        }

        requestAnimationFrame(this.findActiveShortcutsToolbar);
    };

    bindShortcutsToKeyboard(shortcutsStore: ShortcutsStore) {
        if (shortcutsToolbarRegistry.bindShortcutsDispose) {
            shortcutsToolbarRegistry.bindShortcutsDispose();
        }

        shortcutsToolbarRegistry.bindShortcutsDispose = bindShortcuts(
            shortcutsStore.instrumentShortcuts,
            (shortcut: IShortcut) => {
                if (shortcut.action.type === "micropython") {
                    return;
                }
                const { executeShortcut } =
                    require("instrument/window/script") as typeof ScriptModule;
                if (shortcutsStore.appStore.instrument) {
                    executeShortcut(shortcutsStore.appStore, shortcut);
                }
            }
        );
    }

    registerShortcutsToolbar(
        el: HTMLDivElement,
        shortcutsStore: ShortcutsStore
    ) {
        shortcutsToolbarRegistry.shortcutsToolbarMap.set(el, shortcutsStore);
    }

    unregisterShortcutsToolbar(el: HTMLDivElement) {
        shortcutsToolbarRegistry.shortcutsToolbarMap.delete(el);
    }
}

export const shortcutsToolbarRegistry = new ShortcutsToolbarRegistry();

////////////////////////////////////////////////////////////////////////////////

export const shortcutsOrGroups = observable.box<boolean>(true);

export class ShortcutsStore {
    addShortcutsToDatabaseIfAllAreMissingDispose: IReactionDisposer | undefined;

    constructor(public appStore: InstrumentAppStore) {
        makeObservable(this, {
            shortcuts: computed,
            isAnyMissingShortcuts: computed
        });

        this.addShortcutsToDatabaseIfAllAreMissingDispose = autorun(() => {
            const extension = this.appStore.instrument?.extension;
            if (!extension) {
                return;
            }
            const externsionShortcuts = extension?.properties?.shortcuts;
            if (!externsionShortcuts) {
                return;
            }

            this.addShortcutsToDatabaseIfAllAreMissingDispose!();
            this.addShortcutsToDatabaseIfAllAreMissingDispose = undefined;

            const anyShortcutInDatabase = externsionShortcuts.find(shortcut =>
                this.isShortcutInDatabase(extension, shortcut)
            );

            if (!anyShortcutInDatabase) {
                this.addMissingShortcuts();
            }
        });
    }

    instrumentShortcuts = computed(() => {
        let shortcutsMap = new Map<string, IShortcut>();

        const instrument = this.appStore.instrument;
        if (instrument) {
            values(shortcuts)
                .filter(
                    shortcut =>
                        shortcut.groupName ===
                            SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX +
                                instrument.id ||
                        (instrument.extension &&
                            shortcut.groupName ===
                                SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX +
                                    instrument.extension.id) ||
                        instrument.selectedShortcutGroups.indexOf(
                            shortcut.groupName
                        ) !== -1
                )
                .forEach(shortcut => shortcutsMap.set(shortcut.id, shortcut));
        }

        return observable.map(shortcutsMap);
    });

    get shortcuts() {
        return this.instrumentShortcuts.get();
    }

    addShortcut(shortcut: Partial<IShortcut>) {
        beginTransaction("Add shortcut");
        if (shortcut.groupName) {
            if (
                !shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
                ) &&
                !shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX
                )
            ) {
                this.appStore.instrument.addShortcutGroupToInstrument(
                    shortcut.groupName
                );
            }
        } else {
            shortcut = Object.assign({}, shortcut, {
                groupName:
                    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX +
                    this.appStore.history.oid
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
                !shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
                ) &&
                !shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX
                )
            ) {
                this.appStore.instrument.addShortcutGroupToInstrument(
                    shortcut.groupName
                );
            }
        } else {
            shortcut = Object.assign({}, shortcut, {
                groupName:
                    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX +
                    this.appStore.instrument.id
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

    isShortcutInDatabase(extension: IExtension, shortcut: IShortcut) {
        const groupName =
            SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX + extension.id;
        return values(shortcuts).find(
            dbShortcut =>
                dbShortcut.originalId == shortcut.id &&
                dbShortcut.groupName == groupName
        );
    }

    get isAnyMissingShortcuts() {
        const extension = this.appStore.instrument?.extension;
        if (!extension) {
            return false;
        }
        const externsionShortcuts = extension?.properties?.shortcuts;
        if (!externsionShortcuts) {
            return false;
        }

        return externsionShortcuts.find(
            shortcut => !this.isShortcutInDatabase(extension, shortcut)
        );
    }

    addMissingShortcuts() {
        const extension = this.appStore.instrument?.extension;
        if (!extension) {
            return;
        }
        const externsionShortcuts = extension?.properties?.shortcuts;
        if (!externsionShortcuts) {
            return;
        }

        externsionShortcuts.forEach(shortcut => {
            const groupName =
                SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX + extension.id;

            if (!this.isShortcutInDatabase(extension, shortcut)) {
                addShortcut(
                    Object.assign({}, shortcut, {
                        id: undefined,
                        groupName,
                        originalId: shortcut.id
                    })
                );
            }
        });
    }

    onTerminate() {
        if (this.addShortcutsToDatabaseIfAllAreMissingDispose) {
            this.addShortcutsToDatabaseIfAllAreMissingDispose();
        }
    }
}

export class GroupsStore {
    constructor(public appStore: InstrumentAppStore) {}

    get groups() {
        return groups;
    }

    get addGroup() {
        return addGroup;
    }

    updateGroup(changes: Partial<IGroup>) {
        if (changes.name) {
            let group = groups.get(changes.id!);
            if (group && group.name != changes.name) {
                changeGroupNameInInstruments(group.name, changes.name);
            }
        }

        updateGroup(changes);
    }

    deleteGroup(group: Partial<IGroup>) {
        deleteGroupInInstruments(group.name!);
        deleteGroup(group);
    }

    isGroupEnabled(group: IGroup) {
        return (
            this.appStore.instrument.selectedShortcutGroups.indexOf(
                group.name
            ) !== -1
        );
    }

    enableGroup(group: IGroup, enable: boolean): void {
        if (enable) {
            beginTransaction("Add shortcut group to instrument");
            this.appStore.instrument.addShortcutGroupToInstrument(group.name);
        } else {
            beginTransaction("Remove shortcut group from instrument");
            this.appStore.instrument.removeShortcutGroupFromInstrument(
                group.name
            );
        }
        commitTransaction();
    }
}

export function render(appStore: InstrumentAppStore) {
    return shortcutsOrGroups.get() ? (
        <Shortcuts
            shortcutsStore={appStore.shortcutsStore}
            groupsStore={appStore.groupsStore}
        />
    ) : (
        <Groups
            shortcutsStore={appStore.shortcutsStore}
            groupsStore={appStore.groupsStore}
        />
    );
}

export function toolbarButtonsRender(appStore: InstrumentAppStore) {
    return shortcutsOrGroups.get() ? (
        <ShortcutsToolbarButtons
            shortcutsOrGroups={shortcutsOrGroups}
            shortcutsStore={appStore.shortcutsStore}
            groupsStore={appStore.groupsStore}
        />
    ) : (
        <GroupsToolbarButtons
            shortcutsOrGroups={shortcutsOrGroups}
            groupsStore={appStore.groupsStore}
        />
    );
}

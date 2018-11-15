import { ObservableMap, IComputedValue, autorun, values } from "mobx";
import Mousetrap from "mousetrap";

import { IShortcut } from "shortcuts/interfaces";

export function bindShortcuts(
    instumentShortcuts: IComputedValue<ObservableMap<string, IShortcut>>,
    executeShortcut: (shortcut: IShortcut) => void
) {
    autorun(() => {
        Mousetrap.reset();

        values(instumentShortcuts.get()).forEach(shortcut => {
            if (shortcut.keybinding) {
                Mousetrap.bind(shortcut.keybinding, () => {
                    executeShortcut(shortcut);
                    return false;
                });
            }
        });
    });
}

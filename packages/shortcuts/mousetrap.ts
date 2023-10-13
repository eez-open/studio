import { ObservableMap, IComputedValue, autorun, values } from "mobx";
import type * as MousetrapModule from "mousetrap";

import type { IShortcut } from "shortcuts/interfaces";

export function bindShortcuts(
    instumentShortcuts: IComputedValue<ObservableMap<string, IShortcut>>,
    executeShortcut: (shortcut: IShortcut) => void
) {
    const Mousetrap = require("mousetrap") as typeof MousetrapModule;

    const dispose = autorun(() => {
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

    return () => {
        dispose();
        Mousetrap.reset();
    };
}

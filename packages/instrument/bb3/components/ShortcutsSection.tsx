import React from "react";
import { observer } from "mobx-react";

import { ShortcutsToolbar } from "instrument/window/terminal/toolbar";
import { executeShortcut } from "instrument/window/script";

import { InstrumentAppStore } from "instrument/window/app-store";

export const ShortcutsSection = observer(({ appStore }: { appStore: InstrumentAppStore }) => {
    return (
        <section>
            <header>
                <h5>Shortcuts</h5>
            </header>
            <div>
                <ShortcutsToolbar
                    appStore={appStore}
                    executeShortcut={shortcut => {
                        executeShortcut(appStore, shortcut);
                    }}
                    style={{
                        border: 0,
                        backgroundColor: "white"
                    }}
                />
            </div>
        </section>
    );
});

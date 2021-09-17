import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { capitalize } from "eez-studio-shared/string";

import { Toolbar } from "eez-studio-ui/toolbar";
import { ButtonAction } from "eez-studio-ui/action";

import { IShortcut } from "shortcuts/interfaces";

import { InstrumentAppStore } from "instrument/window/app-store";

@observer
export class ShortcutButton extends React.Component<
    {
        appStore: InstrumentAppStore;
        shortcut: IShortcut;
        executeShortcut: () => void;
    },
    {}
> {
    @computed
    get keybinding() {
        return (
            (this.props.shortcut.keybinding &&
                this.props.shortcut.keybinding
                    .split("+")
                    .map(x => capitalize(x))
                    .join(" + ")) ||
            ""
        );
    }

    render() {
        return (
            <ButtonAction
                text={this.props.shortcut.name}
                title={this.keybinding}
                onClick={this.props.executeShortcut}
                className="btn-sm "
                style={{
                    color: "white",
                    backgroundColor: this.props.shortcut.toolbarButtonColor
                }}
                enabled={this.props.appStore.instrument?.connection.isConnected}
            />
        );
    }
}

@observer
export class ShortcutsToolbar extends React.Component<{
    appStore: InstrumentAppStore;
    style?: React.CSSProperties;
    executeShortcut: (shortcut: IShortcut) => void;
}> {
    @computed
    get shortcuts() {
        return Array.from(
            this.props.appStore.shortcutsStore.instrumentShortcuts
                .get()
                .values()
        )
            .filter(s => s.showInToolbar)
            .sort((s1, s2) => {
                if (s1.toolbarButtonPosition < s2.toolbarButtonPosition) {
                    return -1;
                }

                if (s1.toolbarButtonPosition > s2.toolbarButtonPosition) {
                    return 1;
                }

                let name1 = s1.name.toLocaleLowerCase();
                let name2 = s2.name.toLocaleLowerCase();

                return name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
            });
    }

    render() {
        if (this.shortcuts.length === 0) {
            return null;
        }

        return (
            <Toolbar
                className="EezStudio_ShortcutsToolbarContainer"
                style={this.props.style}
            >
                {this.shortcuts.map(shortcut => (
                    <ShortcutButton
                        key={shortcut.id}
                        appStore={this.props.appStore}
                        shortcut={shortcut}
                        executeShortcut={() =>
                            this.props.executeShortcut(shortcut)
                        }
                    />
                ))}
            </Toolbar>
        );
    }
}

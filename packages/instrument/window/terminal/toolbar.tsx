import React from "react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { capitalize } from "eez-studio-shared/string";

import { ButtonAction } from "eez-studio-ui/action";

import type { IShortcut } from "shortcuts/interfaces";

import type { InstrumentAppStore } from "instrument/window/app-store";
import { shortcutsToolbarRegistry } from "instrument/window/shortcuts";

export const ShortcutButton = observer(
    class ShortcutButton extends React.Component<{
        appStore: InstrumentAppStore;
        shortcut: IShortcut;
        executeShortcut: () => void;
        isActive: boolean;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                keybinding: computed
            });
        }

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
            let text;
            let title;
            if (this.keybinding) {
                text = (
                    <>
                        <span
                            className="EezStudio_Keybinding_Part"
                            style={{
                                color: "#333",
                                backgroundColor: "white",
                                opacity: this.props.isActive ? "1.0" : "0.2"
                            }}
                        >
                            {this.keybinding}
                        </span>
                        <span>{this.props.shortcut.name}</span>
                    </>
                );
                title = `${this.keybinding}: ${this.props.shortcut.name}`;
            } else {
                text = this.props.shortcut.name;
                title = this.props.shortcut.name;
            }

            return (
                <ButtonAction
                    text={text}
                    title={title}
                    onClick={this.props.executeShortcut}
                    className="btn-sm "
                    style={{
                        color: "white",
                        backgroundColor: this.props.shortcut.toolbarButtonColor
                    }}
                    enabled={
                        this.props.appStore.instrument?.connection.isConnected
                    }
                />
            );
        }
    }
);

export const ShortcutsToolbar = observer(
    class ShortcutsToolbar extends React.Component<{
        appStore: InstrumentAppStore;
        style?: React.CSSProperties;
        executeShortcut: (shortcut: IShortcut) => void;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                shortcuts: computed
            });
        }

        divRef = React.createRef<HTMLDivElement>();

        componentDidMount() {
            if (this.divRef.current) {
                shortcutsToolbarRegistry.registerShortcutsToolbar(
                    this.divRef.current,
                    this.props.appStore.shortcutsStore
                );
            }
        }

        componentWillUnmount() {
            if (this.divRef.current) {
                shortcutsToolbarRegistry.unregisterShortcutsToolbar(
                    this.divRef.current
                );
            }
        }

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
                <div
                    ref={this.divRef}
                    className="EezStudio_Toolbar EezStudio_ShortcutsToolbarContainer"
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
                            isActive={
                                this.divRef.current ==
                                    shortcutsToolbarRegistry.activeShortcutsToolbar &&
                                this.divRef.current
                                    ? true
                                    : false
                            }
                        />
                    ))}
                    {this.props.appStore.shortcutsStore
                        .isAnyMissingShortcuts && (
                        <button
                            className="btn btn-link"
                            style={{ marginLeft: 5 }}
                            onClick={event => {
                                event.preventDefault();
                                this.props.appStore.shortcutsStore.addMissingShortcuts();
                            }}
                        >
                            Add missing shortcuts
                        </button>
                    )}
                </div>
            );
        }
    }
);

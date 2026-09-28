import React from "react";
import { Command } from "cmdk";
import { observable, runInAction } from "mobx";
import { observer } from "mobx-react";

import { t } from "eez-studio-shared/i18n";
import { Icon } from "eez-studio-ui/icon";

// Figma-style command palette. The commands come from the live Electron
// application menu (via @electron/remote): labels are already localized,
// accelerators and enabled states are real, and executing a command calls
// the same click handler the native menu would. Bound to Ctrl+Shift+P
// (Ctrl+K is taken by the Check command).

const paletteState = observable({
    isOpen: false,
    commands: [] as IPaletteCommand[]
});

interface IPaletteCommand {
    id: string;
    label: string;
    section: string;
    accelerator?: string;
    item: any;
}

function prettifyAccelerator(accelerator: string | undefined) {
    if (!accelerator) {
        return undefined;
    }
    return accelerator
        .split("+")
        .map(part =>
            part === "CmdOrCtrl"
                ? "Ctrl"
                : part === "CommandOrControl"
                    ? "Ctrl"
                    : part
        )
        .join("+");
}

function collectCommands(menu: any): IPaletteCommand[] {
    const commands: IPaletteCommand[] = [];

    function visitMenuItem(menuItem: any, section: string, depth: number) {
        if (!menuItem || menuItem.type === "separator") {
            return;
        }

        const label: string | undefined = menuItem.label;
        if (menuItem.submenu) {
            const subSection = depth === 0 ? label : section;
            for (const child of menuItem.submenu.items) {
                if (depth === 0) {
                    visitMenuItem(child, label || "", 1);
                } else {
                    visitMenuItem(
                        child,
                        subSection || section,
                        depth + 1
                    );
                }
            }
            return;
        }

        if (!label || !menuItem.click) {
            return;
        }

        commands.push({
            id: section + " / " + label,
            label,
            section,
            accelerator: prettifyAccelerator(menuItem.accelerator),
            item: menuItem
        });
    }

    if (menu) {
        for (const item of menu.items) {
            visitMenuItem(item, "", 0);
        }
    }

    return commands;
}

export function openCommandPalette() {
    const { Menu } = require("@electron/remote");
    runInAction(() => {
        paletteState.commands = collectCommands(Menu.getApplicationMenu());
        paletteState.isOpen = true;
    });
}

function executeCommand(command: IPaletteCommand) {
    runInAction(() => (paletteState.isOpen = false));

    const { BrowserWindow, getCurrentWindow } = require("@electron/remote");
    const focusedWindow = BrowserWindow.getFocusedWindow() || getCurrentWindow();
    try {
        command.item.click(command.item, focusedWindow);
    } catch (err) {
        console.error(err);
    }
}

const CommandPaletteDialog = observer(
    class CommandPaletteDialog extends React.Component {
        inputRef = React.createRef<HTMLInputElement>();

        componentDidMount() {
            window.addEventListener("keydown", this.onGlobalKeyDown, true);
        }

        componentWillUnmount() {
            window.removeEventListener("keydown", this.onGlobalKeyDown, true);
        }

        onGlobalKeyDown = (event: KeyboardEvent) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.shiftKey &&
                event.code === "KeyP" &&
                !event.altKey &&
                !event.repeat
            ) {
                event.preventDefault();
                event.stopPropagation();
                runInAction(() => {
                    if (paletteState.isOpen) {
                        paletteState.isOpen = false;
                    } else {
                        openCommandPalette();
                    }
                });
            }
        };

        render() {
            if (!paletteState.isOpen) {
                return null;
            }

            const groups: Map<string, IPaletteCommand[]> = new Map();
            for (const command of paletteState.commands) {
                let group = groups.get(command.section);
                if (!group) {
                    group = [];
                    groups.set(command.section, group);
                }
                group.push(command);
            }

            return (
                <div
                    className="EezStudio_CommandPalette_Overlay"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) {
                            runInAction(
                                () => (paletteState.isOpen = false)
                            );
                        }
                    }}
                >
                    <Command
                        loop
                        className="EezStudio_CommandPalette"
                        onKeyDown={event => {
                            if (event.key === "Escape") {
                                runInAction(
                                    () => (paletteState.isOpen = false)
                                );
                            }
                        }}
                    >
                        <div className="EezStudio_CommandPalette_InputWrap">
                            <Icon icon="material:search" size={18} />
                            <Command.Input
                                autoFocus
                                placeholder={t("Search commands...")}
                            />
                        </div>
                        <Command.List>
                            <Command.Empty>
                                {t("No matching commands")}
                            </Command.Empty>
                            {[...groups].map(([section, commands]) => (
                                <Command.Group
                                    key={section}
                                    heading={section}
                                >
                                    {commands.map(command => (
                                        <Command.Item
                                            key={command.id}
                                            value={`${command.label} ${command.section} ${command.accelerator || ""}`}
                                            onSelect={() =>
                                                executeCommand(command)
                                            }
                                        >
                                            <span className="label">
                                                {command.label}
                                            </span>
                                            {command.accelerator && (
                                                <span className="kbd">
                                                    {command.accelerator}
                                                </span>
                                            )}
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            ))}
                        </Command.List>
                    </Command>
                </div>
            );
        }
    }
);

export const CommandPalette = CommandPaletteDialog;

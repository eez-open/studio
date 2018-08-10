import * as React from "react";
import { observable, computed, action, IObservableValue, toJS } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { Toolbar } from "shared/ui/toolbar";
import { IconAction, ButtonAction } from "shared/ui/action";
import { confirm } from "shared/ui/dialog";
import { Icon } from "shared/ui/icon";
import { extensions } from "shared/extensions/extensions";

import { IShortcut, IShortcutsStore, IGroupsStore } from "shortcuts/interfaces";
import { DEFAULT_TOOLBAR_BUTTON_COLOR } from "shortcuts/toolbar-button-colors";
import { showShortcutDialog } from "shortcuts/shortcut-dialog";

////////////////////////////////////////////////////////////////////////////////

export const SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX = "__extension__";
export const SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX = "__instrument__";
export const FROM_EXTENSION_GROUP_NAME = "From instrument extension";

////////////////////////////////////////////////////////////////////////////////

const selectedShortcutId = observable.box<string>();

export function selectShortcutById(shortcutsStore: IShortcutsStore, id: string) {
    if (selectedShortcutId) {
        const shortcut = shortcutsStore.shortcuts.get(selectedShortcutId.get());
        if (shortcut) {
            action(() => (shortcut.selected = false))();
        }
    }

    selectedShortcutId.set(id);

    if (selectedShortcutId) {
        const shortcut = shortcutsStore.shortcuts.get(selectedShortcutId.get());
        if (shortcut) {
            action(() => (shortcut.selected = true))();
        }
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class ShortcutsToolbarButtons extends React.Component<
    {
        shortcutsStore: IShortcutsStore;
        groupsStore?: IGroupsStore;
        shortcutsOrGroups?: IObservableValue<boolean>;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.addShortcut = this.addShortcut.bind(this);
        this.showGroups = this.showGroups.bind(this);
    }

    addShortcut() {
        showShortcutDialog(
            this.props.shortcutsStore,
            this.props.groupsStore,
            {
                name: "",
                action: {
                    type: "scpi-commands",
                    data: ""
                },
                keybinding: "",
                groupName: "",
                showInToolbar: true,
                toolbarButtonPosition: 1,
                toolbarButtonColor: DEFAULT_TOOLBAR_BUTTON_COLOR,
                requiresConfirmation: false,
                selected: false
            },
            shortcut => {
                let id = this.props.shortcutsStore.addShortcut!(shortcut);

                selectShortcutById(this.props.shortcutsStore, id);

                setTimeout(() => {
                    let element = document.querySelector(`.shortcut-${id}`);
                    if (element) {
                        element.scrollIntoView();
                    }
                }, 10);
            }
        );
    }

    @action
    showGroups() {
        this.props.shortcutsOrGroups!.set(false);
    }

    render() {
        let buttons = [];

        if (this.props.shortcutsStore.addShortcut) {
            buttons.push(
                <ButtonAction
                    key="addShortcut"
                    text="Add Shortcut"
                    title="Add shortcut"
                    onClick={this.addShortcut}
                    className="btn-success"
                />
            );
        }

        if (this.props.shortcutsOrGroups) {
            buttons.push(
                <ButtonAction
                    key="groups"
                    text="Show Groups"
                    title="Show groups"
                    onClick={this.showGroups}
                    className="btn-secondary"
                />
            );
        }

        return buttons;
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
class Keybinding extends React.Component<{ keybinding: string }, {}> {
    render() {
        return this.props.keybinding
            .split("+")
            .map(part => (
                <div key={part} className="EezStudio_Keybinding_Part">
                    {part}
                </div>
            ))
            .reduce(
                (
                    result: JSX.Element[],
                    element: JSX.Element,
                    index: number,
                    array: JSX.Element[]
                ) => {
                    result.push(element);

                    if (index < array.length - 1) {
                        result.push(<span key={"plus" + index}> + </span>);
                    }

                    return result;
                },
                []
            );
    }
}

@observer
class Shortcut extends React.Component<
    {
        shortcutsStore: IShortcutsStore;
        groupsStore?: IGroupsStore;
        shortcut: IShortcut | IShortcut[];
    },
    {}
> {
    @computed
    get shortcut() {
        if (Array.isArray(this.props.shortcut)) {
            return this.props.shortcut[0];
        } else {
            return this.props.shortcut;
        }
    }

    getExtension(shortcut: IShortcut) {
        return extensions.get(
            shortcut.groupName.substr(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX.length)
        );
    }

    getGroupName(shortcut: IShortcut) {
        let groupName = shortcut.groupName;
        if (!groupName) {
            return "";
        }

        if (groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)) {
            if (this.props.groupsStore && this.props.groupsStore.isGroupEnabled) {
                return FROM_EXTENSION_GROUP_NAME;
            }
            const extension = this.getExtension(shortcut);
            if (extension) {
                return extension.displayName || extension.name;
            }
        }

        if (groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX)) {
            return "";
        }

        return groupName;
    }

    @computed
    get groupName() {
        if (Array.isArray(this.props.shortcut)) {
            return this.props.shortcut
                .map(shortcut => this.getExtension(shortcut))
                .filter(extension => !!extension)
                .map(extension => (
                    <div key={extension!.id}>{extension!.displayName || extension!.name}</div>
                ));
        } else {
            return this.getGroupName(this.props.shortcut);
        }
    }

    render() {
        const {
            id,
            name,
            action,
            keybinding,
            selected,
            requiresConfirmation,
            showInToolbar,
            toolbarButtonColor,
            toolbarButtonPosition
        } = this.shortcut;

        let className = classNames(`shortcut-${id}`, {
            selected: this.props.shortcutsStore.addShortcut && selected
        });

        return (
            <tr
                className={className}
                onClick={() => {
                    if (this.props.shortcutsStore.addShortcut) {
                        selectShortcutById(this.props.shortcutsStore, id);
                    }
                }}
                onDoubleClick={() => {
                    if (this.props.shortcutsStore.addShortcut) {
                        showShortcutDialog(
                            this.props.shortcutsStore,
                            this.props.groupsStore,
                            this.shortcut,
                            shortcut => {
                                this.props.shortcutsStore.updateShortcut!(shortcut);
                            }
                        );
                    }
                }}
            >
                <td className="colColor">
                    <div
                        style={{
                            backgroundColor: showInToolbar ? toolbarButtonColor : "transparent"
                        }}
                    />
                </td>
                <td>{name}</td>
                {this.props.groupsStore && <td>{this.groupName}</td>}
                <td>
                    <Keybinding keybinding={keybinding} />
                </td>
                <td className="colAction">
                    {action.type === "scpi-commands" ? "SCPI" : "JavaScript"}
                </td>
                <td>{requiresConfirmation && <Icon icon="material:check" />}</td>
                <td>{showInToolbar && <Icon icon="material:check" />}</td>
                <td>{toolbarButtonPosition}</td>
                {this.props.shortcutsStore.addShortcut && (
                    <td>
                        <Toolbar>
                            <IconAction
                                icon="material:edit"
                                title="Edit shortcut"
                                onClick={() => {
                                    showShortcutDialog(
                                        this.props.shortcutsStore,
                                        this.props.groupsStore,
                                        this.shortcut,
                                        shortcut => {
                                            this.props.shortcutsStore.updateShortcut!(shortcut);
                                        }
                                    );
                                }}
                            />
                            <IconAction
                                icon="material:delete"
                                title="Delete shortcut"
                                onClick={() => {
                                    confirm("Are you sure?", undefined, () => {
                                        this.props.shortcutsStore.deleteShortcut!(this.shortcut);
                                    });
                                }}
                            />
                        </Toolbar>
                    </td>
                )}
            </tr>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

export function isSameShortcutFromDifferentExtension(s1: IShortcut, s2: IShortcut) {
    if (!s1.groupName || !s1.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)) {
        return false;
    }

    if (!s2.groupName || !s2.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)) {
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

    return JSON.stringify(s1js) === JSON.stringify(s2js);
}

@observer
export class Shortcuts extends React.Component<
    {
        shortcutsStore: IShortcutsStore;
        groupsStore?: IGroupsStore;
    },
    {}
> {
    @computed
    get shortcuts() {
        const sorted = Array.from(this.props.shortcutsStore.shortcuts.values()).sort((s1, s2) => {
            let name1 = s1.name.toLocaleLowerCase();
            let name2 = s2.name.toLocaleLowerCase();
            return name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
        });

        if (!this.props.groupsStore) {
            return sorted;
        }

        let result: (IShortcut | IShortcut[])[] = [];

        // combine duplicate shortcuts
        for (let i = 0; i < sorted.length; i++) {
            let j;
            for (j = i; j + 1 < sorted.length; j++) {
                if (!isSameShortcutFromDifferentExtension(sorted[i], sorted[j + 1])) {
                    break;
                }
            }
            if (j > i) {
                let shortcuts: IShortcut[] = [];
                for (let k = i; k <= j; k++) {
                    shortcuts.push(sorted[k]);
                }
                result.push(shortcuts);
                i = j;
            } else {
                result.push(sorted[i]);
            }
        }

        return result;
    }

    render() {
        return (
            <table
                className="EezStudio_ShortcutsOrGroupsTable EezStudio_ShortcutsTable table"
                tabIndex={-1}
            >
                <thead>
                    <tr>
                        <th />
                        <th>Name</th>
                        {this.props.groupsStore && <th>Group</th>}
                        <th>Keybinding</th>
                        <th>Action</th>
                        <th>Confirmation</th>
                        <th>Toolbar</th>
                        <th>Toolbar position</th>
                        {this.props.shortcutsStore.addShortcut && <th />}
                    </tr>
                </thead>
                <tbody>
                    {this.shortcuts.map(shortcut => (
                        <Shortcut
                            shortcutsStore={this.props.shortcutsStore}
                            groupsStore={this.props.groupsStore}
                            key={Array.isArray(shortcut) ? shortcut[0].id : shortcut.id}
                            shortcut={shortcut}
                        />
                    ))}
                </tbody>
            </table>
        );
    }
}

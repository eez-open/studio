import React from "react";
import { observable, computed, action, IObservableValue, toJS } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import { objectEqual } from "eez-studio-shared/util";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { confirm } from "eez-studio-ui/dialog-electron";
import { Icon } from "eez-studio-ui/icon";
import { Table, IColumn, IRow } from "eez-studio-ui/table";

import { extensions } from "eez-studio-shared/extensions/extensions";

import { IShortcut, IShortcutsStore, IGroupsStore } from "shortcuts/interfaces";
import { DEFAULT_TOOLBAR_BUTTON_COLOR } from "shortcuts/toolbar-button-colors";
import { showShortcutDialog } from "shortcuts/shortcut-dialog";
import {
    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX,
    FROM_EXTENSION_GROUP_NAME,
    SHORTCUTS_GROUP_NAME_FOR_INSTRUMENT_PREFIX
} from "shortcuts/shortcuts-store";

////////////////////////////////////////////////////////////////////////////////

const selectedShortcutId = observable.box<string>();

export function selectShortcutById(
    shortcutsStore: IShortcutsStore,
    id: string
) {
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
                    className="btn-primary"
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

////////////////////////////////////////////////////////////////////////////////

class ShortcutRow implements IRow {
    constructor(
        private props: {
            shortcutsStore: IShortcutsStore;
            groupsStore?: IGroupsStore;
            shortcut: IShortcut | IShortcut[];
        }
    ) {}

    @computed
    get shortcut() {
        if (Array.isArray(this.props.shortcut)) {
            return this.props.shortcut[0];
        } else {
            return this.props.shortcut;
        }
    }

    get id() {
        return this.shortcut.id;
    }

    get selected() {
        return this.shortcut.selected;
    }

    get color() {
        return this.shortcut.showInToolbar
            ? this.shortcut.toolbarButtonColor
            : "transparent";
    }

    @computed
    get colorComponent() {
        return (
            <div
                style={{
                    backgroundColor: this.shortcut.showInToolbar
                        ? this.shortcut.toolbarButtonColor
                        : "transparent"
                }}
            />
        );
    }

    get name() {
        return this.shortcut.name;
    }

    getExtension(shortcut: IShortcut) {
        return extensions.get(
            shortcut.groupName.substr(
                SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX.length
            )
        );
    }

    getGroupName(shortcut: IShortcut) {
        let groupName = shortcut.groupName;
        if (!groupName) {
            return "";
        }

        if (groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)) {
            if (
                this.props.groupsStore &&
                this.props.groupsStore.isGroupEnabled
            ) {
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
    get group() {
        if (Array.isArray(this.props.shortcut)) {
            return this.props.shortcut
                .map(shortcut => this.getExtension(shortcut))
                .filter(extension => !!extension)
                .map(extension => extension!.displayName || extension!.name)
                .filter((value, index, self) => self.indexOf(value) === index) // unique
                .join(",");
        } else {
            return this.getGroupName(this.props.shortcut);
        }
    }

    @computed
    get groupComponent() {
        if (Array.isArray(this.props.shortcut)) {
            return this.props.shortcut
                .map(shortcut => this.getExtension(shortcut))
                .filter(extension => !!extension)
                .filter((value, index, self) => self.indexOf(value) === index) // unique
                .map(extension => (
                    <div key={extension!.id}>
                        {extension!.displayName || extension!.name}
                    </div>
                ));
        } else {
            return this.getGroupName(this.props.shortcut);
        }
    }

    get keybinding() {
        return this.shortcut.keybinding || "";
    }

    @computed
    get keybindingComponent() {
        return <Keybinding keybinding={this.shortcut.keybinding} />;
    }

    @computed
    get action() {
        return this.shortcut.action.type === "scpi-commands"
            ? "SCPI"
            : this.shortcut.action.type === "javascript"
            ? "JavaScript"
            : "MicroPython";
    }

    get confirmation() {
        return this.shortcut.requiresConfirmation ? 1 : 0;
    }

    @computed
    get confirmationComponent() {
        return (
            this.shortcut.requiresConfirmation && <Icon icon="material:check" />
        );
    }

    @computed
    get toolbar() {
        return this.shortcut.showInToolbar ? 1 : 0;
    }

    @computed
    get toolbarComponent() {
        return this.shortcut.showInToolbar && <Icon icon="material:check" />;
    }

    get toolbarPosition() {
        return this.shortcut.toolbarButtonPosition;
    }

    @computed
    get isExtensionShortcut() {
        if (Array.isArray(this.props.shortcut)) {
            return true;
        } else {
            return (
                !!this.shortcut.groupName &&
                this.shortcut.groupName.startsWith(
                    SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
                )
            );
        }
    }

    @computed
    get actions() {
        return (
            this.props.shortcutsStore.addShortcut && (
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
                                    this.props.shortcutsStore.updateShortcut!(
                                        shortcut
                                    );
                                }
                            );
                        }}
                    />
                    <IconAction
                        icon="material:delete"
                        title="Delete shortcut"
                        onClick={() => {
                            confirm(
                                "Are you sure?",
                                this.isExtensionShortcut
                                    ? "This type of shortcut once deleted cannot be restored without reinstalling instrument extension."
                                    : undefined,
                                () => {
                                    this.props.shortcutsStore.deleteShortcut!(
                                        this.shortcut
                                    );
                                }
                            );
                        }}
                    />
                </Toolbar>
            )
        );
    }

    @computed
    get className() {
        return classNames(`shortcut-${this.id}`, {
            selected: this.props.shortcutsStore.addShortcut && this.selected
        });
    }

    @bind
    onClick() {
        if (this.props.shortcutsStore.addShortcut) {
            selectShortcutById(this.props.shortcutsStore, this.id);
        }
    }

    @bind
    onDoubleClick() {
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
    }
}

////////////////////////////////////////////////////////////////////////////////

export function isSameShortcutFromDifferentExtension(
    s1: IShortcut,
    s2: IShortcut
) {
    if (
        !s1.groupName ||
        !s1.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)
    ) {
        return false;
    }

    if (
        !s2.groupName ||
        !s2.groupName.startsWith(SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX)
    ) {
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

    return objectEqual(s1js, s2js);
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
    get columns() {
        let result: IColumn[] = [];

        result.push({
            name: "color",
            title: "",
            sortEnabled: true
        });
        result.push({
            name: "name",
            title: "Name",
            sortEnabled: true
        });

        if (this.props.groupsStore) {
            result.push({
                name: "group",
                title: "Group / Extension",
                sortEnabled: true
            });
        }

        result.push({
            name: "keybinding",
            title: "Keybinding",
            sortEnabled: true
        });
        result.push({
            name: "action",
            title: "Action",
            sortEnabled: true
        });
        result.push({
            name: "confirmation",
            title: "Confirmation",
            sortEnabled: true
        });
        result.push({
            name: "toolbar",
            title: "Toolbar",
            sortEnabled: true
        });
        result.push({
            name: "toolbarPosition",
            title: "Toolbar position",
            sortEnabled: true
        });

        if (this.props.shortcutsStore.addShortcut) {
            result.push({
                name: "actions",
                title: "",
                sortEnabled: false
            });
        }

        return result;
    }

    @computed
    get rows() {
        let result: (IShortcut | IShortcut[])[] = [];

        const sorted = Array.from(
            this.props.shortcutsStore.shortcuts.values()
        ).sort((s1, s2) => {
            let name1 = s1.name.toLocaleLowerCase();
            let name2 = s2.name.toLocaleLowerCase();
            return name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
        });

        if (this.props.groupsStore) {
            // combine duplicate shortcuts
            for (let i = 0; i < sorted.length; i++) {
                let j;
                for (j = i; j + 1 < sorted.length; j++) {
                    if (
                        !isSameShortcutFromDifferentExtension(
                            sorted[i],
                            sorted[j + 1]
                        )
                    ) {
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
        } else {
            result = sorted;
        }

        return result.map(
            shortcut =>
                new ShortcutRow({
                    shortcutsStore: this.props.shortcutsStore,
                    groupsStore: this.props.groupsStore,
                    shortcut
                })
        );
    }

    render() {
        return (
            <Table
                className="EezStudio_ShortcutsTable"
                persistId="shortcuts/shortcuts"
                columns={this.columns}
                rows={this.rows}
                defaultSortColumn="name"
            />
        );
    }
}

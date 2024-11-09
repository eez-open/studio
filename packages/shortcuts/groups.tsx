import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    IObservableValue,
    makeObservable
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { countBy } from "lodash";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { showDialog } from "eez-studio-ui/dialog";
import { confirm } from "eez-studio-ui/dialog-electron";
import { Table, IColumn, IRow } from "eez-studio-ui/table";

import { IGroup, IGroupsStore, IShortcutsStore } from "shortcuts/interfaces";
import { GroupDialog } from "shortcuts/group-dialog";
import { SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX } from "shortcuts/shortcuts-store";

////////////////////////////////////////////////////////////////////////////////

const selectedGroupId = observable.box<string>();

////////////////////////////////////////////////////////////////////////////////

export const GroupsToolbarButtons = observer(
    class GroupsToolbarButtons extends React.Component<
        {
            shortcutsOrGroups: IObservableValue<boolean>;
            groupsStore: IGroupsStore;
        },
        {}
    > {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                showShortcuts: action
            });
        }

        addGroup = () => {
            showDialog(
                <GroupDialog
                    groupsStore={this.props.groupsStore}
                    group={{
                        id: "",
                        name: ""
                    }}
                    callback={(group: IGroup) => {
                        let groupId = this.props.groupsStore.addGroup(group);

                        runInAction(() => selectedGroupId.set(groupId));

                        setTimeout(() => {
                            let element = document.querySelector(
                                `.group-${groupId}`
                            );
                            if (element) {
                                element.scrollIntoView();
                            }
                        }, 10);
                    }}
                />
            );
        };

        showShortcuts = () => {
            this.props.shortcutsOrGroups.set(true);
        };

        render() {
            return [
                <ButtonAction
                    key="addGroup"
                    text="Add Group"
                    title="Add group"
                    onClick={this.addGroup}
                    className="btn-success"
                />,
                <ButtonAction
                    key="shortcuts"
                    text="Show Shortcuts"
                    title="Show shortcuts"
                    onClick={this.showShortcuts}
                    className="btn-secondary"
                />
            ];
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

class GroupRow implements IRow {
    constructor(
        private props: {
            groupsStore: IGroupsStore;
            group: IGroup;
            numShortcuts: number;
        }
    ) {
        makeObservable(this, {
            selected: computed,
            isGroupEnabledComponent: computed,
            actions: computed,
            className: computed,
            selectGroup: action
        });
    }

    get id() {
        return this.props.group.id;
    }

    get selected() {
        return selectedGroupId.get() === this.id;
    }

    get isGroupEnabled() {
        return this.props.groupsStore.isGroupEnabled ? 1 : 0;
    }

    get isGroupEnabledComponent() {
        return (
            this.props.groupsStore.isGroupEnabled && (
                <input
                    type="checkbox"
                    checked={
                        this.props.groupsStore.isGroupEnabled &&
                        this.props.groupsStore.isGroupEnabled(this.props.group)
                    }
                    onChange={event =>
                        this.props.groupsStore.enableGroup!(
                            this.props.group,
                            event.target.checked
                        )
                    }
                />
            )
        );
    }

    get name() {
        return this.props.group.name;
    }

    get numShortcuts() {
        return this.props.numShortcuts;
    }

    get actions() {
        return (
            <Toolbar>
                <IconAction
                    icon="material:edit"
                    title="Edit group"
                    onClick={this.editGroup}
                />
                <IconAction
                    icon="material:delete"
                    title="Delete group"
                    onClick={this.deleteGroup}
                />
            </Toolbar>
        );
    }

    get className() {
        return classNames(`group-${this.id}`, {
            selected: this.selected
        });
    }

    selectGroup() {
        selectedGroupId.set(this.id);
    }

    editGroup = () => {
        showDialog(
            <GroupDialog
                groupsStore={this.props.groupsStore}
                group={this.props.group}
                callback={(group: IGroup) => {
                    this.props.groupsStore.updateGroup(group);
                }}
            />
        );
    };

    deleteGroup = () => {
        confirm(
            "Are you sure?",
            this.props.numShortcuts > 0
                ? "This will delete all the shortcuts belonging to this group!"
                : undefined,
            () => {
                this.props.groupsStore.deleteGroup(this.props.group);
            }
        );
    };

    onClick = () => {
        this.selectGroup();
    };

    onDoubleClick = () => {
        this.editGroup();
    };
}

class ExtensionGroupRow implements IRow {
    constructor(public numShortcuts: number) {
        makeObservable(this, {
            selected: computed,
            isGroupEnabledComponent: computed,
            className: computed,
            selectGroup: action
        });
    }

    get id() {
        return "__extensions__";
    }

    get selected() {
        return selectedGroupId.get() === this.id;
    }

    get isGroupEnabled() {
        return 1;
    }

    get isGroupEnabledComponent() {
        return <input type="checkbox" checked={true} disabled={true} />;
    }

    get name() {
        return "<IEXT shortcuts>";
    }

    get actions() {
        return null;
    }

    get className() {
        return classNames(`group-${this.id}`, {
            selected: this.selected
        });
    }

    selectGroup() {
        selectedGroupId.set(this.id);
    }

    onClick = () => {
        this.selectGroup();
    };
}

////////////////////////////////////////////////////////////////////////////////

export const Groups = observer(
    class Groups extends React.Component<{
        groupsStore: IGroupsStore;
        shortcutsStore: IShortcutsStore;
    }> {
        constructor(props: {
            groupsStore: IGroupsStore;
            shortcutsStore: IShortcutsStore;
        }) {
            super(props);

            makeObservable(this, {
                columns: computed,
                numShortcuts: computed,
                rows: computed
            });
        }

        get columns() {
            let result: IColumn[] = [];

            if (this.props.groupsStore.isGroupEnabled) {
                result.push({
                    name: "isGroupEnabled",
                    title: "",
                    sortEnabled: true
                });
            }

            result.push({
                name: "name",
                title: "Name",
                sortEnabled: true
            });
            result.push({
                name: "numShortcuts",
                title: "# Shortcuts",
                sortEnabled: true
            });
            result.push({
                name: "actions",
                title: "",
                sortEnabled: false
            });

            return result;
        }

        get numShortcuts() {
            return countBy(
                Array.from(this.props.shortcutsStore.shortcuts.values()),
                shortcut => shortcut.groupName
            );
        }

        get numExtensionShortcuts() {
            return [...this.props.shortcutsStore.shortcuts.values()].filter(
                shortcut =>
                    shortcut.groupName.startsWith(
                        SHORTCUTS_GROUP_NAME_FOR_EXTENSION_PREFIX
                    )
            ).length;
        }

        get rows() {
            return [
                new ExtensionGroupRow(this.numExtensionShortcuts),
                ...Array.from(this.props.groupsStore.groups.values()).map(
                    group =>
                        new GroupRow({
                            groupsStore: this.props.groupsStore,
                            group,
                            numShortcuts: this.numShortcuts[group.name] || 0
                        })
                )
            ];
        }

        render() {
            return (
                <Table
                    className="EezStudio_GroupsTable"
                    persistId="shortcuts/groups"
                    columns={this.columns}
                    rows={this.rows}
                    defaultSortColumn="name"
                />
            );
        }
    }
);

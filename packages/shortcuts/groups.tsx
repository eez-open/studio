import React from "react";
import {
    observable,
    computed,
    action,
    runInAction,
    IObservableValue
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import { _countBy } from "eez-studio-shared/algorithm";

import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction, ButtonAction } from "eez-studio-ui/action";
import { showDialog } from "eez-studio-ui/dialog";
import { confirm } from "eez-studio-ui/dialog-electron";
import { Table, IColumn, IRow } from "eez-studio-ui/table";

import { IGroup, IGroupsStore, IShortcutsStore } from "shortcuts/interfaces";
import { GroupDialog } from "shortcuts/group-dialog";

////////////////////////////////////////////////////////////////////////////////

const selectedGroupId = observable.box<string>();

////////////////////////////////////////////////////////////////////////////////

@observer
export class GroupsToolbarButtons extends React.Component<
    {
        shortcutsOrGroups: IObservableValue<boolean>;
        groupsStore: IGroupsStore;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.addGroup = this.addGroup.bind(this);
        this.showShortcuts = this.showShortcuts.bind(this);
    }

    addGroup() {
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
    }

    @action
    showShortcuts() {
        this.props.shortcutsOrGroups.set(true);
    }

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

////////////////////////////////////////////////////////////////////////////////

class GroupRow implements IRow {
    constructor(
        private props: {
            groupsStore: IGroupsStore;
            group: IGroup;
            numShortcuts: number;
        }
    ) {}

    get id() {
        return this.props.group.id;
    }

    @computed
    get selected() {
        return selectedGroupId.get() === this.id;
    }

    get isGroupEnabled() {
        return this.props.groupsStore.isGroupEnabled ? 1 : 0;
    }

    @computed
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

    @computed
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

    @computed
    get className() {
        return classNames(`group-${this.id}`, {
            selected: this.selected
        });
    }

    @action
    selectGroup() {
        selectedGroupId.set(this.id);
    }

    @bind
    editGroup() {
        showDialog(
            <GroupDialog
                groupsStore={this.props.groupsStore}
                group={this.props.group}
                callback={(group: IGroup) => {
                    this.props.groupsStore.updateGroup(group);
                }}
            />
        );
    }

    @bind
    deleteGroup() {
        confirm(
            "Are you sure?",
            this.props.numShortcuts > 0
                ? "This will delete all the shortcuts belonging to this group!"
                : undefined,
            () => {
                this.props.groupsStore.deleteGroup(this.props.group);
            }
        );
    }

    @bind
    onClick() {
        this.selectGroup();
    }

    @bind
    onDoubleClick() {
        this.editGroup();
    }
}

////////////////////////////////////////////////////////////////////////////////

@observer
export class Groups extends React.Component<{
    groupsStore: IGroupsStore;
    shortcutsStore: IShortcutsStore;
}> {
    @computed
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

    @computed
    get numShortcuts() {
        return _countBy(
            Array.from(this.props.shortcutsStore.shortcuts.values()),
            shortcut => shortcut.groupName
        );
    }

    @computed
    get rows() {
        return Array.from(this.props.groupsStore.groups.values()).map(
            group =>
                new GroupRow({
                    groupsStore: this.props.groupsStore,
                    group,
                    numShortcuts: this.numShortcuts[group.name] || 0
                })
        );
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

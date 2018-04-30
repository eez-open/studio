import * as React from "react";
import { observable, computed, action, IObservableValue, values } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { _countBy } from "shared/algorithm";
import { Toolbar } from "shared/ui/toolbar";
import { IconAction, ButtonAction } from "shared/ui/action";
import { showDialog, confirm } from "shared/ui/dialog";

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

                    action(() => selectedGroupId.set(groupId))();

                    setTimeout(() => {
                        let element = document.querySelector(`.group-${groupId}`);
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

@observer
class Group extends React.Component<
    {
        groupsStore: IGroupsStore;
        group: IGroup;
        numShortcuts: number;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.selectGroup = this.selectGroup.bind(this);
        this.editGroup = this.editGroup.bind(this);
        this.deleteGroup = this.deleteGroup.bind(this);
    }

    @observable selected: boolean;

    @action
    selectGroup() {
        selectedGroupId.set(this.props.group.id);
    }

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

    render() {
        const { group, numShortcuts } = this.props;

        let className = classNames(`group-${group.id}`, {
            selected: selectedGroupId.get() === group.id
        });

        return (
            <tr className={className} onClick={this.selectGroup} onDoubleClick={this.editGroup}>
                {this.props.groupsStore.isGroupEnabled && (
                    <td>
                        <input
                            type="checkbox"
                            checked={
                                this.props.groupsStore.isGroupEnabled &&
                                this.props.groupsStore.isGroupEnabled(group)
                            }
                            onChange={event =>
                                this.props.groupsStore.enableGroup!(group, event.target.checked)
                            }
                        />
                    </td>
                )}
                <td>{group.name}</td>
                <td>{numShortcuts}</td>
                <td>
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
                </td>
            </tr>
        );
    }
}
////////////////////////////////////////////////////////////////////////////////

@observer
export class Groups extends React.Component<
    {
        groupsStore: IGroupsStore;
        shortcutsStore: IShortcutsStore;
    },
    {}
> {
    constructor(props: any) {
        super(props);
    }

    @computed
    get numShortcuts() {
        return _countBy(
            values(this.props.shortcutsStore.shortcuts),
            shortcut => shortcut.groupName
        );
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

                    action(() => selectedGroupId.set(groupId))();

                    setTimeout(() => {
                        let element = document.querySelector(`.group-${groupId}`);
                        if (element) {
                            element.scrollIntoView();
                        }
                    }, 10);
                }}
            />
        );
    }

    render() {
        return (
            <table
                className="EezStudio_ShortcutsOrGroupsTable EezStudio_GroupsTable table"
                tabIndex={-1}
            >
                <thead>
                    <tr>
                        {this.props.groupsStore.isGroupEnabled && <th />}
                        <th>Name</th>
                        <th># Shortcuts</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {values(this.props.groupsStore.groups).map(group => {
                        return (
                            <Group
                                key={group.id}
                                groupsStore={this.props.groupsStore}
                                group={group}
                                numShortcuts={this.numShortcuts[group.name] || 0}
                            />
                        );
                    })}
                </tbody>
            </table>
        );
    }
}

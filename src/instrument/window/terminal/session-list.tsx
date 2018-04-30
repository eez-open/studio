import * as React from "react";
import { observable, computed, action, toJS } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import { formatDateTimeLong } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { IconAction } from "shared/ui/action";
import { Dialog, showDialog } from "shared/ui/dialog";
import { PropertyList, TextInputProperty } from "shared/ui/properties";
import { logUpdate } from "shared/activity-log";

import { historySessions, ISession } from "instrument/window/history";
import { appStore } from "instrument/window/app-store";

@observer
class EditSessionNameDialog extends React.Component<
{
    name: string;
    callback: (name: string) => void;
},
{}
> {
    constructor(props: any) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.name = this.props.name;
    }

    @observable name: string;

    @action
    handleChange(value: string) {
        this.name = value;
    }

    handleSubmit() {
        this.props.callback(this.name);
        return true;
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit}>
                <PropertyList>
                    <TextInputProperty value={this.name} onChange={this.handleChange} />
                </PropertyList>
            </Dialog>
        );
    }
}

export function showEditSessionNameDialog(name: string, callback: (name: string) => void) {
    showDialog(<EditSessionNameDialog callback={callback} name={name} />);
}

@observer
export class SessionListItem extends React.Component<{ session: ISession }, {}> {
    constructor(props: any) {
        super(props);
        this.handleEditSessionName = this.handleEditSessionName.bind(this);
        this.handleClearSessionName = this.handleClearSessionName.bind(this);
        this.onClick = this.onClick.bind(this);
    }

    @computed
    get message(): {
        connectionParameters?: any;
        sessionName: string | undefined;
    } {
        let message = this.props.session.historyItem.message;
        if (!message) {
            return {
                sessionName: undefined
            };
        }

        try {
            return JSON.parse(message);
        } catch (err) {
            return {
                sessionName: message
            };
        }
    }

    handleEditSessionName() {
        showEditSessionNameDialog(this.message.sessionName || "", name => {
            let message = toJS(this.message);
            message.sessionName = name;

            beginTransaction("Edit session name");
            logUpdate(
                {
                    id: this.props.session.id,
                    oid: appStore.instrument!.id,
                    message: JSON.stringify(message)
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    handleClearSessionName() {
        let message = toJS(this.message);
        message.sessionName = undefined;

        beginTransaction("Clear session name");
        logUpdate(
            {
                id: this.props.session.id,
                oid: appStore.instrument!.id,
                message: JSON.stringify(message)
            },
            {
                undoable: true
            }
        );
        commitTransaction();
    }

    onClick() {
        historySessions.selectSession(this.props.session);
    }

    render() {
        let className = classNames("EezStudio_SessionListItem", {
            selected: this.props.session.selected
        });

        return (
            <tr
                className={className}
                onClick={this.onClick}
                onDoubleClick={this.handleEditSessionName}
            >
                <td>{formatDateTimeLong(this.props.session.historyItem.date)} </td>
                <td>{this.message.sessionName}</td>
                <td>
                    <IconAction
                        icon="material:edit"
                        title="Edit session name"
                        onClick={this.handleEditSessionName}
                    />
                    {this.message.sessionName && (
                        <IconAction
                            icon="material:clear"
                            title="Clear session name"
                            onClick={this.handleClearSessionName}
                        />
                    )}
                </td>
            </tr>
        );
    }
}

@observer
export class SessionList extends React.Component<{}, {}> {
    render() {
        return (
            <div className="EezStudio_SessionList">
                <table>
                    <tbody>
                        {historySessions.sessions.map(session => (
                            <SessionListItem key={session.id} session={session} />
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
}

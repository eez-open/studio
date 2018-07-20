import * as React from "react";
import { observable, computed, action, toJS } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";
import { bind } from "bind-decorator";

import { formatDateTimeLong } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { log, logUpdate, logDelete } from "shared/activity-log";

import { IconAction } from "shared/ui/action";
import { Dialog, showDialog } from "shared/ui/dialog";
import { PropertyList, TextInputProperty } from "shared/ui/properties";
import { VerticalHeaderWithBody, ToolbarHeader, Body } from "shared/ui/header-with-body";
import { ButtonAction } from "shared/ui/action";
import { confirm } from "shared/ui/dialog";

import { IAppStore, History, ISession } from "instrument/window/history/history";

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
export class SessionListItem extends React.Component<
    { appStore: IAppStore; history: History; session: ISession },
    {}
> {
    @computed
    get message(): {
        connectionParameters?: any;
        sessionName: string | undefined;
    } {
        let message = this.props.session.activityLogEntry.message;
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

    @bind
    handleEditSessionName() {
        showEditSessionNameDialog(this.message.sessionName || "", name => {
            let message = toJS(this.message);
            message.sessionName = name;

            beginTransaction("Edit session name");
            logUpdate(
                {
                    id: this.props.session.id,
                    oid: this.props.appStore.instrument!.id,
                    message: JSON.stringify(message)
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    @bind
    handleClearSessionName() {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Delete session");

            logDelete(this.props.session.activityLogEntry, {
                undoable: false
            });

            commitTransaction();
        });
    }

    @bind
    onClick() {
        this.props.history.sessions.selectSession(this.props.session);
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
                <td>{formatDateTimeLong(this.props.session.activityLogEntry.date)} </td>
                <td>{this.message.sessionName}</td>
                <td>
                    <IconAction
                        icon="material:edit"
                        title="Edit session name"
                        onClick={this.handleEditSessionName}
                    />
                    <IconAction
                        icon="material:clear"
                        title="Clear session name"
                        onClick={this.handleClearSessionName}
                    />
                </td>
            </tr>
        );
    }
}

@observer
export class SessionList extends React.Component<{ appStore: IAppStore; history: History }> {
    @bind
    newSession() {
        showEditSessionNameDialog("", name => {
            beginTransaction("New session");
            log(
                {
                    oid: "0",
                    type: "activity-log/session",
                    message: JSON.stringify({
                        sessionName: name
                    })
                },
                {
                    undoable: false
                }
            );
            commitTransaction();
        });
    }

    render() {
        return (
            <VerticalHeaderWithBody>
                <ToolbarHeader className="EezStudio_PanelHeader">
                    <ButtonAction
                        text="New Session"
                        title="Create a new session"
                        className="btn-success"
                        onClick={this.newSession}
                    />
                </ToolbarHeader>
                <Body className="EezStudio_HistoryTable selectable">
                    <div className="EezStudio_SessionList">
                        <table>
                            <tbody>
                                {this.props.history.sessions.sessions.map(session => (
                                    <SessionListItem
                                        appStore={this.props.appStore}
                                        key={session.id}
                                        history={this.props.history}
                                        session={session}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

import React from "react";
import { computed, toJS } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import { bind } from "bind-decorator";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { log, logUpdate, logDelete } from "eez-studio-shared/activity-log";

import { validators } from "eez-studio-shared/model/validation";

import styled from "eez-studio-ui/styled-components";
import { IconAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import { Body } from "eez-studio-ui/header-with-body";
import { confirm } from "eez-studio-ui/dialog-electron";

import { IAppStore, History } from "instrument/window/history/history";
import { ISession } from "instrument/window/history/session/store";

export function showEditSessionNameDialog(name: string, callback: (name: string) => void) {
    showGenericDialog({
        dialogDefinition: {
            fields: [
                {
                    name: "sessionName",
                    type: "string",
                    validators: [validators.required]
                }
            ]
        },

        values: {
            sessionName: name
        }
    })
        .then(result => callback(result.values.sessionName))
        .catch(() => {});
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
                this.props.appStore.history.options.store,
                {
                    id: this.props.session.id,
                    oid: this.props.appStore.history.oid,
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
    handleDeleteSession() {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Delete session");

            logDelete(
                this.props.appStore.history.options.store,
                {
                    id: this.props.session.activityLogEntry.id,
                    oid: "0",
                    type: "activity-log/session-start"
                },
                {
                    undoable: false
                }
            );

            const message = JSON.parse(this.props.session.activityLogEntry.message);
            if (message.sessionCloseId) {
                logDelete(
                    this.props.appStore.history.options.store,
                    {
                        id: message.sessionCloseId,
                        oid: "0",
                        type: "activity-log/session-close"
                    },
                    {
                        undoable: false
                    }
                );
            }

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
                        title="Delete session"
                        onClick={this.handleDeleteSession}
                    />
                </td>
            </tr>
        );
    }
}

const SessionListTableContainer = styled.div`
    padding: 5px;

    tbody > tr {
        cursor: pointer;
        font-size: 90%;

        &.selected {
            background-color: ${props => props.theme.selectionBackgroundColor};
            color: white;
            .text-muted {
                color: #ccc !important;
            }
            .EezStudio_Action {
                color: white;
            }
            .EezStudio_Action:hover {
                color: #aaa;
            }
        }

        table {
            width: 100%;
        }

        td {
            position: relative;
        }

        td:nth-child(1) {
            padding-right: 10px;
            white-space: nowrap;
        }

        td:nth-child(2) {
            width: 100%;
        }

        td:nth-child(3) {
            white-space: nowrap;
        }

        .EezStudio_Icon {
            visibility: hidden;
        }

        &:hover .EezStudio_Icon {
            visibility: visible;
        }
    }
`;

@observer
export class SessionList extends React.Component<{ appStore: IAppStore; history: History }> {
    @bind
    newSession() {
        showEditSessionNameDialog("", name => {
            beginTransaction("New session");
            log(
                this.props.appStore.history.options.store,
                {
                    oid: "0",
                    type: "activity-log/session-start",
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
            <Body className="EezStudio_HistoryTable selectable">
                <SessionListTableContainer>
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
                </SessionListTableContainer>
            </Body>
        );
    }
}

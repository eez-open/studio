import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { validators } from "eez-studio-shared/validation";

import { IconAction, TextAction } from "eez-studio-ui/action";
import { showGenericDialog } from "eez-studio-ui/generic-dialog";
import {
    Body,
    ToolbarHeader,
    VerticalHeaderWithBody
} from "eez-studio-ui/header-with-body";
import { confirm } from "eez-studio-ui/dialog-electron";

import type { IAppStore, History } from "instrument/window/history/history";
import {
    historySessions,
    IHistorySession,
    SESSION_FREE_ID
} from "instrument/window/history/session/store";

export function showEditSessionNameDialog(
    name: string,
    callback: (name: string) => void
) {
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

export const SessionListItem = observer(
    class SessionListItem extends React.Component<
        { appStore: IAppStore; history: History; session: IHistorySession },
        {}
    > {
        constructor(props: {
            appStore: IAppStore;
            history: History;
            session: IHistorySession;
        }) {
            super(props);
        }

        handleEditSessionName = () => {
            showEditSessionNameDialog(this.props.session?.name ?? "", name => {
                historySessions.updateSessionName(this.props.session, name);
            });
        };

        handleDeleteSession = () => {
            confirm("Are you sure?", undefined, () => {
                historySessions.deleteSession(this.props.session);
            });
        };

        onClick = () => {
            historySessions.activateSession(this.props.session.id);
        };

        render() {
            let className = classNames("EezStudio_SessionListItem", {
                selected:
                    this.props.session.id == historySessions.activeSessionId,
                session_free_mode: this.props.session.id == SESSION_FREE_ID
            });

            return (
                <tr
                    className={className}
                    onClick={this.onClick}
                    onDoubleClick={this.handleEditSessionName}
                >
                    <td>{this.props.session.name}</td>
                    <td>
                        {this.props.session.id != SESSION_FREE_ID && (
                            <IconAction
                                icon="material:edit"
                                title="Edit session name"
                                onClick={this.handleEditSessionName}
                            />
                        )}
                        {this.props.session.id != SESSION_FREE_ID && (
                            <IconAction
                                icon="material:clear"
                                title="Delete session"
                                onClick={this.handleDeleteSession}
                            />
                        )}
                    </td>
                </tr>
            );
        }
    }
);

export const SessionList = observer(
    class SessionList extends React.Component<{
        appStore: IAppStore;
        history: History;
    }> {
        newSession = () => {
            showEditSessionNameDialog("", name => {
                historySessions.createNewSession(name);
            });
        };

        render() {
            return (
                <VerticalHeaderWithBody className="EezStudio_SessionList">
                    <ToolbarHeader>
                        <TextAction
                            text="Create Session"
                            title="Create a new session"
                            onClick={this.newSession}
                        />
                    </ToolbarHeader>
                    <Body className="EezStudio_HistoryTable selectable">
                        <div className="EezStudio_SessionListTableContainer">
                            <table>
                                <tbody>
                                    {historySessions.sessions.map(session => (
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
);

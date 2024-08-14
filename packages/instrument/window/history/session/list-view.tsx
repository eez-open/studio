import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { validators } from "eez-studio-shared/validation";

import { ButtonAction, IconAction } from "eez-studio-ui/action";
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
    session: IHistorySession | undefined,
    callback: (name: string) => void
) {
    showGenericDialog({
        dialogDefinition: {
            title: session ? "Edit Session Name" : "New Session",
            fields: [
                {
                    name: "name",
                    type: "string",
                    validators: [
                        validators.required,
                        validators.unique(
                            session,
                            historySessions.sessions,
                            "A session with this name already exists."
                        )
                    ]
                }
            ]
        },

        values: {
            name: session?.name ?? ""
        }
    })
        .then(result => callback(result.values.name))
        .catch(() => {});
}

export const SessionListItem = observer(
    class SessionListItem extends React.Component<{
        appStore: IAppStore;
        history: History;
        session: IHistorySession;
        isSelected: boolean;
        onSelect: () => void;
    }> {
        render() {
            let className = classNames("EezStudio_SessionListItem", {
                selected: this.props.isSelected,
                session_free_mode: this.props.session.id == SESSION_FREE_ID
            });

            return (
                <tr className={className} onClick={this.props.onSelect}>
                    <td>{this.props.session.name}</td>
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
        ref = React.createRef<HTMLDivElement>();

        constructor(props: any) {
            super(props);
        }

        componentDidMount() {
            this.ensureSelectedVisible();
        }

        componentDidUpdate() {
            this.ensureSelectedVisible();
        }

        ensureSelectedVisible() {
            const selected = this.ref.current?.querySelector(".selected");
            if (selected) {
                selected.scrollIntoView({ block: "nearest" });
            }
        }

        newSession = () => {
            showEditSessionNameDialog(undefined, name => {
                historySessions.createNewSession(name);
            });
        };

        handleEditSessionName = () => {
            const selectedSession = historySessions.selectedSession;
            if (selectedSession) {
                showEditSessionNameDialog(selectedSession, name => {
                    historySessions.updateSessionName(selectedSession, name);
                });
            }
        };

        handleDeleteSession = () => {
            const selectedSession = historySessions.selectedSession;
            if (selectedSession) {
                confirm("Are you sure?", undefined, () => {
                    historySessions.deleteSession(selectedSession);
                });
            }
        };

        handleDeleteForeverSession = () => {
            const session = historySessions.selectedSession;
            if (session) {
                confirm(
                    "Are you sure?",
                    "This will irrevocably delete the selected session and all history items belonging to the session.",
                    () => {
                        historySessions.deleteForeverSession(session);
                    }
                );
            }
        };

        render() {
            return (
                <VerticalHeaderWithBody className="EezStudio_SessionList">
                    <ToolbarHeader>
                        {historySessions.showDeleted ? (
                            <>
                                <IconAction
                                    key="restore"
                                    icon="material:restore"
                                    title="Restore selected session"
                                    onClick={historySessions.restoreSession}
                                />
                                <IconAction
                                    icon="material:delete_forever"
                                    title="Delete forever session"
                                    onClick={this.handleDeleteForeverSession}
                                    enabled={
                                        historySessions.selectedSession !=
                                        undefined
                                    }
                                />
                                <ButtonAction
                                    key="back"
                                    icon="material:arrow_back"
                                    text="Back"
                                    title={"Go back to the sessions list"}
                                    onClick={() =>
                                        historySessions.setShowDeleted(false)
                                    }
                                    className="btn-secondary btn-sm"
                                />
                            </>
                        ) : (
                            <>
                                <IconAction
                                    icon="material:add"
                                    title="Create a new session"
                                    onClick={this.newSession}
                                />
                                <IconAction
                                    icon="material:edit"
                                    title="Edit session name"
                                    onClick={this.handleEditSessionName}
                                    enabled={
                                        historySessions.selectedSession.id !==
                                        SESSION_FREE_ID
                                    }
                                />
                                <IconAction
                                    icon="material:delete"
                                    title="Delete session"
                                    onClick={this.handleDeleteSession}
                                    enabled={
                                        historySessions.selectedSession.id !==
                                        SESSION_FREE_ID
                                    }
                                />
                                {historySessions.deletedSessions.length > 0 && (
                                    <ButtonAction
                                        text={`Deleted Sessions (${historySessions.deletedSessions.length})`}
                                        icon="material:delete"
                                        title="Show deleted sessions"
                                        onClick={() =>
                                            historySessions.setShowDeleted(true)
                                        }
                                        className="btn-secondary btn-sm"
                                        style={{ marginLeft: 20 }}
                                    />
                                )}
                            </>
                        )}
                    </ToolbarHeader>
                    <Body className="EezStudio_HistoryTable selectable">
                        <div
                            className="EezStudio_SessionListTableContainer"
                            ref={this.ref}
                        >
                            <table>
                                <tbody>
                                    {(historySessions.showDeleted
                                        ? historySessions.deletedSessions
                                        : historySessions.sessions
                                    ).map(session => (
                                        <SessionListItem
                                            appStore={this.props.appStore}
                                            key={session.id}
                                            history={this.props.history}
                                            session={session}
                                            isSelected={
                                                session.id ==
                                                historySessions.selectedSession
                                                    .id
                                            }
                                            onSelect={action(() => {
                                                if (
                                                    historySessions.showDeleted
                                                ) {
                                                    historySessions.selectSession(
                                                        session
                                                    );
                                                } else {
                                                    historySessions.activateSession(
                                                        session.id
                                                    );
                                                }
                                            })}
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

import React from "react";
import { action, autorun, makeObservable, observable } from "mobx";
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

import type { IAppStore } from "instrument/window/history/history";
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
        session: IHistorySession;
        isSelected: boolean;
        onSelect: () => void;
    }> {
        get lastActivity() {
            const lastActivity = historySessions.getLastActivity(
                this.props.session
            );
            return lastActivity ? lastActivity.toLocaleString() : "";
        }

        render() {
            let className = classNames({
                selected: this.props.isSelected,
                session_free_mode: this.props.session.id == SESSION_FREE_ID
            });

            return (
                <tr className={className} onClick={this.props.onSelect}>
                    <td>{this.props.session.name}</td>
                    <td>{this.lastActivity}</td>
                </tr>
            );
        }
    }
);

export const SessionList = observer(
    class SessionList extends React.Component<{
        appStore: IAppStore;
    }> {
        ref = React.createRef<HTMLDivElement>();

        sortBy: string = "name-asc";

        constructor(props: any) {
            super(props);

            this.sortBy =
                window.localStorage.getItem("session-list-sort") ?? "name-asc";

            makeObservable(this, {
                sortBy: observable
            });

            autorun(() => {
                window.localStorage.setItem("session-list-sort", this.sortBy);
            });
        }

        get sessions() {
            const sessions = (
                historySessions.showDeleted
                    ? historySessions.deletedSessions
                    : historySessions.sessions
            ).slice();

            const sortedSessions = sessions.slice(1);

            sortedSessions.sort((a, b) => {
                let result;

                if (this.sortBy.startsWith("name")) {
                    result = b.name
                        .toLowerCase()
                        .localeCompare(a.name.toLowerCase());
                } else {
                    const aLastActivity = historySessions.getLastActivity(a);
                    const bLastActivity = historySessions.getLastActivity(b);

                    if (!aLastActivity && !bLastActivity) {
                        result = 0;
                    } else if (!aLastActivity) {
                        result = this.sortBy.endsWith("asc") ? -1 : 1;
                    } else if (!bLastActivity) {
                        result = this.sortBy.endsWith("asc") ? 1 : -1;
                    } else {
                        result =
                            aLastActivity < bLastActivity
                                ? 1
                                : aLastActivity > bLastActivity
                                ? -1
                                : 0;
                    }
                }

                if (this.sortBy.endsWith("asc")) {
                    result = -result;
                }

                return result;
            });

            return [sessions[0], ...sortedSessions];
        }

        componentDidMount() {
            this.ensureSelectedVisible();
        }

        componentDidUpdate() {
            this.ensureSelectedVisible();
        }

        ensureSelectedVisible() {
            const container = this.ref.current;
            if (container) {
                const selected = container.querySelector(".selected");
                if (selected) {
                    const rectSelected = selected.getBoundingClientRect();
                    const rectContainer = container.getBoundingClientRect();

                    const margin = 2 * rectSelected.height;

                    let y = rectSelected.y - rectContainer.y;

                    const scrollTop = container.parentElement!.scrollTop;
                    const height = container.parentElement!.clientHeight;

                    if (scrollTop > y - margin) {
                        container.parentElement!.scrollTop = y - margin;
                    } else if (
                        scrollTop + height <
                        y + rectSelected.height + margin
                    ) {
                        container.parentElement!.scrollTop =
                            y + rectSelected.height + margin - height;
                    }
                }
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
                                    onClick={() =>
                                        historySessions.restoreSession(
                                            historySessions.selectedSession
                                        )
                                    }
                                    enabled={
                                        historySessions.selectedSession !=
                                        undefined
                                    }
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
                                <thead>
                                    <tr>
                                        <th
                                            className={classNames(
                                                "sort-enabled",
                                                {
                                                    "sort-asc":
                                                        this.sortBy ==
                                                        "name-asc",
                                                    "sort-desc":
                                                        this.sortBy ==
                                                        "name-desc"
                                                }
                                            )}
                                            onClick={action(() => {
                                                if (this.sortBy == "name-asc") {
                                                    this.sortBy = "name-desc";
                                                } else {
                                                    this.sortBy = "name-asc";
                                                }
                                            })}
                                        >
                                            Name
                                        </th>
                                        <th
                                            className={classNames(
                                                "sort-enabled",
                                                {
                                                    "sort-asc":
                                                        this.sortBy ==
                                                        "last-activity-asc",
                                                    "sort-desc":
                                                        this.sortBy ==
                                                        "last-activity-desc"
                                                }
                                            )}
                                            onClick={action(() => {
                                                if (
                                                    this.sortBy ==
                                                    "last-activity-asc"
                                                ) {
                                                    this.sortBy =
                                                        "last-activity-desc";
                                                } else {
                                                    this.sortBy =
                                                        "last-activity-asc";
                                                }
                                            })}
                                        >
                                            Last Activity
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {this.sessions.map(session => (
                                        <SessionListItem
                                            appStore={this.props.appStore}
                                            key={session.id}
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

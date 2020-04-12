import { observable, action, runInAction, autorun } from "mobx";
import { bind } from "bind-decorator";

import { dbQuery } from "eez-studio-shared/db";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import {
    IActivityLogEntry,
    activityLogStore,
    log,
    logUpdate,
    activeSession
} from "eez-studio-shared/activity-log";

import { error } from "eez-studio-ui/notification";

import { History, CONF_ITEMS_BLOCK_SIZE } from "instrument/window/history/history";
import { createHistoryItem } from "instrument/window/history/item-factory";
import { moveToTopOfHistory } from "instrument/window/history/history-view";

import { SessionHistoryItem } from "instrument/window/history/items/session";
import { showEditSessionNameDialog } from "instrument/window/history/session/list-view";

export interface ISession {
    selected: boolean;
    id: string;
    activityLogEntry: IActivityLogEntry;
}

export class HistorySessions {
    constructor(public history: History) {
        autorun(() => {
            let newActiveSession: SessionHistoryItem | undefined;

            if (activeSession.id) {
                const activityLogEntry = activityLogStore.findById(activeSession.id);
                if (activityLogEntry) {
                    newActiveSession = createHistoryItem(
                        activityLogEntry,
                        this.history.appStore
                    ) as SessionHistoryItem;
                }
            } else {
                newActiveSession = undefined;
            }

            const newMessage = activeSession.message;

            runInAction(() => {
                this.activeSession = newActiveSession;
                if (this.activeSession && newMessage) {
                    this.activeSession.message = newMessage;
                }
            });
        });
    }

    @observable sessions: ISession[] = [];
    @observable selectedSession: ISession | undefined;
    @observable activeSession: SessionHistoryItem | undefined;

    @action
    async load() {
        const rows = await dbQuery(
            `SELECT
                    id,
                    ${activityLogStore.nonTransientAndNonLazyProperties}
                FROM
                    ${this.history.table} AS T3
                WHERE
                    type = 'activity-log/session-start' AND
                    (
                        json_extract(message, '$.sessionCloseId') IS NULL OR
                        EXISTS(
                            SELECT * FROM ${this.history.table} AS T1
                            WHERE ${this.history.oidWhereClause} AND T1.sid = T3.id
                        )
                    )
                ORDER BY
                    date`
        ).all();

        runInAction(() => {
            this.sessions = this.history.rowsToHistoryItems(rows).map(activityLogEntry => ({
                selected: false,
                id: activityLogEntry.id,
                activityLogEntry
            }));
        });
    }

    @action.bound
    async selectSession(selectedSession: ISession | undefined) {
        if (this.selectedSession) {
            this.selectedSession.selected = false;
        }
        this.selectedSession = selectedSession;
        if (this.selectedSession) {
            this.selectedSession.selected = true;
        }

        if (selectedSession) {
            const rows = await dbQuery(
                `SELECT
                        id,
                        ${activityLogStore.nonTransientAndNonLazyProperties}
                    FROM
                        (
                            SELECT
                                *
                            FROM
                                ${this.history.table} as T1
                            WHERE
                                ${
                                    this.history.oidWhereClause
                                } AND date >= ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
            ).all(new Date(selectedSession.activityLogEntry.date).getTime(), CONF_ITEMS_BLOCK_SIZE);

            this.history.displayRows(rows);

            moveToTopOfHistory(this.history.appStore.navigationStore.mainHistoryView);
        }
    }

    onActivityLogEntryCreated(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.type === "activity-log/session-start") {
            let i: number;
            for (i = 0; i < this.sessions.length; i++) {
                if (activityLogEntry.id === this.sessions[i].activityLogEntry.id) {
                    return;
                }
                if (activityLogEntry.date < this.sessions[i].activityLogEntry.date) {
                    break;
                }
            }

            runInAction(() => {
                this.sessions.splice(i, 0, {
                    selected: false,
                    id: activityLogEntry.id,
                    activityLogEntry
                });
            });
        }
    }

    onActivityLogEntryUpdated(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.message !== undefined) {
            for (let i = 0; i < this.sessions.length; i++) {
                if (this.sessions[i].id === activityLogEntry.id) {
                    runInAction(() => {
                        this.sessions[i].activityLogEntry.message = activityLogEntry.message;
                    });
                    break;
                }
            }
        }
    }

    onActivityLogEntryRemoved(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.type === "activity-log/session-start") {
            for (let i = 0; i < this.sessions.length; i++) {
                if (this.sessions[i].id === activityLogEntry.id) {
                    runInAction(() => {
                        this.sessions.splice(i, 1);
                    });
                    break;
                }
            }
        }
    }

    @bind
    startNewSession() {
        if (!this.activeSession) {
            showEditSessionNameDialog("", name => {
                if (!this.activeSession) {
                    beginTransaction("New session");
                    log(
                        activityLogStore,
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
                } else {
                    error("Failed to start new session because there is an active session");
                }
            });
        }
    }

    @action.bound
    closeActiveSession() {
        if (this.activeSession) {
            beginTransaction("Close session");

            const sessionCloseId = log(
                activityLogStore,
                {
                    oid: "0",
                    type: "activity-log/session-close"
                },
                {
                    undoable: false
                }
            );

            let message: any = JSON.parse(this.activeSession.message);
            message.sessionCloseId = sessionCloseId;
            logUpdate(
                activityLogStore,
                {
                    id: this.activeSession.id,
                    oid: this.activeSession.oid,
                    message: JSON.stringify(message)
                },
                {
                    undoable: false
                }
            );

            commitTransaction();
        }
    }
}

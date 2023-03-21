import {
    observable,
    action,
    runInAction,
    autorun,
    makeObservable,
    IReactionDisposer
} from "mobx";

import { dbQuery } from "eez-studio-shared/db-query";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import { error } from "eez-studio-ui/notification";

import {
    IActivityLogEntry,
    activityLogStore,
    log,
    logUpdate,
    activeSession
} from "instrument/window/history/activity-log";

import type { History } from "instrument/window/history/history";
import { CONF_ITEMS_BLOCK_SIZE } from "instrument/window/history/CONF_ITEMS_BLOCK_SIZE";
import {
    createHistoryItem,
    rowsToHistoryItems
} from "instrument/window/history/item-factory";
import { moveToTopOfHistory } from "instrument/window/history/history-view";

import type { SessionHistoryItem } from "instrument/window/history/items/session";
import { showEditSessionNameDialog } from "instrument/window/history/session/list-view";

export interface ISession {
    selected: boolean;
    id: string;
    activityLogEntry: IActivityLogEntry;
}

export class HistorySessions {
    sessions: ISession[] = [];
    selectedSession: ISession | undefined;
    activeSession: SessionHistoryItem | undefined;

    autorunDisposer: IReactionDisposer;

    constructor(public history: History) {
        makeObservable(this, {
            sessions: observable,
            selectedSession: observable,
            activeSession: observable,
            load: action,
            selectSession: action.bound,
            closeActiveSession: action.bound
        });

        this.autorunDisposer = autorun(
            () => {
                let newActiveSession: SessionHistoryItem | undefined;

                if (activeSession.id) {
                    const activityLogEntry = activityLogStore.findById(
                        activeSession.id
                    );
                    if (activityLogEntry) {
                        newActiveSession = createHistoryItem(
                            this.history.options.store,
                            activityLogEntry
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
            },
            {
                delay: 100
            }
        );
    }

    async load() {
        const rows = await dbQuery(
            `SELECT
                    id,
                    ${activityLogStore.nonTransientAndNonLazyProperties}
                FROM
                    "${activityLogStore.storeName}" AS T3
                WHERE
                    type = 'activity-log/session-start' AND
                    (
                        json_extract(message, '$.sessionCloseId') IS NULL OR
                        EXISTS(
                            SELECT * FROM ${activityLogStore.storeName} AS T1
                            WHERE ${this.history.oidWhereClause} AND T1.sid = T3.id
                        )
                    )
                ORDER BY
                    date`
        ).all();

        runInAction(() => {
            this.sessions = rowsToHistoryItems(activityLogStore, rows).map(
                activityLogEntry => ({
                    selected: false,
                    id: activityLogEntry.id,
                    activityLogEntry
                })
            );
        });
    }

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
                            ${activityLogStore.storeName} as T1
                            WHERE
                                ${
                                    this.history.oidWhereClause
                                } AND date >= ? ${this.history.getFilter()}
                            ORDER BY
                                date
                        )
                    LIMIT ?`
            ).all(
                new Date(selectedSession.activityLogEntry.date).getTime(),
                CONF_ITEMS_BLOCK_SIZE
            );

            this.history.displayRows(rows);

            moveToTopOfHistory(
                this.history.appStore.navigationStore.mainHistoryView
            );
        }
    }

    onActivityLogEntryCreated(activityLogEntry: IActivityLogEntry) {
        if (activityLogEntry.type === "activity-log/session-start") {
            let i: number;
            for (i = 0; i < this.sessions.length; i++) {
                if (
                    activityLogEntry.id === this.sessions[i].activityLogEntry.id
                ) {
                    return;
                }
                if (
                    activityLogEntry.date <
                    this.sessions[i].activityLogEntry.date
                ) {
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
                        this.sessions[i].activityLogEntry.message =
                            activityLogEntry.message;
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

    startNewSession = () => {
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
                    error(
                        "Failed to start new session because there is an active session"
                    );
                }
            });
        }
    };

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
                this.history.options.store,
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

    onTerminate() {
        if (this.autorunDisposer) {
            this.autorunDisposer();
        }
    }
}

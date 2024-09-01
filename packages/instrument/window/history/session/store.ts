import {
    observable,
    makeObservable,
    computed,
    values,
    runInAction,
    autorun
} from "mobx";

import {
    beginTransaction,
    commitTransaction,
    createStore,
    createStoreObjectsCollection,
    types
} from "eez-studio-shared/store";
import { db } from "eez-studio-shared/db";

import * as notification from "eez-studio-ui/notification";
import { guid } from "eez-studio-shared/guid";

////////////////////////////////////////////////////////////////////////////////

export const SESSION_FREE_ID = "free";

const SESSION_FREE: IHistorySession = observable({
    id: SESSION_FREE_ID,
    uuid: "e06929d6-b97e-4d65-bcb0-0c9f00058dd6",
    name: "Free mode",
    folder: "",
    isActive: false,
    deleted: false
});

////////////////////////////////////////////////////////////////////////////////

export interface IHistorySession {
    id: string;
    uuid: string;
    name: string;
    folder: string;
    isActive: boolean;
    deleted: boolean;
}

export const historySessionsStore = createStore({
    storeName: "history/sessions",
    versionTables: [],
    versions: [
        // version 1
        `CREATE TABLE "history/sessions"(
            id INTEGER PRIMARY KEY NOT NULL UNIQUE,
            name TEXT NOT NULL,
            folder TEXT NOT NULL,
            isActive BOOLEAN NOT NULL,
            deleted BOOLEAN NOT NULL
        );
        CREATE TABLE IF NOT EXISTS versions(tableName TEXT PRIMARY KEY, version INT NOT NULL);
        INSERT INTO versions(tableName, version) VALUES ('history/sessions', 1)`,

        // version 2
        `ALTER TABLE "history/sessions" ADD COLUMN uuid TEXT;
        UPDATE versions SET version = 2 WHERE tableName = 'history/sessions';`
    ],
    properties: {
        id: types.id,
        uuid: types.string,
        name: types.string,
        folder: types.string,
        isActive: types.boolean,
        deleted: types.boolean
    }
});

const sessionsCollection = createStoreObjectsCollection<IHistorySession>();
historySessionsStore.watch(sessionsCollection);
export const sessions = sessionsCollection.objects;

const deletedSessionsCollection =
    createStoreObjectsCollection<IHistorySession>();
historySessionsStore.watch(deletedSessionsCollection, {
    deletedOption: "only"
});
export const deletedSessions = deletedSessionsCollection.objects;

export function getActiveSession() {
    return values(sessions).find(session => session.isActive);
}

////////////////////////////////////////////////////////////////////////////////

class HistorySessions {
    _selectedSession: IHistorySession | undefined = undefined;
    showDeleted = false;

    constructor() {
        makeObservable(this, {
            _selectedSession: observable,
            showDeleted: observable,
            sessions: computed,
            deletedSessions: computed,
            selectedSession: computed,
            activeSession: computed
        });

        autorun(() => {
            if (this.showDeleted && this.deletedSessions.length == 0) {
                this.setShowDeleted(false);
            }
        });
    }

    get sessions() {
        const list = [...values(sessions)];
        list.sort((a, b) => a.name.localeCompare(b.name));
        list.unshift(SESSION_FREE);
        return list;
    }

    get deletedSessions() {
        const list = [...values(deletedSessions)];
        list.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }

    get selectedSession() {
        return this._selectedSession || this.activeSession;
    }

    get activeSession() {
        return getActiveSession() ?? SESSION_FREE;
    }

    activateSession(sessionId: string | undefined) {
        if (sessionId === this.activeSession.id) {
            return;
        }

        if (
            this.activeSession.id !== SESSION_FREE_ID ||
            (sessionId && sessionId !== SESSION_FREE_ID)
        ) {
            beginTransaction("Activate session");

            if (this.activeSession.id !== SESSION_FREE_ID) {
                historySessionsStore.updateObject({
                    id: this.activeSession.id,
                    isActive: false
                });
            }

            if (sessionId && sessionId !== SESSION_FREE_ID) {
                historySessionsStore.updateObject({
                    id: sessionId,
                    isActive: true
                });
            }

            commitTransaction();
        }
    }

    selectSession(session: IHistorySession | undefined) {
        runInAction(() => {
            this._selectedSession = session;
        });
    }

    setShowDeleted = (showDeleted: boolean) => {
        if (showDeleted == this.showDeleted) {
            return;
        }

        if (showDeleted) {
            runInAction(() => {
                this.showDeleted = true;
                this._selectedSession = this.deletedSessions[0];
            });
        } else {
            runInAction(() => {
                this.showDeleted = false;
                this._selectedSession = undefined;
            });
        }
    };

    createNewSession = (name: string) => {
        beginTransaction("Create session");

        const sessionId = historySessionsStore.createObject({
            uuid: guid(),
            name,
            folder: "",
            isActive: false
        });

        commitTransaction();

        this.activateSession(sessionId);
    };

    updateSessionName(session: IHistorySession, name: string) {
        if (session.id === SESSION_FREE_ID) {
            return;
        }

        beginTransaction("Update session name");

        historySessionsStore.updateObject({
            id: session.id,
            name
        });

        commitTransaction();
    }

    deleteSession(session: IHistorySession) {
        if (session.id === SESSION_FREE_ID) {
            return;
        }

        beginTransaction("Delete session");

        historySessionsStore.deleteObject(session);

        commitTransaction();
    }

    restoreSession = (session: IHistorySession) => {
        historySessionsStore.undeleteObject(session);

        //this.activateSession(session.id);

        runInAction(() => {
            this._selectedSession = undefined;
        });
    };

    async deleteForeverSession(session: IHistorySession) {
        const { activityLogStore, logDelete } = await import(
            "instrument/window/history/activity-log"
        );

        let progressToastId = notification.info(
            "Deleting session history items ...",
            {
                autoClose: false,
                closeButton: false,
                closeOnClick: false,
                hideProgressBar: false,
                progressStyle: {
                    transition: "none"
                }
            }
        );

        await new Promise(resolve => setTimeout(resolve, 100));

        const logs = db
            .prepare(`SELECT * FROM activityLog WHERE sid=${session.id}`)
            .all();
        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            logDelete(activityLogStore, log, {
                deletePermanently: true
            });

            const progress = (i + 1) / logs.length;

            notification.update(progressToastId, {
                progress
            });

            await new Promise(resolve => setTimeout(resolve, 0));
        }

        notification.dismiss(progressToastId);

        historySessionsStore.deleteObject(session, {
            deletePermanently: true
        });

        // select next session
        let i = this.deletedSessions.findIndex(
            deletedSession => deletedSession.id == session.id
        );
        if (i == -1) {
            i = 0;
        } else {
            if (i + 1 < this.deletedSessions.length) {
                i++;
            } else {
                i--;
            }
        }
        runInAction(() => {
            this._selectedSession = this.deletedSessions[i];
        });
    }

    getLastActivity(session: IHistorySession) {
        let row;
        if (session.id == SESSION_FREE_ID) {
            row = db
                .prepare(
                    "SELECT date FROM activityLog ORDER BY date DESC LIMIT 1"
                )
                .get();
        } else {
            row = db
                .prepare(
                    "SELECT date FROM activityLog WHERE sid = ? ORDER BY date DESC LIMIT 1"
                )
                .get([session.id]);
        }

        if (!row) {
            return null;
        }

        return new Date(Number(row.date));
    }
}

export const historySessions = new HistorySessions();

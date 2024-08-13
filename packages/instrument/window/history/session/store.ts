import { observable, makeObservable, computed, values } from "mobx";

import {
    beginTransaction,
    commitTransaction,
    createStore,
    createStoreObjectsCollection,
    types
} from "eez-studio-shared/store";

////////////////////////////////////////////////////////////////////////////////

export const SESSION_FREE_ID = "free";

const SESSION_FREE: IHistorySession = observable({
    id: SESSION_FREE_ID,
    name: "Free mode",
    folder: "",
    isActive: false,
    deleted: false
});

////////////////////////////////////////////////////////////////////////////////

export interface IHistorySession {
    id: string;
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
        INSERT INTO versions(tableName, version) VALUES ('history/sessions', 1)`
    ],
    properties: {
        id: types.id,
        name: types.string,
        folder: types.string,
        isActive: types.boolean,
        deleted: types.boolean
    }
});

const sessionsCollection = createStoreObjectsCollection<IHistorySession>();
historySessionsStore.watch(sessionsCollection);
export const sessions = sessionsCollection.objects;

export function getActiveSession() {
    return values(sessions).find(session => session.isActive);
}

////////////////////////////////////////////////////////////////////////////////

class HistorySessions {
    constructor() {
        makeObservable(this, {
            sessions: computed,
            activeSessionId: computed
        });
    }

    get sessions() {
        const list = [...values(sessions)];

        list.sort((a, b) => a.name.localeCompare(b.name));

        list.unshift(SESSION_FREE);

        return list;
    }

    get activeSessionId() {
        return this.activeSession?.id ?? SESSION_FREE_ID;
    }

    get activeSession() {
        return getActiveSession() ?? SESSION_FREE;
    }

    activateSession(sessionId: string | undefined) {
        if (sessionId === this.activeSessionId) {
            return;
        }

        if (
            (this.activeSessionId &&
                this.activeSessionId !== SESSION_FREE_ID) ||
            (sessionId && sessionId !== SESSION_FREE_ID)
        ) {
            beginTransaction("Activate session");

            if (
                this.activeSessionId &&
                this.activeSessionId !== SESSION_FREE_ID
            ) {
                historySessionsStore.updateObject({
                    id: this.activeSessionId,
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

    createNewSession = (name: string) => {
        beginTransaction("Create session");

        const sessionId = historySessionsStore.createObject({
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
}

export const historySessions = new HistorySessions();

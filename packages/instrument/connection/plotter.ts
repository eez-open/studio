import {
    IActivityLogEntry,
    activityLogStore,
    log,
    logUpdate
} from "instrument/window/history/activity-log";
import { LongOperation } from "instrument/connection/connection-base";

import type { Connection } from "instrument/connection/connection-main";
import { db } from "eez-studio-shared/db-path";

const UPDATE_LOG_DEBOUNCE = 10;

export class Plotter implements LongOperation {
    logId: string;
    logEntry: Partial<IActivityLogEntry>;
    dataSurplus: string | undefined = undefined;
    isQuery: boolean = false;
    _isDone: boolean = false;

    maxNumPoints: number = 10000;

    dataStr: string = "";

    variableNames: string[] = [];
    data: {
        x: number;
        y: number[];
    }[] = [];
    totalNumPoints: number = 0;
    numPoints: number = 0;

    updateLogTime: any;

    dataBuffer: Buffer;

    skipFirst: boolean = true;

    constructor(protected connection: Connection) {
        // TODO do not create log entry until some data is received, or create
        // log entry that will print "Waiting for data ..." and timeout after 10 seconds
        // If number of variables changed than close current log entry and create a new one.
        // If Studio is reloaded than latest log entry should survive, even if recording is paused.
        // So, the last log entry should be permanent and only make id temporary
        // when closed (if recording is paused).

        this.createLog();
    }

    abort() {
        this.updateTemporary();

        this._isDone = true;
    }

    onData(dataStr: string) {
        // line separator: '\r\n' & '\n'
        // value separator: ',' or '\t'
        // value name separator: ':'

        this.dataStr += dataStr;

        let x = Date.now();

        let updated = false;
        while (true) {
            let i = this.dataStr.indexOf("\n");
            if (i == -1) {
                break;
            }

            let line = this.dataStr.slice(0, i);
            this.dataStr = this.dataStr.slice(i + 1);

            if (line.endsWith("\r")) {
                line = line.slice(0, i - 1);
            }

            line = line.trim();

            if (line == "") {
                continue;
            }

            const variables = this.parseLine(line, x);

            if (variables.length > 0) {
                const variableNames = variables.map(variable => variable.name);

                if (this.variableNames.length == 0) {
                    if (this.skipFirst) {
                        this.skipFirst = false;
                        continue; // skip first
                    } else {
                        this.variableNames = variableNames;
                        this.dataBuffer = Buffer.alloc(
                            8 *
                                this.maxNumPoints *
                                (1 + this.variableNames.length)
                        );
                    }
                } else if (
                    !compareStringArray(variableNames, this.variableNames)
                ) {
                    // variable names changed, create a new log item

                    // flush all remaining data
                    if (updated) {
                        if (this.updateLogTime) {
                            clearTimeout(this.updateLogTime);
                            this.updateLogTime = undefined;
                        }
                        this.updateLog();
                        updated = false;
                        this.updateTemporary();
                    }

                    this.createLog();

                    this.variableNames = variableNames;
                    this.data = [];
                    this.totalNumPoints = 0;
                    this.numPoints = 0;
                    this.dataBuffer = Buffer.alloc(
                        8 * this.maxNumPoints * (1 + this.variableNames.length)
                    );
                }

                // keep data length up to this.maxNumPoints
                if (this.numPoints == this.maxNumPoints) {
                    this.dataBuffer.copyWithin(
                        0,
                        8 * (1 + this.variableNames.length)
                    );
                    this.numPoints = this.maxNumPoints - 1;
                }

                let offset =
                    8 * this.numPoints * (1 + this.variableNames.length);

                this.dataBuffer.writeDoubleBE(x, offset);
                offset += 8;

                for (let varIdx = 0; varIdx < variables.length; varIdx++) {
                    this.dataBuffer.writeDoubleBE(
                        variables[varIdx].value,
                        offset
                    );
                    offset += 8;
                }

                updated = true;
                this.totalNumPoints++;
                this.numPoints++;
            }
        }

        if (updated && !this.updateLogTime) {
            this.updateLogTime = setTimeout(() => {
                this.updateLogTime = undefined;
                this.updateLog();
            }, UPDATE_LOG_DEBOUNCE);
        }
    }

    isDone() {
        return this._isDone;
    }

    createLog() {
        this.connection.lastAnswerActivityLogId = undefined;
        this.connection.lastAnswerActivityLogMessage = "";

        this.logEntry = {
            oid: this.connection.instrument.id,
            type: "instrument/plotter",
            message: JSON.stringify({}),
            temporary: false
        };

        this.logId = log(activityLogStore, this.logEntry, {
            undoable: false
        });
    }

    parseLine(line: string, x: number) {
        let parts = line.split(",");
        if (parts.length == 1) {
            parts = line.split("\t");
        }

        const variables: {
            name: string;
            value: number;
        }[] = [];

        parts.forEach((part, i) => {
            let name;
            let valueStr;

            const nameValue = part.split(":");
            if (nameValue.length == 2) {
                name = nameValue[0];
                valueStr = nameValue[1];
            } else {
                name = `Value ${i + 1}`;
                valueStr = nameValue[0];
            }

            let value = parseFloat(valueStr);
            if (isNaN(value)) {
                return;
            }

            variables.push({ name, value });
        });

        return variables;
    }

    lastTime: number | undefined;
    lastNumPoints: number;
    lastRate: number;

    get rate() {
        const currentTime = Date.now();
        const currentNumPoints = this.totalNumPoints;

        if (this.lastTime == undefined) {
            this.lastRate = 0;
        } else {
            const diffPoints = currentNumPoints - this.lastNumPoints;
            const diffTime = currentTime - this.lastTime;
            if (diffTime < 1000) {
                return this.lastRate;
            }
            this.lastRate = (diffPoints / diffTime) * 1000;
        }

        this.lastTime = currentTime;
        this.lastNumPoints = currentNumPoints;

        return this.lastRate;
    }

    updateLog() {
        this.logEntry.message = JSON.stringify({
            variableNames: this.variableNames,
            numPoints: this.totalNumPoints,
            rate: this.rate
        });

        logUpdate(
            activityLogStore,
            {
                id: this.logId,
                oid: this.connection.instrument.id,
                message: this.logEntry.message,
                data: this.dataBuffer.slice(
                    0,
                    8 * this.numPoints * (1 + this.variableNames.length)
                )
            },
            {
                undoable: false
            }
        );
    }

    updateTemporary() {
        if (this.connection.instrument.id) {
            const row = db
                .prepare(
                    `SELECT "recordHistory" FROM "instrument" WHERE id = ?`
                )
                .get(this.connection.instrument.id);
            if (!row.recordHistory) {
                logUpdate(
                    activityLogStore,
                    {
                        id: this.logId,
                        oid: this.connection.instrument.id,
                        temporary: true
                    },
                    {
                        undoable: false
                    }
                );
            }
        }
    }
}

function compareStringArray(arr1: string[], arr2: string[]) {
    if (arr1.length != arr2.length) {
        return false;
    }

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }

    return true;
}

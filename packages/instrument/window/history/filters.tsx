import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { dbQuery } from "eez-studio-shared/db-query";
import { scheduleTask, Priority } from "eez-studio-shared/scheduler";

import { PropertyList, BooleanProperty } from "eez-studio-ui/properties";

import type { IActivityLogEntry } from "instrument/window/history/activity-log";

import type { IAppStore, History } from "instrument/window/history/history";
import type { IHistoryItem } from "instrument/window/history/item";

export class Filters {
    session: boolean = true;
    connectsAndDisconnects: boolean = true;
    scpi: boolean = true;
    downloadedFiles: boolean = true;
    uploadedFiles: boolean = true;
    attachedFiles: boolean = true;
    charts: boolean = true;
    lists: boolean = true;
    notes: boolean = true;
    launchedScripts: boolean = true;

    constructor() {
        makeObservable(this, {
            session: observable,
            connectsAndDisconnects: observable,
            scpi: observable,
            downloadedFiles: observable,
            uploadedFiles: observable,
            attachedFiles: observable,
            charts: observable,
            lists: observable,
            notes: observable,
            launchedScripts: observable
        });
    }

    filterActivityLogEntry(activityLogEntry: IActivityLogEntry): boolean {
        if (this.session) {
            if (activityLogEntry.type.startsWith("activity-log/session")) {
                return true;
            }
        }

        if (this.connectsAndDisconnects) {
            if (
                [
                    "instrument/created",
                    "instrument/restored",
                    "instrument/connected",
                    "instrument/connect-failed",
                    "instrument/disconnected"
                ].indexOf(activityLogEntry.type) !== -1
            ) {
                return true;
            }
        }

        if (this.scpi) {
            if (
                ["instrument/request", "instrument/answer"].indexOf(
                    activityLogEntry.type
                ) !== -1
            ) {
                return true;
            }
        }

        if (this.downloadedFiles) {
            if (activityLogEntry.type === "instrument/file-download") {
                return true;
            }
        }

        if (this.uploadedFiles) {
            if (activityLogEntry.type === "instrument/file-upload") {
                return true;
            }
        }

        if (this.attachedFiles) {
            if (activityLogEntry.type === "instrument/file-attachment") {
                return true;
            }
        }

        if (this.charts) {
            if (activityLogEntry.type === "instrument/chart") {
                return true;
            }
        }

        if (this.lists) {
            if (activityLogEntry.type === "instrument/list") {
                return true;
            }
        }

        if (this.notes) {
            if (activityLogEntry.type === "activity-log/note") {
                return true;
            }
        }

        if (this.launchedScripts) {
            if (activityLogEntry.type === "instrument/script") {
                return true;
            }
        }

        return false;
    }

    getFilter() {
        const types: string[] = [];

        if (this.session) {
            types.push(
                "activity-log/session-start",
                "activity-log/session-close"
            );
        }

        if (this.connectsAndDisconnects) {
            types.push(
                "instrument/created",
                "instrument/restored",
                "instrument/connected",
                "instrument/connect-failed",
                "instrument/disconnected"
            );
        }

        if (this.scpi) {
            types.push("instrument/request", "instrument/answer");
        }

        if (this.downloadedFiles) {
            types.push("instrument/file-download");
        }

        if (this.uploadedFiles) {
            types.push("instrument/file-upload");
        }

        if (this.attachedFiles) {
            types.push("instrument/file-attachment");
        }

        if (this.charts) {
            types.push("instrument/chart");
        }

        if (this.lists) {
            types.push("instrument/list");
        }

        if (this.notes) {
            types.push("activity-log/note");
        }

        if (this.launchedScripts) {
            types.push("instrument/script");
        }

        if (types.length > 0) {
            return (
                "(" + types.map(type => `type == '${type}'`).join(" OR ") + ")"
            );
        } else {
            return "0";
        }
    }
}

export class FilterStats {
    session = 0;
    connectsAndDisconnects = 0;
    scpi = 0;
    downloadedFiles = 0;
    uploadedFiles = 0;
    attachedFiles = 0;
    charts = 0;
    lists = 0;
    notes = 0;
    launchedScripts = 0;

    constructor(public history: History) {
        makeObservable(this, {
            session: observable,
            connectsAndDisconnects: observable,
            scpi: observable,
            downloadedFiles: observable,
            uploadedFiles: observable,
            attachedFiles: observable,
            charts: observable,
            lists: observable,
            notes: observable,
            launchedScripts: observable,
            add: action
        });

        scheduleTask("Get filter stats", Priority.Lowest, async () => {
            const rows = await dbQuery(
                `SELECT
                            type, count(*) AS count
                        FROM
                            ${history.table} AS T1
                        WHERE
                            ${this.history.oidWhereClause} AND NOT deleted
                        GROUP BY
                            type`
            ).all();

            rows.forEach(row => {
                this.add(row.type, Number(row.count));
            });
        });
    }

    add(type: string, amount: number) {
        if (
            [
                "activity-log/session-start",
                "activity-log/session-close"
            ].indexOf(type) !== -1
        ) {
            this.session += amount;
        } else if (
            [
                "instrument/created",
                "instrument/restored",
                "instrument/connected",
                "instrument/connect-failed",
                "instrument/disconnected"
            ].indexOf(type) !== -1
        ) {
            this.connectsAndDisconnects += amount;
        } else if (
            ["instrument/request", "instrument/answer"].indexOf(type) !== -1
        ) {
            this.scpi += amount;
        } else if (type === "instrument/file-download") {
            this.downloadedFiles += amount;
        } else if (type === "instrument/file-upload") {
            this.uploadedFiles += amount;
        } else if (type === "instrument/file-attachment") {
            this.attachedFiles += amount;
        } else if (type === "instrument/chart") {
            this.charts += amount;
        } else if (type === "instrument/list") {
            this.lists += amount;
        } else if (type === "activity-log/note") {
            this.notes += amount;
        } else if (type === "instrument/script") {
            this.launchedScripts += amount;
        }
    }

    onHistoryItemCreated(historyItem: IHistoryItem) {
        this.add(historyItem.type, 1);
    }

    onHistoryItemRemoved(historyItem: IHistoryItem) {
        this.add(historyItem.type, -1);
    }
}

export const FiltersComponent = observer(
    class FiltersComponent extends React.Component<{ appStore: IAppStore }> {
        render() {
            const filterStats = this.props.appStore.history.filterStats;

            return (
                <div className="EezStudio_FiltersComponentContainer">
                    <PropertyList>
                        <BooleanProperty
                            name={`Session start and close (${filterStats.session})`}
                            value={this.props.appStore.filters.session}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.session =
                                        value)
                            )}
                        />
                        <BooleanProperty
                            name={`Connects and disconnects (${filterStats.connectsAndDisconnects})`}
                            value={
                                this.props.appStore.filters
                                    .connectsAndDisconnects
                            }
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.connectsAndDisconnects =
                                        value)
                            )}
                        />
                        <BooleanProperty
                            name={`SCPI commands, queries and query results (${filterStats.scpi})`}
                            value={this.props.appStore.filters.scpi}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.scpi = value)
                            )}
                        />
                        <BooleanProperty
                            name={`Downloaded files (${filterStats.downloadedFiles})`}
                            value={this.props.appStore.filters.downloadedFiles}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.downloadedFiles =
                                        value)
                            )}
                        />
                        <BooleanProperty
                            name={`Uploaded files (${filterStats.uploadedFiles})`}
                            value={this.props.appStore.filters.uploadedFiles}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.uploadedFiles =
                                        value)
                            )}
                        />
                        <BooleanProperty
                            name={`Attached files (${filterStats.attachedFiles})`}
                            value={this.props.appStore.filters.attachedFiles}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.attachedFiles =
                                        value)
                            )}
                        />
                        <BooleanProperty
                            name={`Charts (${filterStats.charts})`}
                            value={this.props.appStore.filters.charts}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.charts = value)
                            )}
                        />

                        {(this.props.appStore.instrument.id == "0" ||
                            this.props.appStore.instrument.listsProperty) && (
                            <BooleanProperty
                                name={`Lists (${filterStats.lists})`}
                                value={this.props.appStore.filters.lists}
                                onChange={action(
                                    (value: boolean) =>
                                        (this.props.appStore.filters.lists =
                                            value)
                                )}
                            />
                        )}
                        <BooleanProperty
                            name={`Notes (${filterStats.notes})`}
                            value={this.props.appStore.filters.notes}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.notes = value)
                            )}
                        />
                        <BooleanProperty
                            name={`Launched scripts (${filterStats.launchedScripts})`}
                            value={this.props.appStore.filters.launchedScripts}
                            onChange={action(
                                (value: boolean) =>
                                    (this.props.appStore.filters.launchedScripts =
                                        value)
                            )}
                        />
                    </PropertyList>
                </div>
            );
        }
    }
);

import path from "path";
import { dialog, getCurrentWindow } from "@electron/remote";
import React from "react";
import {
    action,
    autorun,
    computed,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { Icon } from "eez-studio-ui/icon";

import { InstrumentsStore } from "home/instruments";

import { InstrumentObject } from "instrument/instrument-object";
import {
    historySessions,
    type IHistorySession
} from "instrument/window/history/session/store";
import { db, instrumentDatabases } from "eez-studio-shared/db";

////////////////////////////////////////////////////////////////////////////////

class ExportModel {
    instrumentsOption: "all" | "selected" = "all";
    selectedInstruments: Set<string> = new Set();

    sessionsOption: "all" | "selected" = "all";
    selectedSessions: Set<string> = new Set();
    manadatorySelectedSessions: Set<string> = new Set();

    historyOption: "all" | "older-then" = "all";
    historyOdlerThenYears: number = 0;
    historyOdlerThenMonths: number = 0;
    historyOdlerThenDays: number = 0;

    removeHistoryAfterExport: boolean = false;

    numHistoryItems: number = 0;

    constructor() {
        makeObservable(this, {
            instrumentsOption: observable,
            selectedInstruments: observable,

            sessionsOption: observable,
            selectedSessions: observable,
            manadatorySelectedSessions: observable,

            historyOption: observable,
            historyOdlerThenYears: observable,
            historyOdlerThenMonths: observable,
            historyOdlerThenDays: observable,

            removeHistoryAfterExport: observable,

            numHistoryItems: observable
        });

        autorun(() => {
            let condition = "";

            if (this.instrumentsOption == "selected") {
                const oids = Array.from(this.selectedInstruments)
                    .map(oid => `'${oid}'`)
                    .join(",");
                if (oids.length > 0) {
                    condition = ` WHERE oid IN (${oids})`;
                } else {
                    condition = ` WHERE 0`;
                }
            }

            if (this.historyOption == "older-then") {
                if (condition == "") {
                    condition += " WHERE ";
                } else {
                    condition += " AND ";
                }
                condition += `"date" < unixepoch(date('now','-${this.historyOdlerThenYears} year','-${this.historyOdlerThenMonths} month','-${this.historyOdlerThenDays} day')) * 1000`;
            }

            let numHistoryItems = db
                .prepare(
                    "SELECT count(*) as count FROM activityLog" + condition
                )
                .get().count;

            let sessions = db
                .prepare(
                    "SELECT DISTINCT(sid) as id FROM activityLog" + condition
                )
                .all();

            sessions = sessions.filter(session => session.id != null);

            runInAction(() => {
                this.manadatorySelectedSessions.clear();
                sessions.forEach((session: any) => {
                    if (session.id != null) {
                        this.manadatorySelectedSessions.add(
                            session.id.toString()
                        );
                    }
                });

                this.numHistoryItems = numHistoryItems;
            });
        });
    }
}

////////////////////////////////////////////////////////////////////////////////

const Section = observer(
    class Section extends React.Component<{
        title: string;
        children: React.ReactNode;
    }> {
        render() {
            return (
                <div className="EezStudio_ExportDialog_Section">
                    <div className="EezStudio_ExportDialog_SectionTitle">
                        {this.props.title}
                    </div>
                    <div className="EezStudio_ExportDialog_SectionContent">
                        {this.props.children}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const InstrumentNode = observer(
    class InstrumentNode extends React.Component<{
        exportModel: ExportModel;
        instrument: InstrumentObject;
    }> {
        render() {
            const { exportModel, instrument } = this.props;

            return (
                <ListItem
                    label={
                        <label
                            className="form-check-label d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={exportModel.selectedInstruments.has(
                                    instrument.id
                                )}
                                onChange={action(event => {
                                    if (event.target.checked) {
                                        exportModel.selectedInstruments.add(
                                            instrument.id
                                        );
                                    } else {
                                        exportModel.selectedInstruments.delete(
                                            instrument.id
                                        );
                                    }
                                })}
                            />
                            <Icon icon={instrument.image} size={48} />
                            {instrument.name}
                        </label>
                    }
                />
            );
        }
    }
);

const InstrumentList = observer(
    class InstrumentList extends React.Component<{
        instrumentsStore: InstrumentsStore;
        exportModel: ExportModel;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                instruments: computed
            });
        }

        get instruments() {
            const instruments = this.props.instrumentsStore.instruments.slice();
            instruments.sort((a, b) => a.name.localeCompare(b.name));
            return this.props.instrumentsStore.instruments.map(instrument => ({
                id: instrument.id,
                data: instrument,
                selected: false
            }));
        }

        renderInstrumentNode = (node: IListNode) => {
            let instrument = node.data as InstrumentObject;
            return (
                <InstrumentNode
                    exportModel={this.props.exportModel}
                    instrument={instrument}
                />
            );
        };

        render() {
            return (
                <ListContainer tabIndex={0}>
                    <List
                        nodes={this.instruments}
                        renderNode={this.renderInstrumentNode}
                    />
                </ListContainer>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const SessionNode = observer(
    class SessionNode extends React.Component<{
        exportModel: ExportModel;
        session: IHistorySession;
    }> {
        render() {
            const { exportModel, session } = this.props;

            return (
                <ListItem
                    label={
                        <label
                            className="form-check-label form-check d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id={`EezStudio_ExportDialog_Session_${session.id}`}
                                checked={
                                    exportModel.selectedSessions.has(
                                        session.id
                                    ) ||
                                    exportModel.manadatorySelectedSessions.has(
                                        session.id
                                    )
                                }
                                onChange={action(event => {
                                    if (event.target.checked) {
                                        exportModel.selectedSessions.add(
                                            session.id
                                        );
                                    } else {
                                        exportModel.selectedSessions.delete(
                                            session.id
                                        );
                                    }
                                })}
                                disabled={exportModel.manadatorySelectedSessions.has(
                                    session.id
                                )}
                            />
                            {session.name}
                        </label>
                    }
                />
            );
        }
    }
);

const SessionList = observer(
    class SessionList extends React.Component<{
        instrumentsStore: InstrumentsStore;
        exportModel: ExportModel;
    }> {
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                sessions: computed
            });
        }

        get sessions() {
            return historySessions.sessions.slice(1).map(session => ({
                id: session.id,
                data: session,
                selected: false
            }));
        }

        renderSessionNode = (node: IListNode) => {
            let session = node.data as IHistorySession;
            return (
                <SessionNode
                    exportModel={this.props.exportModel}
                    session={session}
                />
            );
        };

        render() {
            return (
                <ListContainer tabIndex={0}>
                    <List
                        nodes={this.sessions}
                        renderNode={this.renderSessionNode}
                    />
                </ListContainer>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const HistoryExportSettings = observer(
    class HistoryExportSettings extends React.Component<{
        exportModel: ExportModel;
        style?: React.CSSProperties;
    }> {
        render() {
            const { exportModel } = this.props;

            return (
                <div style={this.props.style}>
                    <div className="EezStudio_ExportDialog_ArchiveOlderThen d-flex align-items-center">
                        <label className="form-label">
                            Years
                            <input
                                className="form-control"
                                type="number"
                                value={exportModel.historyOdlerThenYears}
                                min={0}
                                step={1}
                                onChange={action(event => {
                                    exportModel.historyOdlerThenYears =
                                        parseInt(event.target.value);
                                })}
                            />
                        </label>
                        <label className="form-label">
                            Months
                            <input
                                className="form-control"
                                type="number"
                                value={exportModel.historyOdlerThenMonths}
                                min={0}
                                step={1}
                                onChange={action(event => {
                                    exportModel.historyOdlerThenMonths =
                                        parseInt(event.target.value);
                                })}
                            />
                        </label>
                        <label className="form-label">
                            Days
                            <input
                                className="form-control"
                                type="number"
                                value={exportModel.historyOdlerThenDays}
                                min={0}
                                step={1}
                                onChange={action(event => {
                                    exportModel.historyOdlerThenDays = parseInt(
                                        event.target.value
                                    );
                                })}
                            />
                        </label>
                    </div>
                    <div className="EezStudio_ExportDialog_RemoveHistoryAfterExport">
                        <label
                            className="form-check-label d-flex align-items-center"
                            style={{ gap: 5 }}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={exportModel.removeHistoryAfterExport}
                                onChange={action(event => {
                                    exportModel.removeHistoryAfterExport =
                                        event.target.checked;
                                })}
                            />
                            Delete history after export
                        </label>
                    </div>
                </div>
            );
        }
    }
);

const ExportDialog = observer(
    class ExportDialog extends React.Component<{
        instrumentsStore: InstrumentsStore;
    }> {
        mode: "instruments" | "sessions" | "archive" | "custom" = "instruments";

        instrumentsExportModel = new ExportModel();
        sessionExportModel = new ExportModel();
        archiveExportModel = new ExportModel();
        customExportModel = new ExportModel();

        description: string = "";

        error: string | undefined;

        constructor(props: any) {
            super(props);

            runInAction(() => {
                this.instrumentsExportModel.instrumentsOption = "selected";
                this.instrumentsExportModel.sessionsOption = "all";
                this.instrumentsExportModel.historyOption = "all";
                this.instrumentsExportModel.removeHistoryAfterExport = false;

                this.sessionExportModel.instrumentsOption = "selected";
                this.sessionExportModel.sessionsOption = "selected";
                this.sessionExportModel.historyOption = "all";
                this.sessionExportModel.removeHistoryAfterExport = false;

                this.archiveExportModel.instrumentsOption = "all";
                this.archiveExportModel.sessionsOption = "all";
                this.archiveExportModel.historyOption = "older-then";
                this.archiveExportModel.historyOdlerThenYears = 1;
                this.archiveExportModel.removeHistoryAfterExport = false;
            });

            makeObservable(this, {
                mode: observable,
                description: observable,
                error: observable,
                exportModel: computed
            });
        }

        get exportModel() {
            if (this.mode == "instruments") return this.instrumentsExportModel;
            if (this.mode == "sessions") return this.sessionExportModel;
            if (this.mode == "archive") return this.archiveExportModel;
            return this.customExportModel;
        }

        onInstrumentsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.instrumentsOption = e.target.value as any;
            }
        );

        onSessionsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.sessionsOption = e.target.value as any;
            }
        );

        onHistoryOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                this.exportModel.historyOption = e.target.value as any;
            }
        );

        onOK = action(() => {
            if (this.mode == "instruments") {
                if (this.exportModel.selectedInstruments.size == 0) {
                    this.error = "At least one instrument must be selected.";
                    return false;
                }
            }

            if (this.mode == "sessions") {
                if (this.exportModel.selectedSessions.size == 0) {
                    this.error = "At least one session must be selected.";
                    return false;
                }
            }

            if (this.description.trim() == "") {
                this.error = "Description is required.";
                return false;
            }

            (async () => {
                let defaultPath = window.localStorage.getItem(
                    "lastExportDatabasePath"
                );

                const fileName = "export.db";

                const result = await dialog.showSaveDialog(getCurrentWindow(), {
                    filters: [
                        {
                            name: "DB files",
                            extensions: ["db"]
                        },
                        { name: "All Files", extensions: ["*"] }
                    ],
                    defaultPath: defaultPath
                        ? defaultPath + path.sep + fileName
                        : fileName
                });

                const filePath = result.filePath;

                if (filePath) {
                    window.localStorage.setItem(
                        "lastExportDatabasePath",
                        path.dirname(filePath)
                    );

                    instrumentDatabases.exportDatabase(filePath, {
                        mode: this.mode,
                        instrumentsOption: this.exportModel.instrumentsOption,
                        selectedInstruments: Array.from(
                            this.exportModel.selectedInstruments
                        ),
                        sessionsOption: this.exportModel.sessionsOption,
                        selectedSessions: Array.from(
                            this.exportModel.selectedSessions
                        ),
                        historyOption: this.exportModel.historyOption,
                        historyOdlerThenYears:
                            this.exportModel.historyOdlerThenYears,
                        historyOdlerThenMonths:
                            this.exportModel.historyOdlerThenMonths,
                        historyOdlerThenDays:
                            this.exportModel.historyOdlerThenDays,
                        removeHistoryAfterExport:
                            this.exportModel.removeHistoryAfterExport,
                        description: this.description
                    });
                }
            })();

            return true;
        });

        render() {
            return (
                <Dialog
                    className="EezStudio_ExportDialog"
                    title="Export"
                    onOk={this.onOK}
                    additionalFooterControl={
                        this.error ? (
                            <div className="text-danger">{this.error}</div>
                        ) : undefined
                    }
                >
                    <ul className="nav nav-pills">
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "instruments"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "instruments";
                                })}
                            >
                                Export Instruments
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "sessions"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "sessions";
                                })}
                            >
                                Export Sessions
                            </a>
                        </li>
                        <li className="nav-item">
                            <a
                                className={classNames("nav-link", {
                                    active: this.mode == "archive"
                                })}
                                href="#"
                                onClick={action(event => {
                                    event.preventDefault();
                                    this.mode = "archive";
                                })}
                            >
                                Archive History
                            </a>
                        </li>
                        {/*
                            <li className="nav-item">
                                <a
                                    className={classNames("nav-link", {
                                        active: this.mode == "custom"
                                    })}
                                    href="#"
                                    onClick={action(event => {
                                        event.preventDefault();
                                        this.mode = "custom";
                                    })}
                                >
                                    Custom
                                </a>
                            </li>
                        */}
                    </ul>

                    {this.mode == "instruments" && (
                        <InstrumentList
                            instrumentsStore={this.props.instrumentsStore}
                            exportModel={this.exportModel}
                        />
                    )}

                    {this.mode == "sessions" && (
                        <SessionList
                            instrumentsStore={this.props.instrumentsStore}
                            exportModel={this.exportModel}
                        />
                    )}

                    {this.mode == "archive" && (
                        <div className="EezStudio_ExportDialog_ArchiveMode">
                            <div style={{ marginBottom: 10 }}>
                                Archive history items older then:
                            </div>
                            <HistoryExportSettings
                                exportModel={this.exportModel}
                            />
                        </div>
                    )}

                    {this.mode == "custom" && (
                        <>
                            <Section title="INSTRUMENTS">
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        id="EezStudio_ExportDialog_AllInstruments"
                                        value="all"
                                        checked={
                                            this.exportModel
                                                .instrumentsOption == "all"
                                        }
                                        onChange={
                                            this.onInstrumentsOptionChange
                                        }
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="EezStudio_ExportDialog_AllInstruments"
                                    >
                                        All instruments
                                    </label>
                                </div>
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        id="EezStudio_ExportDialog_SelectedInstruments"
                                        value="selected"
                                        checked={
                                            this.exportModel
                                                .instrumentsOption == "selected"
                                        }
                                        onChange={
                                            this.onInstrumentsOptionChange
                                        }
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="EezStudio_ExportDialog_SelectedInstruments"
                                    >
                                        Selected instruments
                                    </label>
                                </div>

                                {this.exportModel.instrumentsOption ==
                                    "selected" && (
                                    <InstrumentList
                                        instrumentsStore={
                                            this.props.instrumentsStore
                                        }
                                        exportModel={this.exportModel}
                                    />
                                )}
                            </Section>

                            <Section title="SESSIONS">
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        id="EezStudio_ExportDialog_AllSessions"
                                        value="all"
                                        checked={
                                            this.exportModel.sessionsOption ==
                                            "all"
                                        }
                                        onChange={this.onSessionsOptionChange}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="EezStudio_ExportDialog_AllSessions"
                                    >
                                        All sessions
                                    </label>
                                </div>
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        id="EezStudio_ExportDialog_SelectedSessions"
                                        value="selected"
                                        checked={
                                            this.exportModel.sessionsOption ==
                                            "selected"
                                        }
                                        onChange={this.onSessionsOptionChange}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="EezStudio_ExportDialog_SelectedSessions"
                                    >
                                        Selected sessions
                                        {this.exportModel.sessionsOption ==
                                        "selected"
                                            ? ` (${
                                                  this.exportModel
                                                      .manadatorySelectedSessions
                                                      .size +
                                                  this.exportModel
                                                      .selectedSessions.size
                                              } selected)`
                                            : ""}
                                    </label>
                                </div>

                                {this.exportModel.sessionsOption ==
                                    "selected" && (
                                    <SessionList
                                        instrumentsStore={
                                            this.props.instrumentsStore
                                        }
                                        exportModel={this.exportModel}
                                    />
                                )}
                            </Section>

                            <Section
                                title={`HISTORY (${
                                    this.exportModel.numHistoryItems == 1
                                        ? "1 item"
                                        : `${this.exportModel.numHistoryItems} items`
                                })`}
                            >
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        id="EezStudio_ExportDialog_AllHistory"
                                        value="all"
                                        checked={
                                            this.exportModel.historyOption ==
                                            "all"
                                        }
                                        onChange={this.onHistoryOptionChange}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="EezStudio_ExportDialog_AllHistory"
                                    >
                                        All history
                                    </label>
                                </div>

                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        id="EezStudio_ExportDialog_OlderThenHistory"
                                        value="older-then"
                                        checked={
                                            this.exportModel.historyOption ==
                                            "older-then"
                                        }
                                        onChange={this.onHistoryOptionChange}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="EezStudio_ExportDialog_OlderThenHistory"
                                    >
                                        Older then
                                    </label>
                                </div>

                                {this.exportModel.historyOption ==
                                    "older-then" && (
                                    <HistoryExportSettings
                                        exportModel={this.exportModel}
                                        style={{ marginLeft: 20 }}
                                    />
                                )}
                            </Section>
                        </>
                    )}
                    <div style={{ marginTop: 20 }}>
                        <label
                            htmlFor="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                            className="form-label"
                        >
                            Description:
                        </label>
                        <textarea
                            className="form-control"
                            id="EezStudio_ProjectEditorScrapbook_ItemDetails_Description"
                            rows={3}
                            value={this.description}
                            onChange={action(event => {
                                this.description = event.target.value;
                            })}
                        ></textarea>
                    </div>
                </Dialog>
            );
        }
    }
);

export function showExportDialog(instrumentsStore: InstrumentsStore) {
    showDialog(<ExportDialog instrumentsStore={instrumentsStore} />);
}

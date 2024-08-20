import React from "react";
import { findDOMNode } from "react-dom";
import {
    action,
    autorun,
    computed,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { Icon } from "eez-studio-ui/icon";

import { InstrumentsStore } from "home/instruments";

import { InstrumentObject } from "instrument/instrument-object";
import {
    historySessions,
    type IHistorySession
} from "instrument/window/history/session/store";
import { db } from "eez-studio-shared/db";

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

const exportModel = new ExportModel();

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
        instrument: InstrumentObject;
    }> {
        render() {
            let instrument = this.props.instrument;

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

////////////////////////////////////////////////////////////////////////////////

const SessionNode = observer(
    class SessionNode extends React.Component<{
        session: IHistorySession;
    }> {
        render() {
            let session = this.props.session;

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

////////////////////////////////////////////////////////////////////////////////

const ExportDialog = observer(
    class ExportDialog extends React.Component<{
        instrumentsStore: InstrumentsStore;
    }> {
        element: Element;

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

        get sessions() {
            return historySessions.sessions.map(session => ({
                id: session.id,
                data: session,
                selected: false
            }));
        }

        onInstrumentsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                exportModel.instrumentsOption = e.target.value as any;
            }
        );

        onSessionsOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                exportModel.sessionsOption = e.target.value as any;
            }
        );

        onHistoryOptionChange = action(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                exportModel.historyOption = e.target.value as any;
            }
        );

        renderInstrumentNode = (node: IListNode) => {
            let instrument = node.data as InstrumentObject;
            return <InstrumentNode instrument={instrument} />;
        };

        renderSessionNode = (node: IListNode) => {
            let session = node.data as IHistorySession;
            return <SessionNode session={session} />;
        };

        render() {
            return (
                <Dialog
                    ref={(ref: any) => {
                        this.element = findDOMNode(ref) as Element;
                    }}
                    className="EezStudio_ExportDialog"
                    title="Export"
                >
                    <Section title="INSTRUMENTS">
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="EezStudio_ExportDialog_AllInstruments"
                                value="all"
                                checked={exportModel.instrumentsOption == "all"}
                                onChange={this.onInstrumentsOptionChange}
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
                                    exportModel.instrumentsOption == "selected"
                                }
                                onChange={this.onInstrumentsOptionChange}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="EezStudio_ExportDialog_SelectedInstruments"
                            >
                                Selected instruments
                            </label>
                        </div>

                        {exportModel.instrumentsOption == "selected" && (
                            <ListContainer tabIndex={0}>
                                <List
                                    nodes={this.instruments}
                                    renderNode={this.renderInstrumentNode}
                                />
                            </ListContainer>
                        )}
                    </Section>

                    <Section title="SESSIONS">
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="EezStudio_ExportDialog_AllSessions"
                                value="all"
                                checked={exportModel.sessionsOption == "all"}
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
                                    exportModel.sessionsOption == "selected"
                                }
                                onChange={this.onSessionsOptionChange}
                            />
                            <label
                                className="form-check-label"
                                htmlFor="EezStudio_ExportDialog_SelectedSessions"
                            >
                                Selected sessions
                                {exportModel.sessionsOption == "selected"
                                    ? ` (${
                                          exportModel.manadatorySelectedSessions
                                              .size +
                                          exportModel.selectedSessions.size
                                      } selected)`
                                    : ""}
                            </label>
                        </div>

                        {exportModel.sessionsOption == "selected" && (
                            <ListContainer tabIndex={0}>
                                <List
                                    nodes={this.sessions}
                                    renderNode={this.renderSessionNode}
                                />
                            </ListContainer>
                        )}
                    </Section>

                    <Section
                        title={`HISTORY (${
                            exportModel.numHistoryItems == 1
                                ? "1 item"
                                : `${exportModel.numHistoryItems} items`
                        })`}
                    >
                        <div className="form-check">
                            <input
                                className="form-check-input"
                                type="radio"
                                id="EezStudio_ExportDialog_AllHistory"
                                value="all"
                                checked={exportModel.historyOption == "all"}
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
                                    exportModel.historyOption == "older-then"
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

                        {exportModel.historyOption == "older-then" && (
                            <div style={{ marginLeft: 20 }}>
                                <div className="d-flex align-items-center">
                                    <label className="form-label">
                                        Years
                                        <input
                                            className="form-control"
                                            type="number"
                                            value={
                                                exportModel.historyOdlerThenYears
                                            }
                                            min={0}
                                            step={1}
                                            onChange={action(event => {
                                                exportModel.historyOdlerThenYears =
                                                    parseInt(
                                                        event.target.value
                                                    );
                                            })}
                                        />
                                    </label>
                                    <label className="form-label">
                                        Months
                                        <input
                                            className="form-control"
                                            type="number"
                                            value={
                                                exportModel.historyOdlerThenMonths
                                            }
                                            min={0}
                                            step={1}
                                            onChange={action(event => {
                                                exportModel.historyOdlerThenMonths =
                                                    parseInt(
                                                        event.target.value
                                                    );
                                            })}
                                        />
                                    </label>
                                    <label className="form-label">
                                        Days
                                        <input
                                            className="form-control"
                                            type="number"
                                            value={
                                                exportModel.historyOdlerThenDays
                                            }
                                            min={0}
                                            step={1}
                                            onChange={action(event => {
                                                exportModel.historyOdlerThenDays =
                                                    parseInt(
                                                        event.target.value
                                                    );
                                            })}
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label
                                        className="form-check-label d-flex align-items-center"
                                        style={{ gap: 5 }}
                                    >
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            checked={
                                                exportModel.removeHistoryAfterExport
                                            }
                                            onChange={action(event => {
                                                exportModel.removeHistoryAfterExport =
                                                    event.target.checked;
                                            })}
                                        />
                                        Remove history after export
                                    </label>
                                </div>
                            </div>
                        )}
                    </Section>
                </Dialog>
            );
        }
    }
);

export function showExportDialog(
    instrumentsStore: InstrumentsStore,
    callback: (exportModel: ExportModel) => void
) {
    showDialog(<ExportDialog instrumentsStore={instrumentsStore} />);
}

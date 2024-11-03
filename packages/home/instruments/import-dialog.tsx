import React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import Database from "better-sqlite3";

import { instrumentDatabases } from "eez-studio-shared/db";

import { Dialog, showDialog } from "eez-studio-ui/dialog";

import { InstrumentsStore } from "home/instruments";

const ImportDialog = observer(
    class ImportDialog extends React.Component<{
        instrumentsStore: InstrumentsStore;
        filePath: string;
    }> {
        onOK = action(() => {
            instrumentDatabases.importDatabase(this.props.filePath);
            return true;
        });

        render() {
            let description = "";
            let className;

            try {
                const db = new Database(this.props.filePath);
                description = (
                    db.prepare("SELECT description FROM settings").get() as any
                ).description;
            } catch (e) {
                description = "Failed to read description";
                className = "text-danger";
            }

            return (
                <Dialog
                    className="EezStudio_ImportDialog"
                    title="Import"
                    onOk={this.onOK}
                >
                    <div>From file:</div>
                    <div>{this.props.filePath}</div>
                    <div>Description:</div>
                    <div className={className}>{description}</div>
                </Dialog>
            );
        }
    }
);

export function showImportDialog(
    instrumentsStore: InstrumentsStore,
    filePath: string
) {
    showDialog(
        <ImportDialog instrumentsStore={instrumentsStore} filePath={filePath} />
    );
}

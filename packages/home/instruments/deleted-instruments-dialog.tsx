import React from "react";
import { findDOMNode } from "react-dom";
import { computed, values, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import { createStoreObjectsCollection } from "eez-studio-shared/store";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { confirm } from "eez-studio-ui/dialog-electron";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { ButtonAction } from "eez-studio-ui/action";

import { db } from "eez-studio-shared/db";

import { InstrumentsStore } from "home/instruments";

import { InstrumentObject, store } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

const deletedInstrumentCollection =
    createStoreObjectsCollection<InstrumentObject>(true);
store.watch(deletedInstrumentCollection, {
    deletedOption: "only"
});
export const deletedInstruments = deletedInstrumentCollection.objects;

////////////////////////////////////////////////////////////////////////////////

const DeletedInstrumentsDialog = observer(
    class DeletedInstrumentsDialog extends React.Component<{
        instrumentsStore: InstrumentsStore;
    }> {
        element: Element;

        renderNode = (node: IListNode) => {
            let instrument = node.data as InstrumentObject;

            let creationDate;
            try {
                const result = db
                    .prepare(
                        `SELECT * FROM "activityLog" WHERE oid=? AND type='instrument/created'`
                    )
                    .get(instrument.id) as any;
                creationDate = new Date(Number(result.date));
            } catch (err) {
                // console.error(err);
                creationDate = null;
            }

            return (
                <ListItem
                    leftIcon={instrument.image}
                    leftIconSize={48}
                    label={
                        <>
                            <div>{instrument.name}</div>
                            <div>
                                {"Creation date: " +
                                    (creationDate
                                        ? formatDateTimeLong(creationDate)
                                        : "unknown")}
                            </div>
                            <div style={{ display: "flex" }}>
                                <ButtonAction
                                    className="btn btn-sm btn-outline-success"
                                    text="Restore"
                                    title="Restore"
                                    onClick={() => {
                                        instrument.restore();
                                        this.props.instrumentsStore.selectedInstrumentId =
                                            instrument.id;
                                    }}
                                    style={{ marginRight: "5px" }}
                                />
                                <ButtonAction
                                    className="btn btn-sm btn-outline-danger"
                                    text="Delete Permanently"
                                    title="Delete instrument permanently including all the history"
                                    onClick={() => {
                                        confirm(
                                            "Are you sure?",
                                            "It will also delete all the history.",
                                            () => {
                                                instrument.deletePermanently();
                                            }
                                        );
                                    }}
                                />
                            </div>
                        </>
                    }
                />
            );
        };

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                deletedInstruments: computed
            });
        }

        get deletedInstruments() {
            return values(deletedInstruments).map(instrument => ({
                id: instrument.id,
                data: instrument,
                selected: false
            }));
        }

        deleteAllPermanently() {
            confirm(
                "Are you sure?",
                "It will also delete all the history.",
                () => {
                    let deletedInstruments = this.deletedInstruments.slice();
                    for (let i = 0; i < deletedInstruments.length; i++) {
                        deletedInstruments[i].data.deletePermanently();
                    }
                }
            );
        }

        componentDidUpdate() {
            if (this.deletedInstruments.length === 0) {
                $(this.element).modal("hide");
            }
        }

        render() {
            return (
                <Dialog
                    ref={(ref: any) => {
                        this.element = findDOMNode(ref) as Element;
                    }}
                    additionalButtons={[
                        {
                            id: "deleteAllPermanently",
                            type: "danger",
                            position: "left",
                            onClick: () => this.deleteAllPermanently(),
                            disabled: false,
                            style: { marginRight: "auto" },
                            text: "Delete All Permanently"
                        }
                    ]}
                >
                    <ListContainer
                        tabIndex={0}
                        minHeight={240}
                        maxHeight={400}
                        className="EezStudio_DeletedInstrumentsList"
                    >
                        <List
                            nodes={this.deletedInstruments}
                            renderNode={this.renderNode}
                        />
                    </ListContainer>
                </Dialog>
            );
        }
    }
);

export function showDeletedInstrumentsDialog(
    instrumentsStore: InstrumentsStore
) {
    showDialog(
        <DeletedInstrumentsDialog instrumentsStore={instrumentsStore} />
    );
}

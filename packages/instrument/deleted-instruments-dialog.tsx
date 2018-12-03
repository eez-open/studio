import React from "react";
import { findDOMNode } from "react-dom";
import { computed, values } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";

import { createStoreObjectsCollection } from "eez-studio-shared/store";

import { Dialog, showDialog, confirm } from "eez-studio-ui/dialog";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { ButtonAction } from "eez-studio-ui/action";

import { InstrumentObject, store } from "instrument/instrument-object";

////////////////////////////////////////////////////////////////////////////////

const deletedInstrumentCollection = createStoreObjectsCollection<InstrumentObject>(true);
store.watch(deletedInstrumentCollection, {
    deletedOption: "only"
});
export const deletedInstruments = deletedInstrumentCollection.objects;

////////////////////////////////////////////////////////////////////////////////

@observer
class DeletedInstrumentsDialog extends React.Component<{}, {}> {
    element: Element;

    renderNode(node: IListNode) {
        let instrument = node.data as InstrumentObject;
        return (
            <ListItem
                leftIcon={instrument.image}
                leftIconSize={48}
                label={
                    <div>
                        <div>{instrument.name}</div>
                        <div>
                            {"Creation date: " +
                                (instrument.creationDate
                                    ? formatDateTimeLong(instrument.creationDate)
                                    : "unknown")}
                        </div>
                        <div style={{ paddingBottom: "5px" }}>
                            <ButtonAction
                                className="btn-sm btn-outline-success"
                                text="Restore"
                                title="Restore"
                                onClick={() => {
                                    instrument.restore();
                                }}
                                style={{ marginRight: "5px" }}
                            />
                            <ButtonAction
                                className="btn-sm btn-outline-danger"
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
                    </div>
                }
            />
        );
    }

    @computed
    get deletedInstruments() {
        return values(deletedInstruments).map(instrument => ({
            id: instrument.id,
            data: instrument,
            selected: false
        }));
    }

    deleteAllPermanently() {
        confirm("Are you sure?", "It will also delete all the history.", () => {
            let deletedInstruments = this.deletedInstruments.slice();
            for (let i = 0; i < deletedInstruments.length; i++) {
                deletedInstruments[i].data.deletePermanently();
            }
        });
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
                additionalButton={{
                    id: "deleteAllPermanently",
                    type: "danger",
                    position: "left",
                    onClick: () => this.deleteAllPermanently(),
                    disabled: false,
                    style: { marginRight: "auto" },
                    text: "Delete All Permanently"
                }}
            >
                <ListContainer tabIndex={0} minHeight={240} maxHeight={400}>
                    <List nodes={this.deletedInstruments} renderNode={this.renderNode} />
                </ListContainer>
            </Dialog>
        );
    }
}

export function showDeletedInstrumentsDialog() {
    showDialog(<DeletedInstrumentsDialog />);
}

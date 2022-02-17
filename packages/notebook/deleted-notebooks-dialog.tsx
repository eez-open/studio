import React from "react";
import { findDOMNode } from "react-dom";
import { computed, values, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { Dialog, showDialog } from "eez-studio-ui/dialog";
import { confirm } from "eez-studio-ui/dialog-electron";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { ButtonAction } from "eez-studio-ui/action";

import {
    INotebook,
    notebooksStore,
    deletedNotebooks,
    itemsStore
} from "notebook/store";

////////////////////////////////////////////////////////////////////////////////

const DeletedNotebooksDialog = observer(
    class DeletedNotebooksDialog extends React.Component {
        element: Element;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                deletedNotebooks: computed
            });
        }

        renderNode(node: IListNode) {
            let notebook = node.data as INotebook;
            return (
                <ListItem
                    label={
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "space-between",
                                marginBottom: "5px"
                            }}
                        >
                            <div>{notebook.name}</div>
                            <div className="EezStudio_NoWrap">
                                <ButtonAction
                                    className="btn-sm btn-outline-success"
                                    text="Restore"
                                    title="Restore"
                                    onClick={() => {
                                        notebooksStore.undeleteObject(notebook);
                                    }}
                                    style={{
                                        marginRight: "5px",
                                        display: "inline"
                                    }}
                                />
                                <ButtonAction
                                    className="btn-sm btn-outline-danger"
                                    text="Delete Permanently"
                                    title="Delete notebook permanently including all the items"
                                    onClick={() => {
                                        confirm(
                                            "Are you sure?",
                                            "It will also delete all the items in the notebbok.",
                                            () => {
                                                itemsStore.deleteObject(
                                                    { oid: notebook.id },
                                                    { deletePermanently: true }
                                                );
                                                notebooksStore.deleteObject(
                                                    notebook,
                                                    {
                                                        deletePermanently: true
                                                    }
                                                );
                                            }
                                        );
                                    }}
                                    style={{ display: "inline" }}
                                />
                            </div>
                        </div>
                    }
                />
            );
        }

        get deletedNotebooks() {
            return values(deletedNotebooks).map(notebook => ({
                id: notebook.id,
                data: notebook,
                selected: false
            }));
        }

        deleteAllPermanently() {
            confirm(
                "Are you sure?",
                "It will also delete all the items.",
                () => {
                    let deletedNotebooks = this.deletedNotebooks.slice();
                    for (let i = 0; i < deletedNotebooks.length; i++) {
                        itemsStore.deleteObject(
                            { oid: deletedNotebooks[i].id },
                            { deletePermanently: true }
                        );
                        notebooksStore.deleteObject(deletedNotebooks[i], {
                            deletePermanently: true
                        });
                    }
                }
            );
        }

        componentDidUpdate() {
            if (this.deletedNotebooks.length === 0) {
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
                        <List
                            nodes={this.deletedNotebooks}
                            renderNode={this.renderNode}
                        />
                    </ListContainer>
                </Dialog>
            );
        }
    }
);

export function showDeletedNotebooksDialog() {
    showDialog(<DeletedNotebooksDialog />);
}

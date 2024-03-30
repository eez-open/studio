import React from "react";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";

import { Balloon } from "eez-studio-ui/balloon";
import { PropertyList, StaticRichTextProperty } from "eez-studio-ui/properties";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

import { logUpdate } from "instrument/window/history/activity-log";

import { showEditNoteDialog } from "instrument/window/note-dialog";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { PreventDraggable } from "instrument/window/history/helper";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";

////////////////////////////////////////////////////////////////////////////////

export const NoteHistoryItemComponent = observer(
    class NoteHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: NoteHistoryItem;
        },
        {}
    > {
        handleEditNote = () => {
            showEditNoteDialog(this.props.historyItem.message, note => {
                beginTransaction("Edit note");
                logUpdate(
                    this.props.appStore.history.options.store,
                    {
                        id: this.props.historyItem.id,
                        oid: this.props.appStore.history.oid,
                        message: note
                    },
                    {
                        undoable: true
                    }
                );
                commitTransaction();
            });
        };

        render() {
            return (
                <div
                    className="EezStudio_NoteHistoryItem"
                    onDoubleClick={this.handleEditNote}
                >
                    <Balloon>
                        <p>
                            <HistoryItemInstrumentInfo
                                appStore={this.props.appStore}
                                historyItem={this.props.historyItem}
                            />
                            <small className="EezStudio_HistoryItemDate">
                                {formatDateTimeLong(
                                    this.props.historyItem.date
                                )}
                            </small>
                        </p>
                        {this.props.historyItem.getSourceDescriptionElement(
                            this.props.appStore
                        )}
                        <PreventDraggable tag="div">
                            <PropertyList>
                                <StaticRichTextProperty
                                    value={this.props.historyItem.message}
                                />
                            </PropertyList>
                        </PreventDraggable>
                    </Balloon>
                    <Toolbar>
                        <IconAction
                            icon="material:edit"
                            title="Edit note"
                            onClick={this.handleEditNote}
                        />
                    </Toolbar>
                </div>
            );
        }
    }
);

export class NoteHistoryItem extends HistoryItem {
    get info() {
        return (
            <Balloon>
                <PropertyList>
                    <StaticRichTextProperty value={this.message} />
                </PropertyList>
            </Balloon>
        );
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <NoteHistoryItemComponent appStore={appStore} historyItem={this} />
        );
    }
}

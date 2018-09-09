import * as React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { formatDateTimeLong } from "shared/util";
import { beginTransaction, commitTransaction } from "shared/store";
import { IActivityLogEntry, logDelete, logUpdate } from "shared/activity-log";

import { confirm } from "shared/ui/dialog";
import { Balloon } from "shared/ui/balloon";
import { PropertyList, StaticRichTextProperty } from "shared/ui/properties";
import { Toolbar } from "shared/ui/toolbar";
import { IconAction } from "shared/ui/action";

import { showEditNoteDialog } from "instrument/window/note-dialog";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class NoteHistoryItemComponent extends React.Component<
    {
        historyItem: NoteHistoryItem;
    },
    {}
> {
    @bind
    handleEditNote() {
        showEditNoteDialog(this.props.historyItem.message, note => {
            beginTransaction("Edit note");
            logUpdate(
                this.props.historyItem.appStore.history.options.store,
                {
                    id: this.props.historyItem.id,
                    oid: this.props.historyItem.appStore!.history.oid,
                    message: note
                },
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    @bind
    handleDeleteNote() {
        confirm("Are you sure?", undefined, () => {
            beginTransaction("Delete note");
            logDelete(
                this.props.historyItem.appStore.history.options.store,
                this.props.historyItem,
                {
                    undoable: true
                }
            );
            commitTransaction();
        });
    }

    render() {
        return (
            <div
                className="EezStudio_HistoryItem EezStudio_HistoryItem_Note"
                onDoubleClick={this.handleEditNote}
            >
                <Balloon>
                    <p>
                        <small className="EezStudio_HistoryItemDate text-muted">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    {this.props.historyItem.sourceDescriptionElement}
                    <PropertyList>
                        <StaticRichTextProperty value={this.props.historyItem.message} />
                    </PropertyList>
                </Balloon>
                <Toolbar>
                    <IconAction
                        icon="material:edit"
                        title="Edit note"
                        onClick={this.handleEditNote}
                    />
                    <IconAction
                        icon="material:delete"
                        title="Delete note"
                        onClick={this.handleDeleteNote}
                    />
                </Toolbar>
            </div>
        );
    }
}

export class NoteHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get info() {
        return (
            <Balloon>
                <PropertyList>
                    <StaticRichTextProperty value={this.message} />
                </PropertyList>
            </Balloon>
        );
    }

    get listItemElement(): JSX.Element | null {
        return <NoteHistoryItemComponent historyItem={this} />;
    }
}

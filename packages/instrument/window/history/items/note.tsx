import React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { beginTransaction, commitTransaction } from "eez-studio-shared/store";
import { IActivityLogEntry, logUpdate } from "eez-studio-shared/activity-log";

import styled from "eez-studio-ui/styled-components";
import { Balloon } from "eez-studio-ui/balloon";
import { PropertyList, StaticRichTextProperty } from "eez-studio-ui/properties";
import { Toolbar } from "eez-studio-ui/toolbar";
import { IconAction } from "eez-studio-ui/action";

import { showEditNoteDialog } from "instrument/window/note-dialog";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const NoteHistoryItemDiv = styled(HistoryItemDiv)`
    position: relative;
    margin: auto;
    overflow: visible;
    border-radius: 0;
    padding: 0;
    min-width: 240px;

    .EezStudio_Toolbar {
        position: absolute;
        display: none;
        top: 5px;
        right: 5px;
    }

    &:hover .EezStudio_Toolbar {
        display: block;
    }
`;

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

    render() {
        return (
            <NoteHistoryItemDiv onDoubleClick={this.handleEditNote}>
                <Balloon>
                    <p>
                        <HistoryItemDate>
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </HistoryItemDate>
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
                </Toolbar>
            </NoteHistoryItemDiv>
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

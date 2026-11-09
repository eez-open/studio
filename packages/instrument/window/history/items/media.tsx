import React from "react";
import { observer } from "mobx-react";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { Icon } from "eez-studio-ui/icon";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { formatDateTimeLong } from "eez-studio-shared/util";
import {
    RECORD_AUDIO_ICON,
    RECORD_VIDEO_ICON
} from "project-editor/ui-components/icons";
import { formatBytes } from "eez-studio-shared/formatBytes";
import { MediaPlayer, PreventDraggable } from "../helper";
import { Toolbar } from "eez-studio-ui/toolbar";

////////////////////////////////////////////////////////////////////////////////

export const MediaHistoryItemComponent = observer(
    class MediaHistoryItemComponent extends React.Component<
        {
            appStore: IAppStore;
            historyItem: MediaHistoryItem;
        },
        {}
    > {
        get data() {
            return this.props.historyItem.data as Uint8Array;
        }

        render() {
            const mimeType =
                this.props.historyItem.mediaHistoryItemMessage.mimeType;

            const isVideo = mimeType.startsWith("video");

            return (
                <div className="EezStudio_FileHistoryItem">
                    <Icon
                        className="me-3"
                        icon={isVideo ? RECORD_VIDEO_ICON : RECORD_AUDIO_ICON}
                        size={48}
                    />
                    <div>
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
                        <div className="mb-1">
                            {mimeType}: {formatBytes(this.data.length)}
                        </div>
                        <PreventDraggable tag="div">
                            <MediaPlayer data={this.data} mimeType={mimeType} />
                        </PreventDraggable>
                        <Toolbar>
                            {this.props.historyItem.renderAddNoteAction(
                                this.props.appStore
                            )}
                        </Toolbar>
                        {this.props.historyItem.renderNote(this.props.appStore)}
                    </div>
                </div>
            );
        }
    }
);

interface MediaHistoryItemMessage {
    mimeType: string;
}

export class MediaHistoryItem extends HistoryItem {
    get mediaHistoryItemMessage() {
        return this.messageObject as MediaHistoryItemMessage;
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <MediaHistoryItemComponent appStore={appStore} historyItem={this} />
        );
    }
}

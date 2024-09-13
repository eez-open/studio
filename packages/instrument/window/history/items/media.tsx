import React from "react";
import { observer } from "mobx-react";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { computed, makeObservable } from "mobx";
import { Icon } from "eez-studio-ui/icon";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { formatDateTimeLong } from "eez-studio-shared/util";
import {
    RECORD_AUDIO_ICON,
    RECORD_VIDEO_ICON
} from "project-editor/ui-components/icons";
import { formatBytes } from "eez-studio-shared/formatBytes";
import { PreventDraggable } from "../helper";
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
        constructor(props: any) {
            super(props);

            makeObservable(this, {
                blob: computed,
                src: computed
            });
        }

        get data() {
            return this.props.historyItem.data as Uint8Array;
        }

        get blob() {
            return new Blob([this.data], {
                type: this.props.historyItem.mediaHistoryItemMessage.mimeType
            });
        }

        get src(): string {
            return window.URL.createObjectURL(this.blob);
        }

        render() {
            const isVideo =
                this.props.historyItem.mediaHistoryItemMessage.mimeType.startsWith(
                    "video"
                );

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
                            {
                                this.props.historyItem.mediaHistoryItemMessage
                                    .mimeType
                            }
                            : {formatBytes(this.data.length)}
                        </div>
                        <PreventDraggable tag="div">
                            {isVideo ? (
                                <video
                                    controls
                                    src={this.src}
                                    draggable="true"
                                    onDragStart={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                ></video>
                            ) : (
                                <audio
                                    controls
                                    src={this.src}
                                    draggable="true"
                                    onDragStart={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                ></audio>
                            )}
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

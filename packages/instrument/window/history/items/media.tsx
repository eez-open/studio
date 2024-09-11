import React from "react";
import { observer } from "mobx-react";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";
import { computed, makeObservable } from "mobx";
import { Icon } from "eez-studio-ui/icon";
import { HistoryItemInstrumentInfo } from "../HistoryItemInstrumentInfo";
import { formatDateTimeLong } from "eez-studio-shared/util";
import { RECORD_AUDIO_ICON } from "project-editor/ui-components/icons";
import { formatBytes } from "eez-studio-shared/formatBytes";

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
                message: computed,
                blob: computed,
                src: computed
            });
        }

        get message() {
            return JSON.parse(this.props.historyItem.message);
        }

        get data() {
            return this.props.historyItem.data as Uint8Array;
        }

        get blob() {
            return new Blob([this.data], {
                type: this.message.mimeType
            });
        }

        get src(): string {
            return window.URL.createObjectURL(this.blob);
        }

        render() {
            return (
                <div className="EezStudio_FileHistoryItem">
                    <Icon className="me-3" icon={RECORD_AUDIO_ICON} size={48} />
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
                            {this.message.mimeType}:{" "}
                            {formatBytes(this.data.length)}
                        </div>
                        <audio controls src={this.src}></audio>
                    </div>
                </div>
            );
        }
    }
);

export class MediaHistoryItem extends HistoryItem {
    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <MediaHistoryItemComponent appStore={appStore} historyItem={this} />
        );
    }
}

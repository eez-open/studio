import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import type { IActivityLogEntry } from "eez-studio-shared/activity-log";

import { Icon } from "eez-studio-ui/icon";

import type { IAppStore } from "instrument/window/history/history";
import { HistoryItem } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ScriptHistoryItemComponent extends React.Component<
    {
        appStore: IAppStore;
        historyItem: ScriptHistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_ScriptHistoryItem">
                <Icon className="me-3" icon={"material:slideshow"} size={48} />
                <div>
                    <p>
                        <small className="EezStudio_HistoryItemDate">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    {this.props.historyItem.getSourceDescriptionElement(
                        this.props.appStore
                    )}
                    <table className="table">
                        <tbody>
                            <tr>
                                <td>Name</td>
                                <td>
                                    {this.props.historyItem.scriptMessage.name}
                                </td>
                            </tr>
                            <tr>
                                <td>Type</td>
                                <td>
                                    {this.props.historyItem.scriptMessage.type}
                                </td>
                            </tr>
                            {this.props.historyItem.scriptMessage
                                .parameters && (
                                <tr>
                                    <td>Parameters</td>
                                    <td>
                                        <pre>
                                            {JSON.stringify(
                                                this.props.historyItem
                                                    .scriptMessage.parameters
                                            )}
                                        </pre>
                                    </td>
                                </tr>
                            )}
                            {this.props.historyItem.scriptMessage.done && (
                                <tr>
                                    <td>Result:</td>
                                    <td>
                                        {this.props.historyItem.scriptMessage
                                            .error ? (
                                            <div className="text-danger">
                                                {
                                                    this.props.historyItem
                                                        .scriptMessage.error
                                                }
                                            </div>
                                        ) : (
                                            "Success"
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

export interface IScriptHistoryItemMessage {
    name: string;
    type: string;
    parameters?: any;
    done: boolean;
    error?: string;
}

export class ScriptHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry) {
        super(activityLogEntry);
    }

    @computed
    get scriptMessage() {
        return JSON.parse(this.message) as IScriptHistoryItemMessage;
    }

    getListItemElement(appStore: IAppStore): React.ReactNode {
        return (
            <ScriptHistoryItemComponent
                appStore={appStore}
                historyItem={this}
            />
        );
    }
}

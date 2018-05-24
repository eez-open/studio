import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import { Icon } from "shared/ui/icon";

import { HistoryItem } from "instrument/window/history-item";

////////////////////////////////////////////////////////////////////////////////

@observer
export class ScriptHistoryItemComponent extends React.Component<
    {
        historyItem: ScriptHistoryItem;
    },
    {}
> {
    render() {
        return (
            <div className="EezStudio_HistoryItem EezStudio_HistoryItem_Script">
                <Icon className="mr-3" icon={"material:slideshow"} size={48} />
                <div>
                    <p>
                        <small className="EezStudio_HistoryItemDate text-muted">
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </small>
                    </p>
                    <table className="table">
                        <tbody>
                            <tr>
                                <td>Name</td>
                                <td>{this.props.historyItem.scriptMessage.name}</td>
                            </tr>
                            <tr>
                                <td>Type</td>
                                <td>{this.props.historyItem.scriptMessage.type}</td>
                            </tr>
                            {this.props.historyItem.scriptMessage.parameters && (
                                <tr>
                                    <td>Parameters</td>
                                    <td>
                                        <pre>
                                            {JSON.stringify(
                                                this.props.historyItem.scriptMessage.parameters
                                            )}
                                        </pre>
                                    </td>
                                </tr>
                            )}
                            {this.props.historyItem.scriptMessage.done && (
                                <tr>
                                    <td>Result:</td>
                                    <td>
                                        {this.props.historyItem.scriptMessage.error ? (
                                            <div className="text-danger">
                                                {this.props.historyItem.scriptMessage.error}
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

    get listItemElement(): JSX.Element | null {
        return <ScriptHistoryItemComponent historyItem={this} />;
    }
}

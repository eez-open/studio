import * as React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { IActivityLogEntry } from "eez-studio-shared/activity-log";

import styled from "eez-studio-shared/ui/styled-components";
import { Icon } from "eez-studio-shared/ui/icon";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const ScriptHistoryItemDiv = styled(HistoryItemDiv)`
    background-color: #f5f5f5;
    padding: 10px;
    display: flex;
    flex-direction: row;
`;

@observer
export class ScriptHistoryItemComponent extends React.Component<
    {
        historyItem: ScriptHistoryItem;
    },
    {}
> {
    render() {
        return (
            <ScriptHistoryItemDiv>
                <Icon className="mr-3" icon={"material:slideshow"} size={48} />
                <div>
                    <p>
                        <HistoryItemDate>
                            {formatDateTimeLong(this.props.historyItem.date)}
                        </HistoryItemDate>
                    </p>
                    {this.props.historyItem.sourceDescriptionElement}
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
            </ScriptHistoryItemDiv>
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
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    @computed
    get scriptMessage() {
        return JSON.parse(this.message) as IScriptHistoryItemMessage;
    }

    get listItemElement(): JSX.Element | null {
        return <ScriptHistoryItemComponent historyItem={this} />;
    }
}

import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";

import { formatDateTimeLong } from "eez-studio-shared/util";
import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";
import { Loader } from "eez-studio-ui/loader";
import { ButtonAction } from "eez-studio-ui/action";

import { findObjectByActivityLogEntry } from "eez-studio-shared/extensions/extensions";

import { History, SearchResult } from "instrument/window/history/history";

@observer
export class SearchResultComponent extends React.Component<{
    history: History;
    searchResult: SearchResult;
}> {
    render() {
        const logEntry = this.props.searchResult.logEntry;
        const { date, type, message } = logEntry;

        let name;
        let content;

        const object = findObjectByActivityLogEntry(logEntry);
        if (object) {
            let info = object.activityLogEntryInfo(logEntry);
            if (info) {
                name = info.name;
                content = info.content;
            }
        }

        if (name === undefined) {
            name = `${type}: ${message.slice(0, 100)}`;
        }

        let className = classNames({
            selected: this.props.searchResult.selected
        });

        return (
            <tr
                className={className}
                onClick={() =>
                    this.props.history.search.selectSearchResult(this.props.searchResult)
                }
            >
                <td className="dateColumn">{formatDateTimeLong(date)}</td>
                <td className="contentColumn">{content}</td>
            </tr>
        );
    }
}

@observer
export class SearchResults extends React.Component<{ history: History }> {
    render() {
        let info;

        if (this.props.history.search.searchResults.length > 0) {
            info = `${this.props.history.search.searchResults.length} log items found`;
        } else if (!this.props.history.search.searchInProgress) {
            info = `No log item found.`;
        }

        return (
            <VerticalHeaderWithBody>
                <Header className="EezStudio_PanelHeader">
                    <div className="EezStudio_SearchResultsInfo">
                        {info}
                        {this.props.history.search.searchInProgress && (
                            <div className="EezStudio_SearchResultsInfo_LoaderContainer">
                                <Loader size={24} />
                            </div>
                        )}
                        {this.props.history.search.searchInProgress && (
                            <div className="EezStudio_SearchResultsInfo_StopButtonContainer">
                                <ButtonAction
                                    text="Stop"
                                    title="Stop search"
                                    className="btn-sm"
                                    onClick={() => this.props.history.search.stopSearch()}
                                />
                            </div>
                        )}
                    </div>
                </Header>
                <Body className="EezStudio_HistoryTable selectable">
                    <table className="table">
                        <tbody>
                            {this.props.history.search.searchResults.map(searchResult => (
                                <SearchResultComponent
                                    key={searchResult.logEntry.id}
                                    history={this.props.history}
                                    searchResult={searchResult}
                                />
                            ))}
                        </tbody>
                    </table>
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

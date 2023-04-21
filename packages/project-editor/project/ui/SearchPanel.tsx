import React from "react";
import { action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { IconAction } from "eez-studio-ui/action";

import { ProjectContext } from "project-editor/project/context";
import { Messages } from "project-editor/ui-components/Output";
import {
    MATCH_CASE_ICON,
    MATCH_WHOLE_WORD_ICON,
    REPLACE_ALL_ICON,
    REPLACE_SELECTED_ICON
} from "project-editor/ui-components/icons";
import { Section } from "project-editor/store";

export const SearchPanel = observer(
    class SearchPanel extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <div className="EezStudio_ProjectEditor_Search">
                    <Toolbar />
                    <Messages
                        section={this.context.outputSectionsStore.getSection(
                            Section.SEARCH
                        )}
                        showSearchResults={true}
                    />
                </div>
            );
        }
    }
);

const Toolbar = observer(
    class Toolbar extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                onSearchPatternChange: action.bound,
                toggleMatchCase: action.bound,
                toggleMatchWholeWord: action.bound,
                nextResult: action.bound,
                previousResult: action.bound,
                toggleReplace: action.bound,
                onReplaceTextChange: action.bound,
                replace: action.bound,
                replaceAll: action.bound
            });
        }

        get startSearchEnabled() {
            return this.context.uiStateStore.searchPattern != "";
        }

        startSearch() {
            this.context.startSearch();
        }

        onSearchPatternChange(event: any) {
            this.context.uiStateStore.searchPattern = event.target.value;
            this.startSearch();
        }

        toggleMatchCase() {
            this.context.uiStateStore.searchMatchCase =
                !this.context.uiStateStore.searchMatchCase;
            this.startSearch();
        }

        toggleMatchWholeWord() {
            this.context.uiStateStore.searchMatchWholeWord =
                !this.context.uiStateStore.searchMatchWholeWord;
            this.startSearch();
        }

        get nextResultEnabled() {
            const searchSection = this.context.outputSectionsStore.getSection(
                Section.SEARCH
            );
            const selectedMessage = searchSection.selectedMessage;

            if (!selectedMessage) {
                return searchSection.messages.searchResults.length > 0;
            }

            return (
                searchSection.messages.searchResults.indexOf(selectedMessage) <
                searchSection.messages.searchResults.length - 1
            );
        }

        nextResult() {
            const searchSection = this.context.outputSectionsStore.getSection(
                Section.SEARCH
            );
            const selectedMessage = searchSection.selectedMessage;
            if (!selectedMessage) {
                if (searchSection.messages.searchResults.length > 0) {
                    searchSection.selectMessage(
                        searchSection.messages.searchResults[0]
                    );
                }
            } else {
                const i =
                    searchSection.messages.searchResults.indexOf(
                        selectedMessage
                    );
                if (i < searchSection.messages.searchResults.length - 1) {
                    searchSection.selectMessage(
                        searchSection.messages.searchResults[i + 1]
                    );
                }
            }
        }

        get previousResultEnabled() {
            const searchSection = this.context.outputSectionsStore.getSection(
                Section.SEARCH
            );
            const selectedMessage = searchSection.selectedMessage;

            if (!selectedMessage) {
                return searchSection.messages.searchResults.length > 0;
            }

            return (
                searchSection.messages.searchResults.indexOf(selectedMessage) >
                0
            );
        }

        previousResult() {
            const searchSection = this.context.outputSectionsStore.getSection(
                Section.SEARCH
            );
            const selectedMessage = searchSection.selectedMessage;

            if (!selectedMessage) {
                if (searchSection.messages.searchResults.length > 0) {
                    searchSection.selectMessage(
                        searchSection.messages.searchResults[
                            searchSection.messages.searchResults.length - 1
                        ]
                    );
                }
            } else {
                const i =
                    searchSection.messages.searchResults.indexOf(
                        selectedMessage
                    );
                if (i > 0) {
                    searchSection.selectMessage(
                        searchSection.messages.searchResults[i - 1]
                    );
                }
            }
        }

        toggleReplace() {
            this.context.uiStateStore.replaceEnabled =
                !this.context.uiStateStore.replaceEnabled;
        }

        onReplaceTextChange(event: any) {
            this.context.uiStateStore.replaceText = event.target.value;
        }

        get replaceSelectedEnabled() {
            return (
                this.context.outputSectionsStore.getSection(Section.SEARCH)
                    .selectedMessage != undefined
            );
        }

        replace() {
            // TODO
        }

        get replaceAllEnabled() {
            return (
                this.context.uiStateStore.replaceEnabled &&
                this.context.outputSectionsStore.getSection(Section.SEARCH)
                    .messages.searchResults.length > 0
            );
        }

        replaceAll() {
            // TODO
        }

        render() {
            return (
                <div className="EezStudio_ToolbarSearch">
                    <IconAction
                        icon={
                            this.context.uiStateStore.replaceEnabled
                                ? "material:expand_less"
                                : "material:expand_more"
                        }
                        title="Toggle Replace"
                        iconSize={20}
                        onClick={() => this.toggleReplace()}
                        style={{ marginTop: 2 }}
                    />

                    <div className="EezStudio_ToolbarSearch_Sections">
                        <div className="EezStudio_ToolbarSearch_SearchSection">
                            {this.context.uiStateStore.replaceEnabled ? (
                                <input
                                    className="form-control search-replace-input"
                                    type="text"
                                    placeholder="Search"
                                    value={
                                        this.context.uiStateStore
                                            .searchPattern ?? ""
                                    }
                                    onChange={this.onSearchPatternChange}
                                />
                            ) : (
                                <input
                                    className={classNames(
                                        "form-control",
                                        "search-input",
                                        {
                                            empty: !this.context.uiStateStore
                                                .searchPattern
                                        }
                                    )}
                                    type="text"
                                    placeholder="&#xe8b6;"
                                    value={
                                        this.context.uiStateStore
                                            .searchPattern ?? ""
                                    }
                                    onChange={this.onSearchPatternChange}
                                />
                            )}

                            <div className="btn-group" role="group">
                                <IconAction
                                    icon={MATCH_CASE_ICON}
                                    title="Match Case"
                                    iconSize={20}
                                    selected={
                                        this.context.uiStateStore
                                            .searchMatchCase
                                    }
                                    onClick={this.toggleMatchCase}
                                />
                                <IconAction
                                    icon={MATCH_WHOLE_WORD_ICON}
                                    title="Match Whole Word"
                                    iconSize={20}
                                    selected={
                                        this.context.uiStateStore
                                            .searchMatchWholeWord
                                    }
                                    onClick={this.toggleMatchWholeWord}
                                />
                            </div>
                            <div className="btn-group" role="group">
                                <IconAction
                                    title="Refresh Search Results"
                                    icon="material:refresh"
                                    onClick={() => this.startSearch()}
                                    enabled={this.startSearchEnabled}
                                />
                            </div>

                            <div className="btn-group" role="group">
                                <IconAction
                                    title="Next Result"
                                    icon="material:arrow_downward"
                                    onClick={() => this.nextResult()}
                                    enabled={this.nextResultEnabled}
                                />
                                <IconAction
                                    title="Previous Result"
                                    icon="material:arrow_upward"
                                    onClick={() => this.previousResult()}
                                    enabled={this.previousResultEnabled}
                                />
                            </div>
                        </div>

                        {this.context.uiStateStore.replaceEnabled && (
                            <div className="EezStudio_ToolbarSearch_ReplaceSection">
                                <input
                                    className={"form-control replace-input"}
                                    type="text"
                                    placeholder="Replace"
                                    value={
                                        this.context.uiStateStore.replaceText
                                    }
                                    onChange={this.onReplaceTextChange}
                                />
                                <div className="btn-group" role="group">
                                    <IconAction
                                        title="Replace Selected"
                                        icon={REPLACE_SELECTED_ICON}
                                        iconSize={20}
                                        onClick={() => this.replace()}
                                        enabled={this.replaceSelectedEnabled}
                                    />
                                    <IconAction
                                        title="Replace All"
                                        icon={REPLACE_ALL_ICON}
                                        iconSize={20}
                                        onClick={() => this.replaceAll()}
                                        enabled={this.replaceAllEnabled}
                                    />
                                </div>

                                <div style={{ marginRight: 95 }} />
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

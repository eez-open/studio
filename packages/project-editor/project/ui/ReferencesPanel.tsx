import React from "react";
import { action, makeObservable } from "mobx";
import { observer } from "mobx-react";

import { IconAction } from "eez-studio-ui/action";

import { ProjectContext } from "project-editor/project/context";
import { Messages } from "project-editor/ui-components/Output";
import { Section } from "project-editor/store";

export const ReferencesPanel = observer(
    class ReferencesPanel extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            return (
                <div className="EezStudio_ProjectEditor_References">
                    <Toolbar />
                    <Messages
                        section={this.context.outputSectionsStore.getSection(
                            Section.REFERENCES
                        )}
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
                nextResult: action.bound,
                previousResult: action.bound
            });
        }

        get nextResultEnabled() {
            const section = this.context.outputSectionsStore.getSection(
                Section.REFERENCES
            );
            const selectedMessage = section.selectedMessage;

            if (!selectedMessage) {
                return section.messages.searchResults.length > 0;
            }

            return (
                section.messages.searchResults.indexOf(selectedMessage) <
                section.messages.searchResults.length - 1
            );
        }

        nextResult() {
            const section = this.context.outputSectionsStore.getSection(
                Section.REFERENCES
            );
            const selectedMessage = section.selectedMessage;
            if (!selectedMessage) {
                if (section.messages.searchResults.length > 0) {
                    section.selectMessage(section.messages.searchResults[0]);
                }
            } else {
                const i =
                    section.messages.searchResults.indexOf(selectedMessage);
                if (i < section.messages.searchResults.length - 1) {
                    section.selectMessage(
                        section.messages.searchResults[i + 1]
                    );
                }
            }
        }

        get previousResultEnabled() {
            const section = this.context.outputSectionsStore.getSection(
                Section.REFERENCES
            );
            const selectedMessage = section.selectedMessage;

            if (!selectedMessage) {
                return section.messages.searchResults.length > 0;
            }

            return section.messages.searchResults.indexOf(selectedMessage) > 0;
        }

        previousResult() {
            const section = this.context.outputSectionsStore.getSection(
                Section.REFERENCES
            );
            const selectedMessage = section.selectedMessage;

            if (!selectedMessage) {
                if (section.messages.searchResults.length > 0) {
                    section.selectMessage(
                        section.messages.searchResults[
                            section.messages.searchResults.length - 1
                        ]
                    );
                }
            } else {
                const i =
                    section.messages.searchResults.indexOf(selectedMessage);
                if (i > 0) {
                    section.selectMessage(
                        section.messages.searchResults[i - 1]
                    );
                }
            }
        }

        render() {
            return (
                <div className="EezStudio_ToolbarReferences">
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
            );
        }
    }
);

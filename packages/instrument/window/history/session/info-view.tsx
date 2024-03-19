import React from "react";
import { observer } from "mobx-react";

import { confirm } from "eez-studio-ui/dialog-electron";
import { TextAction, IconAction } from "eez-studio-ui/action";
import { IAppStore } from "instrument/window/history/history";
import { computed, makeObservable } from "mobx";
import { homeTabStore } from "home/home-tab";

////////////////////////////////////////////////////////////////////////////////

export const SessionInfo = observer(
    class SessionInfo extends React.Component<{ appStore: IAppStore }, {}> {
        onClose = () => {
            confirm(
                "Are you sure?",
                undefined,
                this.props.appStore.history.sessions.closeActiveSession
            );
        };

        constructor(props: { appStore: IAppStore }) {
            super(props);

            makeObservable(this, {
                activeSessionName: computed
            });
        }

        get activeSessionName() {
            return this.props.appStore.history.sessions.activeSession!.getSessionName(
                this.props.appStore
            );
        }

        render() {
            const viewSessionsList = (
                <IconAction
                    icon="material:list"
                    title="View sessions list"
                    onClick={
                        this.props.appStore.navigationStore
                            .navigateToSessionsList
                    }
                />
            );

            let body;

            if (this.props.appStore.history.sessions.activeSession) {
                body = (
                    <React.Fragment>
                        <span>Active session:</span>
                        <span>{this.activeSessionName}</span>
                        <TextAction
                            text="Close"
                            title="Close active session"
                            onClick={this.onClose}
                        />
                        {viewSessionsList}
                    </React.Fragment>
                );
            } else {
                if (homeTabStore.activeTab != "instruments") {
                    return null;
                }
                body = (
                    <React.Fragment>
                        <TextAction
                            text="Start Session"
                            title="Start a new session"
                            onClick={
                                this.props.appStore.history.sessions
                                    .startNewSession
                            }
                        />
                        {viewSessionsList}
                    </React.Fragment>
                );
            }

            return <div className="EezStudio_SessionInfoContainer">{body}</div>;
        }
    }
);

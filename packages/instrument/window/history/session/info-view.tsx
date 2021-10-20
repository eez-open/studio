import React from "react";
import { observer } from "mobx-react";

import { confirm } from "eez-studio-ui/dialog-electron";
import { ButtonAction, TextAction, IconAction } from "eez-studio-ui/action";
import { IAppStore } from "instrument/window/history/history";

////////////////////////////////////////////////////////////////////////////////

@observer
export class SessionInfo extends React.Component<{ appStore: IAppStore }, {}> {
    onClose = () => {
        confirm(
            "Are you sure?",
            undefined,
            this.props.appStore.history.sessions.closeActiveSession
        );
    };

    render() {
        const viewSessionsList = (
            <IconAction
                icon="material:list"
                title="View sessions list"
                onClick={
                    this.props.appStore.navigationStore.navigateToSessionsList
                }
            />
        );

        let body;

        if (this.props.appStore.history.sessions.activeSession) {
            body = (
                <React.Fragment>
                    <span>Active session:</span>
                    <span>
                        {
                            this.props.appStore.history.sessions.activeSession
                                .sessionName
                        }
                    </span>
                    <ButtonAction
                        text="Close"
                        title="Close active session"
                        onClick={this.onClose}
                        className="btn-sm"
                    />
                    {viewSessionsList}
                </React.Fragment>
            );
        } else {
            body = (
                <React.Fragment>
                    <TextAction
                        text="Start Session"
                        title="Start a new session"
                        onClick={
                            this.props.appStore.history.sessions.startNewSession
                        }
                    />
                    {viewSessionsList}
                </React.Fragment>
            );
        }

        return <div className="EezStudio_SessionInfoContainer">{body}</div>;
    }
}

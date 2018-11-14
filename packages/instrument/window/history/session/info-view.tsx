import * as React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import styled from "eez-studio-ui/styled-components";
import { confirm } from "eez-studio-ui/dialog";
import { ButtonAction, IconAction } from "eez-studio-ui/action";

import { IAppStore } from "instrument/window/history/history";

////////////////////////////////////////////////////////////////////////////////

const SessionInfoContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    span {
        margin-right: 10px;
    }
    span:nth-child(2) {
        font-weight: 500;
    }
`;

@observer
export class SessionInfo extends React.Component<{ appStore: IAppStore }, {}> {
    @bind
    onClose() {
        confirm(
            "Are you sure?",
            undefined,
            this.props.appStore.history.sessions.closeActiveSession
        );
    }

    render() {
        const viewSessionsList = (
            <IconAction
                icon="material:list"
                title="View sessions list"
                onClick={this.props.appStore.navigationStore.navigateToSessionsList}
            />
        );

        let body;

        if (this.props.appStore.history.sessions.activeSession) {
            body = (
                <React.Fragment>
                    <span>Active session:</span>
                    <span>{this.props.appStore.history.sessions.activeSession.sessionName}</span>
                    <ButtonAction
                        text="Close"
                        title="Close active session"
                        onClick={this.onClose}
                    />
                    {viewSessionsList}
                </React.Fragment>
            );
        } else {
            body = (
                <React.Fragment>
                    <ButtonAction
                        text="Start Session"
                        title="Start a new session"
                        onClick={this.props.appStore.history.sessions.startNewSession}
                    />
                    {viewSessionsList}
                </React.Fragment>
            );
        }

        return <SessionInfoContainer>{body}</SessionInfoContainer>;
    }
}

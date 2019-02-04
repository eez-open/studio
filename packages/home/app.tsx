import React from "react";
import { observer } from "mobx-react";

import styled from "eez-studio-ui/styled-components";
import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";
import { TabsView } from "eez-studio-ui/tabs";
import { SessionInfo } from "instrument/window/history/session/info-view";

import { tabs } from "home/tabs-store";
import { getAppStore } from "home/history";

////////////////////////////////////////////////////////////////////////////////

const SessionInfoContainer = styled.div`
    flex-grow: 0;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    padding: 5px 10px;
    background: ${props => props.theme.panelHeaderColor};
`;

const AppHeader: typeof Header = styled(Header)`
    display: flex;
    flex-direction: row;
` as any;

const TabContainer = styled.div`
    flex-grow: 1;
    & > div {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
    }
`;

@observer
class AppComponent extends React.Component {
    render() {
        return (
            <VerticalHeaderWithBody>
                <AppHeader>
                    <TabsView tabs={tabs.tabs} />
                    <SessionInfoContainer>
                        <SessionInfo appStore={getAppStore()} />
                    </SessionInfoContainer>
                </AppHeader>
                <Body>
                    {tabs.tabs.map(tab => (
                        <TabContainer
                            key={tab.id}
                            style={{ visibility: tab === tabs.activeTab ? "visible" : "hidden" }}
                        >
                            {tab.render()}
                        </TabContainer>
                    ))}
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;

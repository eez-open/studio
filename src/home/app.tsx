import * as React from "react";
import { observer } from "mobx-react";
//import { DragDropContext } from "react-dnd";
//import HTML5Backend from "react-dnd-html5-backend";

import styled from "eez-studio-shared/ui/styled-components";
import { VerticalHeaderWithBody, Header, Body } from "eez-studio-shared/ui/header-with-body";
import { TabsView } from "eez-studio-shared/ui/tabs";
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

const AppHeader = styled(Header)`
    display: flex;
    flex-direction: row;
`;

@observer
class AppComponent extends React.Component<{}, {}> {
    render() {
        return (
            <VerticalHeaderWithBody>
                <AppHeader>
                    <TabsView tabs={tabs.tabs} />
                    <SessionInfoContainer>
                        <SessionInfo appStore={getAppStore()} />
                    </SessionInfoContainer>
                </AppHeader>
                <Body>{tabs.activeTab.render()}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;

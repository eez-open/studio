import * as React from "react";
import { observer } from "mobx-react";
//import { DragDropContext } from "react-dnd";
//import HTML5Backend from "react-dnd-html5-backend";

import styled from "shared/ui/styled-components";
import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { TabsView } from "shared/ui/tabs";
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

@observer
class AppComponent extends React.Component<{}, {}> {
    render() {
        return (
            <VerticalHeaderWithBody>
                <Header>
                    <div style={{ display: "flex", flexDirection: "row" }}>
                        <div style={{ flexGrow: 1 }}>
                            <TabsView tabs={tabs.tabs} />
                        </div>
                        <SessionInfoContainer>
                            <SessionInfo appStore={getAppStore()} />
                        </SessionInfoContainer>
                    </div>
                </Header>
                <Body>{tabs.activeTab.render()}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;

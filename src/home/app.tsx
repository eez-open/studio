import * as React from "react";
import { observer } from "mobx-react";
//import { DragDropContext } from "react-dnd";
//import HTML5Backend from "react-dnd-html5-backend";

import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { TabsView } from "shared/ui/tabs";
import { SessionInfo } from "instrument/window/history/session/info-view";

import { tabs } from "home/tabs-store";
import { getAppStore } from "home/history";

////////////////////////////////////////////////////////////////////////////////

@observer
class AppComponent extends React.Component<{}, {}> {
    render() {
        return (
            <VerticalHeaderWithBody className="EezStudio_AppRootComponent">
                <Header>
                    <div style={{ display: "flex", flexDirection: "row" }}>
                        <div style={{ flexGrow: 1 }}>
                            <TabsView tabs={tabs.tabs} />
                        </div>
                        <div className="EezStudio_SessionInfoContainer">
                            <SessionInfo appStore={getAppStore()} />
                        </div>
                    </div>
                </Header>
                <Body>{tabs.activeTab.render()}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;

import * as React from "react";
import { observer } from "mobx-react";
//import { DragDropContext } from "react-dnd";
//import HTML5Backend from "react-dnd-html5-backend";

import { VerticalHeaderWithBody, Header, Body } from "shared/ui/header-with-body";
import { TabsView } from "shared/ui/tabs";

import { tabs } from "home/store";

////////////////////////////////////////////////////////////////////////////////

@observer
class AppComponent extends React.Component<{}, {}> {
    render() {
        return (
            <VerticalHeaderWithBody className="EezStudio_AppRootComponent">
                <Header>
                    <TabsView tabs={tabs.tabs} />
                </Header>
                <Body>{tabs.activeTab.render()}</Body>
            </VerticalHeaderWithBody>
        );
    }
}

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;

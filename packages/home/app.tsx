import React from "react";
import { action, computed } from "mobx";
import { observer } from "mobx-react";
import update from "immutability-helper";

import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { TabsView } from "eez-studio-ui/tabs";

import { SessionInfo } from "instrument/window/history/session/info-view";

import { tabs } from "home/tabs-store";
import { getAppStore } from "home/history";

import { Setup } from "home/setup";
import "home/home-tab";
import { firstTime } from "home/first-time";

////////////////////////////////////////////////////////////////////////////////

@observer
class AppComponent extends React.Component {
    @computed
    get addTabAttention() {
        return (
            tabs.allTabs.filter(
                tab =>
                    !tabs.findTab(tab.instance.id.toString()) &&
                    tab.instance.attention
            ).length > 0
        );
    }

    render() {
        const appStore = getAppStore();

        if (firstTime.get()) {
            return <Setup />;
        }

        // addTabTitle="Home"
        // addTabIcon="material:add"
        // addTabCallback={
        //     tabs.findTab("home")
        //         ? undefined
        //         : () => {
        //               tabs.openTabById("home", true);
        //           }
        // }
        // addTabAttention={this.addTabAttention}

        return (
            <VerticalHeaderWithBody>
                <Header className="EezStudio_AppHeader">
                    <TabsView
                        tabs={tabs.tabs}
                        moveTab={action(
                            (dragIndex: number, hoverIndex: number) => {
                                const tab = tabs.tabs[dragIndex];

                                tabs.tabs = update(tabs.tabs, {
                                    $splice: [
                                        [dragIndex, 1],
                                        [hoverIndex, 0, tab]
                                    ]
                                });
                            }
                        )}
                    />
                    {appStore.history.sessions.activeSession && (
                        <div className="EezStudio_SessionInfoContainer">
                            <SessionInfo appStore={appStore} />
                        </div>
                    )}
                </Header>
                <Body>
                    <Tabs />
                </Body>
            </VerticalHeaderWithBody>
        );
    }
}

@observer
class Tabs extends React.Component {
    render() {
        return tabs.tabs.map(tab => (
            <div
                className="EezStudio_TabContainer"
                key={tab.id}
                style={{
                    visibility: tab === tabs.activeTab ? "visible" : "hidden",
                    zIndex: tab === tabs.activeTab ? 1 : 0
                }}
            >
                {tab.active ? tab.render() : null}
            </div>
        ));
    }
}

////////////////////////////////////////////////////////////////////////////////

//export const App = DragDropContext(HTML5Backend)(AppComponent);
export const App = AppComponent;

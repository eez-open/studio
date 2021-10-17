import React from "react";
import { action, computed } from "mobx";
import { observer } from "mobx-react";
import update from "immutability-helper";

import { stringCompare } from "eez-studio-shared/string";

import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { TabsView } from "eez-studio-ui/tabs";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { Icon } from "eez-studio-ui/icon";

import { instruments, InstrumentObject } from "instrument/instrument-object";
import { SessionInfo } from "instrument/window/history/session/info-view";

import { tabs } from "home/tabs-store";
import { getAppStore } from "home/history";

import { Setup } from "home/setup";
import "home/workbench";
import { firstTime } from "home/first-time";

////////////////////////////////////////////////////////////////////////////////

class AddTabPopupStuff {
    @computed get instrumentObjects() {
        return Array.from(instruments.values()).filter(
            obj => !tabs.findTab(obj.id)
        );
    }

    @computed get tabs() {
        return tabs.allTabs.filter(
            tab => !tabs.findTab(tab.instance.id.toString())
        );
    }

    @computed get sessionInfo() {
        const appStore = getAppStore();
        return !appStore.history.sessions.activeSession;
    }

    @computed get anythingToAdd() {
        return (
            this.instrumentObjects.length > 0 ||
            this.tabs.length > 0 ||
            this.sessionInfo
        );
    }
}

const theAddTabPopupStuff = new AddTabPopupStuff();

////////////////////////////////////////////////////////////////////////////////

const AddTabPopup = observer(() => {
    let instrumentsList;
    if (theAddTabPopupStuff.instrumentObjects.length > 0) {
        instrumentsList = (
            <ListContainer tabIndex={0}>
                <List
                    nodes={theAddTabPopupStuff.instrumentObjects
                        .sort((a, b) =>
                            stringCompare(
                                a.name.toLowerCase(),
                                b.name.toLowerCase()
                            )
                        )
                        .map(obj => ({
                            id: obj.id,
                            data: obj,
                            selected: false
                        }))}
                    renderNode={(node: IListNode) => {
                        let object = node.data as InstrumentObject;
                        return (
                            <ListItem
                                leftIcon={object.getIcon()}
                                leftIconSize={48}
                                label={object.name}
                            />
                        );
                    }}
                    selectNode={(node: IListNode) => {
                        let object = node.data as InstrumentObject;
                        object.openEditor("tab");
                    }}
                ></List>
            </ListContainer>
        );
    }

    let theRestTabsList;
    if (theAddTabPopupStuff.tabs.length > 0) {
        theRestTabsList = theAddTabPopupStuff.tabs.map(tab => {
            let icon;
            if (typeof tab.instance.icon == "string") {
                icon = <Icon icon={tab.instance.icon} />;
            } else {
                icon = tab.instance.icon;
            }
            return (
                <button
                    key={tab.instance.id}
                    className="btn btn btn-outline-secondary"
                    onClick={() => tab.open().makeActive()}
                    title={
                        tab.instance.tooltipTitle
                            ? tab.instance.tooltipTitle
                            : `Show ${tab.instance.title} Tab`
                    }
                >
                    {icon}
                    <span>{tab.instance.title}</span>
                </button>
            );
        });
    }

    let sessionInfo;
    const appStore = getAppStore();
    if (theAddTabPopupStuff.sessionInfo) {
        sessionInfo = (
            <div className="EezStudio_SessionInfoContainer">
                <SessionInfo appStore={appStore} />
            </div>
        );
    }

    return (
        <div>
            <div className="EezStudio_AddTabPopupContainer">
                {instrumentsList}
                {theRestTabsList}
                {sessionInfo}
            </div>
        </div>
    );
});

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

    @computed get addTabPopup() {
        return theAddTabPopupStuff.anythingToAdd && <AddTabPopup />;
    }

    render() {
        const appStore = getAppStore();

        if (firstTime.get()) {
            return <Setup />;
        }

        return (
            <VerticalHeaderWithBody>
                <Header className="EezStudio_AppHeader">
                    <TabsView
                        tabs={tabs.tabs}
                        addTabPopup={this.addTabPopup}
                        addTabAttention={this.addTabAttention}
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

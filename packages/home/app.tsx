import React from "react";
import { computed } from "mobx";
import { observer } from "mobx-react";

import { stringCompare } from "eez-studio-shared/string";

import styled from "eez-studio-ui/styled-components";
import { VerticalHeaderWithBody, Header, Body } from "eez-studio-ui/header-with-body";
import { TabsView } from "eez-studio-ui/tabs";
import { ListContainer, List, IListNode, ListItem } from "eez-studio-ui/list";
import { Icon } from "eez-studio-ui/icon";

import { SessionInfo } from "instrument/window/history/session/info-view";

import { tabs } from "home/tabs-store";
import { getAppStore } from "home/history";

import { workbenchObjects, WorkbenchObject } from "home/store";
import { Setup } from "home/setup";

////////////////////////////////////////////////////////////////////////////////

class AddTabPopupStuff {
    @computed get instrumentObjects() {
        return Array.from(workbenchObjects.values()).filter(obj => !tabs.findTab(obj.id));
    }

    @computed get tabs() {
        return tabs.allTabs.filter(tab => !tabs.findTab(tab.instance.id.toString()));
    }

    @computed get sessionInfo() {
        const appStore = getAppStore();
        return !appStore.history.sessions.activeSession;
    }

    @computed get anythingToAdd() {
        return this.instrumentObjects.length > 0 || this.tabs.length > 0 || this.sessionInfo;
    }
}

const theAddTabPopupStuff = new AddTabPopupStuff();

////////////////////////////////////////////////////////////////////////////////

const Container = styled.div`
    display: grid;
    grid-column-gap: 1rem;
    grid-row-gap: 1rem;
    grid-template-columns: auto auto;

    & > div.EezStudio_ListContainer {
        min-width: 400px;
        height: 240px;
        grid-column-start: span 2;
    }

    & > button {
        min-width: 200px;
        display: flex;
        align-items: center;
        & > span {
            padding-left: 5px;
            white-space: nowrap;
        }
    }

    & > div.EezStudio_SessionInfoContainer {
        grid-column-start: span 2;
    }
`;

const AddTabPopup = observer(() => {
    let instrumentsList;
    if (theAddTabPopupStuff.instrumentObjects.length > 0) {
        instrumentsList = (
            <ListContainer tabIndex={0}>
                <List
                    nodes={theAddTabPopupStuff.instrumentObjects
                        .sort((a, b) => stringCompare(a.name.toLowerCase(), b.name.toLowerCase()))
                        .map(obj => ({
                            id: obj.id,
                            data: obj,
                            selected: false
                        }))}
                    renderNode={(node: IListNode) => {
                        let object = node.data as WorkbenchObject;
                        return (
                            <ListItem
                                leftIcon={object.getIcon()}
                                leftIconSize={48}
                                label={object.name}
                            />
                        );
                    }}
                    selectNode={(node: IListNode) => {
                        let object = node.data as WorkbenchObject;
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
                <SessionInfoContainer>
                    <SessionInfo appStore={appStore} />
                </SessionInfoContainer>
            </div>
        );
    }

    return (
        <div>
            <Container>
                {instrumentsList}
                {theRestTabsList}
                {sessionInfo}
            </Container>
        </div>
    );
});

////////////////////////////////////////////////////////////////////////////////

const SessionInfoContainer = styled.div`
    flex-grow: 0;
    padding: 5px 10px;
`;

const AppHeader = styled(Header)`
    display: flex;
    flex-direction: row;
    background-color: ${props => props.theme.panelHeaderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};
`;

const TabContainer = styled.div`
    flex-grow: 1;

    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;

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
    @computed
    get addTabAttention() {
        return (
            tabs.allTabs.filter(
                tab => !tabs.findTab(tab.instance.id.toString()) && tab.instance.attention
            ).length > 0
        );
    }

    @computed get addTabPopuo() {
        return theAddTabPopupStuff.anythingToAdd && <AddTabPopup />;
    }

    render() {
        const appStore = getAppStore();

        if (tabs.firstTime) {
            return <Setup />;
        }

        return (
            <VerticalHeaderWithBody>
                <AppHeader>
                    <TabsView
                        tabs={tabs.tabs}
                        addTabPopup={this.addTabPopuo}
                        addTabAttention={this.addTabAttention}
                    />
                    {appStore.history.sessions.activeSession && (
                        <SessionInfoContainer>
                            <SessionInfo appStore={appStore} />
                        </SessionInfoContainer>
                    )}
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

import React from "react";
import { createRoot } from "react-dom/client";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import update from "immutability-helper";
import * as FlexLayout from "flexlayout-react";

import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { TabsView } from "eez-studio-ui/tabs";
import { makeLazyComponent } from "eez-studio-ui/lazy-component";

import { HomeTab, IHomeTab, InstrumentTab, tabs } from "home/tabs-store";
import "home/home-tab";

import type { InstrumentObject } from "instrument/instrument-object";
import {
    ScrapbookManagerDialog,
    model as scrapbookModel
} from "project-editor/store/scrapbook";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";
import { layoutModels } from "eez-studio-ui/side-dock";
import { Icon } from "eez-studio-ui/icon";
import { homeTabStore } from "home/home-tab";

////////////////////////////////////////////////////////////////////////////////

const MainContent = observer(
    class Content extends React.Component {
        render() {
            return (
                <VerticalHeaderWithBody style={{ height: "100%" }}>
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
                        {((tabs.activeTab instanceof HomeTab &&
                            homeTabStore.activeTab == "instruments") ||
                            tabs.activeTab instanceof InstrumentTab) && (
                            <SessionInfoContainer />
                        )}
                    </Header>
                    <Body>
                        <Tabs />
                    </Body>
                </VerticalHeaderWithBody>
            );
        }
    }
);

export const App = observer(
    class App extends React.Component {
        componentDidMount(): void {
            scrapbookModel.mount();
        }

        factory = (node: FlexLayout.TabNode) => {
            var component = node.getComponent();

            if (component === "main-content") {
                return <MainContent />;
            }

            if (component === "scrapbook") {
                return <ScrapbookManagerDialog />;
            }

            return null;
        };

        iconFactory = (node: FlexLayout.TabNode) => {
            let icon = node.getIcon();
            if (!icon || typeof icon != "string") {
                return null;
            }
            return <Icon icon={icon} size={20} />;
        };

        render() {
            let content;
            if (
                !scrapbookModel.isVisible ||
                scrapbookModel.dockOption == "float"
            ) {
                content = <MainContent />;
            } else {
                content = (
                    <FlexLayoutContainer
                        model={layoutModels.app}
                        factory={this.factory}
                        iconFactory={this.iconFactory}
                    />
                );
            }

            return (
                <>
                    {content}
                    <WebSimulators />
                </>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const Tabs = observer(
    class Tabs extends React.Component {
        renderedItems = new Set<string | number>();

        renderContent(item: IHomeTab) {
            this.renderedItems.add(item.id);
            return item.render();
        }

        renderContentIfRenderedBefore(item: IHomeTab) {
            if (!this.renderedItems.has(item.id)) {
                return null;
            }
            return item.render();
        }

        render() {
            return tabs.tabs.map(tab => (
                <div
                    className="EezStudio_TabContainer"
                    key={tab.id}
                    style={{
                        display: tab === tabs.activeTab ? "block" : "none"
                    }}
                >
                    {tab.active
                        ? this.renderContent(tab)
                        : this.renderContentIfRenderedBefore(tab)}
                </div>
            ));
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const SessionInfoContainer = makeLazyComponent(
    async () => {
        const { getAppStore } = await import("home/history");
        const { SessionInfo } = await import(
            "instrument/window/history/session/info-view"
        );
        return { appStore: getAppStore(), SessionInfo };
    },
    ({ appStore, SessionInfo }) => {
        return (
            <div className="EezStudio_SessionInfoContainer">
                <SessionInfo appStore={appStore} />
            </div>
        );
    }
);

////////////////////////////////////////////////////////////////////////////////

const WebSimulators = makeLazyComponent(
    async () => {
        const { instruments } = await import("instrument/instrument-object");

        class State {
            constructor() {
                makeObservable(this, {
                    webSimulators: computed
                });
            }

            get webSimulators() {
                return [...instruments.values()].filter(
                    instrument =>
                        !instrument.connection.isIdle &&
                        instrument.extension &&
                        instrument.lastConnection?.type == "web-simulator"
                );
            }
        }

        return { state: new State() };
    },
    ({ state }) => {
        const webSimulatorConnections = state.webSimulators;
        if (webSimulatorConnections.length == 0) {
            return null;
        }

        return webSimulatorConnections.map(instrument => (
            <WebSimulatorPanel key={instrument.id} instrument={instrument} />
        ));
    }
);

////////////////////////////////////////////////////////////////////////////////

class WebSimulatorPanel extends React.Component<{
    instrument: InstrumentObject;
}> {
    dialog: any;

    componentDidMount() {
        const instrument = this.props.instrument;

        let element = document.createElement("div");

        element.style.position = "absolute";
        element.style.width = "100%";
        element.style.height = "100%";
        element.style.overflow = "hidden";

        const connection = instrument.getConnectionProperty();
        const webSimulatorPage = connection?.webSimulator!.src;

        const installationFolderPath =
            instrument.extension?.installationFolderPath;

        const src =
            installationFolderPath +
            "/" +
            webSimulatorPage +
            "?id=" +
            instrument.lastConnection?.webSimulatorParameters.id;

        const simulator = (
            <iframe
                src={src}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
            ></iframe>
        );

        const root = createRoot(element);
        root.render(simulator);

        const jsPanel: any = (window as any).jsPanel;

        const localStorageItemKey =
            "WebSimulatorPanel6:" + this.props.instrument.id;
        let panelDataStr = window.localStorage.getItem(localStorageItemKey);
        let panelData;
        if (panelDataStr) {
            panelData = JSON.parse(panelDataStr);
        }

        const webSimulatorWidth = connection?.webSimulator!.width ?? 640;
        const webSimulatorHeight = connection?.webSimulator!.height ?? 480;

        const TITLE_HEIGHT = 34;

        const panelMaxWidth = webSimulatorWidth;
        const panelMaxHeight = webSimulatorHeight + TITLE_HEIGHT;
        const panelMinWidth = webSimulatorWidth / 8;
        const panelMinHeight = webSimulatorHeight / 8 + TITLE_HEIGHT;

        let panelLeft;
        let panelTop;
        let panelWidth;
        let panelHeight;
        if (panelData) {
            panelLeft = panelData.left;
            panelTop = panelData.top;
            panelWidth = panelData.width;
            panelHeight =
                (panelWidth * webSimulatorHeight) / webSimulatorWidth +
                TITLE_HEIGHT;
        } else {
            panelWidth = Math.min(
                Math.round(window.innerWidth * 0.5),
                panelMaxWidth
            );
            panelHeight = (panelWidth * webSimulatorHeight) / webSimulatorWidth;
            if (panelHeight > Math.round(window.innerWidth * 0.5)) {
                panelHeight = Math.round(window.innerWidth * 0.5);
                panelWidth =
                    (panelHeight * webSimulatorWidth) / webSimulatorHeight;
            }
            panelHeight += TITLE_HEIGHT;

            panelLeft = (window.innerWidth - panelWidth) / 2;
            panelTop = (window.innerHeight - panelHeight) / 2;
        }

        panelWidth = Math.ceil(panelWidth);
        panelHeight = Math.ceil(panelHeight);

        this.dialog = jsPanel.create({
            container: "#EezStudio_Content",
            theme: "primary",
            headerTitle: instrument.name,
            panelSize: {
                width: panelWidth,
                height: panelHeight
            },
            position: {
                my: "top-left",
                offsetX: panelLeft + "px",
                offsetY: panelTop + "px"
            },
            content: element,
            headerControls: {
                maximize: "remove",
                smallify: "remove"
            },
            dragit: {
                drag: (panel: any, panelData: any) => {
                    window.localStorage.setItem(
                        localStorageItemKey,
                        JSON.stringify(panelData)
                    );
                },
                containment: [0]
            },
            resizeit: {
                aspectRatio: "content",
                maxWidth: panelMaxWidth,
                maxHeight: panelMaxHeight,
                minWidth: panelMinWidth,
                minHeight: panelMinHeight,
                resize: (panel: any, panelData: any) => {
                    window.localStorage.setItem(
                        localStorageItemKey,
                        JSON.stringify(panelData)
                    );
                },
                containment: [0]
            },
            closeOnBackdrop: false,
            closeOnEscape: false,
            onclosed: (panel: any, closedByUser: boolean) => {
                if (closedByUser) {
                    this.props.instrument.connection.disconnect();
                    this.dialog = undefined;
                }
            }
        });
    }

    componentWillUnmount() {
        if (this.dialog) {
            this.dialog.close();
        }
    }

    render() {
        return null;
    }
}

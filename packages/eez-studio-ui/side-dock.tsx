import React from "react";
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";

import { Splitter } from "eez-studio-ui/splitter";
import {
    VerticalHeaderWithBody,
    Header,
    Body
} from "eez-studio-ui/header-with-body";
import { FlexLayoutContainer } from "eez-studio-ui/FlexLayout";

////////////////////////////////////////////////////////////////////////////////

export class SideDockComponent2 extends React.Component<{
    children?: React.ReactNode;
    persistId: string;
    flexLayoutModel: FlexLayout.Model;
    factory: (node: FlexLayout.TabNode) => React.ReactNode;
    header?: JSX.Element;
    width: number;
}> {
    static defaultProps = { width: 240 };

    isOpen: boolean;

    constructor(props: any) {
        super(props);

        makeObservable(this, {
            isOpen: observable,
            toggleIsOpen: action.bound
        });

        this.isOpen =
            localStorage.getItem(this.props.persistId + "/is-open") === "0"
                ? false
                : true;
    }

    toggleIsOpen() {
        this.isOpen = !this.isOpen;
        localStorage.setItem(
            this.props.persistId + "/is-open",
            this.isOpen ? "1" : "0"
        );
    }

    render() {
        const dockSwitcherClassName = classNames("EezStudio_SideDockSwitch", {
            EezStudio_SideDockSwitch_Closed: !this.isOpen
        });

        const dockSwitcher = (
            <div
                className={dockSwitcherClassName}
                onClick={this.toggleIsOpen}
                title={this.isOpen ? "Hide Side bar" : "Show Side bar"}
            />
        );

        let sideDock;

        if (this.isOpen) {
            const container = (
                <FlexLayoutContainer
                    model={this.props.flexLayoutModel}
                    factory={this.props.factory}
                />
            );

            if (this.props.header) {
                sideDock = (
                    <React.Fragment>
                        <VerticalHeaderWithBody className="EezStudio_SideDock_WithHeader">
                            <Header>{this.props.header}</Header>
                            <Body>{container}</Body>
                        </VerticalHeaderWithBody>
                        {dockSwitcher}
                    </React.Fragment>
                );
            } else {
                sideDock = (
                    <React.Fragment>
                        {container}
                        {dockSwitcher}
                    </React.Fragment>
                );
            }
        } else {
            sideDock = dockSwitcher;
        }

        if (this.isOpen) {
            return (
                <Splitter
                    type="horizontal"
                    sizes={`100%|${this.props.width}px`}
                    persistId={`${this.props.persistId}/splitter`}
                    childrenOverflow="auto|visible"
                >
                    {this.props.children}
                    {sideDock}
                </Splitter>
            );
        } else {
            return (
                <React.Fragment>
                    {this.props.children}
                    {sideDock}
                </React.Fragment>
            );
        }
    }
}

export const SideDock2 = observer(SideDockComponent2);

////////////////////////////////////////////////////////////////////////////////

export class LayoutModels {
    static FONT = {
        size: "small"
    };

    static FONT_SUB = {
        size: "small"
    };

    static GLOBAL_OPTIONS = {
        borderEnableAutoHide: true,
        splitterSize: 4,
        splitterExtra: 4,
        legacyOverflowMenu: false,
        tabEnableRename: false
    };

    static HISTORY_VIEW_SEARCH_RESULTS = {
        type: "tab",
        enableClose: false,
        name: "Search results",
        id: "SearchResults",
        component: "SearchResults"
    };

    static HISTORY_VIEW_FILTERS = {
        type: "tab",
        enableClose: false,
        name: "Filters",
        id: "Filters",
        component: "Filters"
    };

    static HISTORY_VIEW_CALENDAR = {
        type: "tab",
        enableClose: false,
        name: "Calendar",
        id: "Calendar",
        component: "Calendar"
    };

    static HISTORY_VIEW_SESSIONS_TAB_ID = "sessions";
    static HISTORY_VIEW_SESSIONS = {
        type: "tab",
        enableClose: false,
        name: "Sessions",
        id: LayoutModels.HISTORY_VIEW_SESSIONS_TAB_ID,
        component: "Sessions"
    };

    static HISTORY_VIEW_SCRAPBOOK = {
        type: "tab",
        enableClose: false,
        name: "Scrapbook",
        id: "Scrapbook",
        component: "Scrapbook"
    };

    static CHARTS_VIEW_RULERS = {
        type: "tab",
        enableClose: false,
        name: "Rulers",
        id: "Rulers",
        component: "Rulers"
    };

    static CHARTS_VIEW_MEASUREMENTS = {
        type: "tab",
        enableClose: false,
        name: "Measurements",
        id: "Measurements",
        component: "Measurements"
    };

    static CHARTS_VIEW_OPTIONS = {
        type: "tab",
        enableClose: false,
        name: "View Options",
        id: "ViewOptions",
        component: "ViewOptions"
    };

    static CHARTS_VIEW_BOOKMARKS = {
        type: "tab",
        enableClose: false,
        name: "Bookmarks",
        id: "Bookmarks",
        component: "Bookmarks"
    };

    static CHARTS_VIEW_HELP = {
        type: "tab",
        enableClose: false,
        name: "Help",
        id: "Help",
        component: "Help"
    };

    historyViewModel1: FlexLayout.Model;
    historyViewModel2: FlexLayout.Model;
    historyViewModel3: FlexLayout.Model;
    historyViewModel4: FlexLayout.Model;

    deletedHistoryViewModel1: FlexLayout.Model;
    deletedHistoryViewModel2: FlexLayout.Model;

    chartsViewModel1: FlexLayout.Model;
    chartsViewModel2: FlexLayout.Model;
    chartsViewModel3: FlexLayout.Model;
    chartsViewModel4: FlexLayout.Model;

    scrapbook: FlexLayout.Model;
    app: FlexLayout.Model;

    constructor() {
        makeObservable(this, {
            historyViewModel1: observable,
            historyViewModel2: observable,
            historyViewModel3: observable,
            historyViewModel4: observable,

            deletedHistoryViewModel1: observable,
            deletedHistoryViewModel2: observable,

            chartsViewModel1: observable,
            chartsViewModel2: observable,
            chartsViewModel3: observable,
            chartsViewModel4: observable,

            scrapbook: observable,
            app: observable
        });

        const sideDockLayoutModelsStr = window.localStorage.getItem(
            "SideDockLayoutModels"
        );
        const sideDockLayoutModels = sideDockLayoutModelsStr
            ? JSON.parse(sideDockLayoutModelsStr)
            : undefined;
        this.load(sideDockLayoutModels);
    }

    get models(): {
        name: string;
        version: number;
        json: FlexLayout.IJsonModel;
        get: () => FlexLayout.Model;
        set: (model: FlexLayout.Model) => void;
    }[] {
        return [
            {
                name: "historyViewModel1",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.HISTORY_VIEW_SEARCH_RESULTS,
                                    LayoutModels.HISTORY_VIEW_CALENDAR,
                                    LayoutModels.HISTORY_VIEW_SESSIONS,
                                    LayoutModels.HISTORY_VIEW_FILTERS,
                                    LayoutModels.HISTORY_VIEW_SCRAPBOOK
                                ]
                            }
                        ]
                    }
                },
                get: () => this.historyViewModel1,
                set: action(model => (this.historyViewModel1 = model))
            },
            {
                name: "historyViewModel2",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.HISTORY_VIEW_SEARCH_RESULTS,
                                    LayoutModels.HISTORY_VIEW_CALENDAR,
                                    LayoutModels.HISTORY_VIEW_FILTERS,
                                    LayoutModels.HISTORY_VIEW_SCRAPBOOK
                                ]
                            }
                        ]
                    }
                },
                get: () => this.historyViewModel2,
                set: action(model => (this.historyViewModel2 = model))
            },
            {
                name: "historyViewModel3",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.HISTORY_VIEW_CALENDAR,
                                    LayoutModels.HISTORY_VIEW_SESSIONS,
                                    LayoutModels.HISTORY_VIEW_FILTERS,
                                    LayoutModels.HISTORY_VIEW_SCRAPBOOK
                                ]
                            }
                        ]
                    }
                },
                get: () => this.historyViewModel3,
                set: action(model => (this.historyViewModel3 = model))
            },
            {
                name: "historyViewModel4",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.HISTORY_VIEW_CALENDAR,
                                    LayoutModels.HISTORY_VIEW_FILTERS,
                                    LayoutModels.HISTORY_VIEW_SCRAPBOOK
                                ]
                            }
                        ]
                    }
                },
                get: () => this.historyViewModel4,
                set: action(model => (this.historyViewModel4 = model))
            },
            {
                name: "deletedHistoryViewModel1",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.HISTORY_VIEW_SEARCH_RESULTS,
                                    LayoutModels.HISTORY_VIEW_CALENDAR
                                ]
                            }
                        ]
                    }
                },
                get: () => this.deletedHistoryViewModel1,
                set: action(model => (this.deletedHistoryViewModel1 = model))
            },
            {
                name: "deletedHistoryViewModel2",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [LayoutModels.HISTORY_VIEW_CALENDAR]
                            }
                        ]
                    }
                },
                get: () => this.deletedHistoryViewModel2,
                set: action(model => (this.deletedHistoryViewModel2 = model))
            },
            {
                name: "chartsViewModel1",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.CHARTS_VIEW_OPTIONS,
                                            LayoutModels.CHARTS_VIEW_RULERS,
                                            LayoutModels.CHARTS_VIEW_BOOKMARKS,
                                            LayoutModels.CHARTS_VIEW_HELP
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.CHARTS_VIEW_MEASUREMENTS
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.chartsViewModel1,
                set: action(model => (this.chartsViewModel1 = model))
            },
            {
                name: "chartsViewModel2",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.CHARTS_VIEW_OPTIONS,
                                            LayoutModels.CHARTS_VIEW_RULERS,
                                            LayoutModels.CHARTS_VIEW_HELP
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.CHARTS_VIEW_MEASUREMENTS
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.chartsViewModel2,
                set: action(model => (this.chartsViewModel2 = model))
            },
            {
                name: "chartsViewModel3",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.CHARTS_VIEW_OPTIONS,
                                    LayoutModels.CHARTS_VIEW_BOOKMARKS,
                                    LayoutModels.CHARTS_VIEW_HELP
                                ]
                            }
                        ]
                    }
                },
                get: () => this.chartsViewModel3,
                set: action(model => (this.chartsViewModel3 = model))
            },
            {
                name: "chartsViewModel4",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    LayoutModels.CHARTS_VIEW_OPTIONS,
                                    LayoutModels.CHARTS_VIEW_HELP
                                ]
                            }
                        ]
                    }
                },
                get: () => this.chartsViewModel4,
                set: action(model => (this.chartsViewModel4 = model))
            },
            {
                name: "scrapbook",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                weight: 33,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Items",
                                        component: "items"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                weight: 67,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Selected Item Info",
                                        component: "item-details"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.scrapbook,
                set: action(model => (this.scrapbook = model))
            },
            {
                name: "app",
                version: 3,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                weight: 75,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Tabs",
                                        component: "main-content"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                enableTabStrip: true,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                weight: 25,
                                children: [
                                    {
                                        type: "tab",
                                        icon: "svg:project-editor-scrapbook",
                                        enableClose: false,
                                        name: "Scrapbook",
                                        component: "scrapbook"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.app,
                set: action(model => (this.app = model))
            }
        ];
    }

    getHistoryViewModel(searchActive: boolean, isSessionsSupported: boolean) {
        if (searchActive) {
            return isSessionsSupported
                ? this.historyViewModel1
                : this.historyViewModel2;
        } else {
            return isSessionsSupported
                ? this.historyViewModel3
                : this.historyViewModel4;
        }
    }

    getDeletedHistoryViewModel(searchActive: boolean) {
        if (searchActive) {
            return this.deletedHistoryViewModel1;
        } else {
            return this.deletedHistoryViewModel2;
        }
    }

    getChartsViewModel(supportRulers: boolean, bookmarks: boolean) {
        if (supportRulers) {
            return bookmarks ? this.chartsViewModel1 : this.chartsViewModel2;
        } else {
            return bookmarks ? this.chartsViewModel3 : this.chartsViewModel4;
        }
    }

    load(layoutModels: any) {
        for (const model of this.models) {
            const savedModel = layoutModels && layoutModels[model.name];
            if (savedModel && savedModel.version == model.version) {
                model.set(FlexLayout.Model.fromJson(savedModel.json));
            } else {
                model.set(FlexLayout.Model.fromJson(model.json));
            }
        }
    }

    save() {
        const layoutModels: any = {};

        for (const model of this.models) {
            try {
                layoutModels[model.name] = {
                    version: model.version,
                    json: model.get().toJson()
                };
            } catch (err) {
                console.log(model);
                console.error(err);
            }
        }

        return layoutModels;
    }

    saveToLocalStorage() {
        window.localStorage.setItem(
            "SideDockLayoutModels",
            JSON.stringify(this.save())
        );
    }

    selectTab(model: FlexLayout.Model, tabId: string) {
        const node = model.getNodeById(tabId);
        if (node) {
            const parentNode = node.getParent();
            let isSelected = false;

            if (parentNode instanceof FlexLayout.TabSetNode) {
                isSelected = parentNode.getSelectedNode() == node;
            } else if (parentNode instanceof FlexLayout.BorderNode) {
                isSelected = parentNode.getSelectedNode() == node;
            }

            if (!isSelected) {
                model.doAction(FlexLayout.Actions.selectTab(tabId));
            }
        }
    }
}

export const layoutModels = new LayoutModels();

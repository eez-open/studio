import { makeObservable, observable, action } from "mobx";
import * as FlexLayout from "flexlayout-react";

import {
    AbstractLayoutModels,
    ILayoutModel
} from "eez-studio-ui/layout-models";

export class LayoutModels extends AbstractLayoutModels {
    static EXTENSION_MANAGER_MASTER_TABSET: FlexLayout.IJsonTabSetNode = {
        type: "tabset",
        enableTabStrip: false,
        enableDrag: false,
        enableDrop: false,
        enableClose: false,
        weight: 55,
        children: [
            {
                type: "tab",
                enableClose: false,
                name: "Master",
                component: "Master"
            }
        ]
    };

    static EXTENSION_MANAGER_DETAILS_TABSET: FlexLayout.IJsonTabSetNode = {
        type: "tabset",
        enableTabStrip: false,
        enableDrag: false,
        enableDrop: false,
        enableClose: false,
        weight: 55,
        children: [
            {
                type: "tab",
                enableClose: false,
                name: "Details",
                component: "Details"
            }
        ]
    };

    static DOCUMENTATION_BROWSER_TOC_TABSET: FlexLayout.IJsonTabSetNode = {
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
                name: "TOC",
                component: "TOC"
            }
        ]
    };

    static DOCUMENTATION_BROWSER_CONTENT_TABSET: FlexLayout.IJsonTabSetNode = {
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
                name: "Content",
                component: "Content"
            }
        ]
    };

    constructor() {
        super();

        makeObservable(this, {
            extensionManager: observable
        });

        const savedLayoutModels =
            window.localStorage.getItem("homeLayoutModels");
        this.load(
            savedLayoutModels ? JSON.parse(savedLayoutModels) : undefined
        );
    }

    save() {
        const savedLayoutModels = super.save();
        window.localStorage.setItem(
            "homeLayoutModels",
            JSON.stringify(savedLayoutModels)
        );
    }

    extensionManager: FlexLayout.Model;
    documentationBrowser: FlexLayout.Model;
    databaseSettings: FlexLayout.Model;

    get models(): ILayoutModel[] {
        const global = {
            borderEnableAutoHide: true,
            splitterSize: 4,
            splitterExtra: 4,
            legacyOverflowMenu: false,
            tabEnableRename: false
        };
        return [
            {
                name: "extensionManager",
                version: 1,
                json: {
                    global,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            LayoutModels.EXTENSION_MANAGER_MASTER_TABSET,
                            LayoutModels.EXTENSION_MANAGER_DETAILS_TABSET
                        ]
                    }
                },
                get: () => this.extensionManager,
                set: action(model => (this.extensionManager = model))
            },
            {
                name: "documentationBrowser",
                version: 3,
                json: {
                    global,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            LayoutModels.DOCUMENTATION_BROWSER_TOC_TABSET,
                            LayoutModels.DOCUMENTATION_BROWSER_CONTENT_TABSET
                        ]
                    }
                },
                get: () => this.documentationBrowser,
                set: action(model => (this.documentationBrowser = model))
            },
            {
                name: "databaseSettings",
                version: 5,
                json: {
                    global,
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
                                        name: "list",
                                        component: "list"
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
                                        name: "details",
                                        component: "details"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.databaseSettings,
                set: action(model => (this.databaseSettings = model))
            }
        ];
    }
}

export const homeLayoutModels = new LayoutModels();

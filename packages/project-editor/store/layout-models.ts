import { makeObservable } from "mobx";
import { observable } from "mobx";
import * as FlexLayout from "flexlayout-react";

import type { DocumentStoreClass } from "project-editor/store";

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

    static CHECKS_TAB_ID = "CHECKS";
    static OUTPUT_TAB_ID = "OUTPUT";
    static SEARCH_RESULTS_TAB_ID = "SEARCH_RESULTS";
    static NAVIGATION_TABSET_ID = "NAVIGATION";
    static EDITORS_TABSET_ID = "EDITORS";
    static PROPERTIES_TAB_ID = "PROPERTIES";
    static COMPONENTS_PALETTE_TAB_ID = "COMPONENTS_PALETTE";
    static BREAKPOINTS_TAB_ID = "BREAKPOINTS_PALETTE";
    static DEBUGGER_TAB_ID = "DEBUGGER";
    static DEBUGGER_LOGS_TAB_ID = "DEBUGGER_LOGS";

    static LOCAL_VARS_TAB_ID = "LOCAL_VARS";
    static GLOBAL_VARS_TAB_ID = "GLOBAL_VARS";
    static STRUCTS_TAB_ID = "STRUCTS";
    static ENUMS_TAB_ID = "ENUMS";

    static SCPI_SUBSYSTEMS_TAB_ID = "SCPI_SUBSYSTEMS";
    static SCPI_ENUMS_TAB_ID = "SCPI_ENUMS";
    static SCPI_COMMANDS_TAB_ID = "SCPI_COMMANDS";

    static LANGUAGES_TAB_ID = "LANGUAGES";
    static TEXT_RESOURCES_TAB_ID = "TEXT_RESOURCES";

    static DEBUGGER_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Debugger",
        id: LayoutModels.DEBUGGER_TAB_ID,
        component: "debuggerPanel"
    };

    static BREAKPOINTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Breakpoints",
        id: LayoutModels.BREAKPOINTS_TAB_ID,
        component: "breakpointsPanel"
    };

    static LOCAL_VARS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Local Vars",
        id: LayoutModels.LOCAL_VARS_TAB_ID,
        component: "locals"
    };

    static STRUCTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Structs",
        id: LayoutModels.STRUCTS_TAB_ID,
        component: "structs"
    };

    models: {
        name: string;
        version: number;
        json: FlexLayout.IJsonModel;
        get: () => FlexLayout.Model;
        set: (model: FlexLayout.Model) => void;
    }[];

    root: FlexLayout.Model;
    variables: FlexLayout.Model;
    bitmaps: FlexLayout.Model;
    fonts: FlexLayout.Model;
    pages: FlexLayout.Model;
    actions: FlexLayout.Model;
    scpi: FlexLayout.Model;
    styles: FlexLayout.Model;
    themes: FlexLayout.Model;
    debugger: FlexLayout.Model;
    texts: FlexLayout.Model;

    constructor(public DocumentStore: DocumentStoreClass) {
        makeObservable(this, {
            root: observable,
            variables: observable,
            bitmaps: observable,
            fonts: observable,
            pages: observable,
            scpi: observable,
            styles: observable,
            themes: observable,
            debugger: observable
        });

        this.models = [
            {
                name: "root",
                version: 13,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [
                        {
                            type: "border",
                            location: "top",
                            children: []
                        },
                        {
                            type: "border",
                            location: "right",
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Themes",
                                    component: "themesSideView"
                                }
                            ]
                        },
                        {
                            type: "border",
                            location: "bottom",
                            children: [
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Checks",
                                    id: LayoutModels.CHECKS_TAB_ID,
                                    component: "checksMessages"
                                },
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Output",
                                    id: LayoutModels.OUTPUT_TAB_ID,
                                    component: "outputMessages"
                                },
                                {
                                    type: "tab",
                                    enableClose: false,
                                    name: "Search Results",
                                    id: LayoutModels.SEARCH_RESULTS_TAB_ID,
                                    component: "searchResultsMessages"
                                }
                            ]
                        }
                    ],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 25,
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                id: LayoutModels.NAVIGATION_TABSET_ID,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Navigation",
                                        component: "navigation"
                                    }
                                ]
                            },

                            {
                                type: "row",
                                weight: 50,
                                children: [
                                    {
                                        type: "tabset",
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        id: LayoutModels.EDITORS_TABSET_ID,
                                        children: [
                                            {
                                                type: "tab",
                                                component: "sub",
                                                config: {
                                                    model: {
                                                        global: {
                                                            ...LayoutModels.GLOBAL_OPTIONS,
                                                            tabEnableClose: true
                                                        },
                                                        borders: [],
                                                        layout: {
                                                            type: "row",
                                                            children: [
                                                                {
                                                                    type: "tabset",
                                                                    children: []
                                                                }
                                                            ]
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 25,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Properties",
                                        id: LayoutModels.PROPERTIES_TAB_ID,
                                        component: "propertiesPanel"
                                    },
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Components Palette",
                                        id: LayoutModels.COMPONENTS_PALETTE_TAB_ID,
                                        component: "componentsPalette"
                                    },
                                    LayoutModels.BREAKPOINTS_TAB,
                                    LayoutModels.DEBUGGER_TAB
                                ]
                            }
                        ]
                    }
                },
                get: () => this.root,
                set: model => (this.root = model)
            },
            {
                name: "variables",
                version: 4,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: [],
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Global Vars",
                                        id: LayoutModels.GLOBAL_VARS_TAB_ID,
                                        component: "globals"
                                    },
                                    LayoutModels.LOCAL_VARS_TAB,
                                    LayoutModels.STRUCTS_TAB,
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Enums",
                                        id: LayoutModels.ENUMS_TAB_ID,
                                        component: "enums"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.variables,
                set: model => (this.variables = model)
            },
            {
                name: "bitmaps",
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
                                        weight: 75,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Bitmaps",
                                                component: "bitmaps"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 25,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Preview",
                                                component: "preview"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.bitmaps,
                set: model => (this.bitmaps = model)
            },
            {
                name: "fonts",
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
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        component: "glyphs"
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        component: "editor"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.fonts,
                set: model => (this.fonts = model)
            },
            {
                name: "pages",
                version: 2,
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
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Pages",
                                                component: "pages"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Page Structure",
                                                component: "page-structure"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Local Vars",
                                                component: "local-vars"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.pages,
                set: model => (this.pages = model)
            },
            {
                name: "actions",
                version: 2,
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
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Actions",
                                                component: "actions"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Local Vars",
                                                component: "local-vars"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.actions,
                set: model => (this.actions = model)
            },
            {
                name: "scpi",
                version: 3,
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
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Subsystems",
                                                id: LayoutModels.SCPI_SUBSYSTEMS_TAB_ID,
                                                component: "subsystems"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Enums",
                                                id: LayoutModels.SCPI_ENUMS_TAB_ID,
                                                component: "enums"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Commands",
                                                id: LayoutModels.SCPI_COMMANDS_TAB_ID,
                                                component: "commands"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.scpi,
                set: model => (this.scpi = model)
            },
            {
                name: "styles",
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
                                        weight: 75,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Styles",
                                                component: "styles"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 25,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Preview",
                                                component: "preview"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.styles,
                set: model => (this.styles = model)
            },
            {
                name: "themes",
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
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                component: "themes"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                component: "colors"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.themes,
                set: model => (this.themes = model)
            },
            {
                name: "debugger",
                version: 2,
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
                                        weight: 25,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Queue",
                                                component: "queue"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 75,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Watch",
                                                component: "watch"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Active Flows",
                                                component: "active-flows"
                                            },
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Logs",
                                                id: LayoutModels.DEBUGGER_LOGS_TAB_ID,
                                                component: "logs"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.debugger,
                set: model => (this.debugger = model)
            },
            {
                name: "texts",
                version: 4,
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
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Text resources",
                                                id: LayoutModels.TEXT_RESOURCES_TAB_ID,
                                                component: "resources"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Languages",
                                                id: LayoutModels.LANGUAGES_TAB_ID,
                                                component: "languages"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.texts,
                set: model => (this.texts = model)
            }
        ];
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

        this.DocumentStore.project.enableTabs();
    }

    save() {
        const layoutModels: any = {};

        for (const model of this.models) {
            layoutModels[model.name] = {
                version: model.version,
                json: model.get().toJson()
            };
        }

        return layoutModels;
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

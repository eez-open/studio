import { action, computed, makeObservable } from "mobx";
import { observable } from "mobx";
import * as FlexLayout from "flexlayout-react";

import type { ProjectStore } from "project-editor/store";

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
    static EDITOR_MODE_EDITORS_TABSET_ID = "EDITORS";
    static RUNTIME_MODE_EDITORS_TABSET_ID = "RUNTIME-EDITORS";
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
    static TEXTS_STATISTICS_TAB_ID = "TEXTS_STATISTICS";

    static PAGE_STRUCTURE_TAB_ID = "page-structure";
    static ACTION_COMPONENTS_TAB_ID = "action-components";
    static ACTIONS_TAB_ID = "actions";

    static BREAKPOINTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Breakpoints",
        id: LayoutModels.BREAKPOINTS_TAB_ID,
        component: "breakpointsPanel"
    };

    static GLOBAL_VARS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Global Vars",
        id: LayoutModels.GLOBAL_VARS_TAB_ID,
        component: "globals"
    };

    static PAGES_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Pages",
        component: "pages"
    };

    static PAGE_STRUCTURE_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Page Structure",
        component: "page-structure",
        id: LayoutModels.PAGE_STRUCTURE_TAB_ID
    };

    static ACTION_COMPONENTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Action Components",
        component: "action-components",
        id: LayoutModels.ACTION_COMPONENTS_TAB_ID
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

    static ENUMS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Enums",
        id: LayoutModels.ENUMS_TAB_ID,
        component: "enums"
    };

    rootEditor: FlexLayout.Model;
    rootRuntime: FlexLayout.Model;

    editorModeEditors: FlexLayout.Model;
    runtimeModeEditors: FlexLayout.Model;

    variables: FlexLayout.Model;
    bitmaps: FlexLayout.Model;
    fonts: FlexLayout.Model;

    pagesEditor: FlexLayout.Model;
    pagesRuntime: FlexLayout.Model;

    actionsEditor: FlexLayout.Model;
    actionsRuntime: FlexLayout.Model;

    scpi: FlexLayout.Model;
    styles: FlexLayout.Model;
    themes: FlexLayout.Model;
    texts: FlexLayout.Model;

    get editors() {
        return this.projectStore.runtime
            ? this.runtimeModeEditors
            : this.editorModeEditors;
    }

    constructor(public projectStore: ProjectStore) {
        makeObservable(this, {
            root: computed,
            rootEditor: observable,
            rootRuntime: observable,

            editorModeEditors: observable,
            runtimeModeEditors: observable,

            variables: observable,
            bitmaps: observable,
            fonts: observable,

            pages: computed,
            pagesEditor: observable,
            pagesRuntime: observable,

            actions: computed,
            actionsEditor: observable,
            actionsRuntime: observable,

            scpi: observable,
            styles: observable,
            themes: observable,

            texts: observable
        });
    }

    get borders() {
        const borders: FlexLayout.IJsonBorderNode[] = [
            {
                type: "border",
                location: "top",
                children: []
            }
        ];

        if (!this.projectStore.projectTypeTraits.isLVGL) {
            borders.push({
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
            });
        }

        borders.push({
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
        });

        return borders;
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
                name: "rootEditor",
                version: 33,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: this.borders,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 15,
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
                                type: "tabset",
                                weight: 60,
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                id: LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Editors",
                                        component: "editors"
                                    }
                                ]
                            },
                            {
                                type: "row",
                                weight: 25,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 50,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Properties",
                                                id: LayoutModels.PROPERTIES_TAB_ID,
                                                component: "propertiesPanel"
                                            },
                                            LayoutModels.BREAKPOINTS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 50,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Components Palette",
                                                id: LayoutModels.COMPONENTS_PALETTE_TAB_ID,
                                                component: "componentsPalette"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.rootEditor,
                set: action(model => (this.rootEditor = model))
            },
            {
                name: "rootRuntime",
                version: 24,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 20,
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
                                type: "tabset",
                                weight: 50,
                                enableTabStrip: false,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                id: LayoutModels.RUNTIME_MODE_EDITORS_TABSET_ID,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Editors",
                                        component: "editors"
                                    }
                                ]
                            },
                            {
                                type: "row",
                                weight: 30,
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
                                            },
                                            LayoutModels.BREAKPOINTS_TAB
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
                get: () => this.rootRuntime,
                set: action(model => (this.rootRuntime = model))
            },
            {
                name: "editors",
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
                                id: LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID,
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
                    }
                },
                get: () => this.editorModeEditors,
                set: action(model => (this.editorModeEditors = model))
            },
            {
                name: "runtimeEditors",
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
                                id: LayoutModels.RUNTIME_MODE_EDITORS_TABSET_ID,
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
                    }
                },
                get: () => this.runtimeModeEditors,
                set: action(model => (this.runtimeModeEditors = model))
            },
            {
                name: "variables",
                version: 7,
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
                                        children: [LayoutModels.GLOBAL_VARS_TAB]
                                    },
                                    {
                                        type: "tabset",
                                        children: [LayoutModels.LOCAL_VARS_TAB]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.STRUCTS_TAB,
                                            LayoutModels.ENUMS_TAB
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.variables,
                set: action(model => (this.variables = model))
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
                set: action(model => (this.bitmaps = model))
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
                set: action(model => (this.fonts = model))
            },
            {
                name: "pagesEditor",
                version: 7,
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
                                        children: [LayoutModels.PAGES_TAB]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.PAGE_STRUCTURE_TAB,
                                            LayoutModels.ACTION_COMPONENTS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [LayoutModels.LOCAL_VARS_TAB]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.pagesEditor,
                set: action(model => (this.pagesEditor = model))
            },
            {
                name: "pagesRuntime",
                version: 3,
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
                                        name: "Pages",
                                        component: "pages"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.pagesRuntime,
                set: action(model => (this.pagesRuntime = model))
            },
            {
                name: "actionsEditor",
                version: 7,
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
                                                component: "actions",
                                                id: LayoutModels.ACTIONS_TAB_ID
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            LayoutModels.ACTION_COMPONENTS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        children: [LayoutModels.LOCAL_VARS_TAB]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.actionsEditor,
                set: action(model => (this.actionsEditor = model))
            },
            {
                name: "actionsRuntime",
                version: 3,
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
                                        name: "Actions",
                                        component: "actions"
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.actionsRuntime,
                set: action(model => (this.actionsRuntime = model))
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
                set: action(model => (this.scpi = model))
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
                set: action(model => (this.styles = model))
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
                set: action(model => (this.themes = model))
            },
            {
                name: "texts",
                version: 7,
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
                                    },
                                    {
                                        type: "tabset",
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Statistics",
                                                id: LayoutModels.TEXTS_STATISTICS_TAB_ID,
                                                component: "statistics"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.texts,
                set: action(model => (this.texts = model))
            }
        ];
    }

    get root() {
        return this.projectStore.runtime ? this.rootRuntime : this.rootEditor;
    }

    get pages() {
        return this.projectStore.runtime ? this.pagesRuntime : this.pagesEditor;
    }

    get actions() {
        return this.projectStore.runtime
            ? this.actionsRuntime
            : this.actionsEditor;
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

        this.projectStore.project.enableTabs();
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

    unmount() {}
}

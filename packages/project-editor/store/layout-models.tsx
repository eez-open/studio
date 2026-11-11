import React from "react";

import {
    action,
    computed,
    IReactionDisposer,
    makeObservable,
    reaction,
    runInAction
} from "mobx";
import { observable } from "mobx";
import * as FlexLayout from "flexlayout-react";

import { Icon } from "eez-studio-ui/icon";
import {
    AbstractLayoutModels,
    ILayoutModel
} from "eez-studio-ui/layout-models";

import type { ProjectStore } from "project-editor/store";
import { settingsController } from "home/settings";
import { ProjectEditor } from "project-editor/project-editor-interface";

////////////////////////////////////////////////////////////////////////////////

export class LayoutModels extends AbstractLayoutModels {
    static GLOBAL_OPTIONS: FlexLayout.IGlobalAttributes = {
        borderEnableAutoHide: true,
        tabEnableRename: false,
        tabSetMinWidth: 50,
        tabSetMinHeight: 50
    };

    static PAGES_TAB_ID = "PAGES";
    static USER_WIDGETS_TAB_ID = "WIDGETS";
    static ACTIONS_TAB_ID = "ACTIONS";
    static VARIABLES_TAB_ID = "VARIABLES";
    static CHECKS_TAB_ID = "CHECKS";
    static OUTPUT_TAB_ID = "OUTPUT";
    static SEARCH_TAB_ID = "SEARCH";
    static REFERENCES_TAB_ID = "REFERENCES";
    static EDITOR_MODE_EDITORS_TABSET_ID = "EDITORS";
    static RUNTIME_MODE_EDITORS_TABSET_ID = "RUNTIME-EDITORS";
    static PROPERTIES_TAB_ID = "PROPERTIES";
    static COMPONENTS_PALETTE_TAB_ID = "COMPONENTS_PALETTE";
    static BREAKPOINTS_TAB_ID = "BREAKPOINTS_PALETTE";
    static DEBUGGER_TAB_ID = "DEBUGGER";
    static DEBUGGER_LOGS_TAB_ID = "DEBUGGER_LOGS";

    static SCPI_SUBSYSTEMS_TAB_ID = "SCPI_SUBSYSTEMS";
    static SCPI_ENUMS_TAB_ID = "SCPI_ENUMS";
    static SCPI_COMMANDS_TAB_ID = "SCPI_COMMANDS";

    static LANGUAGES_TAB_ID = "LANGUAGES";
    static TEXT_RESOURCES_TAB_ID = "TEXT_RESOURCES";
    static TEXTS_STATISTICS_TAB_ID = "TEXTS_STATISTICS";

    static STYLES_TAB_ID = "styles";
    static FONTS_TAB_ID = "fonts";
    static BITMAPS_TAB_ID = "bitmaps";
    static THEMES_TAB_ID = "themes";
    static TEXTS_TAB_ID = "texts";
    static SCPI_TAB_ID = "scpi";
    static INSTRUMENT_COMMANDS_TAB_ID = "instrument-commands";
    static EXTENSION_DEFINITIONS_TAB_ID = "iext";
    static CHANGES_TAB_ID = "changes";
    static MICRO_PYTHON_TAB_ID = "micro-python";
    static README_TAB_ID = "readme";
    static LVGL_GROUPS_TAB_ID = "lvgl-groups";
    static DOCKER_SIMULATOR_PREVIEW_TAB_ID = "DOCKER_SIMULATOR_PREVIEW";
    static DOCKER_SIMULATOR_LOGS_TAB_ID = "DOCKER_SIMULATOR_LOGS";
    static DOCKER_SIMULATOR_PREVIEW_LOGS_TAB_ID =
        "DOCKER_SIMULATOR_PREVIEW_LOGS";

    static PROJECT_EXPLORER_TAB_ID = "PROJECT_EXPLORER";
    // "Widgets Structure" tab in the "Project Explorer" layout
    static FLOW_STRUCTURE_TAB_ID = "FLOW_STRUCTURE";

    // Tabs of the "Classic" layout which are groups in the Project Explorer,
    // selectTab() with one of these ids selects the Project Explorer group
    // when the "Project Explorer" layout is used.
    static PROJECT_EXPLORER_GROUP_TAB_IDS = [
        LayoutModels.PAGES_TAB_ID,
        LayoutModels.USER_WIDGETS_TAB_ID,
        LayoutModels.ACTIONS_TAB_ID,
        LayoutModels.VARIABLES_TAB_ID,
        LayoutModels.STYLES_TAB_ID,
        LayoutModels.FONTS_TAB_ID,
        LayoutModels.BITMAPS_TAB_ID,
        LayoutModels.THEMES_TAB_ID,
        LayoutModels.TEXTS_TAB_ID,
        LayoutModels.LVGL_GROUPS_TAB_ID,
        LayoutModels.SCPI_TAB_ID,
        LayoutModels.INSTRUMENT_COMMANDS_TAB_ID,
        LayoutModels.EXTENSION_DEFINITIONS_TAB_ID,
        LayoutModels.CHANGES_TAB_ID,
        LayoutModels.BREAKPOINTS_TAB_ID,
        LayoutModels.COMPONENTS_PALETTE_TAB_ID
    ];

    // Project Explorer group which shows the items of all the other groups,
    // except these
    static PROJECT_EXPLORER_ALL_GROUP_ID = "ALL";
    static PROJECT_EXPLORER_GROUP_TAB_IDS_NOT_IN_ALL = [
        LayoutModels.CHANGES_TAB_ID,
        LayoutModels.BREAKPOINTS_TAB_ID,
        LayoutModels.COMPONENTS_PALETTE_TAB_ID
    ];

    static PAGES_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Pages",
        component: "pages",
        icon: "svg:pages",
        id: LayoutModels.PAGES_TAB_ID
    };
    static WIDGETS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "User Widgets",
        component: "widgets",
        icon: "svg:user_widgets",
        id: LayoutModels.USER_WIDGETS_TAB_ID
    };
    static ACTIONS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "User Actions",
        component: "actions",
        icon: "material:code",
        id: LayoutModels.ACTIONS_TAB_ID
    };

    static STYLES_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Styles",
        id: LayoutModels.STYLES_TAB_ID,
        component: "styles",
        icon: "material:format_color_fill"
    };

    static FONTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Fonts",
        id: LayoutModels.FONTS_TAB_ID,
        component: "fonts",
        icon: "material:font_download"
    };

    static BITMAPS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Bitmaps",
        id: LayoutModels.BITMAPS_TAB_ID,
        component: "bitmaps",
        icon: "material:image"
    };

    static THEMES_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Themes",
        id: LayoutModels.THEMES_TAB_ID,
        component: "themesSideView",
        icon: "svg:palette"
    };

    static TEXTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Texts",
        id: LayoutModels.TEXTS_TAB_ID,
        component: "texts",
        icon: "svg:language"
    };

    static SCPI_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "SCPI",
        id: LayoutModels.SCPI_TAB_ID,
        component: "scpi",
        icon: "material:navigate_next"
    };

    static INSTRUMENT_COMMANDS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Instrument Commands",
        id: LayoutModels.INSTRUMENT_COMMANDS_TAB_ID,
        component: "instrument-commands",
        icon: "material:navigate_next"
    };

    static EXTENSION_DEFINITIONS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "IEXT",
        id: LayoutModels.EXTENSION_DEFINITIONS_TAB_ID,
        component: "extension-definitions",
        icon: "material:extension"
    };

    static CHANGES_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Changes",
        id: LayoutModels.CHANGES_TAB_ID,
        component: "changes",
        icon: "svg:changes"
    };

    static BREAKPOINTS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Breakpoints",
        id: LayoutModels.BREAKPOINTS_TAB_ID,
        icon: "svg:breakpoints_panel",
        component: "breakpointsPanel"
    };

    static LVGL_GROUPS_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Groups",
        id: LayoutModels.LVGL_GROUPS_TAB_ID,
        component: "lvgl-groups",
        icon: "material:view_compact"
    };

    static PROPERTIES_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Properties",
        id: LayoutModels.PROPERTIES_TAB_ID,
        component: "propertiesPanel",
        icon: "svg:properties"
    };

    static COMPONENTS_PALETTE_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Components Palette",
        id: LayoutModels.COMPONENTS_PALETTE_TAB_ID,
        component: "componentsPalette",
        icon: "svg:components"
    };

    static PROJECT_EXPLORER_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Project Explorer",
        id: LayoutModels.PROJECT_EXPLORER_TAB_ID,
        component: "projectExplorer",
        icon: "material:folder_open"
    };

    static FLOW_STRUCTURE_TAB: FlexLayout.IJsonTabNode = {
        type: "tab",
        enableClose: false,
        name: "Widgets Structure",
        id: LayoutModels.FLOW_STRUCTURE_TAB_ID,
        component: "flow-structure",
        icon: "svg:hierarchy"
    };

    static get OUTPUT_TABS(): FlexLayout.IJsonTabNode[] {
        return [
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
                name: "Search",
                id: LayoutModels.SEARCH_TAB_ID,
                component: "search"
            },
            {
                type: "tab",
                enableClose: false,
                name: "References",
                id: LayoutModels.REFERENCES_TAB_ID,
                component: "references"
            }
        ];
    }

    static iconFactory = (node: FlexLayout.TabNode) => {
        let icon = node.getIcon();
        if (!icon || typeof icon != "string") {
            return null;
        }
        return <Icon icon={icon} size={20} />;
    };

    rootEditor: FlexLayout.Model;
    rootEditorForIEXT: FlexLayout.Model;
    rootProjectExplorer: FlexLayout.Model;
    rootRuntime: FlexLayout.Model;
    rootDockerSimulator: FlexLayout.Model;

    // Track if docker simulator mode is active
    isDockerSimulatorMode: boolean = false;

    dispose1: IReactionDisposer | undefined;
    dispose2: IReactionDisposer | undefined;

    get isProjectExplorerLayout() {
        return settingsController.isProjectExplorerLayout;
    }

    // Properties dialog is used instead of the Properties panel
    get isPropertiesDialogUsed() {
        return settingsController.isPropertiesDialog;
    }

    get rootEditorClassic() {
        return this.projectStore.projectTypeTraits.isIEXT
            ? this.rootEditorForIEXT
            : this.rootEditor;
    }

    // layout model used in editor mode (i.e. not in runtime mode)
    get rootEditorModel() {
        return this.isProjectExplorerLayout
            ? this.rootProjectExplorer
            : this.rootEditorClassic;
    }

    get root() {
        if (!this.projectStore.projectTypeTraits.isIEXT) {
            if (this.isDockerSimulatorMode) {
                return this.rootDockerSimulator;
            }
            if (this.projectStore.runtime) {
                return this.rootRuntime;
            }
        }
        return this.rootEditorModel;
    }

    styles: FlexLayout.Model;
    lvglStyles: FlexLayout.Model;
    bitmaps: FlexLayout.Model;
    fonts: FlexLayout.Model;
    themes: FlexLayout.Model;
    scpi: FlexLayout.Model;
    texts: FlexLayout.Model;
    lvglGroups: FlexLayout.Model;

    constructor(public projectStore: ProjectStore) {
        super();

        makeObservable(this, {
            rootEditor: observable,
            rootEditorForIEXT: observable,
            rootProjectExplorer: observable,
            rootRuntime: observable,
            rootDockerSimulator: observable,

            isDockerSimulatorMode: observable,
            isProjectExplorerLayout: computed,
            isPropertiesDialogUsed: computed,
            rootEditorClassic: computed,
            rootEditorModel: computed,
            root: computed,

            styles: observable,
            lvglStyles: observable,
            bitmaps: observable,
            fonts: observable,
            themes: observable,
            scpi: observable,
            texts: observable,
            lvglGroups: observable
        });

        // when the project editor layout is changed in the settings, move
        // the opened editors to the newly used layout
        this.dispose1 = reaction(
            () => this.isProjectExplorerLayout,
            isProjectExplorerLayout => {
                if (isProjectExplorerLayout) {
                    this.moveEditorTabs(
                        this.rootEditorClassic,
                        this.rootProjectExplorer
                    );
                } else {
                    this.moveEditorTabs(
                        this.rootProjectExplorer,
                        this.rootEditorClassic
                    );
                }
                this.projectStore.editorModeEditorsStore?.refresh(true);
            }
        );

        // when the properties editor is changed in the settings, add or
        // remove the Properties panel
        this.dispose2 = reaction(
            () => this.isPropertiesDialogUsed,
            isPropertiesDialogUsed => {
                this.enablePropertiesTabs();
                if (!isPropertiesDialogUsed) {
                    ProjectEditor.closePropertiesDialog?.(this.projectStore);
                }
            }
        );
    }

    static getEditorTabs(model: FlexLayout.Model) {
        const tabs: FlexLayout.TabNode[] = [];
        model.visitNodes(node => {
            if (
                node instanceof FlexLayout.TabNode &&
                node.getComponent() == "editor"
            ) {
                tabs.push(node);
            }
        });
        return tabs;
    }

    moveEditorTabs(fromModel: FlexLayout.Model, toModel: FlexLayout.Model) {
        if (!fromModel || !toModel || fromModel == toModel) {
            return;
        }

        const toTabSet = toModel.getNodeById(
            LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID
        );
        if (!(toTabSet instanceof FlexLayout.TabSetNode)) {
            return;
        }

        const getEditorTabs = LayoutModels.getEditorTabs;

        const fromTabs = getEditorTabs(fromModel);
        if (fromTabs.length == 0) {
            return;
        }

        let selectedTabId: string | undefined;
        const activeTabSet = fromModel.getActiveTabset();
        const activeTab = activeTabSet?.getSelectedNode();
        if (activeTab && fromTabs.indexOf(activeTab as any) != -1) {
            selectedTabId = activeTab.getId();
        }

        // remove editors left in the target layout from the last time it
        // was used, so the same editor is not opened twice
        for (const tab of getEditorTabs(toModel)) {
            toModel.doAction(FlexLayout.Actions.deleteTab(tab.getId()));
        }

        for (const tab of fromTabs) {
            const tabJson = tab.toJson() as FlexLayout.IJsonTabNode;
            const tabParent = tab.getParent();
            const isSelected =
                tabParent instanceof FlexLayout.TabSetNode &&
                tabParent.getSelectedNode() == tab;
            if (!selectedTabId && isSelected) {
                selectedTabId = tab.getId();
            }

            fromModel.doAction(FlexLayout.Actions.deleteTab(tab.getId()));

            toModel.doAction(
                FlexLayout.Actions.addNode(
                    tabJson,
                    toTabSet.getId(),
                    FlexLayout.DockLocation.CENTER,
                    -1,
                    false
                )
            );
        }

        if (selectedTabId && toModel.getNodeById(selectedTabId)) {
            toModel.doAction(FlexLayout.Actions.selectTab(selectedTabId));
        }
    }

    get borders() {
        const borders: FlexLayout.IJsonBorderNode[] = [
            {
                type: "border",
                location: "top",
                children: []
            }
        ];

        borders.push({
            type: "border",
            location: "right",
            size: 240,
            children: [
                LayoutModels.STYLES_TAB,
                LayoutModels.FONTS_TAB,
                LayoutModels.BITMAPS_TAB,
                LayoutModels.THEMES_TAB,
                LayoutModels.LVGL_GROUPS_TAB,
                LayoutModels.BREAKPOINTS_TAB
            ]
        });

        borders.push({
            type: "border",
            location: "bottom",
            children: LayoutModels.OUTPUT_TABS
        });

        borders.push({
            type: "border",
            location: "left",
            size: 240,
            children: [
                LayoutModels.TEXTS_TAB,
                LayoutModels.SCPI_TAB,
                LayoutModels.INSTRUMENT_COMMANDS_TAB,
                LayoutModels.EXTENSION_DEFINITIONS_TAB,
                LayoutModels.CHANGES_TAB
            ]
        });

        return borders;
    }

    get bordersIEXT() {
        const borders: FlexLayout.IJsonBorderNode[] = [
            {
                type: "border",
                location: "top",
                children: []
            }
        ];

        borders.push({
            type: "border",
            location: "right",
            size: 240,
            children: []
        });

        borders.push({
            type: "border",
            location: "bottom",
            children: LayoutModels.OUTPUT_TABS
        });

        borders.push({
            type: "border",
            location: "left",
            size: 240,
            children: [LayoutModels.CHANGES_TAB]
        });

        return borders;
    }

    get bordersProjectExplorer() {
        const borders: FlexLayout.IJsonBorderNode[] = [
            {
                type: "border",
                location: "bottom",
                children: LayoutModels.OUTPUT_TABS
            }
        ];

        return borders;
    }

    get models(): ILayoutModel[] {
        return [
            {
                name: "rootProjectExplorer",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: this.bordersProjectExplorer,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                weight: 20,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 2,
                                        children: [
                                            LayoutModels.PROJECT_EXPLORER_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            LayoutModels.FLOW_STRUCTURE_TAB
                                        ]
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 80,
                                enableDeleteWhenEmpty: false,
                                enableClose: false,
                                id: LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID,
                                children: []
                            }
                        ]
                    }
                },
                get: () => this.rootProjectExplorer,
                set: action(model => (this.rootProjectExplorer = model))
            },
            {
                name: "rootEditor",
                version: 116,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: this.borders,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                weight: 15,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            LayoutModels.PAGES_TAB,
                                            LayoutModels.WIDGETS_TAB,
                                            LayoutModels.ACTIONS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Widgets Structure",
                                                component: "flow-structure",
                                                icon: "svg:hierarchy"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Variables",
                                                component: "variables",
                                                icon: "svg:variable",
                                                id: LayoutModels.VARIABLES_TAB_ID
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 65,
                                enableDeleteWhenEmpty: false,
                                enableClose: false,
                                id: LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID,
                                children: []
                            },
                            {
                                type: "row",
                                weight: 20,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 2,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Properties",
                                                id: LayoutModels.PROPERTIES_TAB_ID,
                                                component: "propertiesPanel",
                                                icon: "svg:properties"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            LayoutModels.COMPONENTS_PALETTE_TAB
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
                name: "rootEditorForIEXT",
                version: 5,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    borders: this.bordersIEXT,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                weight: 25,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            LayoutModels.EXTENSION_DEFINITIONS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 5,
                                        children: [LayoutModels.SCPI_TAB]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 5,
                                        children: [
                                            LayoutModels.INSTRUMENT_COMMANDS_TAB
                                        ]
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 50,
                                enableClose: false,
                                enableDeleteWhenEmpty: false,
                                id: LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID,
                                children: []
                            },
                            {
                                type: "row",
                                weight: 25,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 2,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Properties",
                                                id: LayoutModels.PROPERTIES_TAB_ID,
                                                component: "propertiesPanel",
                                                icon: "svg:properties"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.rootEditorForIEXT,
                set: action(model => (this.rootEditorForIEXT = model))
            },
            {
                name: "rootRuntime",
                version: 55,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "row",
                                weight: 1,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            LayoutModels.PAGES_TAB,
                                            LayoutModels.WIDGETS_TAB,
                                            LayoutModels.ACTIONS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Active Flows",
                                                icon: "svg:active_flows_panel",
                                                component: "active-flows"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 2,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Watch",
                                                icon: "svg:watch_panel",
                                                component: "watch"
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                type: "tabset",
                                weight: 3,
                                enableClose: false,
                                enableDeleteWhenEmpty: false,
                                id: LayoutModels.RUNTIME_MODE_EDITORS_TABSET_ID,
                                children: []
                            },
                            {
                                type: "row",
                                weight: 1,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 1,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Queue",
                                                icon: "svg:queue_panel",
                                                component: "queue"
                                            },
                                            LayoutModels.BREAKPOINTS_TAB
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 2,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Logs",
                                                id: LayoutModels.DEBUGGER_LOGS_TAB_ID,
                                                icon: "svg:log",
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
                name: "rootDockerSimulator",
                version: 1,
                json: {
                    global: LayoutModels.GLOBAL_OPTIONS,
                    layout: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                weight: 70,
                                enableTabStrip: true,
                                enableDrag: false,
                                enableDrop: false,
                                enableClose: false,
                                children: [
                                    {
                                        type: "tab",
                                        enableClose: false,
                                        name: "Preview",
                                        id: LayoutModels.DOCKER_SIMULATOR_PREVIEW_TAB_ID,
                                        icon: "material:computer",
                                        component: "dockerSimulatorPreview"
                                    }
                                ]
                            },
                            {
                                type: "row",
                                weight: 30,
                                children: [
                                    {
                                        type: "tabset",
                                        weight: 50,
                                        enableTabStrip: true,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Build Logs",
                                                id: LayoutModels.DOCKER_SIMULATOR_LOGS_TAB_ID,
                                                icon: "svg:log",
                                                component: "dockerSimulatorLogs"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        weight: 50,
                                        enableTabStrip: true,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Preview Logs",
                                                id: LayoutModels.DOCKER_SIMULATOR_PREVIEW_LOGS_TAB_ID,
                                                icon: "svg:log",
                                                component:
                                                    "dockerSimulatorPreviewLogs"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.rootDockerSimulator,
                set: action(model => (this.rootDockerSimulator = model))
            },
            {
                name: "bitmaps",
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
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
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
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
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
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
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
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
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
                name: "lvglStyles",
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
                                        enableTabStrip: false,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
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
                get: () => this.lvglStyles,
                set: action(model => (this.lvglStyles = model))
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
            },
            {
                name: "lvglGroups",
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
                                        enableTabStrip: true,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        weight: 50,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Groups",
                                                component: "groups"
                                            }
                                        ]
                                    },
                                    {
                                        type: "tabset",
                                        enableTabStrip: true,
                                        enableDrag: false,
                                        enableDrop: false,
                                        enableClose: false,
                                        weight: 50,
                                        children: [
                                            {
                                                type: "tab",
                                                enableClose: false,
                                                name: "Group Widgets",
                                                component: "order"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                },
                get: () => this.lvglGroups,
                set: action(model => (this.lvglGroups = model))
            }
        ];
    }

    load(layoutModels: any) {
        super.load(layoutModels);
        this.projectStore.project.enableTabs();
        this.enableProjectExplorerTabs();
        this.enablePropertiesTabs();

        // The project editor layout could be changed in the settings since
        // the project was closed: open the editors in the used layout.
        const [fromModel, toModel] = this.isProjectExplorerLayout
            ? [this.rootEditorClassic, this.rootProjectExplorer]
            : [this.rootProjectExplorer, this.rootEditorClassic];
        if (
            fromModel &&
            toModel &&
            LayoutModels.getEditorTabs(toModel).length == 0
        ) {
            this.moveEditorTabs(fromModel, toModel);
        }
    }

    enableProjectExplorerTabs() {
        // IEXT projects have no pages, so no widgets structure
        if (
            this.projectStore.projectTypeTraits.isIEXT &&
            this.rootProjectExplorer?.getNodeById(
                LayoutModels.FLOW_STRUCTURE_TAB_ID
            )
        ) {
            this.rootProjectExplorer.doAction(
                FlexLayout.Actions.deleteTab(LayoutModels.FLOW_STRUCTURE_TAB_ID)
            );
        }
    }

    // Properties panel is in its own tab, except when the Properties dialog
    // is used (selected in the settings)
    enablePropertiesTabs() {
        const enabled = !this.isPropertiesDialogUsed;
        for (const model of [
            this.rootEditor,
            this.rootEditorForIEXT,
            this.rootProjectExplorer
        ]) {
            if (model) {
                this.enablePropertiesTab(model, enabled);
            }
        }
    }

    enablePropertiesTab(model: FlexLayout.Model, enabled: boolean) {
        const propertiesTab = model.getNodeById(LayoutModels.PROPERTIES_TAB_ID);

        if (!enabled) {
            if (propertiesTab) {
                model.doAction(
                    FlexLayout.Actions.deleteTab(LayoutModels.PROPERTIES_TAB_ID)
                );
            }
            return;
        }

        if (propertiesTab) {
            return;
        }

        // above the Components Palette, as in the default "Classic" layout
        const componentsPaletteTabSet = model
            .getNodeById(LayoutModels.COMPONENTS_PALETTE_TAB_ID)
            ?.getParent();
        if (componentsPaletteTabSet instanceof FlexLayout.TabSetNode) {
            this.addTabNextToTabSet(
                model,
                LayoutModels.PROPERTIES_TAB,
                componentsPaletteTabSet,
                FlexLayout.DockLocation.TOP,
                2 / 3
            );
            return;
        }

        // otherwise, on the right side of the editors
        const editorsTabSet = model.getNodeById(
            LayoutModels.EDITOR_MODE_EDITORS_TABSET_ID
        );
        if (editorsTabSet instanceof FlexLayout.TabSetNode) {
            this.addTabNextToTabSet(
                model,
                LayoutModels.PROPERTIES_TAB,
                editorsTabSet,
                FlexLayout.DockLocation.RIGHT,
                1 / 4
            );
        }
    }

    // Adds a new tabset with the tab next to the given tabset, the new
    // tabset gets the ratio of the space taken by both tabsets.
    addTabNextToTabSet(
        model: FlexLayout.Model,
        tabJson: FlexLayout.IJsonTabNode,
        tabSet: FlexLayout.TabSetNode,
        location: FlexLayout.DockLocation,
        ratio: number
    ) {
        const tabNode = model.doAction(
            FlexLayout.Actions.addNode(
                tabJson,
                tabSet.getId(),
                location,
                -1,
                false
            )
        ) as FlexLayout.TabNode | undefined;

        const newTabSet = tabNode?.getParent();
        if (
            newTabSet instanceof FlexLayout.TabSetNode &&
            newTabSet != tabSet &&
            newTabSet.getParent() == tabSet.getParent()
        ) {
            const totalWeight = newTabSet.getWeight() + tabSet.getWeight();
            model.doAction(
                FlexLayout.Actions.updateNodeAttributes(newTabSet.getId(), {
                    weight: totalWeight * ratio
                })
            );
            model.doAction(
                FlexLayout.Actions.updateNodeAttributes(tabSet.getId(), {
                    weight: totalWeight * (1 - ratio)
                })
            );
        }
    }

    selectTab(model: FlexLayout.Model, tabId: string) {
        if (
            model &&
            model == this.rootProjectExplorer &&
            LayoutModels.PROJECT_EXPLORER_GROUP_TAB_IDS.indexOf(tabId) != -1
        ) {
            // there are no such tabs in the Project Explorer layout,
            // select the Project Explorer group with the same items (unless
            // the "All" group, which also shows these items, is selected)
            const navigationStore = this.projectStore.navigationStore;
            if (
                navigationStore.projectExplorerSelectedGroup !=
                    LayoutModels.PROJECT_EXPLORER_ALL_GROUP_ID ||
                LayoutModels.PROJECT_EXPLORER_GROUP_TAB_IDS_NOT_IN_ALL.indexOf(
                    tabId
                ) != -1
            ) {
                runInAction(() => {
                    navigationStore.projectExplorerSelectedGroup = tabId;
                });
            }
            tabId = LayoutModels.PROJECT_EXPLORER_TAB_ID;
        }

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

    toggleComponentsPalette() {
        settingsController.showComponentsPaletteInProjectEditor =
            !settingsController.showComponentsPaletteInProjectEditor;
        this.projectStore.project.enableTabs();
    }

    reset() {
        for (const model of this.models) {
            model.set(FlexLayout.Model.fromJson(model.json));
        }

        this.projectStore.project.enableTabs();
        this.enableProjectExplorerTabs();
        this.enablePropertiesTabs();
    }

    unmount() {
        if (this.dispose1) {
            this.dispose1();
            this.dispose1 = undefined;
        }
        if (this.dispose2) {
            this.dispose2();
            this.dispose2 = undefined;
        }
    }
}

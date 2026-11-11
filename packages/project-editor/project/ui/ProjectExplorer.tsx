import React from "react";
import { action, computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";

import { Icon } from "eez-studio-ui/icon";
import { SearchInput } from "eez-studio-ui/search-input";

import type { SortDirectionType } from "project-editor/core/objectAdapter";
import { LayoutModels, NavigationStore, ProjectStore } from "project-editor/store";
import { ProjectContext } from "project-editor/project/context";
import {
    ListNavigation,
    SortControl
} from "project-editor/ui-components/ListNavigation";
import {
    IProjectExplorerFilter,
    ProjectExplorerFilterContext
} from "project-editor/ui-components/ProjectExplorerFilter";

import { Page } from "project-editor/features/page/page";
import { Action } from "project-editor/features/action/action";
import { Enum, Structure } from "project-editor/features/variable/variable";
import { StylesTab } from "project-editor/features/style/StylesNavigation";
import { FontsTab } from "project-editor/features/font/FontsNavigation";
import { BitmapsTab } from "project-editor/features/bitmap/BitmapsNavigation";
import { ThemesSideView } from "project-editor/features/style/theme";
import { TextsTab } from "project-editor/features/texts/navigation";
import { ScpiTab } from "project-editor/features/scpi/ScpiNavigation";
import { InstrumentCommandsList } from "project-editor/features/instrument-commands/InstrumentCommandsNavigation";
import { ExtensionDefinitionsTab } from "project-editor/features/extension-definitions/extension-definitions";
import { ChangesTab } from "project-editor/features/changes/navigation";
import { LVGLGroupsTab } from "project-editor/lvgl/groups";
import { BreakpointsPanel } from "project-editor/flow/debugger/BreakpointsPanel";
import { ComponentsPalette } from "project-editor/flow/editor/ComponentsPalette";

////////////////////////////////////////////////////////////////////////////////

// a titled list in the "All" group
interface IProjectExplorerSection {
    title: string;
    isAvailable?: (projectStore: ProjectStore) => boolean;
    render: (projectStore: ProjectStore) => React.ReactNode;
}

interface IProjectExplorerGroup {
    // id of the tab which shows the same items in the "Classic" layout
    tabId: string;
    // Variables tab is split into multiple groups
    variablesSubNavigationItem?: string;

    title: string;
    icon: React.ReactNode;
    badge?: string;

    // does the group content use the Project Explorer search and sort order
    search: boolean;
    order: boolean;

    isAvailable: (projectStore: ProjectStore) => boolean;
    render: (projectStore: ProjectStore) => React.ReactNode;

    // How the group is shown in the "All" group. By default, it is one
    // section with the group title and content.
    allSections?: IProjectExplorerSection[];
}

const isNotIEXT = (projectStore: ProjectStore) =>
    !projectStore.projectTypeTraits.isIEXT;

const hasFlowSupport = (projectStore: ProjectStore) =>
    projectStore.projectTypeTraits.hasFlowSupport &&
    !projectStore.projectTypeTraits.isIEXT;

function getLocalVariables(projectStore: ProjectStore) {
    const editor = projectStore.editorsStore.activeEditor;
    if (editor) {
        const object = editor.object;
        if (object instanceof Page || object instanceof Action) {
            return object.localVariables;
        }
    }
    return undefined;
}

const PROJECT_EXPLORER_GROUPS: IProjectExplorerGroup[] = [
    {
        tabId: LayoutModels.PAGES_TAB_ID,
        title: "Pages",
        icon: "svg:pages",
        search: true,
        order: true,
        isAvailable: isNotIEXT,
        render: projectStore => (
            <ListNavigation
                id="pages"
                navigationObject={projectStore.project.userPages}
                selectedObject={
                    projectStore.navigationStore.selectedUserPageObject
                }
                editable={!projectStore.runtime}
                masterNavigationObject={
                    projectStore.project.masterProject?.userPages
                }
            />
        )
    },
    {
        tabId: LayoutModels.USER_WIDGETS_TAB_ID,
        title: "User Widgets",
        icon: "svg:user_widgets",
        search: true,
        order: true,
        isAvailable: isNotIEXT,
        render: projectStore => (
            <ListNavigation
                id="widgets"
                navigationObject={projectStore.project.userWidgets}
                selectedObject={
                    projectStore.navigationStore.selectedUserWidgetObject
                }
                editable={!projectStore.runtime}
                masterNavigationObject={
                    projectStore.project.masterProject?.userWidgets
                }
            />
        )
    },
    {
        tabId: LayoutModels.ACTIONS_TAB_ID,
        title: "User Actions",
        icon: "material:code",
        search: true,
        order: true,
        isAvailable: isNotIEXT,
        render: projectStore => (
            <ListNavigation
                id="actions"
                navigationObject={projectStore.project.actions}
                selectedObject={
                    projectStore.navigationStore.selectedActionObject
                }
                editable={!projectStore.runtime}
                masterNavigationObject={
                    projectStore.project.masterProject?.actions
                }
            />
        )
    },
    {
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_GLOBAL,
        title: "Global Variables",
        icon: "svg:variable",
        badge: "G",
        search: true,
        order: true,
        isAvailable: isNotIEXT,
        render: projectStore => (
            <ListNavigation
                id="global-variables"
                navigationObject={
                    projectStore.project.variables.globalVariables
                }
                selectedObject={
                    projectStore.navigationStore.selectedGlobalVariableObject
                }
                masterNavigationObject={
                    projectStore.project.masterProject?.variables
                        ?.globalVariables
                }
            />
        )
    },
    {
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_LOCAL,
        title: "Local Variables",
        icon: "svg:variable",
        badge: "L",
        search: true,
        order: true,
        isAvailable: hasFlowSupport,
        render: () => <LocalVariables />,
        allSections: [
            {
                title: "Local Variables",
                // only when a page or an action is opened
                isAvailable: projectStore =>
                    getLocalVariables(projectStore) != undefined,
                render: () => <LocalVariables />
            }
        ]
    },
    {
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_STRUCTS,
        title: "Structures",
        get icon() {
            return Structure.classInfo.icon;
        },
        search: true,
        order: true,
        isAvailable: hasFlowSupport,
        render: projectStore => (
            <ListNavigation
                id="structs"
                navigationObject={projectStore.project.variables.structures}
                selectedObject={
                    projectStore.navigationStore.selectedStructureObject
                }
            />
        )
    },
    {
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_ENUMS,
        title: "Enums",
        get icon() {
            return Enum.classInfo.icon;
        },
        search: true,
        order: true,
        isAvailable: isNotIEXT,
        render: projectStore => (
            <ListNavigation
                id="enums"
                navigationObject={projectStore.project.variables.enums}
                selectedObject={projectStore.navigationStore.selectedEnumObject}
            />
        )
    },
    {
        tabId: LayoutModels.STYLES_TAB_ID,
        title: "Styles",
        icon: "material:format_color_fill",
        search: true,
        order: true,
        isAvailable: projectStore =>
            projectStore.project.styles != undefined ||
            projectStore.project.lvglStyles != undefined,
        render: () => <StylesTab />,
        allSections: [
            {
                title: "Styles",
                // without the preview
                render: () => <StylesTab component="styles" />
            }
        ]
    },
    {
        tabId: LayoutModels.FONTS_TAB_ID,
        title: "Fonts",
        icon: "material:font_download",
        search: true,
        order: true,
        isAvailable: projectStore => projectStore.project.fonts != undefined,
        render: () => <FontsTab />
    },
    {
        tabId: LayoutModels.BITMAPS_TAB_ID,
        title: "Bitmaps",
        icon: "material:image",
        search: true,
        order: true,
        isAvailable: projectStore => projectStore.project.bitmaps != undefined,
        render: () => <BitmapsTab />,
        allSections: [
            {
                title: "Bitmaps",
                // without the preview
                render: () => <BitmapsTab component="bitmaps" />
            }
        ]
    },
    {
        tabId: LayoutModels.THEMES_TAB_ID,
        title: "Themes",
        icon: "svg:palette",
        search: true,
        order: true,
        isAvailable: isNotIEXT,
        render: () => <ThemesSideView />,
        allSections: [
            {
                title: "Themes",
                render: () => <ThemesSideView component="themes" />
            },
            {
                title: "Colors",
                render: () => <ThemesSideView component="colors" />
            }
        ]
    },
    {
        tabId: LayoutModels.TEXTS_TAB_ID,
        title: "Texts",
        icon: "svg:language",
        search: true,
        order: true,
        isAvailable: projectStore => projectStore.project.texts != undefined,
        render: () => <TextsTab />,
        allSections: [
            {
                title: "Text Resources",
                render: () => <TextsTab component="resources" />
            },
            {
                title: "Languages",
                render: () => <TextsTab component="languages" />
            }
        ]
    },
    {
        tabId: LayoutModels.LVGL_GROUPS_TAB_ID,
        title: "Groups",
        icon: "material:view_compact",
        search: true,
        order: true,
        isAvailable: projectStore =>
            projectStore.project.lvglGroups != undefined,
        render: () => <LVGLGroupsTab />,
        allSections: [
            {
                title: "LVGL Groups",
                render: () => <LVGLGroupsTab component="groups" />
            }
        ]
    },
    {
        tabId: LayoutModels.SCPI_TAB_ID,
        title: "SCPI",
        icon: "material:settings_ethernet",
        search: true,
        order: true,
        isAvailable: projectStore => projectStore.project.scpi != undefined,
        render: () => <ScpiTab />,
        allSections: [
            {
                title: "SCPI Subsystems",
                render: () => <ScpiTab component="subsystems" />
            },
            {
                title: "SCPI Commands",
                // commands of the selected subsystem
                render: () => <ScpiTab component="commands" />
            },
            {
                title: "SCPI Enums",
                render: () => <ScpiTab component="enums" />
            }
        ]
    },
    {
        tabId: LayoutModels.INSTRUMENT_COMMANDS_TAB_ID,
        title: "Instrument Commands",
        icon: "material:dvr",
        search: true,
        order: true,
        isAvailable: projectStore =>
            projectStore.project.instrumentCommands != undefined,
        render: () => <InstrumentCommandsList />
    },
    {
        tabId: LayoutModels.EXTENSION_DEFINITIONS_TAB_ID,
        title: "IEXT",
        icon: "material:extension",
        search: true,
        order: true,
        isAvailable: projectStore =>
            projectStore.project.extensionDefinitions != undefined,
        render: () => <ExtensionDefinitionsTab />
    },
    {
        tabId: LayoutModels.CHANGES_TAB_ID,
        title: "Changes",
        icon: "svg:changes",
        search: false,
        order: false,
        isAvailable: projectStore => projectStore.project.changes != undefined,
        render: () => <ChangesTab />,
        // not project objects
        allSections: []
    },
    {
        tabId: LayoutModels.BREAKPOINTS_TAB_ID,
        title: "Breakpoints",
        icon: "svg:breakpoints_panel",
        search: false,
        order: false,
        isAvailable: hasFlowSupport,
        render: () => <BreakpointsPanel />,
        // not project objects
        allSections: []
    },
    {
        tabId: LayoutModels.COMPONENTS_PALETTE_TAB_ID,
        title: "Components Palette",
        icon: "svg:components",
        search: true,
        order: false,
        isAvailable: isNotIEXT,
        render: () => <ComponentsPalette />,
        // not project objects
        allSections: []
    }
];

// shows the items of all the other groups, as titled sections
const ALL_GROUP: IProjectExplorerGroup = {
    tabId: LayoutModels.PROJECT_EXPLORER_ALL_GROUP_ID,
    title: "All",
    icon: "material:view_list",
    search: true,
    order: true,
    isAvailable: () => true,
    render: () => <AllGroups />
};

function getAllGroupSections(projectStore: ProjectStore) {
    const sections: IProjectExplorerSection[] = [];

    for (const group of PROJECT_EXPLORER_GROUPS) {
        if (!group.isAvailable(projectStore)) {
            continue;
        }

        const groupSections = group.allSections ?? [
            { title: group.title, render: group.render }
        ];

        for (const section of groupSections) {
            if (!section.isAvailable || section.isAvailable(projectStore)) {
                sections.push(section);
            }
        }
    }

    return sections;
}

function getGroupKey(group: IProjectExplorerGroup) {
    return group.tabId + "/" + (group.variablesSubNavigationItem ?? "");
}

////////////////////////////////////////////////////////////////////////////////

const AllGroups = observer(
    class AllGroups extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        // filter (search text and sort order) for each section
        sectionFilters = new Map<string, IProjectExplorerFilter>();

        getSectionFilter(title: string) {
            let filter = this.sectionFilters.get(title);
            if (!filter) {
                const getNavigationStore = () => this.context.navigationStore;
                filter = {
                    get searchText() {
                        return getNavigationStore().projectExplorerSearchText;
                    },
                    get sortDirection() {
                        return getNavigationStore()
                            .projectExplorerSortDirection;
                    },
                    title
                };
                this.sectionFilters.set(title, filter);
            }
            return filter;
        }

        render() {
            const projectStore = this.context;

            return (
                <div className="EezStudio_ProjectExplorer_All">
                    {getAllGroupSections(projectStore).map(section => (
                        <div
                            key={section.title}
                            className="EezStudio_ProjectExplorer_Section"
                        >
                            <ProjectExplorerFilterContext.Provider
                                value={this.getSectionFilter(section.title)}
                            >
                                {section.render(projectStore)}
                            </ProjectExplorerFilterContext.Provider>
                        </div>
                    ))}
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

const LocalVariables = observer(
    class LocalVariables extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        render() {
            const localVariables = getLocalVariables(this.context);
            if (!localVariables) {
                return (
                    <div className="EezStudio_ProjectExplorer_Message">
                        Open a page or an action to see its local variables.
                    </div>
                );
            }

            return (
                <ListNavigation
                    id="local-variables"
                    navigationObject={localVariables}
                    selectedObject={
                        this.context.navigationStore.selectedLocalVariable
                    }
                />
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

export const ProjectExplorer = observer(
    class ProjectExplorer extends React.Component {
        static contextType = ProjectContext;
        declare context: React.ContextType<typeof ProjectContext>;

        // search text and sort order, from the Project Explorer header, for
        // the list and tree navigation components inside the selected group
        filter: IProjectExplorerFilter;

        constructor(props: {}) {
            super(props);

            const getNavigationStore = () => this.context.navigationStore;

            this.filter = {
                get searchText() {
                    return getNavigationStore().projectExplorerSearchText;
                },
                get sortDirection() {
                    return getNavigationStore().projectExplorerSortDirection;
                }
            };

            makeObservable(this, {
                groups: computed,
                selectedGroup: computed,
                onSelectGroup: action.bound,
                onSearchChange: action.bound,
                onSearchClear: action.bound,
                onSortDirectionChanged: action.bound
            });
        }

        get groups() {
            return [
                ALL_GROUP,
                ...PROJECT_EXPLORER_GROUPS.filter(group =>
                    group.isAvailable(this.context)
                )
            ];
        }

        get selectedGroup(): IProjectExplorerGroup | undefined {
            const navigationStore = this.context.navigationStore;

            const groups = this.groups.filter(
                group =>
                    group.tabId == navigationStore.projectExplorerSelectedGroup
            );

            if (groups.length > 1) {
                // one of the variables groups
                const subNavigationItem =
                    navigationStore.subnavigationSelectedItems[
                        NavigationStore.VARIABLES_SUB_NAVIGATION_ID
                    ];
                return (
                    groups.find(
                        group =>
                            group.variablesSubNavigationItem ==
                            subNavigationItem
                    ) ?? groups[0]
                );
            }

            return groups.length == 1 ? groups[0] : this.groups[0];
        }

        onSelectGroup(group: IProjectExplorerGroup) {
            const navigationStore = this.context.navigationStore;

            navigationStore.projectExplorerSelectedGroup = group.tabId;

            if (group.variablesSubNavigationItem) {
                navigationStore.subnavigationSelectedItems[
                    NavigationStore.VARIABLES_SUB_NAVIGATION_ID
                ] = group.variablesSubNavigationItem;
            }
        }

        onSearchChange(event: any) {
            this.context.navigationStore.projectExplorerSearchText = (
                $(event.target).val() as string
            ).trim();
        }

        onSearchClear() {
            this.context.navigationStore.projectExplorerSearchText = "";
        }

        onSortDirectionChanged(direction: SortDirectionType) {
            this.context.navigationStore.projectExplorerSortDirection =
                direction;
        }

        render() {
            const navigationStore = this.context.navigationStore;
            const selectedGroup = this.selectedGroup;

            return (
                <div className="EezStudio_ProjectExplorer">
                    <div className="EezStudio_ProjectExplorer_Header">
                        <div className="EezStudio_ProjectExplorer_Groups">
                            {this.groups.map(group => (
                                <button
                                    key={getGroupKey(group)}
                                    type="button"
                                    className={classNames(
                                        "EezStudio_ProjectExplorer_Group",
                                        { selected: group == selectedGroup }
                                    )}
                                    title={group.title}
                                    onClick={() => this.onSelectGroup(group)}
                                >
                                    <Icon icon={group.icon} size={20} />
                                    {group.badge && (
                                        <span className="EezStudio_ProjectExplorer_GroupBadge">
                                            {group.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="EezStudio_ProjectExplorer_Filter">
                            <div
                                className="EezStudio_ProjectExplorer_GroupName"
                                title={selectedGroup?.title}
                            >
                                {selectedGroup?.title}
                            </div>
                            <div
                                className={classNames(
                                    "EezStudio_ProjectExplorer_Search",
                                    { disabled: !selectedGroup?.search }
                                )}
                            >
                                <SearchInput
                                    searchText={
                                        navigationStore.projectExplorerSearchText
                                    }
                                    onClear={this.onSearchClear}
                                    onChange={this.onSearchChange}
                                    onKeyDown={this.onSearchChange}
                                />
                            </div>
                            <div
                                className={classNames(
                                    "EezStudio_ProjectExplorer_Order",
                                    { disabled: !selectedGroup?.order }
                                )}
                                title="Order"
                            >
                                <SortControl
                                    direction={
                                        navigationStore.projectExplorerSortDirection
                                    }
                                    onDirectionChanged={
                                        this.onSortDirectionChanged
                                    }
                                />
                            </div>
                        </div>
                    </div>
                    <div className="EezStudio_ProjectExplorer_Body">
                        <div className="EezStudio_ProjectExplorer_BodyContent">
                            <ProjectExplorerFilterContext.Provider
                                value={this.filter}
                            >
                                {selectedGroup && (
                                    <React.Fragment
                                        key={getGroupKey(selectedGroup)}
                                    >
                                        {selectedGroup.render(this.context)}
                                    </React.Fragment>
                                )}
                            </ProjectExplorerFilterContext.Provider>
                        </div>
                    </div>
                </div>
            );
        }
    }
);

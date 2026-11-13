import React from "react";
import ReactDOM from "react-dom";
import {
    action,
    computed,
    makeObservable,
    observable,
    reaction,
    runInAction,
    IReactionDisposer
} from "mobx";
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

// groups with the same menu share one toolbar button, which opens a popup to
// select one of them
type ProjectExplorerMenuId = "variables" | "resources" | "other";

interface IProjectExplorerGroup {
    // id of the tab which shows the same items in the "Classic" layout
    tabId: string;
    // Variables tab is split into multiple groups
    variablesSubNavigationItem?: string;

    title: string;
    icon: React.ReactNode;
    badge?: string;

    menu?: ProjectExplorerMenuId;

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
        menu: "variables",
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
        menu: "variables",
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
        menu: "variables",
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
        menu: "variables",
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
        menu: "resources",
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
        menu: "resources",
        icon: "material:font_download",
        search: true,
        order: true,
        isAvailable: projectStore => projectStore.project.fonts != undefined,
        render: () => <FontsTab />
    },
    {
        tabId: LayoutModels.BITMAPS_TAB_ID,
        title: "Bitmaps",
        menu: "resources",
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
        menu: "resources",
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
        menu: "resources",
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
        menu: "resources",
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
        menu: "other",
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
        menu: "other",
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
        menu: "other",
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
        menu: "other",
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
        menu: "other",
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

// a button in the Project Explorer toolbar
interface IProjectExplorerToolbarItem {
    key: string;
    menu?: ProjectExplorerMenuId;
    // available groups, more than one if this button opens a menu popup
    groups: IProjectExplorerGroup[];
}

function GroupIcon({ group }: { group: IProjectExplorerGroup }) {
    return (
        <span className="EezStudio_ProjectExplorer_GroupIcon">
            <Icon icon={group.icon} size={20} />
            {group.badge && (
                <span className="EezStudio_ProjectExplorer_GroupBadge">
                    {group.badge}
                </span>
            )}
        </span>
    );
}

////////////////////////////////////////////////////////////////////////////////

const ProjectExplorerToolbarButton = observer(
    class ProjectExplorerToolbarButton extends React.Component<{
        item: IProjectExplorerToolbarItem;
        // group shown on the button: the selected group or the last one
        // selected from the menu
        group: IProjectExplorerGroup;
        selectedGroup: IProjectExplorerGroup | undefined;
        onSelectGroup: (group: IProjectExplorerGroup) => void;
    }> {
        // group button and, for the menu, chevron button which opens the popup
        buttonsRef = React.createRef<HTMLDivElement>();
        chevronButtonRef = React.createRef<HTMLButtonElement>();
        popupRef = React.createRef<HTMLDivElement>();

        // undefined when the menu popup is closed
        popupPosition: { left: number; top: number } | undefined = undefined;

        constructor(props: any) {
            super(props);

            makeObservable(this, {
                popupPosition: observable.ref,
                openPopup: action.bound,
                closePopup: action.bound
            });
        }

        get isMenu() {
            return this.props.item.groups.length > 1;
        }

        onClick = () => {
            if (this.popupPosition) {
                this.closePopup();
            }
            this.props.onSelectGroup(this.props.group);
        };

        onChevronClick = () => {
            if (this.popupPosition) {
                this.closePopup();
            } else {
                this.openPopup();
            }
        };

        openPopup() {
            const buttons = this.buttonsRef.current;
            if (!buttons) {
                return;
            }

            // below the buttons, adjusted in componentDidUpdate if it doesn't
            // fit into the window
            const rect = buttons.getBoundingClientRect();
            this.popupPosition = { left: rect.left, top: rect.bottom + 2 };

            document.addEventListener(
                "pointerdown",
                this.onDocumentPointerDown,
                true
            );
            document.addEventListener("keydown", this.onDocumentKeyDown, true);
            window.addEventListener("resize", this.closePopup);
        }

        closePopup() {
            this.popupPosition = undefined;
            this.removeListeners();
        }

        removeListeners() {
            document.removeEventListener(
                "pointerdown",
                this.onDocumentPointerDown,
                true
            );
            document.removeEventListener(
                "keydown",
                this.onDocumentKeyDown,
                true
            );
            window.removeEventListener("resize", this.closePopup);
        }

        onDocumentPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (
                !this.buttonsRef.current?.contains(target) &&
                !this.popupRef.current?.contains(target)
            ) {
                this.closePopup();
            }
        };

        onDocumentKeyDown = (event: KeyboardEvent) => {
            if (event.key == "Escape") {
                event.preventDefault();
                event.stopPropagation();
                this.closePopup();
                this.chevronButtonRef.current?.focus();
            }
        };

        onSelectMenuItem(group: IProjectExplorerGroup) {
            this.closePopup();
            this.props.onSelectGroup(group);
        }

        componentDidUpdate() {
            const buttons = this.buttonsRef.current;
            const popup = this.popupRef.current;
            if (!this.popupPosition || !buttons || !popup) {
                return;
            }

            const MARGIN = 4;
            const buttonRect = buttons.getBoundingClientRect();
            const popupRect = popup.getBoundingClientRect();

            let left = buttonRect.left;
            if (left + popupRect.width > window.innerWidth - MARGIN) {
                left = Math.max(
                    MARGIN,
                    window.innerWidth - MARGIN - popupRect.width
                );
            }

            let top = buttonRect.bottom + 2;
            if (top + popupRect.height > window.innerHeight - MARGIN) {
                top = Math.max(MARGIN, buttonRect.top - 2 - popupRect.height);
            }

            if (
                left != this.popupPosition.left ||
                top != this.popupPosition.top
            ) {
                runInAction(() => {
                    this.popupPosition = { left, top };
                });
            }
        }

        componentWillUnmount() {
            this.removeListeners();
        }

        renderPopup() {
            if (!this.popupPosition) {
                return null;
            }

            return ReactDOM.createPortal(
                <div
                    ref={this.popupRef}
                    className="dropdown-menu show shadow EezStudio_ProjectExplorer_GroupsPopup"
                    style={this.popupPosition}
                    role="menu"
                >
                    {this.props.item.groups.map(group => (
                        <button
                            key={getGroupKey(group)}
                            type="button"
                            className={classNames(
                                "EezStudio_ProjectExplorer_GroupsPopupItem",
                                { selected: group == this.props.selectedGroup }
                            )}
                            role="menuitem"
                            onClick={() => this.onSelectMenuItem(group)}
                        >
                            <GroupIcon group={group} />
                            <span className="EezStudio_ProjectExplorer_GroupsPopupItemTitle">
                                {group.title}
                            </span>
                        </button>
                    ))}
                </div>,
                document.body
            );
        }

        render() {
            const { item, group, selectedGroup } = this.props;

            const selected =
                selectedGroup != undefined &&
                item.groups.includes(selectedGroup);

            const groupButton = (
                <button
                    type="button"
                    className={classNames("EezStudio_ProjectExplorer_Group", {
                        // menu has one selection background for both buttons
                        selected: selected && !this.isMenu
                    })}
                    title={group.title}
                    onClick={this.onClick}
                >
                    <GroupIcon group={group} />
                </button>
            );

            if (!this.isMenu) {
                return groupButton;
            }

            return (
                <div
                    ref={this.buttonsRef}
                    className={classNames(
                        "EezStudio_ProjectExplorer_GroupMenu",
                        { selected }
                    )}
                >
                    {groupButton}
                    <button
                        ref={this.chevronButtonRef}
                        type="button"
                        className={classNames(
                            "EezStudio_ProjectExplorer_GroupChevron",
                            { open: this.popupPosition != undefined }
                        )}
                        title={item.groups.map(group => group.title).join(", ")}
                        aria-haspopup="menu"
                        aria-expanded={this.popupPosition != undefined}
                        onClick={this.onChevronClick}
                    >
                        <svg viewBox="0 0 8 5" width="8" height="5">
                            <path
                                d="M1 1l3 3 3-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                    {this.renderPopup()}
                </div>
            );
        }
    }
);

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
                toolbarItems: computed,
                selectedGroup: computed,
                onSelectGroup: action.bound,
                onSearchChange: action.bound,
                onSearchClear: action.bound,
                onSortDirectionChanged: action.bound
            });
        }

        disposeMenuSelectedGroupReaction: IReactionDisposer | undefined;

        componentDidMount() {
            // a menu button shows the group last selected from its menu, also
            // when it was selected from outside, e.g. by "Go to definition"
            this.disposeMenuSelectedGroupReaction = reaction(
                () => this.selectedGroup,
                group => {
                    if (group?.menu) {
                        this.context.navigationStore.projectExplorerMenuSelectedGroups[
                            group.menu
                        ] = getGroupKey(group);
                    }
                },
                { fireImmediately: true }
            );
        }

        componentWillUnmount() {
            this.disposeMenuSelectedGroupReaction?.();
        }

        get groups() {
            return [
                ALL_GROUP,
                ...PROJECT_EXPLORER_GROUPS.filter(group =>
                    group.isAvailable(this.context)
                )
            ];
        }

        get toolbarItems() {
            const items: IProjectExplorerToolbarItem[] = [];

            for (const group of this.groups) {
                if (group.menu) {
                    const menuItem = items.find(
                        item => item.menu == group.menu
                    );
                    if (menuItem) {
                        menuItem.groups.push(group);
                    } else {
                        items.push({
                            key: group.menu,
                            menu: group.menu,
                            groups: [group]
                        });
                    }
                } else {
                    items.push({ key: getGroupKey(group), groups: [group] });
                }
            }

            return items;
        }

        getToolbarItemGroup(item: IProjectExplorerToolbarItem) {
            const selectedGroup = this.selectedGroup;
            if (selectedGroup && item.groups.includes(selectedGroup)) {
                return selectedGroup;
            }

            if (item.menu) {
                const groupKey =
                    this.context.navigationStore
                        .projectExplorerMenuSelectedGroups[item.menu];
                const group = item.groups.find(
                    group => getGroupKey(group) == groupKey
                );
                if (group) {
                    return group;
                }
            }

            return item.groups[0];
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
                            {this.toolbarItems.map(item => (
                                <ProjectExplorerToolbarButton
                                    key={item.key}
                                    item={item}
                                    group={this.getToolbarItemGroup(item)}
                                    selectedGroup={selectedGroup}
                                    onSelectGroup={this.onSelectGroup}
                                />
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

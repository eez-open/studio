import os from "os";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import {
    action,
    computed,
    IObservableValue,
    makeObservable,
    observable,
    runInAction
} from "mobx";
import { observer } from "mobx-react";
import classNames from "classnames";
import * as FlexLayout from "flexlayout-react";

import { Icon } from "eez-studio-ui/icon";

import type { IEezObject } from "project-editor/core/object";
import { ProjectType } from "project-editor/core/object";
import {
    addItem,
    canAdd,
    getObjectIcon,
    LayoutModels,
    NavigationStore,
    objectToString,
    type ProjectStore
} from "project-editor/store";
import {
    isScrapbookItemFilePath,
    showScrapbookManager
} from "project-editor/store/scrapbook";
import { RuntimeType } from "project-editor/project/project-type-traits";
import { RUN_ICON } from "project-editor/ui-components/icons";
import { settingsController } from "home/settings";

import { Page } from "project-editor/features/page/page";
import { Action } from "project-editor/features/action/action";
import { getProjectWithThemes } from "project-editor/features/style/theme";

import { getEditorComponent } from "./EditorComponentFactory";
import { showExportedItemsDialog } from "./ExportedItemsDialog";
import {
    getProjectExplorerGroups,
    IProjectExplorerGroup,
    isProjectExplorerAllGroup,
    selectProjectExplorerGroup
} from "./ProjectExplorer";
import { getProjectFeatureItems } from "./Toolbar";

////////////////////////////////////////////////////////////////////////////////

// Project editor Command Palette, similar to the one in VSCode:
// - "objects" mode (Ctrl+P), searches all the project objects and shows the
//   selected one,
// - "commands" mode (Ctrl+Shift+P), searches the commands and executes the
//   selected one.
// As in VSCode, the input text starting with ">" switches to the "commands"
// mode.

export type CommandPaletteMode = "objects" | "commands";

const COMMANDS_PREFIX = ">";

// show at most this many items, the rest can be found by typing more
const MAX_ITEMS = 500;

// maximum number of remembered recently executed commands
const MAX_RECENT_COMMANDS = 10;

interface ICommandPaletteItem {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    keybinding?: string;
    run: () => void;
}

interface IMatchedItem {
    item: ICommandPaletteItem;
    // positions of the matched characters in the label
    positions: number[];
}

// recently executed commands, most recent first
const recentCommandIds: string[] = [];

function addRecentCommand(id: string) {
    const i = recentCommandIds.indexOf(id);
    if (i != -1) {
        recentCommandIds.splice(i, 1);
    }
    recentCommandIds.unshift(id);
    if (recentCommandIds.length > MAX_RECENT_COMMANDS) {
        recentCommandIds.length = MAX_RECENT_COMMANDS;
    }
}

function formatKeybinding(keybinding: string) {
    return keybinding.replace(
        "CmdOrCtrl",
        os.platform() == "darwin" ? "Cmd" : "Ctrl"
    );
}

////////////////////////////////////////////////////////////////////////////////

function isWordStart(text: string, i: number) {
    if (i == 0) {
        return true;
    }
    const prev = text[i - 1];
    const ch = text[i];
    return (
        /[\s_\-./:]/.test(prev) ||
        (ch >= "A" && ch <= "Z" && prev >= "a" && prev <= "z")
    );
}

// Returns undefined if the query doesn't match the text. Matching is case
// insensitive, the query matches if all its characters (spaces are ignored)
// are found in the text in the same order. Contiguous matches and matches at
// the start of the words are better.
function fuzzyMatch(
    query: string,
    text: string
): { score: number; positions: number[] } | undefined {
    if (!query) {
        return { score: 0, positions: [] };
    }

    const q = query.toLowerCase();
    const t = text.toLowerCase();

    const index = t.indexOf(q);
    if (index != -1) {
        const positions: number[] = [];
        for (let i = 0; i < q.length; i++) {
            positions.push(index + i);
        }

        let score = 10000 - index;
        if (q.length == t.length) {
            score += 4000;
        }
        if (index == 0) {
            score += 2000;
        } else if (isWordStart(text, index)) {
            score += 1000;
        }

        return { score, positions };
    }

    const positions: number[] = [];
    let score = 0;
    let ti = 0;
    for (const ch of q) {
        if (ch == " ") {
            continue;
        }

        while (ti < t.length && t[ti] != ch) {
            ti++;
        }
        if (ti == t.length) {
            return undefined;
        }

        if (positions.length > 0 && positions[positions.length - 1] == ti - 1) {
            score += 5;
        }
        if (isWordStart(text, ti)) {
            score += 10;
        }

        positions.push(ti);
        ti++;
    }

    // prefer compact matches
    score -= positions[positions.length - 1] - positions[0];

    return { score, positions };
}

function filterItems(items: ICommandPaletteItem[], query: string) {
    const matched: (IMatchedItem & { score: number; index: number })[] = [];

    items.forEach((item, index) => {
        const match = fuzzyMatch(query, item.label);
        if (match) {
            matched.push({
                item,
                positions: match.positions,
                score: match.score,
                index
            });
        }
    });

    if (query) {
        matched.sort(
            (a, b) =>
                b.score - a.score ||
                a.item.label.length - b.item.label.length ||
                a.index - b.index
        );
    }

    return matched;
}

////////////////////////////////////////////////////////////////////////////////

// Project objects shown in the project explorer, grouped by the type.
interface IObjectCollection {
    // e.g. "Page", used in the "New Page" command and as the description of
    // the objects in the list
    typeName: string;

    // where the objects are shown
    tabId: string;
    variablesSubNavigationItem?: string;

    getObjects: (
        projectStore: ProjectStore
    ) => { object: IEezObject; owner?: IEezObject }[];

    // where the "New ..." command adds the new object, undefined if the
    // object can't be added
    getNewObjectParent: (projectStore: ProjectStore) => IEezObject | undefined;

    // selected object in the project explorer
    getSelectedObject?: (
        navigationStore: NavigationStore
    ) => IObservableValue<IEezObject | undefined>;
}

// all objects from the array and, recursively, their children
function getArrayObjects(
    array: IEezObject[] | undefined,
    getChildren?: (object: any) => IEezObject[] | undefined,
    owner?: IEezObject
) {
    const objects: { object: IEezObject; owner?: IEezObject }[] = [];

    function addObjects(array: IEezObject[] | undefined, owner?: IEezObject) {
        if (!array) {
            return;
        }
        for (const object of array) {
            objects.push({ object, owner });
            if (getChildren) {
                addObjects(getChildren(object), object);
            }
        }
    }

    addObjects(array, owner);

    return objects;
}

function arrayCollection(
    collection: Omit<IObjectCollection, "getObjects" | "getNewObjectParent"> & {
        getArray: (projectStore: ProjectStore) => IEezObject[] | undefined;
        getChildren?: (object: any) => IEezObject[] | undefined;
        canAddNew?: (projectStore: ProjectStore) => boolean;
    }
): IObjectCollection {
    const { getArray, getChildren, canAddNew, ...rest } = collection;
    return {
        ...rest,
        getObjects: projectStore =>
            getArrayObjects(getArray(projectStore), getChildren),
        getNewObjectParent: projectStore =>
            !canAddNew || canAddNew(projectStore)
                ? (getArray(projectStore) as IEezObject | undefined)
                : undefined
    };
}

function getActiveFlow(projectStore: ProjectStore) {
    const object = projectStore.editorsStore.activeEditor?.object;
    if (object instanceof Page || object instanceof Action) {
        return object;
    }
    return undefined;
}

const OBJECT_COLLECTIONS: IObjectCollection[] = [
    arrayCollection({
        typeName: "Page",
        tabId: LayoutModels.PAGES_TAB_ID,
        getArray: projectStore => projectStore.project.userPages,
        getSelectedObject: navigationStore =>
            navigationStore.selectedUserPageObject
    }),
    arrayCollection({
        typeName: "User Widget",
        tabId: LayoutModels.USER_WIDGETS_TAB_ID,
        getArray: projectStore => projectStore.project.userWidgets,
        getSelectedObject: navigationStore =>
            navigationStore.selectedUserWidgetObject
    }),
    arrayCollection({
        typeName: "User Action",
        tabId: LayoutModels.ACTIONS_TAB_ID,
        getArray: projectStore => projectStore.project.actions,
        getSelectedObject: navigationStore =>
            navigationStore.selectedActionObject
    }),
    arrayCollection({
        typeName: "Global Variable",
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_GLOBAL,
        getArray: projectStore =>
            projectStore.project.variables?.globalVariables,
        getSelectedObject: navigationStore =>
            navigationStore.selectedGlobalVariableObject
    }),
    {
        typeName: "Local Variable",
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_LOCAL,
        getObjects: projectStore => {
            const project = projectStore.project;
            if (!projectStore.projectTypeTraits.hasFlowSupport) {
                return [];
            }
            return [
                ...(project.userPages ?? []),
                ...(project.userWidgets ?? []),
                ...(project.actions ?? [])
            ].flatMap(flow =>
                getArrayObjects(flow.localVariables, undefined, flow)
            );
        },
        // local variables of the opened page or action
        getNewObjectParent: projectStore =>
            projectStore.projectTypeTraits.hasFlowSupport
                ? getActiveFlow(projectStore)?.localVariables
                : undefined,
        getSelectedObject: navigationStore =>
            navigationStore.selectedLocalVariable
    },
    arrayCollection({
        typeName: "Structure",
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_STRUCTS,
        getArray: projectStore =>
            projectStore.projectTypeTraits.hasFlowSupport
                ? projectStore.project.variables?.structures
                : undefined,
        getSelectedObject: navigationStore =>
            navigationStore.selectedStructureObject
    }),
    arrayCollection({
        typeName: "Enum",
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_ENUMS,
        getArray: projectStore => projectStore.project.variables?.enums,
        getSelectedObject: navigationStore =>
            navigationStore.selectedEnumObject
    }),
    arrayCollection({
        typeName: "Named Expression",
        tabId: LayoutModels.VARIABLES_TAB_ID,
        variablesSubNavigationItem:
            NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_NAMED_EXPRESSIONS,
        getArray: projectStore =>
            projectStore.projectTypeTraits.hasFlowSupport
                ? projectStore.project.variables?.namedExpressions
                : undefined,
        getSelectedObject: navigationStore =>
            navigationStore.selectedNamedExpressionObject
    }),
    arrayCollection({
        typeName: "Style",
        tabId: LayoutModels.STYLES_TAB_ID,
        getArray: projectStore =>
            projectStore.projectTypeTraits.isLVGL
                ? projectStore.project.lvglStyles?.styles
                : projectStore.project.styles,
        getChildren: style => style.childStyles,
        getSelectedObject: navigationStore =>
            navigationStore.selectedStyleObject
    }),
    arrayCollection({
        typeName: "Font",
        tabId: LayoutModels.FONTS_TAB_ID,
        getArray: projectStore => projectStore.project.fonts,
        getSelectedObject: navigationStore =>
            navigationStore.selectedFontObject
    }),
    arrayCollection({
        typeName: "Bitmap",
        tabId: LayoutModels.BITMAPS_TAB_ID,
        getArray: projectStore => projectStore.project.bitmaps,
        getSelectedObject: navigationStore =>
            navigationStore.selectedBitmapObject
    }),
    arrayCollection({
        typeName: "Theme",
        tabId: LayoutModels.THEMES_TAB_ID,
        getArray: projectStore =>
            projectStore.projectTypeTraits.isIEXT
                ? undefined
                : projectStore.project.themes,
        // themes of the master project are read-only
        canAddNew: projectStore =>
            getProjectWithThemes(projectStore) == projectStore.project,
        getSelectedObject: navigationStore =>
            navigationStore.selectedThemeObject
    }),
    arrayCollection({
        typeName: "Color",
        tabId: LayoutModels.THEMES_TAB_ID,
        getArray: projectStore =>
            projectStore.projectTypeTraits.isIEXT
                ? undefined
                : projectStore.project.colors,
        canAddNew: projectStore =>
            !!projectStore.masterProject ||
            getProjectWithThemes(projectStore) == projectStore.project,
        getSelectedObject: navigationStore =>
            navigationStore.selectedThemeColorObject
    }),
    arrayCollection({
        typeName: "Text Resource",
        tabId: LayoutModels.TEXTS_TAB_ID,
        getArray: projectStore => projectStore.project.texts?.resources,
        getSelectedObject: navigationStore =>
            navigationStore.selectedTextResourceObject
    }),
    arrayCollection({
        typeName: "Language",
        tabId: LayoutModels.TEXTS_TAB_ID,
        getArray: projectStore => projectStore.project.texts?.languages,
        getSelectedObject: navigationStore =>
            navigationStore.selectedLanguageObject
    }),
    arrayCollection({
        typeName: "LVGL Group",
        tabId: LayoutModels.LVGL_GROUPS_TAB_ID,
        getArray: projectStore => projectStore.project.lvglGroups?.groups,
        getSelectedObject: navigationStore =>
            navigationStore.selectedLvglGroupObject
    }),
    arrayCollection({
        typeName: "SCPI Subsystem",
        tabId: LayoutModels.SCPI_TAB_ID,
        getArray: projectStore => projectStore.project.scpi?.subsystems,
        getSelectedObject: navigationStore =>
            navigationStore.selectedScpiSubsystemObject
    }),
    {
        typeName: "SCPI Command",
        tabId: LayoutModels.SCPI_TAB_ID,
        getObjects: projectStore =>
            (projectStore.project.scpi?.subsystems ?? []).flatMap(subsystem =>
                getArrayObjects(subsystem.commands, undefined, subsystem)
            ),
        // commands of the selected subsystem
        getNewObjectParent: projectStore => {
            const subsystem: any =
                projectStore.navigationStore.selectedScpiSubsystemObject.get();
            return subsystem &&
                projectStore.project.scpi?.subsystems.indexOf(subsystem) != -1
                ? subsystem.commands
                : undefined;
        },
        getSelectedObject: navigationStore =>
            navigationStore.selectedScpiCommandObject
    },
    arrayCollection({
        typeName: "SCPI Enum",
        tabId: LayoutModels.SCPI_TAB_ID,
        getArray: projectStore => projectStore.project.scpi?.enums,
        getSelectedObject: navigationStore =>
            navigationStore.selectedScpiEnumObject
    }),
    arrayCollection({
        typeName: "Instrument Command",
        tabId: LayoutModels.INSTRUMENT_COMMANDS_TAB_ID,
        getArray: projectStore =>
            projectStore.project.instrumentCommands?.commands,
        getSelectedObject: navigationStore =>
            navigationStore.selectedInstrumentCommandsObject
    }),
    arrayCollection({
        typeName: "Extension Definition",
        tabId: LayoutModels.EXTENSION_DEFINITIONS_TAB_ID,
        getArray: projectStore => projectStore.project.extensionDefinitions,
        getSelectedObject: navigationStore =>
            navigationStore.selectedExtensionDefinitionObject
    })
];

// selects the project explorer group (or the tab in the "Classic" layout)
// which shows the objects of the collection
function revealCollection(
    projectStore: ProjectStore,
    collection: IObjectCollection
) {
    if (collection.variablesSubNavigationItem) {
        runInAction(() => {
            projectStore.navigationStore.subnavigationSelectedItems[
                NavigationStore.VARIABLES_SUB_NAVIGATION_ID
            ] = collection.variablesSubNavigationItem!;
        });
    }

    projectStore.layoutModels.selectTab(
        projectStore.layoutModels.root,
        collection.tabId
    );
}

function showObject(
    projectStore: ProjectStore,
    collection: IObjectCollection,
    object: IEezObject
) {
    revealCollection(projectStore, collection);

    if (collection.getSelectedObject) {
        const selectedObject = collection.getSelectedObject(
            projectStore.navigationStore
        );
        runInAction(() => selectedObject.set(object));
    }

    projectStore.navigationStore.showObjects([object], true, true, true);
}

async function addNewObject(
    projectStore: ProjectStore,
    collection: IObjectCollection
) {
    const parent = collection.getNewObjectParent(projectStore);
    if (!parent) {
        return;
    }

    revealCollection(projectStore, collection);

    const newObject = await addItem(parent);
    if (newObject) {
        showObject(projectStore, collection, newObject);
    }
}

function getObjectItems(projectStore: ProjectStore) {
    const items: ICommandPaletteItem[] = [];

    for (const collection of OBJECT_COLLECTIONS) {
        for (const { object, owner } of collection.getObjects(projectStore)) {
            items.push({
                id: "object:" + items.length,
                label: objectToString(object),
                description: owner
                    ? `${collection.typeName} in ${objectToString(owner)}`
                    : collection.typeName,
                icon: getObjectIcon(object),
                run: () => showObject(projectStore, collection, object)
            });
        }
    }

    return items;
}

////////////////////////////////////////////////////////////////////////////////

const OUTPUT_PANELS = [
    { tabId: LayoutModels.CHECKS_TAB_ID, title: "Checks" },
    { tabId: LayoutModels.OUTPUT_TAB_ID, title: "Output" },
    { tabId: LayoutModels.SEARCH_TAB_ID, title: "Search" },
    { tabId: LayoutModels.REFERENCES_TAB_ID, title: "References" }
];

// undefined if the tab is not in the current layout
function getTabNode(projectStore: ProjectStore, tabId: string) {
    const node = projectStore.layoutModels.root.getNodeById(tabId);
    return node instanceof FlexLayout.TabNode ? node : undefined;
}

function isTabSelected(node: FlexLayout.TabNode) {
    const parent = node.getParent();
    return (
        (parent instanceof FlexLayout.BorderNode ||
            parent instanceof FlexLayout.TabSetNode) &&
        parent.getSelectedNode() == node
    );
}

function focusSearchInput() {
    // wait for the Search panel to be rendered
    let attempts = 20;
    const tryFocus = () => {
        const inputs = document.querySelectorAll<HTMLInputElement>(
            ".EezStudio_ProjectEditor_Search input.search-input"
        );
        for (const input of inputs) {
            if (input.offsetParent != null) {
                input.focus();
                input.select();
                return;
            }
        }
        if (--attempts > 0) {
            requestAnimationFrame(tryFocus);
        }
    };
    requestAnimationFrame(tryFocus);
}

function showProjectExplorerGroup(
    projectStore: ProjectStore,
    group: IProjectExplorerGroup
) {
    const layoutModels = projectStore.layoutModels;
    if (layoutModels.root == layoutModels.rootProjectExplorer) {
        selectProjectExplorerGroup(projectStore.navigationStore, group);
        layoutModels.selectTab(
            layoutModels.root,
            LayoutModels.PROJECT_EXPLORER_TAB_ID
        );
    } else {
        if (group.variablesSubNavigationItem) {
            runInAction(() => {
                projectStore.navigationStore.subnavigationSelectedItems[
                    NavigationStore.VARIABLES_SUB_NAVIGATION_ID
                ] = group.variablesSubNavigationItem!;
            });
        }
        layoutModels.selectTab(layoutModels.root, group.tabId);
    }
}

function isProjectExplorerGroupAvailable(
    projectStore: ProjectStore,
    group: IProjectExplorerGroup
) {
    const layoutModels = projectStore.layoutModels;
    if (layoutModels.root == layoutModels.rootProjectExplorer) {
        return (
            getTabNode(projectStore, LayoutModels.PROJECT_EXPLORER_TAB_ID) !=
            undefined
        );
    }
    // there is no "All" group in the "Classic" layout
    return (
        !isProjectExplorerAllGroup(group) &&
        getTabNode(projectStore, group.tabId) != undefined
    );
}

function getCommandItems(projectStore: ProjectStore) {
    const items: ICommandPaletteItem[] = [];

    const project = projectStore.project;
    const runtime = projectStore.runtime;
    const layoutModels = projectStore.layoutModels;
    const isDockerSimulatorMode = layoutModels.isDockerSimulatorMode;

    // New ...
    if (!runtime) {
        for (const collection of OBJECT_COLLECTIONS) {
            const parent = collection.getNewObjectParent(projectStore);
            if (parent && canAdd(parent)) {
                items.push({
                    id: "new:" + collection.typeName,
                    label: `New ${collection.typeName}...`,
                    icon: "material:add",
                    run: () => addNewObject(projectStore, collection)
                });
            }
        }
    }

    // Save, Check, Build
    if (!runtime) {
        if (projectStore.isModified) {
            items.push({
                id: "save",
                label: "Save",
                icon: "material:save",
                keybinding: "CmdOrCtrl+S",
                run: () => projectStore.save()
            });
        }

        if (project._fullyLoaded) {
            if (!projectStore.projectTypeTraits.isDashboard) {
                items.push({
                    id: "check",
                    label: "Check",
                    icon: "material:check",
                    keybinding: "CmdOrCtrl+K",
                    run: () => projectStore.check()
                });
            }

            if (
                !(
                    projectStore.filePath &&
                    isScrapbookItemFilePath(projectStore.filePath)
                )
            ) {
                items.push({
                    id: "build",
                    label: "Build",
                    icon: "material:build",
                    keybinding: "CmdOrCtrl+B",
                    run: () => projectStore.build()
                });
            }

            if (project.extensionDefinitions?.length > 0) {
                items.push(
                    {
                        id: "build-extensions",
                        label: "Build Extensions",
                        icon: "material:build",
                        run: () => projectStore.buildExtensions()
                    },
                    {
                        id: "build-and-install-extensions",
                        label: "Build and Install Extensions",
                        icon: "material:build",
                        run: () => projectStore.buildAndInstallExtensions()
                    }
                );
            }

            if (
                project.settings.general.projectType == ProjectType.FIRMWARE &&
                project.exportsObjects
            ) {
                items.push({
                    id: "exported-items",
                    label: "Exported Items...",
                    icon: "material:publish",
                    run: () => showExportedItemsDialog(projectStore)
                });
            }

            if (
                projectStore.projectTypeTraits.isResource &&
                project.micropython
            ) {
                items.push({
                    id: "run-micropython-script",
                    label: "Run MicroPython Script",
                    icon: RUN_ICON,
                    run: () => project.micropython.runScript()
                });
            }
        }
    }

    // Edit, Run, Debug, Full Simulator
    const hasRunEditSwitchControls =
        projectStore.context.type != "run-tab" &&
        !project._isDashboardBuild &&
        projectStore.projectTypeTraits.runtimeType != RuntimeType.NONE;

    if (hasRunEditSwitchControls) {
        if (runtime || isDockerSimulatorMode) {
            items.push({
                id: "edit-mode",
                label: "Edit",
                description: "Enter edit mode",
                icon: "material:mode_edit",
                keybinding: "Shift+F5",
                run: () => projectStore.onSetEditorMode()
            });
        }

        if (!(runtime && !runtime.isDebuggerActive) || isDockerSimulatorMode) {
            items.push({
                id: "run-mode",
                label: "Run",
                description: "Enter run mode",
                icon: RUN_ICON,
                keybinding: "F5",
                run: () => projectStore.onSetRuntimeMode()
            });
        }

        if (!runtime?.isDebuggerActive || isDockerSimulatorMode) {
            items.push({
                id: "debug-mode",
                label: "Debug",
                description: "Enter debug mode",
                icon: "material:bug_report",
                keybinding: "Ctrl+F5",
                run: () => projectStore.onSetDebuggerMode()
            });
        }

        if (
            projectStore.projectTypeTraits.isLVGL &&
            project.settings.build.useDockerDesktop &&
            !isDockerSimulatorMode
        ) {
            items.push({
                id: "full-simulator-mode",
                label: "Run in Full Simulator",
                icon: "material:computer",
                keybinding: "F7",
                run: () => projectStore.onSetFullSimulatorMode()
            });
        }
    }

    // debugger
    if (runtime && runtime.isDebuggerActive && !isDockerSimulatorMode) {
        if (runtime.isPaused) {
            items.push(
                {
                    id: "debugger-resume",
                    label: "Debugger: Resume",
                    keybinding: "F5",
                    run: () => runtime.resume()
                },
                {
                    id: "debugger-step-over",
                    label: "Debugger: Step Over",
                    keybinding: "F10",
                    run: () => runtime.runSingleStep("step-over")
                },
                {
                    id: "debugger-step-into",
                    label: "Debugger: Step Into",
                    keybinding: "F11",
                    run: () => runtime.runSingleStep("step-into")
                },
                {
                    id: "debugger-step-out",
                    label: "Debugger: Step Out",
                    keybinding: "Shift+F11",
                    run: () => runtime.runSingleStep("step-out")
                }
            );
        } else {
            items.push({
                id: "debugger-pause",
                label: "Debugger: Pause",
                keybinding: "F6",
                run: () => runtime.pause()
            });
        }
    }

    // Checks, Output, Search and References panels
    for (const panel of OUTPUT_PANELS) {
        const node = getTabNode(projectStore, panel.tabId);
        if (!node) {
            continue;
        }

        const isSelected = isTabSelected(node);

        if (panel.tabId == LayoutModels.SEARCH_TAB_ID) {
            items.push({
                id: "search",
                label: "Search",
                description: "Search the project",
                icon: "material:search",
                run: () => {
                    layoutModels.selectTab(layoutModels.root, panel.tabId);
                    focusSearchInput();
                }
            });
        } else if (!isSelected) {
            items.push({
                id: "show-panel:" + panel.tabId,
                label: `Show ${panel.title}`,
                run: () =>
                    layoutModels.selectTab(layoutModels.root, panel.tabId)
            });
        }

        // selecting the selected tab of the border closes the border
        if (isSelected && node.getParent() instanceof FlexLayout.BorderNode) {
            items.push({
                id: "hide-panel:" + panel.tabId,
                label: `Hide ${panel.title}`,
                run: () => {
                    const node = getTabNode(projectStore, panel.tabId);
                    if (node && isTabSelected(node)) {
                        layoutModels.root.doAction(
                            FlexLayout.Actions.selectTab(panel.tabId)
                        );
                    }
                }
            });
        }
    }

    if (getTabNode(projectStore, LayoutModels.REFERENCES_TAB_ID)) {
        items.push({
            id: "find-unused-objects",
            label: "Search for Unused Items",
            icon: "material:search",
            run: () => projectStore.findUnusedObjects()
        });
    }

    if (!(runtime && !runtime.isDebuggerActive)) {
        items.push({
            id: "find-project-component",
            label: "Find Project Component...",
            icon: "material:search",
            keybinding: "CmdOrCtrl+Shift+F",
            run: () => projectStore.findProjectComponent()
        });
    }

    // Show All, Show Pages, ...
    for (const group of getProjectExplorerGroups(projectStore)) {
        if (isProjectExplorerGroupAvailable(projectStore, group)) {
            items.push({
                id:
                    "show-group:" +
                    group.tabId +
                    "/" +
                    (group.variablesSubNavigationItem ?? ""),
                label: `Show ${group.title}`,
                icon: group.icon,
                run: () => showProjectExplorerGroup(projectStore, group)
            });
        }
    }

    // Settings, Readme, ...
    if (!runtime) {
        for (const featureItem of getProjectFeatureItems(projectStore)) {
            const editorComponent = getEditorComponent(featureItem, undefined);
            if (editorComponent) {
                const title = objectToString(featureItem);
                items.push({
                    id: "open-feature:" + title,
                    label: `Open ${title}`,
                    icon: getObjectIcon(featureItem),
                    run: () =>
                        projectStore.editorsStore.openEditor(
                            editorComponent.object,
                            editorComponent.subObject
                        )
                });
            }
        }
    }

    items.push({
        id: "scrapbook",
        label: "Open Scrapbook",
        run: () => showScrapbookManager()
    });

    if (!runtime) {
        if (!layoutModels.isProjectExplorerLayout) {
            items.push({
                id: "toggle-components-palette",
                label: settingsController.showComponentsPaletteInProjectEditor
                    ? "Hide Components Palette"
                    : "Show Components Palette",
                run: () => layoutModels.toggleComponentsPalette()
            });
        }

        items.push({
            id: "reset-layout",
            label: "Reset Layout",
            run: () => layoutModels.reset()
        });
    }

    return items;
}

////////////////////////////////////////////////////////////////////////////////

class CommandPaletteState {
    text: string;
    selectedIndex = 0;

    _objectItems: ICommandPaletteItem[] | undefined;
    _commandItems: ICommandPaletteItem[] | undefined;

    constructor(public projectStore: ProjectStore, mode: CommandPaletteMode) {
        this.text = mode == "commands" ? COMMANDS_PREFIX : "";

        makeObservable(this, {
            text: observable,
            selectedIndex: observable,
            mode: computed,
            query: computed,
            matchedItems: computed,
            setText: action,
            setSelectedIndex: action
        });
    }

    get mode(): CommandPaletteMode {
        return this.text.startsWith(COMMANDS_PREFIX) ? "commands" : "objects";
    }

    get query() {
        return (
            this.mode == "commands"
                ? this.text.substring(COMMANDS_PREFIX.length)
                : this.text
        ).trim();
    }

    // Items are collected when the palette is opened, i.e. they are not
    // updated while the palette is shown.

    get objectItems() {
        if (!this._objectItems) {
            this._objectItems = getObjectItems(this.projectStore);
        }
        return this._objectItems;
    }

    get commandItems() {
        if (!this._commandItems) {
            const items = getCommandItems(this.projectStore);

            // recently executed commands first
            const recentItems: ICommandPaletteItem[] = [];
            for (const id of recentCommandIds) {
                const i = items.findIndex(item => item.id == id);
                if (i != -1) {
                    recentItems.push(items[i]);
                    items.splice(i, 1);
                }
            }

            this._commandItems = [...recentItems, ...items];
        }
        return this._commandItems;
    }

    get matchedItems() {
        return filterItems(
            this.mode == "commands" ? this.commandItems : this.objectItems,
            this.query
        );
    }

    setText(text: string) {
        this.text = text;
        this.selectedIndex = 0;
    }

    setSelectedIndex(index: number) {
        this.selectedIndex = index;
    }
}

////////////////////////////////////////////////////////////////////////////////

const HighlightedLabel = ({
    label,
    positions
}: {
    label: string;
    positions: number[];
}) => {
    if (positions.length == 0) {
        return <>{label}</>;
    }

    const highlighted = new Set(positions);

    // split the label into the runs of highlighted and not highlighted chars
    const parts: React.ReactNode[] = [];
    let start = 0;
    for (let i = 1; i <= label.length; i++) {
        if (
            i == label.length ||
            highlighted.has(i) != highlighted.has(start)
        ) {
            const text = label.substring(start, i);
            parts.push(
                highlighted.has(start) ? (
                    <span
                        key={start}
                        className="EezStudio_CommandPalette_Highlight"
                    >
                        {text}
                    </span>
                ) : (
                    text
                )
            );
            start = i;
        }
    }

    return <>{parts}</>;
};

const CommandPalette = observer(
    class CommandPalette extends React.Component<{
        state: CommandPaletteState;
        onRun: (item: ICommandPaletteItem) => void;
        onCancel: () => void;
        onBlur: () => void;
    }> {
        inputRef = React.createRef<HTMLInputElement>();
        listRef = React.createRef<HTMLDivElement>();

        componentDidMount() {
            this.focus();
        }

        componentDidUpdate() {
            const selected =
                this.listRef.current?.querySelector<HTMLElement>(
                    ".EezStudio_CommandPalette_Item.selected"
                );
            selected?.scrollIntoView({ block: "nearest" });
        }

        focus() {
            const input = this.inputRef.current;
            if (input) {
                input.focus();
                // caret at the end
                input.setSelectionRange(
                    input.value.length,
                    input.value.length
                );
            }
        }

        get visibleItems() {
            return this.props.state.matchedItems.slice(0, MAX_ITEMS);
        }

        onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            this.props.state.setText(event.target.value);
        };

        onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
            const { state } = this.props;
            const n = this.visibleItems.length;

            let handled = true;

            if (event.key == "ArrowDown") {
                if (n > 0) {
                    state.setSelectedIndex((state.selectedIndex + 1) % n);
                }
            } else if (event.key == "ArrowUp") {
                if (n > 0) {
                    state.setSelectedIndex((state.selectedIndex - 1 + n) % n);
                }
            } else if (event.key == "PageDown") {
                if (n > 0) {
                    state.setSelectedIndex(
                        Math.min(state.selectedIndex + 10, n - 1)
                    );
                }
            } else if (event.key == "PageUp") {
                if (n > 0) {
                    state.setSelectedIndex(
                        Math.max(state.selectedIndex - 10, 0)
                    );
                }
            } else if (event.key == "Enter") {
                const matchedItem = this.visibleItems[state.selectedIndex];
                if (matchedItem) {
                    this.props.onRun(matchedItem.item);
                }
            } else if (event.key == "Escape") {
                this.props.onCancel();
            } else {
                handled = false;
            }

            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        render() {
            const { state } = this.props;
            const matchedItems = state.matchedItems;
            const visibleItems = this.visibleItems;

            return (
                <div className="EezStudio_CommandPalette shadow">
                    <input
                        ref={this.inputRef}
                        className="form-control EezStudio_CommandPalette_Input"
                        type="text"
                        spellCheck={false}
                        value={state.text}
                        placeholder={
                            "Search objects by name, type " +
                            COMMANDS_PREFIX +
                            " to search commands"
                        }
                        onChange={this.onChange}
                        onKeyDown={this.onKeyDown}
                        onBlur={this.props.onBlur}
                    />
                    <div
                        ref={this.listRef}
                        className="EezStudio_CommandPalette_List"
                        // keep the focus in the input
                        onMouseDown={event => event.preventDefault()}
                    >
                        {visibleItems.map(({ item, positions }, i) => (
                            <div
                                key={item.id}
                                className={classNames(
                                    "EezStudio_CommandPalette_Item",
                                    { selected: i == state.selectedIndex }
                                )}
                                onMouseMove={() => {
                                    if (i != state.selectedIndex) {
                                        state.setSelectedIndex(i);
                                    }
                                }}
                                onClick={() => this.props.onRun(item)}
                            >
                                <span className="EezStudio_CommandPalette_ItemIcon">
                                    {item.icon && (
                                        <Icon icon={item.icon} size={16} />
                                    )}
                                </span>
                                <span className="EezStudio_CommandPalette_ItemLabel">
                                    <HighlightedLabel
                                        label={item.label}
                                        positions={positions}
                                    />
                                </span>
                                {item.description && (
                                    <span className="EezStudio_CommandPalette_ItemDescription">
                                        {item.description}
                                    </span>
                                )}
                                {item.keybinding && (
                                    <span className="EezStudio_CommandPalette_ItemKeybinding">
                                        {formatKeybinding(item.keybinding)}
                                    </span>
                                )}
                            </div>
                        ))}
                        {matchedItems.length == 0 && (
                            <div className="EezStudio_CommandPalette_Message">
                                {state.mode == "commands"
                                    ? "No matching commands"
                                    : "No matching objects"}
                            </div>
                        )}
                        {matchedItems.length > visibleItems.length && (
                            <div className="EezStudio_CommandPalette_Message">
                                {`Showing ${visibleItems.length} of ${matchedItems.length} items, type more to narrow the search`}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
    }
);

////////////////////////////////////////////////////////////////////////////////

let openedPalette:
    | {
          state: CommandPaletteState;
          close: (restoreFocus: boolean) => void;
          focus: () => void;
      }
    | undefined;

export function showCommandPalette(
    projectStore: ProjectStore,
    mode: CommandPaletteMode
) {
    if (openedPalette) {
        if (openedPalette.state.projectStore == projectStore) {
            // already opened, just switch the mode
            const state = openedPalette.state;
            if (state.mode != mode) {
                state.setText(mode == "commands" ? COMMANDS_PREFIX : "");
            }
            openedPalette.focus();
            return;
        }
        openedPalette.close(false);
    }

    const previouslyFocusedElement =
        document.activeElement instanceof HTMLElement
            ? document.activeElement
            : undefined;

    const state = new CommandPaletteState(projectStore, mode);

    const element = document.createElement("div");
    element.className = "EezStudio_CommandPaletteContainer";
    document.body.appendChild(element);

    const root: Root = createRoot(element);
    const paletteRef = React.createRef<InstanceType<typeof CommandPalette>>();

    let closed = false;

    const close = (restoreFocus: boolean) => {
        if (closed) {
            return;
        }
        closed = true;

        if (openedPalette?.state == state) {
            openedPalette = undefined;
        }

        root.unmount();
        element.remove();

        if (
            restoreFocus &&
            previouslyFocusedElement &&
            previouslyFocusedElement.isConnected
        ) {
            previouslyFocusedElement.focus();
        }
    };

    const onRun = (item: ICommandPaletteItem) => {
        if (state.mode == "commands") {
            addRecentCommand(item.id);
        }

        close(true);

        try {
            item.run();
        } catch (err) {
            console.error(err);
        }
    };

    openedPalette = {
        state,
        close,
        focus: () => paletteRef.current?.focus()
    };

    root.render(
        <CommandPalette
            ref={paletteRef}
            state={state}
            onRun={onRun}
            onCancel={() => close(true)}
            // closed when clicked outside or the window lost the focus
            onBlur={() => close(false)}
        />
    );
}

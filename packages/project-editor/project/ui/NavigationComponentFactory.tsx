import { action, runInAction } from "mobx";

import { IEezObject } from "project-editor/core/object";

import { Settings } from "project-editor/project/project";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

import { Action } from "project-editor/features/action/action";
import {
    getAncestorOfType,
    getProjectStore,
    LayoutModels
} from "project-editor/store";
import { Bitmap } from "project-editor/features/bitmap/bitmap";
import { Font, Glyph } from "project-editor/features/font/font";
import { Page } from "project-editor/features/page/page";
import {
    Scpi,
    ScpiCommand,
    ScpiSubsystem
} from "project-editor/features/scpi/scpi";
import { Style } from "project-editor/features/style/style";
import {
    Structure,
    Variable,
    Enum
} from "project-editor/features/variable/variable";
import { Component } from "project-editor/flow/component";
import { ScpiEnum } from "project-editor/features/scpi/enum";
import { ConnectionLine } from "project-editor/flow/connection-line";
import { Language, TextResource } from "project-editor/features/texts";
import { LVGLStyle } from "project-editor/lvgl/style";
import { NavigationStore } from "project-editor/store/navigation";
import { ProjectEditor } from "project-editor/project-editor-interface";

export function getNavigationObject(
    object: IEezObject
): IEezObject | undefined {
    let ancestor;

    ancestor = getAncestorOfType(object, Component.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, ConnectionLine.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Action.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Bitmap.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, ExtensionDefinition.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Glyph.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Font.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Page.classInfo);
    if (ancestor) {
        const variable = getAncestorOfType(object, Variable.classInfo);
        if (variable) {
            return variable;
        }
        return ancestor;
    }

    ancestor = getAncestorOfType(object, ScpiSubsystem.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, ScpiCommand.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, ScpiEnum.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Scpi.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Style.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, LVGLStyle.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Variable.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Structure.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Enum.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, Settings.classInfo);
    if (ancestor) {
        return ancestor;
    }

    ancestor = getAncestorOfType(object, TextResource.classInfo);
    if (ancestor) {
        return ancestor;
    }

    return undefined;
}

export const navigateTo = action((object: IEezObject) => {
    const projectStore = getProjectStore(object);
    const project = projectStore.project;

    let ancestor;

    ancestor = getAncestorOfType(object, Variable.classInfo);
    if (ancestor) {
        const isLocal = ProjectEditor.getFlow(object) != undefined;

        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.VARIABLES_TAB_ID
        );

        projectStore.navigationStore.subnavigationSelectedItems[
            NavigationStore.VARIABLES_SUB_NAVIGATION_ID
        ] = isLocal
            ? NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_LOCAL
            : NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_GLOBAL;

        if (object instanceof Variable) {
            runInAction(() => {
                if (isLocal) {
                    projectStore.navigationStore.selectedLocalVariable.set(
                        object
                    );
                } else {
                    projectStore.navigationStore.selectedGlobalVariableObject.set(
                        object
                    );
                }
            });
        }

        return;
    }

    ancestor = getAncestorOfType(object, Page.classInfo) as Page;
    if (ancestor) {
        if (ancestor.isUsedAsUserWidget) {
            projectStore.layoutModels.selectTab(
                projectStore.layoutModels.root,
                LayoutModels.USER_WIDGETS_TAB_ID
            );
        } else {
            projectStore.layoutModels.selectTab(
                projectStore.layoutModels.root,
                LayoutModels.PAGES_TAB_ID
            );
        }

        const variable = getAncestorOfType(object, Variable.classInfo);
        if (variable) {
            projectStore.layoutModels.selectTab(
                projectStore.layoutModels.root,
                LayoutModels.VARIABLES_TAB_ID
            );

            projectStore.navigationStore.subnavigationSelectedItems[
                NavigationStore.VARIABLES_SUB_NAVIGATION_ID
            ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_LOCAL;
        }

        return;
    }

    ancestor = getAncestorOfType(object, Action.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.ACTIONS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Bitmap.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.BITMAPS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, ExtensionDefinition.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.EXTENSION_DEFINITIONS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Font.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.FONTS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Scpi.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.SCPI_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Style.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.STYLES_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Structure.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.VARIABLES_TAB_ID
        );
        projectStore.navigationStore.subnavigationSelectedItems[
            NavigationStore.VARIABLES_SUB_NAVIGATION_ID
        ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_STRUCTS;

        if (object instanceof Structure) {
            runInAction(() => {
                projectStore.navigationStore.selectedStructureObject.set(
                    object
                );
            });
        }
        return;
    }

    ancestor = getAncestorOfType(object, Enum.classInfo);
    if (ancestor) {
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.root,
            LayoutModels.VARIABLES_TAB_ID
        );
        projectStore.navigationStore.subnavigationSelectedItems[
            NavigationStore.VARIABLES_SUB_NAVIGATION_ID
        ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_ENUMS;

        if (object instanceof Enum) {
            runInAction(() => {
                projectStore.navigationStore.selectedEnumObject.set(object);
            });
        }
        return;
    }

    if (getAncestorOfType(object, Settings.classInfo)) {
        projectStore.editorsStore.openEditor(project.settings, object);
        return;
    }
});

export function selectObject(object: IEezObject) {
    const projectStore = getProjectStore(object);
    const project = projectStore.project;

    let ancestor;

    ancestor = getAncestorOfType(object, Action.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedActionObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, Bitmap.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedBitmapObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, ExtensionDefinition.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedExtensionDefinitionObject.set(
            ancestor
        );
        return;
    }

    ancestor = getAncestorOfType(object, Font.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedFontObject.set(ancestor);
        ancestor = getAncestorOfType(object, Glyph.classInfo);
        if (ancestor) {
            projectStore.navigationStore.selectedGlyphObject.set(ancestor);
        }
        return;
    }

    ancestor = getAncestorOfType<Page>(object, Page.classInfo);
    if (ancestor) {
        const variable = getAncestorOfType(object, Variable.classInfo);
        if (variable) {
            projectStore.layoutModels.selectTab(
                projectStore.layoutModels.root,
                LayoutModels.VARIABLES_TAB_ID
            );

            projectStore.navigationStore.selectedLocalVariable.set(variable);

            projectStore.navigationStore.subnavigationSelectedItems[
                NavigationStore.VARIABLES_SUB_NAVIGATION_ID
            ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_LOCAL;
        } else {
            if (ancestor.isUsedAsUserWidget) {
                projectStore.navigationStore.selectedUserWidgetObject.set(
                    ancestor
                );
            } else {
                projectStore.navigationStore.selectedUserPageObject.set(
                    ancestor
                );
            }
        }

        return;
    }

    ancestor = getAncestorOfType(object, Scpi.classInfo);
    if (ancestor) {
        ancestor = getAncestorOfType(object, ScpiEnum.classInfo);
        if (ancestor) {
            projectStore.navigationStore.selectedEnumObject.set(ancestor);
            projectStore.layoutModels.selectTab(
                projectStore.layoutModels.scpi,
                LayoutModels.SCPI_ENUMS_TAB_ID
            );
            return;
        }

        ancestor = getAncestorOfType(object, ScpiSubsystem.classInfo);
        if (ancestor) {
            projectStore.navigationStore.selectedScpiSubsystemObject.set(
                ancestor
            );

            projectStore.layoutModels.selectTab(
                projectStore.layoutModels.scpi,
                LayoutModels.SCPI_SUBSYSTEMS_TAB_ID
            );

            const ancestorCommand = getAncestorOfType(
                object,
                ScpiCommand.classInfo
            );

            if (ancestorCommand) {
                projectStore.navigationStore.selectedScpiCommandObject.set(
                    ancestorCommand
                );

                projectStore.layoutModels.selectTab(
                    projectStore.layoutModels.scpi,
                    LayoutModels.SCPI_COMMANDS_TAB_ID
                );

                projectStore.editorsStore.openEditor(
                    project.scpi,
                    ancestorCommand
                );
            } else {
                projectStore.editorsStore.openEditor(project.scpi, ancestor);
            }
        }

        return;
    }

    ancestor = getAncestorOfType(object, Style.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedStyleObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, Variable.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedGlobalVariableObject.set(ancestor);
        projectStore.navigationStore.subnavigationSelectedItems[
            NavigationStore.VARIABLES_SUB_NAVIGATION_ID
        ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_GLOBAL;
        return;
    }

    ancestor = getAncestorOfType(object, Structure.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedStructureObject.set(ancestor);
        projectStore.navigationStore.subnavigationSelectedItems[
            NavigationStore.VARIABLES_SUB_NAVIGATION_ID
        ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_STRUCTS;
        return;
    }

    ancestor = getAncestorOfType(object, Enum.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedEnumObject.set(ancestor);
        projectStore.navigationStore.subnavigationSelectedItems[
            NavigationStore.VARIABLES_SUB_NAVIGATION_ID
        ] = NavigationStore.VARIABLES_SUB_NAVIGATION_ITEM_ENUMS;
        return;
    }

    ancestor = getAncestorOfType(object, Language.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedEnumObject.set(ancestor);
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.texts,
            LayoutModels.LANGUAGES_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, TextResource.classInfo);
    if (ancestor) {
        projectStore.navigationStore.selectedEnumObject.set(ancestor);
        projectStore.layoutModels.selectTab(
            projectStore.layoutModels.texts,
            LayoutModels.TEXT_RESOURCES_TAB_ID
        );
        return;
    }
}

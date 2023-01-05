import { action } from "mobx";

import { IEezObject } from "project-editor/core/object";

import { getProject, Settings } from "project-editor/project/project";

import { ActionsNavigation } from "project-editor/features/action/ActionsNavigation";
import { BitmapsNavigation } from "project-editor/features/bitmap/BitmapsNavigation";
import {
    ExtensionDefinition,
    ExtensionDefinitionNavigation
} from "project-editor/features/extension-definitions/extension-definitions";
import { FontsNavigation } from "project-editor/features/font/FontsNavigation";
import { PagesNavigation } from "project-editor/features/page/PagesNavigation";
import { ScpiNavigation } from "project-editor/features/scpi/ScpiNavigation";
import { StylesNavigation } from "project-editor/features/style/StylesNavigation";
import { ProjectVariablesNavigation } from "project-editor/features/variable/VariablesNavigation";
import { SettingsNavigation } from "./SettingsNavigation";

import { NavigationComponent } from "project-editor/project/NavigationComponent";
import { Action } from "project-editor/features/action/action";
import {
    getAncestorOfType,
    getProjectEditorStore,
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
import { ConnectionLine } from "project-editor/flow/flow";
import { TextsNavigation } from "project-editor/features/texts/navigation";
import { Language, TextResource } from "project-editor/features/texts";
import { ReadmeNavigation } from "project-editor/features/readme/navigation";
import { ChangesNavigation } from "project-editor/features/changes/navigation";
import { LVGLStyle, LVGLStylesNavigation } from "project-editor/lvgl/style";

export function getNavigationComponentId(object: IEezObject) {
    const project = getProject(object);

    if (object == project.actions) {
        return "actions";
    } else if (object == project.bitmaps) {
        return "bitmaps";
    } else if (object == project.extensionDefinitions) {
        return "iext";
    } else if (object == project.fonts) {
        return "fonts";
    } else if (object == project.pages) {
        return "pages";
    } else if (object == project.scpi) {
        return "scpi";
    } else if (object == project.styles) {
        return "styles";
    } else if (object == project.variables) {
        return "variables";
    } else if (object == project.settings) {
        return "settings";
    }

    return undefined;
}

export function getNavigationComponent(
    object: IEezObject
): typeof NavigationComponent | undefined {
    const project = getProject(object);

    if (object == project.actions) {
        return ActionsNavigation;
    }

    if (object == project.bitmaps) {
        return BitmapsNavigation;
    }

    if (object == project.extensionDefinitions) {
        return ExtensionDefinitionNavigation;
    }

    if (object == project.fonts) {
        return FontsNavigation;
    }

    if (object == project.pages) {
        return PagesNavigation;
    }

    if (object == project.scpi) {
        return ScpiNavigation;
    }

    if (object == project.styles) {
        return StylesNavigation;
    }

    if (object == project.lvglStyles) {
        return LVGLStylesNavigation;
    }

    if (object == project.variables) {
        return ProjectVariablesNavigation;
    }

    if (object == project.settings) {
        if (
            !(
                project.projectTypeTraits.isDashboard ||
                project.projectTypeTraits.isApplet
            )
        ) {
            return SettingsNavigation;
        }
    }

    if (object == project.texts) {
        return TextsNavigation;
    }

    if (object == project.readme) {
        return ReadmeNavigation;
    }

    if (object == project.changes) {
        return ChangesNavigation;
    }

    return undefined;
}

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
    const projectEditorStore = getProjectEditorStore(object);
    const project = projectEditorStore.project;

    let ancestor;

    ancestor = getAncestorOfType(object, Action.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.actions
        );
        return;
    }

    ancestor = getAncestorOfType(object, Bitmap.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.bitmaps
        );
        return;
    }

    ancestor = getAncestorOfType(object, ExtensionDefinition.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.extensionDefinitions
        );
        return;
    }

    ancestor = getAncestorOfType(object, Font.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.fonts
        );
        return;
    }

    ancestor = getAncestorOfType(object, Page.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.pages
        );
        return;
    }

    ancestor = getAncestorOfType(object, Scpi.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(project.scpi);
        return;
    }

    ancestor = getAncestorOfType(object, Style.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.styles
        );
        return;
    }

    ancestor = getAncestorOfType(object, Variable.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.variables
        );
        return;
    }

    ancestor = getAncestorOfType(object, Structure.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.variables
        );
        return;
    }

    ancestor = getAncestorOfType(object, Enum.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.variables
        );
        return;
    }

    if (getAncestorOfType(object, Settings.classInfo)) {
        // TODO
        projectEditorStore.navigationStore.selectedRootObject.set(
            project.settings
        );
        return;
    }
});

export function selectObject(object: IEezObject) {
    const projectEditorStore = getProjectEditorStore(object);
    const project = projectEditorStore.project;

    let ancestor;

    ancestor = getAncestorOfType(object, Action.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedActionObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, Bitmap.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedBitmapObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, ExtensionDefinition.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedExtensionDefinitionObject.set(
            ancestor
        );
        return;
    }

    ancestor = getAncestorOfType(object, Font.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedFontObject.set(ancestor);
        ancestor = getAncestorOfType(object, Glyph.classInfo);
        if (ancestor) {
            projectEditorStore.navigationStore.selectedGlyphObject.set(
                ancestor
            );
        }
        return;
    }

    ancestor = getAncestorOfType(object, Page.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedPageObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, Scpi.classInfo);
    if (ancestor) {
        ancestor = getAncestorOfType(object, ScpiEnum.classInfo);
        if (ancestor) {
            projectEditorStore.navigationStore.selectedEnumObject.set(ancestor);
            projectEditorStore.layoutModels.selectTab(
                projectEditorStore.layoutModels.scpi,
                LayoutModels.SCPI_ENUMS_TAB_ID
            );
            return;
        }

        ancestor = getAncestorOfType(object, ScpiSubsystem.classInfo);
        if (ancestor) {
            projectEditorStore.navigationStore.selectedScpiSubsystemObject.set(
                ancestor
            );

            projectEditorStore.layoutModels.selectTab(
                projectEditorStore.layoutModels.scpi,
                LayoutModels.SCPI_SUBSYSTEMS_TAB_ID
            );

            const ancestorCommand = getAncestorOfType(
                object,
                ScpiCommand.classInfo
            );

            if (ancestorCommand) {
                projectEditorStore.navigationStore.selectedScpiCommandObject.set(
                    ancestorCommand
                );

                projectEditorStore.layoutModels.selectTab(
                    projectEditorStore.layoutModels.scpi,
                    LayoutModels.SCPI_COMMANDS_TAB_ID
                );

                projectEditorStore.editorsStore.openEditor(
                    project.scpi,
                    ancestorCommand
                );
            } else {
                projectEditorStore.editorsStore.openEditor(
                    project.scpi,
                    ancestor
                );
            }
        }

        return;
    }

    ancestor = getAncestorOfType(object, Style.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedStyleObject.set(ancestor);
        return;
    }

    ancestor = getAncestorOfType(object, Variable.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedGlobalVariableObject.set(
            ancestor
        );
        projectEditorStore.layoutModels.selectTab(
            projectEditorStore.layoutModels.variables,
            LayoutModels.GLOBAL_VARS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Structure.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedStructureObject.set(
            ancestor
        );
        projectEditorStore.layoutModels.selectTab(
            projectEditorStore.layoutModels.variables,
            LayoutModels.STRUCTS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Enum.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedEnumObject.set(ancestor);
        projectEditorStore.layoutModels.selectTab(
            projectEditorStore.layoutModels.variables,
            LayoutModels.ENUMS_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, Language.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedEnumObject.set(ancestor);
        projectEditorStore.layoutModels.selectTab(
            projectEditorStore.layoutModels.texts,
            LayoutModels.LANGUAGES_TAB_ID
        );
        return;
    }

    ancestor = getAncestorOfType(object, TextResource.classInfo);
    if (ancestor) {
        projectEditorStore.navigationStore.selectedEnumObject.set(ancestor);
        projectEditorStore.layoutModels.selectTab(
            projectEditorStore.layoutModels.texts,
            LayoutModels.TEXT_RESOURCES_TAB_ID
        );
        return;
    }
}

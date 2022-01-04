import { IEezObject } from "project-editor/core/object";

import { getProject } from "project-editor/project/project";

import { ActionsNavigation } from "project-editor/features/action/ActionsNavigation";
import { BitmapsNavigation } from "project-editor/features/bitmap/BitmapsNavigation";
import { ExtensionDefinitionNavigation } from "project-editor/features/extension-definitions/extension-definitions";
import { FontsNavigation } from "project-editor/features/font/FontsNavigation";
import { PagesNavigation } from "project-editor/features/page/PagesNavigation";
import { ScpiNavigation } from "project-editor/features/scpi/ScpiNavigation";
import { StylesNavigation } from "project-editor/features/style/StylesNavigation";
import { ProjectVariablesNavigation } from "project-editor/features/variable/VariablesNavigation";
import { SettingsNavigation } from "./SettingsNavigation";

import { NavigationComponent } from "project-editor/project/NavigationComponent";

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

    if (object == project.variables) {
        return ProjectVariablesNavigation;
    }

    if (object == project.settings) {
        if (!(project.isDashboardProject || project.isAppletProject)) {
            return SettingsNavigation;
        }
    }

    return undefined;
}

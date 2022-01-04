import { IEezObject, isAncestor } from "project-editor/core/object";

import { getProject } from "project-editor/project/project";

import { EditorComponent } from "project-editor/project/EditorComponent";
import { Action } from "project-editor/features/action/action";
import {
    ActionEditor,
    ActionFlowTabState
} from "project-editor/features/action/ActionEditor";
import { FontEditor } from "project-editor/features/font/FontEditor";
import { MicroPythonEditor } from "project-editor/features/micropython/micropython";
import {
    PageEditor,
    PageTabState
} from "project-editor/features/page/PageEditor";
import { ScpiHelpPreview } from "project-editor/features/scpi/ScpiNavigation";
import { ShortcutsEditor } from "project-editor/features/shortcuts/project-shortcuts";
import { SettingsEditor } from "./SettingsNavigation";
import { Page } from "project-editor/features/page/page";
import { Font } from "project-editor/features/font/font";

export function getEditorComponent(
    object: IEezObject
): typeof EditorComponent | undefined {
    const project = getProject(object);

    if (object instanceof Action) {
        if (object.implementationType === "flow") {
            return ActionEditor;
        }
    }

    if (object instanceof Font) {
        return FontEditor;
    }

    if (object == project.micropython) {
        return MicroPythonEditor;
    }

    if (object instanceof Page) {
        return PageEditor;
    }

    if (object == project.scpi) {
        return ScpiHelpPreview;
    }

    if (object == project.shortcuts) {
        return ShortcutsEditor;
    }

    if (isAncestor(object, project.settings)) {
        return SettingsEditor;
    }

    return undefined;
}

export function createEditorState(object: IEezObject) {
    const project = getProject(object);

    if (isAncestor(object, project.actions)) {
        const action = object as Action;
        if (action.implementationType === "flow") {
            return new ActionFlowTabState(action);
        }
    }

    if (isAncestor(object, project.pages)) {
        return new PageTabState(object as Page);
    }

    return undefined;
}

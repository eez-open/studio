import { getParent, IEezObject, isAncestor } from "project-editor/core/object";

import { getProject } from "project-editor/project/project";

import {
    EditorComponent,
    IEditorState
} from "project-editor/project/ui/EditorComponent";
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
import { InstrumentCommandHelpPreview } from "project-editor/features/instrument-commands/InstrumentCommandsNavigation";
import { ShortcutsEditor } from "project-editor/features/shortcuts/project-shortcuts";
import { SettingsEditor } from "./SettingsNavigation";
import { Page } from "project-editor/features/page/page";
import { Font } from "project-editor/features/font/font";
import { ScpiCommand, ScpiSubsystem } from "project-editor/features/scpi/scpi";
import { getAncestorOfType } from "project-editor/store";
import { ReadmeEditor } from "project-editor/features/readme/navigation";
import { ChangesEditor } from "project-editor/features/changes/editor";

export function getEditorComponent(
    object: IEezObject,
    params: any
):
    | {
          object: IEezObject;
          subObject?: IEezObject;
          EditorComponent: typeof EditorComponent;
      }
    | undefined {
    const project = getProject(object);

    if (object instanceof Action && project.projectTypeTraits.hasFlowSupport) {
        return { object, EditorComponent: ActionEditor };
    }

    if (object instanceof Font) {
        return { object, EditorComponent: FontEditor };
    }

    if (object == project.micropython) {
        return { object, EditorComponent: MicroPythonEditor };
    }

    if (object instanceof Page) {
        return { object, EditorComponent: PageEditor };
    }

    if (isAncestor(object, project.scpi)) {
        let subObject = getAncestorOfType(object, ScpiCommand.classInfo);
        if (!subObject) {
            subObject = getAncestorOfType(object, ScpiSubsystem.classInfo);
        }
        return {
            object: project.scpi,
            subObject: object,
            EditorComponent: ScpiHelpPreview
        };
    }

    if (isAncestor(object, project.instrumentCommands)) {
        return {
            object: project.instrumentCommands,
            subObject: object,
            EditorComponent: InstrumentCommandHelpPreview
        };
    }

    if (object == project.shortcuts) {
        return { object, EditorComponent: ShortcutsEditor };
    }

    if (isAncestor(object, project.settings)) {
        return {
            object: project.settings,
            subObject: object,
            EditorComponent: SettingsEditor
        };
    }

    if (isAncestor(object, project.readme)) {
        return {
            object: project.readme,
            subObject: object,
            EditorComponent: ReadmeEditor
        };
    }

    if (isAncestor(object, project.changes)) {
        return {
            object: project.changes,
            EditorComponent: ChangesEditor
        };
    }

    return undefined;
}

export function getAncestorWithEditorComponent(object: IEezObject) {
    while (object) {
        const result = getEditorComponent(object, undefined);
        if (result) {
            return result;
        }
        object = getParent(object);
    }

    return undefined;
}

export function createEditorState(object: IEezObject) {
    const project = getProject(object);

    let state: IEditorState | undefined;

    if (isAncestor(object, project.actions)) {
        const action = object as Action;
        state = new ActionFlowTabState(action);
    } else if (
        isAncestor(object, project.userPages) ||
        isAncestor(object, project.userWidgets)
    ) {
        state = new PageTabState(object as Page);
    }

    if (state && state.loadState) {
        state.loadState(undefined);
    }

    return state;
}

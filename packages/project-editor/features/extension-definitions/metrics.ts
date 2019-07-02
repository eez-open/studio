import { EezArrayObject, getProperty } from "project-editor/model/object";
import { Project } from "project-editor/project/project";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: Project): { [key: string]: string | number } {
    let extensionDefinitions = getProperty(project, "extensionDefinitions") as EezArrayObject<
        ExtensionDefinition
    >;

    return {
        "IEXT definitions": extensionDefinitions._array.length
    };
}

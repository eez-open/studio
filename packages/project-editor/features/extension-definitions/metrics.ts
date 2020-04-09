import { getProperty } from "project-editor/core/object";
import { Project } from "project-editor/project/project";

import { ExtensionDefinition } from "project-editor/features/extension-definitions/extension-definitions";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: Project): { [key: string]: string | number } {
    let extensionDefinitions = getProperty(
        project,
        "extensionDefinitions"
    ) as ExtensionDefinition[];
    return {
        "IEXT definitions": extensionDefinitions.length
    };
}

import { ProjectProperties } from "project-editor/project/project";

import { ExtensionDefinitionProperties } from "project-editor/project/features/extension-definitions/extension-definitions";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let extensionDefinitions = project["extensionDefinitions"] as ExtensionDefinitionProperties[];

    return {
        "Extension definitions": extensionDefinitions.length
    };
}

import { ProjectProperties } from "project-editor/project/project";

import { ActionProperties } from "project-editor/project/features/action/action";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let projectActions = project["actions"] as ActionProperties[];

    return {
        Actions: projectActions.length
    };
}

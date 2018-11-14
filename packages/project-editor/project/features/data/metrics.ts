import { ProjectProperties } from "project-editor/project/project";

import { DataItemProperties } from "project-editor/project/features/data/data";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let projectDataItems = project["data"] as DataItemProperties[];

    return {
        "Data items": projectDataItems.length
    };
}

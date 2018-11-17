import { getProperty } from "project-editor/core/store";

import { ProjectProperties } from "project-editor/project/project";

import { ScpiProperties } from "project-editor/project/features/scpi/scpi";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: ProjectProperties): { [key: string]: string | number } {
    let scpi = getProperty(project, "scpi") as ScpiProperties;

    return {
        SCPI: "",
        "<span class='td-indent'>Commands</span>": scpi.subsystems._array.reduce(
            (c, s) => c + s.commands._array.reduce(c => c + 1, 0),
            0
        )
    };
}

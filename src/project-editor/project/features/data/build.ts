import { BuildResult } from "project-editor/core/extensions";

import { ProjectProperties } from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";

import { DataItemProperties } from "project-editor/project/features/data/data";

////////////////////////////////////////////////////////////////////////////////

function buildDataEnum(project: ProjectProperties) {
    let projectDataItems = project["data"] as DataItemProperties[];

    let dataItems = projectDataItems.map(
        (dataItem, index) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "DATA_ID_",
                dataItem.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )}`
    );

    dataItems.unshift(`${projectBuild.TAB}DATA_ID_NONE`);

    return `enum DataEnum {\n${dataItems.join(",\n")}\n};`;
}

export function build(project: ProjectProperties): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        resolve({
            DATA_ENUM: buildDataEnum(project)
        });
    });
}

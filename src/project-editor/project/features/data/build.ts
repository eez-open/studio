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

function buildDataFuncsDecl(project: ProjectProperties) {
    let projectDataItems = project["data"] as DataItemProperties[];

    let dataItems = projectDataItems.map(dataItem => {
        return `void ${projectBuild.getName(
            "data_",
            dataItem.name,
            projectBuild.NamingConvention.UnderscoreLowerCase
        )}(DataOperationEnum operation, Cursor &cursor, Value &value);`;
    });

    return dataItems.join("\n");
}

function buildDataArrayDecl(project: ProjectProperties) {
    return "typedef void (*DataOperationsFunction)(DataOperationEnum operation, Cursor &cursor, Value &value);\n\nextern DataOperationsFunction g_dataOperationsFunctions[];";
}

function buildDataArrayDef(project: ProjectProperties) {
    let projectDataItems = project["data"] as DataItemProperties[];

    let dataItems = projectDataItems.map(
        dataItem =>
            `${projectBuild.TAB}${projectBuild.getName(
                "data_",
                dataItem.name,
                projectBuild.NamingConvention.UnderscoreLowerCase
            )}`
    );

    return `DataOperationsFunction g_dataOperationsFunctions[] = {\n${
        projectBuild.TAB
    }0,\n${dataItems.join(",\n")}\n};`;
}

export function build(
    project: ProjectProperties,
    sectionNames: string[] | undefined
): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const result: any = {};

        if (!sectionNames || sectionNames.indexOf("DATA_ENUM") !== -1) {
            result.DATA_ENUM = buildDataEnum(project);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_FUNCS_DECL") !== -1) {
            result.DATA_FUNCS_DECL = buildDataFuncsDecl(project);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ARRAY_DECL") !== -1) {
            result.DATA_ARRAY_DECL = buildDataArrayDecl(project);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ARRAY_DEF") !== -1) {
            result.DATA_ARRAY_DEF = buildDataArrayDef(project);
        }

        resolve(result);
    });
}

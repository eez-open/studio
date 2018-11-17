import { BuildResult } from "project-editor/core/extensions";

import { ProjectStore } from "project-editor/core/store";
import { ProjectProperties } from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";

import { DataItemProperties } from "project-editor/project/features/data/data";

////////////////////////////////////////////////////////////////////////////////

function buildDataEnum(projectDataItems: DataItemProperties[]) {
    let dataItems = projectDataItems.map(
        (dataItem, i) =>
            `${projectBuild.TAB}${projectBuild.getName(
                "DATA_ID_",
                dataItem.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    dataItems.unshift(`${projectBuild.TAB}DATA_ID_NONE = 0`);

    return `enum DataEnum {\n${dataItems.join(",\n")}\n};`;
}

function buildDataFuncsDecl(projectDataItems: DataItemProperties[]) {
    let dataItems = projectDataItems.map(dataItem => {
        return `void ${projectBuild.getName(
            "data_",
            dataItem.name,
            projectBuild.NamingConvention.UnderscoreLowerCase
        )}(DataOperationEnum operation, Cursor &cursor, Value &value);`;
    });

    return dataItems.join("\n");
}

function buildDataArrayDecl() {
    return "typedef void (*DataOperationsFunction)(DataOperationEnum operation, Cursor &cursor, Value &value);\n\nextern DataOperationsFunction g_dataOperationsFunctions[];";
}

function buildDataArrayDef(projectDataItems: DataItemProperties[]) {
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

        const projectDataItems = project.data._array.filter(
            dataItem =>
                !ProjectStore.selectedBuildConfiguration ||
                !dataItem.usedIn ||
                dataItem.usedIn.indexOf(ProjectStore.selectedBuildConfiguration.name) !== -1
        );

        if (!sectionNames || sectionNames.indexOf("DATA_ENUM") !== -1) {
            result.DATA_ENUM = buildDataEnum(projectDataItems);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_FUNCS_DECL") !== -1) {
            result.DATA_FUNCS_DECL = buildDataFuncsDecl(projectDataItems);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ARRAY_DECL") !== -1) {
            result.DATA_ARRAY_DECL = buildDataArrayDecl();
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ARRAY_DEF") !== -1) {
            result.DATA_ARRAY_DEF = buildDataArrayDef(projectDataItems);
        }

        resolve(result);
    });
}

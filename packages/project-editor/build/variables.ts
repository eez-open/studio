import type { BuildResult } from "project-editor/store/features";

import { TAB, NamingConvention, getName } from "project-editor/build/helper";

import type { Variable } from "project-editor/features/variable/variable";
import type { Assets, DataBuffer } from "project-editor/build/assets";

////////////////////////////////////////////////////////////////////////////////

function buildDataEnum(projectVariables: Variable[]) {
    let variables = projectVariables.map(
        (variable, i) =>
            `${TAB}${getName(
                "DATA_ID_",
                variable,
                NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    variables.unshift(`${TAB}DATA_ID_NONE = 0`);

    return `enum DataEnum {\n${variables.join(",\n")}\n};`;
}

function buildDataFuncsDecl(projectVariables: Variable[]) {
    let variables = projectVariables.map(variable => {
        return `void ${getName(
            "data_",
            variable,
            NamingConvention.UnderscoreLowerCase
        )}(DataOperationEnum operation, const WidgetCursor &cursor, Value &value);`;
    });

    return [
        "void data_none(DataOperationEnum operation, const WidgetCursor &cursor, Value &value);"
    ]
        .concat(variables)
        .join("\n");
}

function buildDataArrayDecl() {
    return "typedef void (*DataOperationsFunction)(DataOperationEnum operation, const WidgetCursor &widgetCursor, Value &value);\n\nextern DataOperationsFunction g_dataOperationsFunctions[];";
}

function buildDataArrayDef(projectVariables: Variable[]) {
    let variables = projectVariables.map(
        variable =>
            `${TAB}${getName(
                "data_",
                variable,
                NamingConvention.UnderscoreLowerCase
            )}`
    );

    return `DataOperationsFunction g_dataOperationsFunctions[] = {\n${TAB}data_none,\n${variables.join(
        ",\n"
    )}\n};`;
}

export function buildVariables(
    assets: Assets,
    sectionNames: string[] | undefined
): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const result: any = {};

        let projectVariables = assets.globalVariables;

        if (assets.projectEditorStore.projectTypeTraits.hasFlowSupport) {
            // only native
            projectVariables = projectVariables.filter(
                variable =>
                    (assets.option == "buildFiles" ||
                        variable.id != undefined) &&
                    variable.native
            );
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ENUM") !== -1) {
            result.DATA_ENUM = buildDataEnum(projectVariables);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_FUNCS_DECL") !== -1) {
            result.DATA_FUNCS_DECL = buildDataFuncsDecl(projectVariables);
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ARRAY_DECL") !== -1) {
            result.DATA_ARRAY_DECL = buildDataArrayDecl();
        }

        if (!sectionNames || sectionNames.indexOf("DATA_ARRAY_DEF") !== -1) {
            result.DATA_ARRAY_DEF = buildDataArrayDef(projectVariables);
        }

        resolve(result);
    });
}

export function buildVariableNames(assets: Assets, dataBuffer: DataBuffer) {
    dataBuffer.writeArray(
        assets.projectEditorStore.masterProject ? assets.globalVariables : [],
        variable => {
            dataBuffer.writeString(variable.name);
        }
    );
}

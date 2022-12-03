import type { BuildResult } from "project-editor/store/features";
import { Project, BuildConfiguration } from "project-editor/project/project";
import { getName, NamingConvention, TAB } from "project-editor/build/helper";
import { Variable } from "project-editor/features/variable/variable";

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
        )}(DataOperationEnum operation, Cursor cursor, Value &value);`;
    });

    return [
        "void data_none(DataOperationEnum operation, Cursor cursor, Value &value);"
    ]
        .concat(variables)
        .join("\n");
}

function buildDataArrayDecl() {
    return "typedef void (*DataOperationsFunction)(DataOperationEnum operation, Cursor cursor, Value &value);\n\nextern DataOperationsFunction g_dataOperationsFunctions[];";
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

export function build(
    project: Project,
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined
): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const result: any = {};

        const projectVariables = project.variables.globalVariables.filter(
            variable =>
                !buildConfiguration ||
                !variable.usedIn ||
                variable.usedIn.indexOf(buildConfiguration.name) !== -1
        );
        for (const importDirective of project.settings.general.imports) {
            if (importDirective.project) {
                projectVariables.push(
                    ...importDirective.project.variables.globalVariables.filter(
                        variable =>
                            !buildConfiguration ||
                            !variable.usedIn ||
                            variable.usedIn.indexOf(buildConfiguration.name) !==
                                -1
                    )
                );
            }
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

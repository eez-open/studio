import type { BuildResult } from "project-editor/store/features";
import { Project, BuildConfiguration } from "project-editor/project/project";
import { Action } from "project-editor/features/action/action";
import { getName, NamingConvention, TAB } from "project-editor/build/helper";

////////////////////////////////////////////////////////////////////////////////

function buildActionsEnum(projectActions: Action[]) {
    let actions = projectActions.map(
        (action, i) =>
            `${TAB}${getName(
                "ACTION_ID_",
                action,
                NamingConvention.UnderscoreUpperCase
            )} = ${i + 1}`
    );

    actions.unshift(`${TAB}ACTION_ID_NONE = 0`);

    return `enum ActionsEnum {\n${actions.join(",\n")}\n};`;
}

function buildActionsFuncsDecl(projectActions: Action[]) {
    let actions = projectActions.map(action => {
        return `void ${getName(
            "action_",
            action,
            NamingConvention.UnderscoreLowerCase
        )}();`;
    });

    return actions.join("\n");
}

function buildActionsFuncsDef(projectActions: Action[]) {
    let actions = projectActions.map(action => {
        let implementationCode = action.implementation;

        if (implementationCode) {
            implementationCode = implementationCode
                .trim()
                .split("\n")
                .map(line => TAB + line)
                .join("\n");
        } else {
            implementationCode = "";
        }

        return `void ${getName(
            "action_",
            action,
            NamingConvention.UnderscoreLowerCase
        )}() {\n${implementationCode}\n}\n`;
    });

    return actions.join("\n");
}

function buildActionsArrayDecl() {
    return "extern ActionExecFunc g_actionExecFunctions[];";
}

function buildActionsArrayDef(projectActions: Action[]) {
    let actions = projectActions.map(
        action =>
            `${TAB}${getName(
                "action_",
                action,
                NamingConvention.UnderscoreLowerCase
            )}`
    );

    return `ActionExecFunc g_actionExecFunctions[] = {\n${TAB}0,\n${actions.join(
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

        const projectActions = project.actions.filter(
            action =>
                !buildConfiguration ||
                !action.usedIn ||
                action.usedIn.indexOf(buildConfiguration.name) !== -1
        );
        for (const importDirective of project.settings.general.imports) {
            if (importDirective.project) {
                projectActions.push(
                    ...importDirective.project.actions.filter(
                        action =>
                            !buildConfiguration ||
                            !action.usedIn ||
                            action.usedIn.indexOf(buildConfiguration.name) !==
                                -1
                    )
                );
            }
        }

        if (!sectionNames || sectionNames.indexOf("ACTIONS_ENUM") !== -1) {
            result.ACTIONS_ENUM = buildActionsEnum(projectActions);
        }

        if (
            !sectionNames ||
            sectionNames.indexOf("ACTIONS_FUNCS_DECL") !== -1
        ) {
            result.ACTIONS_FUNCS_DECL = buildActionsFuncsDecl(projectActions);
        }

        if (!sectionNames || sectionNames.indexOf("ACTIONS_FUNCS_DEF") !== -1) {
            result.ACTIONS_FUNCS_DEF = buildActionsFuncsDef(projectActions);
        }

        if (
            !sectionNames ||
            sectionNames.indexOf("ACTIONS_ARRAY_DECL") !== -1
        ) {
            result.ACTIONS_ARRAY_DECL = buildActionsArrayDecl();
        }

        if (!sectionNames || sectionNames.indexOf("ACTIONS_ARRAY_DEF") !== -1) {
            result.ACTIONS_ARRAY_DEF = buildActionsArrayDef(projectActions);
        }

        resolve(result);
    });
}

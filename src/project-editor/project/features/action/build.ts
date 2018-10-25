import { BuildResult } from "project-editor/core/extensions";

import { ProjectStore } from "project-editor/core/store";
import { ProjectProperties } from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";

import { ActionProperties } from "project-editor/project/features/action/action";

////////////////////////////////////////////////////////////////////////////////

function buildActionsEnum(projectActions: ActionProperties[]) {
    let actions = projectActions.map(
        action =>
            `${projectBuild.TAB}${projectBuild.getName(
                "ACTION_ID_",
                action.name,
                projectBuild.NamingConvention.UnderscoreUpperCase
            )}`
    );

    actions.unshift(`${projectBuild.TAB}ACTION_ID_NONE`);

    return `enum ActionsEnum {\n${actions.join(",\n")}\n};`;
}

function buildActionsFuncsDef(projectActions: ActionProperties[]) {
    let actions = projectActions.map(action => {
        let implementationCode = action.implementationCode;

        if (implementationCode) {
            implementationCode = implementationCode
                .split("\n")
                .map(line => projectBuild.TAB + line)
                .join("\n");
        } else {
            implementationCode = "";
        }

        return `void ${projectBuild.getName(
            "action_",
            action.name,
            projectBuild.NamingConvention.UnderscoreLowerCase
        )}() {\n${implementationCode}\n}\n`;
    });

    return actions.join("\n");
}

function buildActionsArrayDecl() {
    return "extern ActionExecFunc g_actionExecFunctions[];";
}

function buildActionsArrayDef(projectActions: ActionProperties[]) {
    let actions = projectActions.map(
        action =>
            `${projectBuild.TAB}${projectBuild.getName(
                "action_",
                action.name,
                projectBuild.NamingConvention.UnderscoreLowerCase
            )}`
    );

    return `ActionExecFunc g_actionExecFunctions[] = {\n${projectBuild.TAB}0,\n${actions.join(
        ",\n"
    )}\n};`;
}

export function build(
    project: ProjectProperties,
    sectionNames: string[] | undefined
): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const result: any = {};

        const projectActions = (project["actions"] as ActionProperties[]).filter(
            action =>
                !ProjectStore.selectedBuildConfiguration ||
                !action.usedIn ||
                action.usedIn.indexOf(ProjectStore.selectedBuildConfiguration.name) !== -1
        );

        if (!sectionNames || sectionNames.indexOf("ACTIONS_ENUM") !== -1) {
            result.ACTIONS_ENUM = buildActionsEnum(projectActions);
        }

        if (!sectionNames || sectionNames.indexOf("ACTIONS_FUNCS_DEF") !== -1) {
            result.ACTIONS_FUNCS_DEF = buildActionsFuncsDef(projectActions);
        }

        if (!sectionNames || sectionNames.indexOf("ACTIONS_ARRAY_DECL") !== -1) {
            result.ACTIONS_ARRAY_DECL = buildActionsArrayDecl();
        }

        if (!sectionNames || sectionNames.indexOf("ACTIONS_ARRAY_DEF") !== -1) {
            result.ACTIONS_ARRAY_DEF = buildActionsArrayDef(projectActions);
        }

        resolve(result);
    });
}

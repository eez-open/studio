import { BuildResult } from "project-editor/core/extensions";

import { ProjectProperties } from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";

import { ActionProperties } from "project-editor/project/features/action/action";

////////////////////////////////////////////////////////////////////////////////

function buildActionsEnum(project: ProjectProperties) {
    let projectActions = project["actions"] as ActionProperties[];

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

function buildActionsFuncsDef(project: ProjectProperties) {
    let projectActions = project["actions"] as ActionProperties[];

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

function buildActionsArrayDecl(project: ProjectProperties) {
    return "typedef void (*ACTION)();\n\nextern ACTION actions[];";
}

function buildActionsArrayDef(project: ProjectProperties) {
    let projectActions = project["actions"] as ActionProperties[];

    let actions = projectActions.map(
        action =>
            `${projectBuild.TAB}${projectBuild.getName(
                "action_",
                action.name,
                projectBuild.NamingConvention.UnderscoreLowerCase
            )}`
    );

    return `ACTION actions[] = {\n${projectBuild.TAB}0,\n${actions.join(",\n")}\n};`;
}

export function build(project: ProjectProperties): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        resolve({
            ACTIONS_ENUM: buildActionsEnum(project),
            ACTIONS_FUNCS_DEF: buildActionsFuncsDef(project),
            ACTIONS_ARRAY_DECL: buildActionsArrayDecl(project),
            ACTIONS_ARRAY_DEF: buildActionsArrayDef(project)
        });
    });
}

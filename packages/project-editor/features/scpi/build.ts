import { camelize } from "eez-studio-shared/string";

import type {
    Project,
    BuildConfiguration
} from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";
import type { ScpiCommand } from "project-editor/features/scpi/scpi";
import type { BuildResult } from "project-editor/core/extensions";

////////////////////////////////////////////////////////////////////////////////

function cleanUpCommandName(command: ScpiCommand) {
    // replace '[<n>]' and '<n>' with '#'
    return command.name.replace(/\[\<n\>\]/g, "<n>").replace(/\<n\>/g, "#");
}

function getCommandFuncName(command: ScpiCommand) {
    let name = cleanUpCommandName(command)
        .replace(/\*/g, "core_")
        .replace(/:/g, "_")
        .replace(/\[/g, "")
        .replace(/\]/g, "")
        .replace(/\#/g, "")
        .replace(/\?/, "_Q")
        .toLowerCase();

    return "scpi_cmd_" + camelize(name);
}

function buildScpiCommandsDecl(project: Project) {
    let projectActions = project.scpi;

    let commands: string[] = [];

    projectActions.subsystems.forEach(subsystem => {
        subsystem.commands.forEach(command => {
            commands.push(
                `${projectBuild.TAB}SCPI_COMMAND("${cleanUpCommandName(
                    command
                )}", ${getCommandFuncName(command)})`
            );
        });
    });

    return `#define SCPI_COMMANDS \\\n${commands.join(" \\\n")}`;
}

export function build(
    project: Project,
    sectionNames: string[] | undefined,
    buildConfiguration: BuildConfiguration | undefined
): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const result: any = {};

        if (
            !sectionNames ||
            sectionNames.indexOf("SCPI_COMMANDS_DECL") !== -1
        ) {
            result.SCPI_COMMANDS_DECL = buildScpiCommandsDecl(project);
        }

        resolve(result);
    });
}

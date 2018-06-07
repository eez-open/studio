import { camelize } from "shared/string";

import { ProjectProperties } from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";
import { ScpiProperties, ScpiCommandProperties } from "project-editor/project/features/scpi/scpi";
import { BuildResult } from "project-editor/core/extensions";

////////////////////////////////////////////////////////////////////////////////

function cleanUpCommandName(command: ScpiCommandProperties) {
    // replace '[<n>]' and '<n>' with '#'
    return command.name.replace(/\[\<n\>\]/g, "<n>").replace(/\<n\>/g, "#");
}

function getCommandFuncName(command: ScpiCommandProperties) {
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

function buildScpiCommandsDecl(project: ProjectProperties) {
    let projectActions = (project as any).scpi as ScpiProperties;

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

export function build(project: ProjectProperties): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        resolve({
            SCPI_COMMANDS_DECL: buildScpiCommandsDecl(project)
        });
    });
}

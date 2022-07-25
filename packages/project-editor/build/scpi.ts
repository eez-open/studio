import { camelize } from "eez-studio-shared/string";

import type {
    Project,
    BuildConfiguration
} from "project-editor/project/project";
import { TAB } from "project-editor/build/helper";
import type { ScpiCommand } from "project-editor/features/scpi/scpi";
import type { BuildResult } from "project-editor/store/features";

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
    let commands: string[] = [];

    project.scpi.subsystems.forEach(subsystem => {
        subsystem.commands.forEach(command => {
            commands.push(
                `${TAB}SCPI_COMMAND("${cleanUpCommandName(
                    command
                )}", ${getCommandFuncName(command)})`
            );
        });
    });

    return `#define SCPI_COMMANDS \\\n${commands.join(" \\\n")}`;
}

export function buildScpi(
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

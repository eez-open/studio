import { camelize } from "eez-studio-shared/string";

import { isReferenced } from "eez-studio-shared/model/search";
import { OutputSectionsStore } from "eez-studio-shared/model/store";
import * as output from "eez-studio-shared/model/output";

import { Project } from "project-editor/project/project";
import * as projectBuild from "project-editor/project/build";
import { Scpi, ScpiCommand } from "project-editor/project/features/scpi/scpi";
import { BuildResult } from "project-editor/core/extensions";

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
    let projectActions = (project as any).scpi as Scpi;

    let commands: string[] = [];

    projectActions.subsystems._array.forEach(subsystem => {
        subsystem.commands._array.forEach(command => {
            commands.push(
                `${projectBuild.TAB}SCPI_COMMAND("${cleanUpCommandName(
                    command
                )}", ${getCommandFuncName(command)})`
            );
        });
    });

    return `#define SCPI_COMMANDS \\\n${commands.join(" \\\n")}`;
}

export function build(project: Project, sectionNames: string[] | undefined): Promise<BuildResult> {
    return new Promise((resolve, reject) => {
        const result: any = {};

        // warn about enum not used in the project
        const scpi = (project as any).scpi as Scpi;
        const enums = scpi.enums;
        for (const scpiEnum of enums._array) {
            if (!isReferenced(scpiEnum)) {
                OutputSectionsStore.write(
                    output.Section.OUTPUT,
                    output.Type.WARNING,
                    `enum not used in the project`,
                    scpiEnum
                );
            }
        }

        if (!sectionNames || sectionNames.indexOf("SCPI_COMMANDS_DECL") !== -1) {
            result.SCPI_COMMANDS_DECL = buildScpiCommandsDecl(project);
        }

        resolve(result);
    });
}

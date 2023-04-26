import { _map } from "eez-studio-shared/algorithm";
import { underscore } from "eez-studio-shared/string";
import { formatNumber } from "eez-studio-shared/util";
import { EezObject } from "project-editor/core/object";
import { ProjectEditor } from "project-editor/project-editor-interface";
import { Project } from "project-editor/project/project";

export const TAB = "    ";

export enum NamingConvention {
    UnderscoreUpperCase,
    UnderscoreLowerCase
}

export function getName<
    T extends EezObject & {
        name: string;
    }
>(
    prefix: string,
    objectOrName: T | string,
    namingConvention: NamingConvention
) {
    let name;
    if (typeof objectOrName == "string") {
        name = objectOrName;
    } else {
        const objectName = objectOrName.name;

        const objectProject = ProjectEditor.getProject(objectOrName);
        const rootProject = objectProject._store.project;
        if (objectProject != rootProject) {
            const visitedProjects = new Set<Project>();

            function findImportDirective(
                project: Project,
                accumulatedPrefix: string
            ): string | undefined {
                if (visitedProjects.has(project)) {
                    return undefined;
                }
                visitedProjects.add(project);
                for (const importDirective of project.settings.general
                    .imports) {
                    if (importDirective.project) {
                        const importDirectivePrefix = importDirective.importAs
                            ? importDirective.importAs + "_"
                            : "";

                        if (importDirective.project == objectProject) {
                            return importDirective.importAs
                                ? accumulatedPrefix +
                                      importDirectivePrefix +
                                      objectName
                                : objectName;
                        } else {
                            const name = findImportDirective(
                                importDirective.project,
                                accumulatedPrefix + importDirectivePrefix
                            );

                            if (name) {
                                return name;
                            }
                        }
                    }
                }

                return undefined;
            }

            name = findImportDirective(rootProject, "");
        }

        if (!name) {
            name = objectName;
        }
    }
    name = name.replace(/[^a-zA-Z_0-9]/g, " ");

    if (namingConvention == NamingConvention.UnderscoreUpperCase) {
        name = underscore(name).toUpperCase();
    } else if (namingConvention == NamingConvention.UnderscoreLowerCase) {
        name = underscore(name).toLowerCase();
    }

    name = prefix + name;

    return name;
}

export function dumpData(data: number[] | Buffer) {
    const NUMBERS_PER_LINE = 16;
    let result = "";
    _map(data, value => "0x" + formatNumber(value, 16, 2)).forEach(
        (value, index) => {
            if (result.length > 0) {
                result += ",";
            }
            if (index % NUMBERS_PER_LINE == 0) {
                result += "\n" + TAB;
            } else {
                result += " ";
            }
            result += value;
        }
    );
    result += "\n";
    return result;
}

export function indent(tab: string, text: string) {
    return text
        .split("\n")
        .map(line => tab + line)
        .join("\n");
}

export function escapeCString(text: string) {
    return `"${text
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t")
        .replace(/\r/g, "\\r")}"`;
}

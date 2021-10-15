import type { Project } from "project-editor/project/project";

export function metrics(project: Project): { [key: string]: string | number } {
    return {
        SCPI: "",
        "<span class='td-indent'>Commands</span>":
            project.scpi.subsystems.reduce(
                (c, s) => c + s.commands.reduce(c => c + 1, 0),
                0
            )
    };
}

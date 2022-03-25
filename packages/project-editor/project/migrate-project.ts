import { visitObjects } from "project-editor/core/search";
import { updateObject } from "project-editor/store";
import { RectangleWidget } from "project-editor/flow/components/widgets";
import {
    Project,
    ProjectType,
    ProjectVersion
} from "project-editor/project/project";

////////////////////////////////////////////////////////////////////////////////

export function migrateProjectVersion(
    project: Project,
    newProjectVersion: ProjectVersion
) {
    if (
        newProjectVersion != "v1" &&
        newProjectVersion != "v2" &&
        (project.settings.general.projectVersion == "v1" ||
            project.settings.general.projectVersion == "v2")
    ) {
        // from v1 or v2 to v3 or newer
        migrateRectangleWidgetToV3(project);
    } else if (
        (newProjectVersion == "v1" || newProjectVersion == "v2") &&
        project.settings.general.projectVersion != "v1" &&
        project.settings.general.projectVersion != "v2"
    ) {
        // from v3 or newer to v1 or v2
        migrateRectangleWidgetToV2(project);
    }
}

function getRectangleWidgets(project: Project) {
    const rectangleWidgets: RectangleWidget[] = [];
    const v = visitObjects(project);
    while (true) {
        let visitResult = v.next();
        if (visitResult.done) {
            break;
        }
        if (visitResult.value instanceof RectangleWidget) {
            rectangleWidgets.push(visitResult.value);
        }
    }
    return rectangleWidgets;
}

function migrateRectangleWidgetToV3(project: Project) {
    getRectangleWidgets(project).forEach(rectangleWidget => {
        if (
            rectangleWidget.invertColors == undefined ||
            rectangleWidget.invertColors == false
        ) {
            if (rectangleWidget.style) {
                if (rectangleWidget.style.color != undefined) {
                    updateObject(rectangleWidget.style, {
                        backgroundColor: rectangleWidget.style.color
                    });
                    updateObject(rectangleWidget.style, {
                        color: undefined
                    });
                } else if (rectangleWidget.style.inheritFrom == "default") {
                    updateObject(rectangleWidget.style, {
                        inheritFrom: "default_inverse"
                    });
                } else if (
                    rectangleWidget.style.inheritFrom == "default_inverse"
                ) {
                    updateObject(rectangleWidget.style, {
                        inheritFrom: "default"
                    });
                } else {
                    console.log(
                        "migrateRectangleWidgetToV3",
                        rectangleWidget.style
                    );
                }
            }
            updateObject(rectangleWidget, {
                invertColors: undefined
            });
        }
    });
}

function migrateRectangleWidgetToV2(project: Project) {
    getRectangleWidgets(project).forEach(rectangleWidget => {
        updateObject(rectangleWidget, {
            invertColors: true
        });
    });
}

////////////////////////////////////////////////////////////////////////////////

export function migrateProjectType(
    project: Project,
    newProjectType: ProjectType,
    newFlowSupport: boolean
) {
    project.enableTabs(newProjectType, newFlowSupport);
}

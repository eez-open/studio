import { visitObjects } from "project-editor/core/search";
import { updateObject } from "project-editor/store";
import { RectangleWidget } from "project-editor/flow/components/widgets/eez-gui";
import {
    Project,
    ProjectType,
    ProjectVersion
} from "project-editor/project/project";
import { ProjectEditor } from "project-editor/project-editor-interface";

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
    for (const object of visitObjects(project)) {
        if (object instanceof RectangleWidget) {
            rectangleWidgets.push(object);
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
                } else if (rectangleWidget.style.useStyle == "default") {
                    updateObject(rectangleWidget.style, {
                        useStyle: "default_inverse"
                    });
                } else if (
                    rectangleWidget.style.useStyle == "default_inverse"
                ) {
                    updateObject(rectangleWidget.style, {
                        useStyle: "default"
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

function removeFlowSupport(project: Project) {
    const projectStore = project._store;

    project.actions.forEach(action => {
        if (action.implementationType != "native") {
            // remove all components
            projectStore.deleteObjects(action.components);

            // remove all connection lines
            projectStore.deleteObjects(action.connectionLines);

            // remove all local variables
            projectStore.deleteObjects(action.localVariables);

            // remove all user properties
            projectStore.deleteObjects(action.userProperties);

            // set as native
            projectStore.updateObject(action, {
                implementationType: "native"
            });
        }
    });

    project.pages.forEach(page => {
        // remove all action components
        projectStore.deleteObjects(
            page.components.filter(
                component =>
                    component instanceof ProjectEditor.ActionComponentClass
            )
        );

        // remove all connection lines
        projectStore.deleteObjects(page.connectionLines);

        // remove all local variables
        projectStore.deleteObjects(page.localVariables);

        // remove all user properties
        projectStore.deleteObjects(page.userProperties);

        if (projectStore.projectTypeTraits.isLVGL) {
            // set all event handlers for LVGL widgets to "action"
            page._lvglWidgets.forEach(lvglWidget => {
                lvglWidget.eventHandlers.forEach(eventHandler => {
                    if (eventHandler.handlerType == "flow") {
                        projectStore.updateObject(eventHandler, {
                            handlerType: "action"
                        });
                    }
                });
            });
        }
    });

    // remove timeline in widgets
    for (const object of visitObjects(project)) {
        if (object instanceof ProjectEditor.WidgetClass) {
            if (object.timeline.length > 0) {
                projectStore.updateObject(object, {
                    timeline: []
                });
            }
        }
    }

    // set all globalVariables as native
    project.variables.globalVariables.forEach(globalVariable => {
        if (!globalVariable.native) {
            projectStore.updateObject(globalVariable, {
                native: true
            });
        }
    });

    // remove all structures
    projectStore.deleteObjects(project.variables.structures);

    if (projectStore.projectTypeTraits.isLVGL) {
        // remove all enums
        projectStore.deleteObjects(project.variables.enums);
    }
}

////////////////////////////////////////////////////////////////////////////////

export function migrateProjectType(
    project: Project,
    newProjectType: ProjectType,
    newFlowSupport: boolean
) {
    project.enableTabs(newProjectType, newFlowSupport);

    if (newFlowSupport != undefined) {
        if (project.settings.general.flowSupport && !newFlowSupport) {
            removeFlowSupport(project);
        }
    }
}

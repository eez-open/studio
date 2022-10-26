import { visitObjects } from "project-editor/core/search";
import { updateObject } from "project-editor/store";
import { RectangleWidget } from "project-editor/flow/components/widgets";
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

function removeFlowSupport(project: Project) {
    const projectEditorStore = project._DocumentStore;

    project.actions.forEach(action => {
        if (action.implementationType != "native") {
            // remove all components
            projectEditorStore.deleteObjects(action.components);

            // remove all connection lines
            projectEditorStore.deleteObjects(action.connectionLines);

            // remove all local variables
            projectEditorStore.deleteObjects(action.localVariables);

            // set as native
            projectEditorStore.updateObject(action, {
                implementationType: "native"
            });
        }
    });

    project.pages.forEach(page => {
        // remove all action components
        projectEditorStore.deleteObjects(
            page.components.filter(
                component =>
                    component instanceof ProjectEditor.ActionComponentClass
            )
        );

        // remove all connection lines
        projectEditorStore.deleteObjects(page.connectionLines);

        // remove all local variables
        projectEditorStore.deleteObjects(page.localVariables);

        if (projectEditorStore.projectTypeTraits.isLVGL) {
            // set all event handlers for LVGL widgets to "action"
            page._lvglWidgets.forEach(lvglWidget => {
                lvglWidget.eventHandlers.forEach(eventHandler => {
                    if (eventHandler.handlerType == "flow") {
                        projectEditorStore.updateObject(eventHandler, {
                            handlerType: "action"
                        });
                    }
                });
            });
        }
    });

    // set all globalVariables as native
    project.variables.globalVariables.forEach(globalVariable => {
        if (!globalVariable.native) {
            projectEditorStore.updateObject(globalVariable, {
                native: true
            });
        }
    });

    // remove all structures
    projectEditorStore.deleteObjects(project.variables.structures);

    if (projectEditorStore.projectTypeTraits.isLVGL) {
        // remove all enums
        projectEditorStore.deleteObjects(project.variables.enums);
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

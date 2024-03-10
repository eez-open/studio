import { visitObjects } from "project-editor/core/search";
import { Project } from "project-editor/project/project";
import { LVGLStylesDefinition } from "project-editor/lvgl/style-definition";
import { lvglPropertiesMap } from "project-editor/lvgl/style-catalog";
import { updateObject } from "project-editor/store";

export function migrateLvglVersion(
    project: Project,
    newLvglVersion: "8.3" | "9.0"
) {
    if (project.settings.general.lvglVersion == newLvglVersion) {
        return;
    }

    // remove style properties that doesn't exists in the new lvgl version
    for (const object of visitObjects(project)) {
        if (object instanceof LVGLStylesDefinition) {
            if (object.definition) {
                let newDefinition = object.definition;

                Object.keys(object.definition).forEach(part => {
                    Object.keys(object.definition[part]).forEach(state => {
                        Object.keys(object.definition[part][state]).forEach(
                            propertyName => {
                                const propertyInfo =
                                    lvglPropertiesMap.get(propertyName);
                                if (
                                    !propertyInfo ||
                                    propertyInfo.lvglStyleProp.code[
                                        newLvglVersion
                                    ] == undefined
                                ) {
                                    newDefinition =
                                        LVGLStylesDefinition.removePropertyFromDefinitionByName(
                                            newDefinition,
                                            propertyName,
                                            part,
                                            state
                                        ) ?? {};
                                }
                            }
                        );
                    });
                });

                if (newDefinition != object.definition) {
                    updateObject(object, {
                        definition: newDefinition
                    });
                }
            }
        }
    }
}

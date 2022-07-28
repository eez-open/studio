import { getProperty } from "project-editor/core/object";
import type { ProjectEditorStore } from "project-editor/store";
import { ProjectEditor } from "project-editor/project-editor-interface";

export function getAllMetrics(projectEditorStore: ProjectEditorStore) {
    let allMetrics: any = {};

    const project = projectEditorStore.project;
    let projectFeatures = ProjectEditor.extensions;
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.metrics &&
            getProperty(project, projectFeature.key)
        ) {
            let featureMetrics = projectFeature.metrics(project);
            allMetrics = Object.assign(allMetrics, featureMetrics);
        }
    }

    return allMetrics;
}

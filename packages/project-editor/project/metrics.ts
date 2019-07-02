import { getProperty } from "project-editor/core/object";
import { ProjectStore } from "project-editor/core/store";
import { getExtensionsByCategory } from "project-editor/core/extensions";

export function getAllMetrics() {
    let allMetrics: any = {};

    const project = ProjectStore.project;
    let projectFeatures = getExtensionsByCategory("project-feature");
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.eezStudioExtension.implementation.projectFeature.metrics &&
            getProperty(
                project,
                projectFeature.eezStudioExtension.implementation.projectFeature.key
            )
        ) {
            let featureMetrics = projectFeature.eezStudioExtension.implementation.projectFeature.metrics(
                project
            );
            allMetrics = Object.assign(allMetrics, featureMetrics);
        }
    }

    return allMetrics;
}

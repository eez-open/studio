import { getProperty } from "project-editor/core/object";
import { getProjectFeatures } from "project-editor/core/extensions";
import { DocumentStoreClass } from "project-editor/core/store";

export function getAllMetrics(DocumentStore: DocumentStoreClass) {
    let allMetrics: any = {};

    const project = DocumentStore.project;
    let projectFeatures = getProjectFeatures();
    for (let projectFeature of projectFeatures) {
        if (
            projectFeature.eezStudioExtension.implementation.projectFeature
                .metrics &&
            getProperty(
                project,
                projectFeature.eezStudioExtension.implementation.projectFeature
                    .key
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

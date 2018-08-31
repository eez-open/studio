import { IExtensionDefinition } from "shared/extensions/extension";
import { renderActivityViewerSection } from "activity-viewer/section";

const activityViewerExtension: IExtensionDefinition = {
    preInstalled: true,

    homeSections: [
        {
            id: "activity-viewer",
            title: "Activity Viewer",
            icon: "material:",
            render: renderActivityViewerSection
        }
    ],

    activityLogTools: [
        {
            id: "activity-viewer/export",
            title: "Export selected history items",
            icon: "material:save",
            isEnabled: () => true,
            handler: () => {}
        }
    ]
};

export default activityViewerExtension;

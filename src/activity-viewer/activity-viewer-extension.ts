import { IExtensionDefinition, IActivityLogController } from "shared/extensions/extension";
import { renderActivityViewerSection } from "activity-viewer/section";
import { exportActivityLogItems } from "activity-viewer/export";

const activityViewerExtension: IExtensionDefinition = {
    preInstalled: true,

    homeSections: [
        {
            id: "activity-viewer",
            title: "Activity Viewer",
            icon: "material:view_list",
            render: renderActivityViewerSection
        }
    ],

    activityLogTools: [
        {
            id: "activity-viewer/export",
            title: "Export selected history items",
            icon: "material:save",
            isEnabled: (controller: IActivityLogController) => controller.selection.length > 0,
            handler: (controller: IActivityLogController) => {
                exportActivityLogItems(controller.selection);
            }
        }
    ]
};

export default activityViewerExtension;

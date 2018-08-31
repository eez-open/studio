"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const section_1 = require("activity-viewer/section");
const activityViewerExtension = {
    preInstalled: true,
    homeSections: [
        {
            id: "activity-viewer",
            title: "Activity Viewer",
            icon: "material:",
            render: section_1.renderActivityViewerSection
        }
    ],
    activityLogTools: [
        {
            id: "activity-viewer/export",
            title: "Export selected history items",
            icon: "material:save",
            isEnabled: () => true,
            handler: () => { }
        }
    ]
};
exports.default = activityViewerExtension;
//# sourceMappingURL=activity-viewer-extension.js.map
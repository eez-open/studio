import { PropertyType } from "project-editor/core/object";
import type { ProjectEditorFeature } from "project-editor/store/features";

import { Page } from "project-editor/features/page/page";

////////////////////////////////////////////////////////////////////////////////

const feature: ProjectEditorFeature = {
    name: "eezstudio-project-feature-user-widget",
    version: "0.1.0",
    description: "User widgets support for your project",
    author: "EEZ",
    authorLogo: "../eez-studio-ui/_images/eez_logo.png",
    displayName: "User Widgets",
    mandatory: true,
    key: "userWidgets",
    type: PropertyType.Array,
    typeClass: Page,
    icon: "svg:user_widgets",
    create: () => []
};

export default feature;

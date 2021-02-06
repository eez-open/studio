import React from "react";

import { ProjectStoreClass } from "project-editor/project/project";

export const ProjectContext = React.createContext<ProjectStoreClass>(
    undefined as any
);
